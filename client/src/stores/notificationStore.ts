import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'APPROVAL_REQUEST' | 'TASK_ASSIGNED' | 'OVERDUE' | 'EXPIRING' | 'SYSTEM';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  isOpen: boolean;
  setNotifications: (n: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: AppNotification) => void;
  togglePanel: () => void;
  closePanel: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  isOpen: false,
  setNotifications: (notifications) => set({ notifications }),
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
  })),
  markAllRead: () => set((s) => ({
    notifications: s.notifications.map(n => ({ ...n, isRead: true }))
  })),
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  closePanel: () => set({ isOpen: false }),
}));
