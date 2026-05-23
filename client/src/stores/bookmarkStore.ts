import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BookmarkState {
  ids: string[];
  isBookmarked: (id: string) => boolean;
  toggle: (id: string) => void;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      ids: [],
      isBookmarked: (id) => get().ids.includes(id),
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
    }),
    { name: 'qk_ticket_bookmarks' },
  ),
);
