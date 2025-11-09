
import { type Conversation, type User } from '../types';

// This service is now designed to communicate with a backend API.
// The frontend is ready, but you will need to build the API endpoints on Vercel.

const API_BASE_URL = '/api'; // Assuming Vercel Serverless Functions are in the /api directory

const CURRENT_USER_KEY = 'currentUser';

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // The server will return an error message in the body
      const errorData = await response.json();
      throw new Error(errorData.message || 'Falha no login.');
    }

    const user: User = await response.json();
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  },

  async register(name: string, email: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao registrar.');
    }

    const newUser: User = await response.json();
    // Automatically log in the new user
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    return newUser;
  },

  async loginWithGoogle(name: string, email: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Falha no login com Google.');
    }

    const user: User = await response.json();
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  },

  async logout(): Promise<void> {
    // In a real app, you might want to call a /api/logout endpoint
    // to invalidate a session token on the server.
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser(): User | null {
    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    try {
        return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
        return null;
    }
  },

  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      // In a real app, you would also pass an authentication token.
      const response = await fetch(`${API_BASE_URL}/conversations?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Não foi possível buscar as conversas.');
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      return [];
    }
  },

  async saveUserConversations(userId: string, conversations: Conversation[]): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // In a real app, you would also pass an authentication token.
            body: JSON.stringify({ userId, conversations }),
        });
    } catch (error) {
        console.error("Failed to save conversations:", error);
        // You might want to handle this more gracefully, e.g., notify the user.
    }
  },
};