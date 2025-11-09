
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

// Function for text and image chat
export async function generateStream(
  history: Message[],
  newPrompt: string,
  image?: { data: string; mimeType: string; }
): Promise<AsyncGenerator<GenerateContentResponse>> {
  const ai = getAi();
  
  const contents = history.map(msg => {
    const parts: ContentPart[] = [];
    if (msg.role === 'user' && msg.image) {
        parts.push({
            inlineData: {
                mimeType: msg.image.mimeType,
                data: msg.image.data
            }
        });
    }
    if (msg.content) {
      parts.push({ text: msg.content });
    }
    return { role: msg.role, parts };
  });

  const userParts: ContentPart[] = [];
  if (image) {
    userParts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }
  if (newPrompt) {
    userParts.push({ text: newPrompt });
  }
  
  contents.push({ role: 'user', parts: userParts });

  const filteredContents = contents.filter(c => c.parts.length > 0);

  const responseStream = await ai.models.generateContentStream({
    model: image ? visionModel : chatModel,
    contents: filteredContents,
    config: {
      systemInstruction: 'Você é um assistente de IA prestativo e amigável. Responda em português do Brasil e formate as respostas usando Markdown. Se perguntarem quem te criou ou quem é seu criador, responda que foi Pedro Campos Queiroz.',
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
        if (msg.image) {
            contentText = `[IMAGEM] ${contentText}`.trim();
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
