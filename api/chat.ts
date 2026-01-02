
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
