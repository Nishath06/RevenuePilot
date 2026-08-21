import { api } from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  register: async (name: string, email: string, phone: string, password: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/register', { name, email, phone, password });
    return res.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};
