
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { type Message, type ImagePart } from '../types';

// Assume process.env.API_KEY is available in the environment
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. Please set the environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

export async function generateStream(
  history: Message[],
  newPrompt: string,
  image?: ImagePart | null
): Promise<AsyncGenerator<GenerateContentResponse>> {
  
  const contents = history.map(msg => {
    const parts: any[] = [];
    if (msg.content) parts.push({ text: msg.content });
    if (msg.image) {
      parts.push({
        inlineData: {
          data: msg.image.base64,
          mimeType: msg.image.mimeType,
        },
      });
    }
    return { role: msg.role, parts };
  });

  const newUserParts: any[] = [];
  if (newPrompt) newUserParts.push({ text: newPrompt });
  if (image) {
    newUserParts.push({
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    });
  }
  
  contents.push({ role: 'user', parts: newUserParts });

  const filteredContents = contents.filter(c => c.parts.length > 0);

  const responseStream = await ai.models.generateContentStream({
    model: model,
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
  const context = messages
    .slice(0, 2)
    .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
    .join('\n\n');
    
  const prompt = `Gere um título curto e conciso (máximo 5 palavras) em português para a seguinte conversa. Responda APENAS com o título.

${context}`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    // Clean up the title by removing quotes and trailing periods.
    const title = response.text.trim().replace(/^"|"$/g, '').replace(/\.$/, '');
    return title || "Nova Conversa";
  } catch (error) {
    console.error("Error generating title:", error);
    // Return a fallback title in case of an error.
    return "Conversa sem título";
  }
}
