
import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import { type Message, type ImagePart, type AspectRatio } from '../types';

const chatModel = 'gemini-2.5-flash';
const imageEditModel = 'gemini-2.5-flash-image';
const imageGenerationModel = 'imagen-4.0-generate-001';

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable not found.");
  }
  return new GoogleGenAI({ apiKey });
}

// Function for text chat and image analysis
export async function generateStream(
  history: Message[],
  newPrompt: string,
  image?: ImagePart | null
): Promise<AsyncGenerator<GenerateContentResponse>> {
  const ai = getAi();
  
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
    model: chatModel,
    contents: filteredContents,
    config: {
      systemInstruction: 'Você é um assistente de IA prestativo e amigável. Responda em português do Brasil e formate as respostas usando Markdown. Se perguntarem quem te criou ou quem é seu criador, responda que foi Pedro Campos Queiroz.',
    },
  });

  return responseStream;
}

// Function for image editing
export async function editImage(prompt: string, image: ImagePart): Promise<ImagePart> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: imageEditModel,
    contents: {
      parts: [
        {
          inlineData: {
            data: image.base64,
            mimeType: image.mimeType,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`A edição da imagem falhou. Motivo: ${candidate.finishReason}`);
  }

  const editedImagePart = candidate?.content?.parts?.find(part => part.inlineData);
  if (editedImagePart?.inlineData) {
    return {
      base64: editedImagePart.inlineData.data,
      mimeType: editedImagePart.inlineData.mimeType || 'image/png',
    };
  }
  
  console.error('Falha na edição de imagem, resposta da API:', JSON.stringify(response, null, 2));
  throw new Error('Não foi possível editar a imagem. A resposta da API não continha uma imagem.');
}

// Function for image generation
export async function generateImage(prompt: string, aspectRatio: AspectRatio): Promise<ImagePart> {
  const ai = getAi();
  const response = await ai.models.generateImages({
    model: imageGenerationModel,
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: aspectRatio,
      outputMimeType: 'image/png',
    },
  });

  const generatedImage = response.generatedImages?.[0];
  if (generatedImage?.image) {
    return {
      base64: generatedImage.image.imageBytes,
      mimeType: generatedImage.image.mimeType || 'image/png',
    };
  }
  
  console.error('Falha na geração de imagem, resposta da API:', JSON.stringify(response, null, 2));
  // The generateImages response does not provide a structured `finishReason`. 
  // We throw a generic but informative error after logging the response.
  throw new Error('Não foi possível gerar a imagem. Verifique se o seu prompt está de acordo com as políticas de segurança.');
}


export async function generateConversationTitle(
  messages: Message[]
): Promise<string> {
  const ai = getAi();
  const context = messages
    .slice(0, 2)
    .map(msg => `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`)
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
