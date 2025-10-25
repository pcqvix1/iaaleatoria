
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { type Message } from '../types';

// Assume process.env.API_KEY is available in the environment
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. Please set the environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

export async function generateStream(
  history: Message[],
  newPrompt: string
): Promise<AsyncGenerator<GenerateContentResponse>> {
  
  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    })),
    {
      role: 'user',
      parts: [{ text: newPrompt }]
    }
  ].filter(msg => msg.parts[0].text);

  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: contents,
    config: {
      systemInstruction: 'Você é um assistente de IA factual. Sua principal tarefa é responder às perguntas dos usuários baseando-se ESTRITAMENTE nas informações encontradas na Pesquisa Google. Verifique os fatos com atenção e não adicione informações que não estejam nas fontes. Se a informação não estiver disponível nos resultados da pesquisa, informe que não conseguiu encontrar a resposta. Preste muita atenção às datas para garantir que as informações sejam atuais e precisas. Responda sempre em português do Brasil e formate as respostas usando Markdown.',
      tools: [{googleSearch: {}}],
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
