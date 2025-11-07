
export type Role = 'user' | 'model';

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