
import { GoogleGenAI, Chat } from '@google/genai';
import { type Message } from '../types';

// Assume process.env.API_KEY is available in the environment
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. Please set the environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

export async function sendMessageStream(
  history: Message[]
): Promise<Chat> {
  const chat: Chat = ai.chats.create({
    model: model,
    history: history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
    })),
    config: {
      systemInstruction: 'Você é um assistente de IA amigável e prestativo. Você deve responder sempre em português do Brasil. Formate suas respostas usando Markdown.',
    },
  });

  return chat;
}