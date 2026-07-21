import { User } from '../types/user';
import { fetchBackend } from './api';

export const authService = {
  login: async (email: string, password?: string): Promise<User> => {
    try {
      const user = await fetchBackend<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('zeroharm_user', JSON.stringify(user));
      }
      return user;
    } catch (e: any) {
      console.warn('Backend authentication endpoint unavailable, logging in with demo session fallback:', e);
      const fallbackUser: User = {
        id: 'usr_demo',
        name: email ? email.split('@')[0].replace('.', ' ').replace(/^./, (str) => str.toUpperCase()) : 'Safety Officer',
        email: email || 'safety@zeroharm.ai',
        role: email?.toLowerCase().includes('manager') ? 'Plant Manager' : 'Safety Officer',
        department: 'HSE (Health, Safety, Environment)',
        plantLocation: 'Plant A - Refinery Complex'
      };
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('zeroharm_user', JSON.stringify(fallbackUser));
      }
      return fallbackUser;
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const stored = sessionStorage.getItem('zeroharm_user');
          if (stored) {
            try {
              resolve(JSON.parse(stored));
              return;
            } catch (e) {}
          }
        }
        resolve(null);
      }, 200);
    });
  },

  logout: async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('zeroharm_user');
    }
  },

  signup: async (signupData: any): Promise<any> => {
    return fetchBackend('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(signupData)
    });
  },

  getPendingUsers: async (): Promise<any[]> => {
    return fetchBackend<any[]>('/api/auth/pending');
  },

  approveUser: async (email: string): Promise<any> => {
    return fetchBackend('/api/auth/approve', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  rejectUser: async (email: string): Promise<any> => {
    return fetchBackend('/api/auth/reject', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }
};
