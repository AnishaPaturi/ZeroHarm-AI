export type UserRole = 
  | 'Safety Officer'
  | 'Plant Manager'
  | 'Site Engineer'
  | 'Compliance Officer'
  | 'Industrial Inspector';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  department: string;
  plantLocation: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
