
import { type Conversation, type User } from '../types';
import { v4 as uuidv4 } from 'uuid';

// This is a mock service. In a real app, you'd make API calls to your backend.
// We use localStorage to simulate a persistent user session and data.

const USERS_KEY = 'chat_users';
const CURRENT_USER_KEY = 'currentUser';

// Simulate network delay
const networkDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

const getUsers = (): User[] => {
    const usersJson = localStorage.getItem(USERS_KEY);
    try {
        return usersJson ? JSON.parse(usersJson) : [];
    } catch (e) {
        return [];
    }
};

const saveUsers = (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};


export const authService = {
  async login(email: string, password: string): Promise<User | null> {
    await networkDelay(300);
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
    }
    return null;
  },

  async register(name: string, email: string, password: string): Promise<User> {
    await networkDelay(500);
    const users = getUsers();

    if (users.some(u => u.email === email)) {
        throw new Error('Já existe uma conta com este e-mail.');
    }

    const newUser: User = {
        id: uuidv4(),
        name,
        email,
        password, // NOTE: Storing plain text password only for this mock service.
    };

    users.push(newUser);
    saveUsers(users);

    // Automatically log in the new user
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    return newUser;
  },

  async logout(): Promise<void> {
    await networkDelay(300);
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser(): User | null {
    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  },

  async getUserConversations(userId: string): Promise<Conversation[]> {
    await networkDelay(500);
    const conversationsJson = localStorage.getItem(`conversations_${userId}`);
    if (conversationsJson) {
        try {
            return JSON.parse(conversationsJson);
        } catch (e) {
            console.error("Failed to parse conversations from localStorage", e);
            return [];
        }
    }
    return [];
  },

  async saveUserConversations(userId: string, conversations: Conversation[]): Promise<void> {
    // No artificial delay for saving, as it should feel instant.
    localStorage.setItem(`conversations_${userId}`, JSON.stringify(conversations));
  },
};
