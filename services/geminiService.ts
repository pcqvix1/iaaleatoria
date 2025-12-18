
import { type Message } from '../types';
import { API_BASE_URL } from '../config';

// We do NOT import GoogleGenAI here to avoid exposing secrets or heavy SDKs on client.
// We mock the types we need.
export interface GenerateContentResponse {
  text: () => string; 
  candidates?: any[];
  usageMetadata?: any;
}

const chatModel = 'gemini-3-flash-preview';
const visionModel = 'gemini-3-flash-preview';

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

// Function for text and file chat
export async function* generateStream(
  history: Message[],
  newPrompt: string,
  attachment?: { data: string; mimeType: string; name: string; },
  systemInstruction?: string
): AsyncGenerator<{ text: string; candidates?: any[] }> {
  
  const MAX_HISTORY = 20;
  const limitedHistory = history.length > MAX_HISTORY 
    ? history.slice(history.length - MAX_HISTORY) 
    : history;

  const contents = limitedHistory.map(msg => {
    const parts: ContentPart[] = [];

    if (msg.attachment) {
        if (msg.attachment.mimeType.startsWith('image/')) {
            parts.push({
                inlineData: {
                    mimeType: msg.attachment.mimeType,
                    data: msg.attachment.data
                }
            });
        } else { 
            let fileContext = '';
            if (msg.role === 'user' && msg.attachment.data) {
                fileContext = `Contexto de um arquivo anterior chamado "${msg.attachment.name}":\n\n--- CONTEÚDO ---\n${msg.attachment.data}\n--- FIM ---`;
            } else if (msg.role === 'user') {
                fileContext = `[O usuário tinha anexado o arquivo "${msg.attachment.name}" mas o conteúdo não foi lido.]`;
            }
            if (fileContext) {
                parts.push({ text: fileContext });
            }
        }
    }

    if (msg.content) {
      parts.push({ text: msg.content });
    }
    return { role: msg.role, parts };
  });

  const userParts: ContentPart[] = [];
  
  if (attachment) {
    if (attachment.mimeType.startsWith('image/')) {
      userParts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data,
        },
      });
    } else { 
      const fileContext = attachment.data
        ? `Use o conteúdo do arquivo "${attachment.name}" abaixo para responder à pergunta do usuário.\n\n--- INÍCIO ---\n${attachment.data}\n--- FIM ---`
        : `[O usuário anexou o arquivo "${attachment.name}" (${attachment.mimeType}), mas não foi possível ler o seu conteúdo. Informe educadamente ao usuário que você não pode acessar o conteúdo deste tipo de arquivo.]`;
      userParts.push({ text: fileContext });
    }
  }

  if (newPrompt.trim()) {
    userParts.push({ text: newPrompt });
  }
  
  if(userParts.length > 0) {
    contents.push({ role: 'user', parts: userParts });
  }

  const filteredContents = contents.filter(c => c.parts.length > 0 && c.parts.some(p => ('text' in p && p.text.trim()) || 'inlineData' in p));
  const modelToUse = attachment?.mimeType.startsWith('image/') ? visionModel : chatModel;
  
  const instruction = systemInstruction || 'Você é um assistente de IA prestativo e amigável. Responda em português do Brasil e formate as respostas usando Markdown.';

  const payload = {
    model: modelToUse,
    contents: filteredContents,
    config: {
      systemInstruction: instruction,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 1024 },
    },
  };

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro do servidor: ${response.status}`);
  }

  if (!response.body) throw new Error('ReadableStream não suportado.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const delimiter = '\n__GEMINI_CHUNK__\n';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      const parts = buffer.split(delimiter);
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;
        try {
          const chunkJson = JSON.parse(part);
          if (chunkJson.error) throw new Error(chunkJson.error);
          
          yield {
            text: chunkJson.text || '',
            candidates: chunkJson.candidates,
          };
        } catch (e) {
          console.warn('Erro ao parsear chunk:', e);
        }
      }
    }
    
    if (buffer.trim()) {
       try {
          const chunkJson = JSON.parse(buffer);
          if (chunkJson.error) throw new Error(chunkJson.error);
           yield {
            text: chunkJson.text || '',
            candidates: chunkJson.candidates,
          };
        } catch (e) {
          // Ignore incomplete json at very end
        }
    }

  } catch (error) {
    console.error("Stream reading error:", error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function generateConversationTitle(
  messages: Message[]
): Promise<string> {
  const context = messages
    .slice(0, 2)
    .map(msg => {
        let contentText = msg.content;
        if (msg.attachment) {
            contentText = `[ARQUIVO: ${msg.attachment.name}] ${contentText}`.trim();
        }
        return `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${contentText}`;
    })
    .join('\n\n');
    
  const prompt = `Analise a seguinte conversa e crie um título curto e descritivo em português, com no máximo 5 palavras. O título deve capturar a essência do assunto. Não adicione aspas nem pontuação final.

Conversa:
---
${context}
---

Título Sugerido:`;

  try {
    const stream = generateStream([], prompt);
    let title = '';
    for await (const chunk of stream) {
        title += chunk.text;
    }

    title = title.replace(/^(título|title):?\s*/i, '');
    title = title.replace(/^"|"$|^\s*['`]|['`]\s*$/g, '').replace(/[.,!?;:]$/, '').trim();

    return title || "Nova Conversa";
  } catch (error) {
    console.error("Error generating title:", error);
    return "Conversa";
  }
}
