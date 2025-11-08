
export type Role = 'user' | 'model';

export interface ImagePart {
  base64: string;
  mimeType: string;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  image?: ImagePart;
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

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Storing for mock purposes
}
