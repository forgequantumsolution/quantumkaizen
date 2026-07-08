import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The active Site selected in the navbar. Drives ticket-list filtering: it's
 * passed as `?siteId=` to the tickets API (the server ignores it if the user
 * isn't allowed to see that site — the selection can never widen access).
 *
 * `null` = "All Sites" (only meaningful for users who hold `site.view_all`).
 * The Header reconciles this against the user's allowed sites on load, so a
 * persisted id from another session/user is dropped if out of scope.
 */
interface SiteState {
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      selectedSiteId: null,
      setSelectedSiteId: (id) => set({ selectedSiteId: id }),
    }),
    { name: 'qk-site' },
  ),
);
