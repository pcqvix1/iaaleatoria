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
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  isTyping?: boolean;
}

export type Theme = 'light' | 'dark';

// FIX: Exported the AspectRatio type to be used in the ImageGenerationModal.
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface User {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
}