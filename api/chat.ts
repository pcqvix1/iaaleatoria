
import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const apiKey = process.env.API_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;
const groqKey = process.env.GROQ_API_KEY;
const googleSearchKey = process.env.GOOGLE_API_KEY_SEARCH;
const googleCxId = process.env.GOOGLE_CX_ID;

// Initialize Google Gemini Client
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// --- SEARCH GROUNDING MODULE ---

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

/**
 * Realiza busca usando Google Custom Search JSON API
 */
async function performGoogleSearch(query: string): Promise<SearchResult[]> {
  if (!googleSearchKey || !googleCxId) {
    console.warn("Google Search API Key or CX ID not configured.");
    return [];
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleSearchKey}&cx=${googleCxId}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Google Search failed: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    // Normaliza os resultados
    return data.items.map((item: any) => ({
      title: item.title || 'Sem título',
      snippet: (item.snippet || '').replace(/\n/g, ' ').trim(), // Remove quebras de linha para manter limpo
      link: item.link
    }));

  } catch (error) {
    console.error("Error executing Google Search:", error);
    return [];
  }
}

/**
 * Constrói o prompt com contexto de busca (Grounding)
 */
function buildGroundedPrompt(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) return "";

  const contextText = searchResults.map(r => `Título: ${r.title}\nResumo: ${r.snippet}\nLink: ${r.link}`).join('\n\n');

  return `
INSTRUÇÕES DE GROUNDING (OBRIGATÓRIO):

- Você possui acesso a informações em tempo real fornecidas abaixo.
- Use EXCLUSIVAMENTE as informações abaixo para responder à pergunta do usuário sobre este tópico.
- NÃO invente URLs, links ou referências que não estejam na lista.
- Se a resposta não estiver explicitamente nos dados, responda: "Não encontrei informações suficientes nos resultados da busca."
- Responda de forma direta e informativa.
- Use PRIORITARIAMENTE as informações abaixo.
- Não invente fatos fora dos dados fornecidos.

DADOS DA PESQUISA:
${contextText}
`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { model, contents, config } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache, no-transform',
  });

  const delimiter = '\n__GEMINI_CHUNK__\n';

  try {
    // ==================================================================================
    // 1. GOOGLE GEMINI MODELS (Native Grounding)
    // ==================================================================================
    if (model.includes('gemini') || model.includes('veo')) {
      if (!ai) {
        throw new Error('API Key do Google não configurada.');
      }
      
      const geminiModel = model === 'gemini-3-flash-preview' ? 'gemini-2.5-flash' : model; 

      const responseStream = await ai.models.generateContentStream({
        model: geminiModel,
        contents: contents,
        config: config,
      });

      for await (const chunk of responseStream) {
        // NOTE: If Gemini starts supporting separate reasoning field in chunks, map it here.
        // Currently relying on standard text output.
        const chunkData = JSON.stringify({
          text: chunk.text,
          candidates: chunk.candidates,
          usageMetadata: chunk.usageMetadata
        });
        res.write(chunkData + delimiter);
      }
    } 
    // ==================================================================================
    // 2. OPENAI-COMPATIBLE MODELS (DeepSeek & GPT-OSS via OpenRouter/Groq)
    // ==================================================================================
    else {
      let apiUrl = '';
      let apiToken = '';
      let targetModel = model;
      const headers: Record<string, string> = {
          "Content-Type": "application/json"
      };
      
      const requestBody: any = {
          stream: true,
          temperature: config?.temperature ?? 0.7,
      };

      // --- SEARCH GROUNDING MIDDLEWARE ---
      let groundingSystemMessage = '';
      let groundingMetadata = null;

      // 1. Extração robusta da query (Junta todas as partes de texto)
      const lastUserMessage = contents
        .slice()
        .reverse()
        .find((c: any) => c.role === 'user');
      
      const searchQuery = lastUserMessage?.parts
        ?.map((p: any) => p.text || '')
        .join(' ')
        .trim() || '';

      // 2. Decisão inteligente de busca
      // DESATIVADO PARA DeepSeek e GPT-OSS para evitar alucinações de ferramentas ou uso não intencional
      const needsSearch = false; 
      /*
      // Lógica antiga (comentada):
      const needsSearch = config?.tools?.some((t: any) => t.googleSearch) || 
                          (searchQuery && /quem|quando|quanto|onde|preço|valor|cotação|lançamento|evento|202[4-9]|hoje|ontem|agora|notícia/i.test(searchQuery));
      */

      if (needsSearch && searchQuery) {
         const searchResults = await performGoogleSearch(searchQuery);
         
         if (searchResults.length > 0) {
             // Gera o prompt de contexto para o modelo ler
             groundingSystemMessage = buildGroundedPrompt(searchResults);

             // Prepara metadados JSON para o Frontend desenhar a caixa de fontes
             groundingMetadata = {
                 groundingChunks: searchResults.map(r => ({
                     web: {
                         uri: r.link,
                         title: r.title
                     }
                 }))
             };
         }
      }

      // --- Configuration Selection ---
      if (model.includes('deepseek') || model.includes('openrouter')) {
          // OpenRouter
          if (!openRouterKey) throw new Error('API Key do OpenRouter não configurada.');
          
          apiUrl = "https://openrouter.ai/api/v1/chat/completions";
          apiToken = openRouterKey;
          targetModel = "deepseek/deepseek-r1-0528:free";
          
          headers["HTTP-Referer"] = "https://iaaleatoria.vercel.app";
          headers["X-Title"] = "Gemini GPT Clone";

      } else if (model === 'openai/gpt-oss-120b' || model.includes('groq')) {
          // Groq
          if (!groqKey) throw new Error('API Key do Groq não configurada.');
          
          apiUrl = "https://api.groq.com/openai/v1/chat/completions";
          apiToken = groqKey;
          targetModel = "openai/gpt-oss-120b";
          
          requestBody.temperature = 1;
          requestBody.max_completion_tokens = 8192;
          requestBody.top_p = 1;
          requestBody.reasoning_effort = "medium";
      } else {
          throw new Error(`Provedor de modelo desconhecido para: ${model}`);
      }
      
      headers["Authorization"] = `Bearer ${apiToken}`;

      // --- Message Formatting ---
      const messages = contents.map((c: any) => {
        let content = '';
        if (Array.isArray(c.parts)) {
            content = c.parts.map((p: any) => p.text || '').join('\n');
        }
        return {
            role: c.role === 'model' ? 'assistant' : c.role,
            content: content
        };
      });

      // Insert System Instruction if exists (Lower priority)
      if (config?.systemInstruction) {
        messages.unshift({ role: 'system', content: config.systemInstruction });
      }

      // INJECT GROUNDING PROMPT (HIGHEST PRIORITY - First Item)
      // Garante que o modelo leia os dados antes de qualquer outra instrução
      if (groundingSystemMessage) {
          messages.unshift({ role: 'system', content: groundingSystemMessage });
      }
      
      // Finalize Body
      requestBody.model = targetModel;
      requestBody.messages = messages;

      // --- Request Execution ---
      const externalResponse = await fetch(apiUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!externalResponse.ok) {
         const errText = await externalResponse.text();
         throw new Error(`Provider Error (${targetModel}): ${externalResponse.status} - ${errText}`);
      }

      if (!externalResponse.body) throw new Error('Sem corpo de resposta do provedor.');

      // --- Streaming Parser (SSE) ---
      const reader = externalResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // CRUCIAL: Envia os metadados das fontes IMEDIATAMENTE antes do texto.
      if (groundingMetadata) {
          const metaChunk = JSON.stringify({
              text: '', 
              candidates: [{ 
                  groundingMetadata: groundingMetadata,
                  finishReason: null
              }] 
          });
          res.write(metaChunk + delimiter);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
            
            if (trimmedLine.startsWith('data: ')) {
                try {
                    const jsonStr = trimmedLine.slice(6);
                    const data = JSON.parse(jsonStr);
                    const delta = data.choices?.[0]?.delta;
                    
                    if (delta) {
                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                        const content = delta.content || '';

                        // We send reasoning and content separately to the frontend
                        if (reasoning || content) {
                            const chunkData = JSON.stringify({
                                text: content, // Only the final answer part
                                reasoning: reasoning, // The Chain of Thought part
                                candidates: [{ finishReason: data.choices?.[0]?.finish_reason }]
                            });
                            res.write(chunkData + delimiter);
                        }
                    }
                } catch (e) {
                    // Ignore non-json or keep-alive lines
                }
            }
        }
      }
    }

    res.end();

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.write(JSON.stringify({ error: errorMessage }) + delimiter);
    res.end();
  }
}
