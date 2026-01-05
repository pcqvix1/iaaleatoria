
export type Role = 'user' | 'model';

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id:string;
  role: Role;
  content: string;
  attachment?: {
    data: string; // base64 encoded string
    mimeType: string;
    name: string;
  };
  groundingChunks?: GroundingChunk[];
  reasoning?: string; // Stores the Chain of Thought/Reasoning content
}

export type ModelId = 'gemini-2.5-flash' | 'deepseek/deepseek-r1-0528:free' | 'openai/gpt-oss-120b';
export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  isTyping?: boolean;
  systemInstruction?: string;
  modelId?: ModelId; // O modelo selecionado para esta conversa
}

export type Theme = 'light' | 'dark';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface User {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
}
