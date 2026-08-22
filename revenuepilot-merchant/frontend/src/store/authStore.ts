import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser, authAPI } from '../services/api';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authAPI.login({ email, password });
          const { access_token, user } = res.data;
          const role = user.role || 'merchant';
          if (role !== 'merchant' && role !== 'admin') {
            throw new Error('Access denied: merchant account required');
          }
          localStorage.setItem('merchant_token', access_token);
          set({ user: { ...user, role }, token: access_token, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem('merchant_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('merchant_token');
        if (!token) { set({ isAuthenticated: false }); return; }
        try {
          const res = await authAPI.me();
          const user = res.data;
          const role = user.role || 'merchant';
          if (role !== 'merchant' && role !== 'admin') {
            get().logout();
            return;
          }
          set({ user: { ...user, role }, token, isAuthenticated: true });
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: 'merchant-auth',
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);
