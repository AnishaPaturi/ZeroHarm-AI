import { User } from '../types/user';

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
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = MOCK_USERS[email.toLowerCase().trim()];
        let loggedInUser: User;
        if (user) {
          loggedInUser = user;
        } else {
          // Allow login for custom emails
          loggedInUser = {
            id: 'usr_custom',
            name: email.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
            email: email,
            role: 'Site Engineer',
            department: 'Production Operations',
            plantLocation: 'Plant A - Refinery Complex'
          };
        }
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('zeroharm_user', JSON.stringify(loggedInUser));
        }
        resolve(loggedInUser);
      }, 800);
    });
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
  }
};
