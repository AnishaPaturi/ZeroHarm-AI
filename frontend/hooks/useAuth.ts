import { create } from 'zustand';
import { User, AuthState } from '../types/user';
import { authService } from '../services/auth';

interface AuthStore extends AuthState {
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (e: any) {
      set({ error: e.message || 'Initialization failed', isLoading: false });
    }
  },

  login: async (email: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.login(email, password);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Login failed', isLoading: false });
    }
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  }
}));
