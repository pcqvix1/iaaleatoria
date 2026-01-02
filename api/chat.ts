
import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const apiKey = process.env.API_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;
const groqKey = process.env.GROQ_API_KEY;

// Initialize Google Gemini Client
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
    // 1. GOOGLE GEMINI MODELS
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
        const chunkData = JSON.stringify({
          text: chunk.text,
          candidates: chunk.candidates,
          usageMetadata: chunk.usageMetadata
        });
        res.write(chunkData + delimiter);
      }
    } 
    // ==================================================================================
    // 2. OPENAI-COMPATIBLE MODELS (OpenRouter & Groq)
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

      // --- HYBRID GROUNDING LOGIC FOR NON-GEMINI MODELS ---
      // If the user requested Google Search (via config.tools), we use Gemini to fetch context first.
      let groundingContext = '';
      let groundingMetadata = null;

      if (config?.tools && config.tools.some((t: any) => t.googleSearch)) {
         if (ai) {
             try {
                // Extract the last user message to use as the search query
                const lastUserMessage = contents
                    .slice()
                    .reverse()
                    .find((c: any) => c.role === 'user');
                
                const searchQuery = lastUserMessage?.parts?.[0]?.text || '';
                
                if (searchQuery) {
                    const searchResult = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: [{ role: 'user', parts: [{ text: searchQuery }] }],
                        config: { tools: [{ googleSearch: {} }] }
                    });
                    
                    if (searchResult.candidates && searchResult.candidates.length > 0) {
                        groundingMetadata = searchResult.candidates[0].groundingMetadata;
                        // The text returned by Gemini when using search is often a grounded summary.
                        // We use this as high-quality context.
                        groundingContext = searchResult.text || '';
                    }
                }
             } catch (e) {
                 console.error("Grounding fetch failed:", e);
                 // Proceed without grounding on error
             }
         }
      }

      // --- Configuration Selection ---
      if (model.includes('deepseek') || model.includes('openrouter')) {
          // OpenRouter
          if (!openRouterKey) throw new Error('API Key do OpenRouter não configurada.');
          
          apiUrl = "https://openrouter.ai/api/v1/chat/completions";
          apiToken = openRouterKey;
          targetModel = "deepseek/deepseek-r1-0528:free";
          
          // Required OpenRouter Headers
          headers["HTTP-Referer"] = "https://gemini-gpt-clone.vercel.app";
          headers["X-Title"] = "Gemini GPT Clone";

      } else if (model === 'openai/gpt-oss-20b' || model.includes('groq')) {
          // Groq
          if (!groqKey) throw new Error('API Key do Groq não configurada.');
          
          apiUrl = "https://api.groq.com/openai/v1/chat/completions";
          apiToken = groqKey;
          targetModel = "openai/gpt-oss-20b";
          
          // Parâmetros específicos do Groq conforme solicitado
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

      // Insert System Instruction if exists
      if (config?.systemInstruction) {
        messages.unshift({ role: 'system', content: config.systemInstruction });
      }

      // Insert Grounding Context if we fetched it
      if (groundingContext) {
          const groundingSystemMessage = `
INFORMAÇÃO DE PESQUISA EM TEMPO REAL (GOOGLE):
Abaixo estão informações obtidas via Google Search para ajudar a responder a solicitação do usuário.
Use estas informações como fonte de verdade para fatos atuais.

--- INÍCIO DA PESQUISA ---
${groundingContext}
--- FIM DA PESQUISA ---
`;
          // Inject as a system message right before the latest messages or at the top
          messages.splice(messages.length - 1, 0, { role: 'system', content: groundingSystemMessage });
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

      // If we have grounding metadata from the hybrid step, send it in the first chunk
      if (groundingMetadata) {
          const metaChunk = JSON.stringify({
              text: '', // No text yet
              candidates: [{ groundingMetadata: groundingMetadata }] // Just metadata for the frontend to render sources
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
                        let textChunk = '';

                        // Handle Reasoning (common in DeepSeek/O1-style models)
                        const reasoning = delta.reasoning_content || delta.reasoning;
                        
                        if (reasoning) {
                            textChunk += `> ${reasoning}`; 
                        }

                        if (delta.content) {
                            textChunk += delta.content;
                        }

                        if (textChunk) {
                            const chunkData = JSON.stringify({
                                text: textChunk,
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
