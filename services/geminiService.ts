
import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import { type Message, type ImagePart, type AspectRatio } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. Please set the environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const chatModel = 'gemini-2.5-flash';
const imageEditModel = 'gemini-2.5-flash-image';
const imageGenerationModel = 'imagen-4.0-generate-001';

// Function for text chat and image analysis
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

  const editedImagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
  if (editedImagePart?.inlineData) {
    return {
      base64: editedImagePart.inlineData.data,
      mimeType: editedImagePart.inlineData.mimeType || 'image/png', // Default to png if not provided
    };
  }
  throw new Error('Não foi possível editar a imagem.');
}

// Function for image generation
export async function generateImage(prompt: string, aspectRatio: AspectRatio): Promise<ImagePart> {
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
  throw new Error('Não foi possível gerar a imagem.');
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
      model: chatModel,
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
