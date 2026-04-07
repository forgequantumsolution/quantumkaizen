import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentItem {
  id: string;
  label: string;
  path: string;
  type: string;
  visitedAt: string;
}

interface RecentItemsState {
  items: RecentItem[];
  addItem: (item: Omit<RecentItem, 'visitedAt'>) => void;
  clearItems: () => void;
}

export const useRecentItemsStore = create<RecentItemsState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const now = new Date().toISOString();
        const existing = get().items.filter((i) => i.path !== item.path);
        set({ items: [{ ...item, visitedAt: now }, ...existing].slice(0, 8) });
      },
      clearItems: () => set({ items: [] }),
    }),
    { name: 'qk-recent-items' }
  )
);
