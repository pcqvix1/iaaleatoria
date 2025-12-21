
import { type Conversation, type User } from '../types';

const API_BASE_URL = '/api';
const CURRENT_USER_KEY = 'currentUser';
const AUTH_TOKEN_KEY = 'authToken';

export const authService = {
  getAuthHeaders() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  },

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

    const { user, token } = await response.json();
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
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

    const { user, token } = await response.json();
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return user;
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

    const { user, token } = await response.json();
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return user;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
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
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ newPassword, currentPassword }), // userId removed from body, implied by token
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao atualizar a senha.');
    }
  },

  async deleteAccount(userId: string): Promise<void> {
      const response = await fetch(`${API_BASE_URL}/delete-account`, {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
          // Body empty, ID from token
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

  async getUserConversations(): Promise<Conversation[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      
      if (response.status === 401) {
          await this.logout();
          throw new Error('Sessão expirada');
      }

      if (!response.ok) {
        throw new Error('Não foi possível buscar as conversas.');
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      return [];
    }
  },

  async saveUserConversations(conversations: Conversation[]): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/conversations`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ conversations }), // userId removed, implied by token
        });
    } catch (error) {
        console.error("Failed to save conversations:", error);
    }
  },
};
