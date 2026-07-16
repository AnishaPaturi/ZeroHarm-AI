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
        if (user) {
          resolve(user);
        } else {
          // Allow login for custom emails
          resolve({
            id: 'usr_custom',
            name: email.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
            email: email,
            role: 'Site Engineer',
            department: 'Production Operations',
            plantLocation: 'Plant A - Refinery Complex'
          });
        }
      }, 800);
    });
  },

  getCurrentUser: async (): Promise<User | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_USERS['safety@zeroharm.ai']); // default mock session
      }, 200);
    });
  }
};
