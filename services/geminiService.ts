import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import { type Message, type AspectRatio } from '../types';

const chatModel = 'gemini-2.5-flash';
const visionModel = 'gemini-2.5-flash';
const imageEditModel = 'gemini-2.5-flash-image';

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
    if (msg.role === 'user' && msg.attachment && msg.attachment.mimeType.startsWith('image/')) {
        parts.push({
            inlineData: {
                mimeType: msg.attachment.mimeType,
                data: msg.attachment.data
            }
        });
    }
    if (msg.content) {
      parts.push({ text: msg.content });
    }
    return { role: msg.role, parts };
  });

  const userParts: ContentPart[] = [];
  let finalUserPrompt = newPrompt;

  if (attachment) {
    if (attachment.mimeType.startsWith('image/')) {
      userParts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data,
        },
      });
    } else if (attachment.data) { 
      finalUserPrompt = `O usuário anexou um arquivo chamado "${attachment.name}". O conteúdo do arquivo está abaixo, entre os separadores. Analise o conteúdo e responda à pergunta do usuário.\n\n--- INÍCIO DO ARQUIVO ---\n${attachment.data}\n--- FIM DO ARQUIVO ---\n\nPergunta do usuário: ${newPrompt}`;
    } else { 
      finalUserPrompt = `${newPrompt}\n\n[O usuário anexou o arquivo "${attachment.name}" (${attachment.mimeType}), mas não foi possível ler o seu conteúdo. Informe educadamente ao usuário que você não pode acessar o conteúdo deste tipo de arquivo e que ele pode tentar com arquivos de texto simples (como .txt, .md, .csv) ou copiar e colar o texto do documento na conversa.]`;
    }
  }

  if (finalUserPrompt) {
    userParts.push({ text: finalUserPrompt });
  }
  
  contents.push({ role: 'user', parts: userParts });

  const filteredContents = contents.filter(c => c.parts.length > 0);
  const modelToUse = attachment?.mimeType.startsWith('image/') ? visionModel : chatModel;

  const responseStream = await ai.models.generateContentStream({
    model: modelToUse,
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

export async function generateCanvasContent(prompt: string, type: 'code' | 'latex'): Promise<string> {
    const ai = getAi();
    let systemInstruction = '';
    
    if (type === 'code') {
        systemInstruction = "Você é um especialista em programação. Gere apenas o código para o pedido do usuário. Determine a linguagem a partir do prompt. Não inclua explicações, apenas o bloco de código bruto em markdown. Exemplo: ```python...```.";
    } else if (type === 'latex') {
        systemInstruction = "Você é um especialista em LaTeX. Gere apenas o código de um documento LaTeX completo e executável para o pedido do usuário. Não inclua explicações, apenas o código LaTeX bruto dentro de um bloco de código markdown. Exemplo: ```latex...```.";
    }

    try {
        const response = await ai.models.generateContent({
            model: chatModel,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.1,
            },
        });
        return response.text;
    } catch (error) {
        console.error(`Error generating canvas content for type ${type}:`, error);
        throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export async function generateImageForCanvas(
  prompt: string,
  aspectRatio: AspectRatio, // This can be used in the future if the API supports it
): Promise<string> {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
        model: imageEditModel,
        contents: {
            parts: [{ text: prompt }],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    const firstPart = response.candidates?.[0]?.content?.parts?.[0];
    if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
        return firstPart.inlineData.data;
    }
    throw new Error('Nenhuma imagem foi gerada. A resposta pode ter sido bloqueada.');
  } catch(error) {
      console.error("Error generating image for canvas:", error);
      throw new Error(`Falha ao gerar imagem: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export async function editImageWithMask(
  baseImage: { data: string; mimeType: string },
  mask: { data: string }, // Mask is a base64 png
  prompt: string
): Promise<string> {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
        model: imageEditModel,
        contents: {
            parts: [
                { inlineData: { data: baseImage.data, mimeType: baseImage.mimeType } },
                { text: prompt },
                { inlineData: { data: mask.data, mimeType: 'image/png' } },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    const firstPart = response.candidates?.[0]?.content?.parts?.[0];
    if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
        return firstPart.inlineData.data;
    }
    throw new Error('Nenhuma imagem foi retornada da edição. A resposta pode ter sido bloqueada.');
  } catch(error) {
    console.error("Error editing image with mask:", error);
    throw new Error(`Falha ao editar imagem: ${error instanceof Error ? error.message : String(error)}`);
  }
}