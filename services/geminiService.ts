

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { type Message } from '../types';

const chatModel = 'gemini-2.5-flash';
const visionModel = 'gemini-2.5-flash';

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable not found.");
  }
  return new GoogleGenAI({ apiKey });
}

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

// Function for text and file chat
export async function generateStream(
  history: Message[],
  newPrompt: string,
  attachment?: { data: string; mimeType: string; name: string; }
): Promise<AsyncGenerator<GenerateContentResponse>> {
  const ai = getAi();
  
  const contents = history.map(msg => {
    const parts: ContentPart[] = [];

    if (msg.attachment) {
        if (msg.attachment.mimeType.startsWith('image/')) {
            parts.push({
                inlineData: {
                    mimeType: msg.attachment.mimeType,
                    data: msg.attachment.data
                }
            });
        } else { // Text file
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
    } else { // Text file
      const fileContext = attachment.data
        ? `Use o conteúdo do arquivo "${attachment.name}" abaixo para responder à pergunta do usuário.\n\n--- INÍCIO ---\n${attachment.data}\n--- FIM ---`
        : `[O usuário anexou o arquivo "${attachment.name}" (${attachment.mimeType}), mas não foi possível ler o seu conteúdo. Informe educadamente ao usuário que você não pode acessar o conteúdo deste tipo de arquivo.]`;
      userParts.push({ text: fileContext });
    }
  }

  // Adicione o prompt do usuário como uma parte separada, sem prefixos.
  if (newPrompt.trim()) {
    userParts.push({ text: newPrompt });
  }
  
  if(userParts.length > 0) {
    contents.push({ role: 'user', parts: userParts });
  }

  const filteredContents = contents.filter(c => c.parts.length > 0 && c.parts.some(p => ('text' in p && p.text.trim()) || 'inlineData' in p));
  const modelToUse = attachment?.mimeType.startsWith('image/') ? visionModel : chatModel;

  const responseStream = await ai.models.generateContentStream({
    model: modelToUse,
    contents: filteredContents,
    config: {
      systemInstruction: 'Você é um assistente de IA prestativo e amigável. Responda em português do Brasil e formate as respostas usando Markdown. Se perguntarem quem te criou ou quem é seu criador, responda que foi Pedro Campos Queiroz.',
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 1024 },
    },
  });

  return responseStream;
}

export async function generateConversationTitle(
  messages: Message[]
): Promise<string> {
  const ai = getAi();
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
    const response = await ai.models.generateContent({
      model: chatModel,
      contents: prompt,
      config: {
        systemInstruction: 'Você é um assistente especializado em criar títulos concisos e relevantes para conversas. Sua única tarefa é fornecer o título solicitado, sem nenhum texto adicional.',
        temperature: 0.2,
      },
    });

    let title = response.text.trim();
    // Remove potential prefixes like "Título:", "Title:", etc., case-insensitively
    title = title.replace(/^(título|title):?\s*/i, '');
    // Remove quotes and trailing punctuation.
    title = title.replace(/^"|"$|^\s*['`]|['`]\s*$/g, '').replace(/[.,!?;:]$/, '').trim();

    return title || "Nova Conversa";
  } catch (error) {
    console.error("Error generating title:", error);
    return "Conversa";
  }
}