import { create } from 'zustand';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
}

interface NotificationStore {
  toasts: ToastNotification[];
  addToast: (message: string, type: ToastNotification['type']) => void;
  removeToast: (id: string) => void;
}

export const useNotifications = create<NotificationStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = `toast_${Date.now()}`;
    const newToast: ToastNotification = { id, message, type, timestamp: new Date().toISOString() };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  }
}));
