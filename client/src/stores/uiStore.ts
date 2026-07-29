import { create } from 'zustand';

// Per-user sidebar accordion state, keyed by NavGroup.key (never by title —
// titles are admin-editable). The DB carries each group's `defaultOpen`, which
// seeds the initial value; whatever the user toggles afterwards is theirs and
// persists here, so an admin's default never fights a user's own choice on
// every reload. Versioned key so a shape change can't read stale JSON.
const NAV_GROUPS_KEY = 'qk_ui_nav_groups_open_v1';

const readOpenState = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(NAV_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeOpenState = (state: Record<string, boolean>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — ignore */
  }
};

interface UIState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  darkMode: boolean;
  /** groupKey → open. Absent means "use the group's defaultOpen". */
  navGroupsOpen: Record<string, boolean>;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleDarkMode: () => void;
  toggleNavGroup: (groupKey: string, defaultOpen: boolean) => void;
  setNavGroupOpen: (groupKey: string, open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  sidebarOpen: false,
  darkMode: false,
  navGroupsOpen: readOpenState(),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

  toggleNavGroup: (groupKey, defaultOpen) =>
    set((state) => {
      const current = state.navGroupsOpen[groupKey] ?? defaultOpen;
      const next = { ...state.navGroupsOpen, [groupKey]: !current };
      writeOpenState(next);
      return { navGroupsOpen: next };
    }),

  setNavGroupOpen: (groupKey, open) =>
    set((state) => {
      if (state.navGroupsOpen[groupKey] === open) return state;
      const next = { ...state.navGroupsOpen, [groupKey]: open };
      writeOpenState(next);
      return { navGroupsOpen: next };
    }),
}));
