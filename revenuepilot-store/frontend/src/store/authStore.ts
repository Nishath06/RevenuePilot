import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('revenuepilot_user') || 'null'),
  token: localStorage.getItem('revenuepilot_token'),
  isAuthenticated: !!localStorage.getItem('revenuepilot_token'),
  setAuth: (user, token) => {
    localStorage.setItem('revenuepilot_user', JSON.stringify(user));
    localStorage.setItem('revenuepilot_token', token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('revenuepilot_user');
    localStorage.removeItem('revenuepilot_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
