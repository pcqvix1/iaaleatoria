
import { type Conversation, type User } from '../types';
import { API_BASE_URL } from '../config';

const CURRENT_USER_KEY = 'currentUser';

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
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

  async updatePassword(userId: string, newPassword: string, currentPassword?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword, currentPassword }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao atualizar a senha.');
    }
  },

  async deleteAccount(userId: string): Promise<void> {
      const response = await fetch(`${API_BASE_URL}/delete-account`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
      });

      if (!response.ok && response.status !== 204) {
          try {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Falha ao excluir a conta.');
          } catch (e) {
              throw new Error('Falha ao excluir a conta.');
          }
      }
      await this.logout();
  },

  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
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
            body: JSON.stringify({ userId, conversations }),
        });
    } catch (error) {
        console.error("Failed to save conversations:", error);
    }
  },
};
