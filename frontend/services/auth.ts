import { User } from '../types/user';
import { fetchBackend } from './api';

const MOCK_USERS: Record<string, User> = {
  'safety@zeroharm.ai': {
    id: 'usr_1',
    name: 'Sarah Jenkins',
    email: 'safety@zeroharm.ai',
    role: 'Safety Officer',
    department: 'HSE (Health, Safety, Environment)',
    plantLocation: 'Plant A - Refinery Complex'
  },
  'manager@zeroharm.ai': {
    id: 'usr_2',
    name: 'David Vance',
    email: 'manager@zeroharm.ai',
    role: 'Plant Manager',
    department: 'Plant Operations',
    plantLocation: 'Plant A - Refinery Complex'
  },
  'inspector@zeroharm.ai': {
    id: 'usr_3',
    name: 'Marcus Brody',
    email: 'inspector@zeroharm.ai',
    role: 'Industrial Inspector',
    department: 'Compliance Auditing',
    plantLocation: 'Plant B - Chemical Storage'
  }
};

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
      throw new Error(e.message || 'Authentication failed');
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
