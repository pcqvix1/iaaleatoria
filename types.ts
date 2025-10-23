
export type Role = 'user' | 'model';

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export type Theme = 'light' | 'dark';
