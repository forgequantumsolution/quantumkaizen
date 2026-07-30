import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FALLBACK_NAV_GROUPS, type NavGroupConfig } from '@/config/navModules';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavGroupMember {
  id: string;
  moduleKey: string;
  sortOrder: number;
  updatedAt: string;
}

export interface NavGroup {
  id: string;
  key: string;
  title: string;
  icon: string | null;
  sortOrder: number;
  collapsible: boolean;
  defaultOpen: boolean;
  isFallback: boolean;
  isSystem: boolean;
  updatedAt: string;
  members: NavGroupMember[];
}

/** Full-document save payload — always the complete layout, never a diff. */
export interface SaveNavGroupsInput {
  baseUpdatedAt?: string | null;
  groups: Array<{
    key: string;
    title: string;
    icon?: string | null;
    collapsible: boolean;
    defaultOpen: boolean;
    isFallback: boolean;
    moduleKeys: string[];
  }>;
}

export const navGroupKeys = {
  all: ['nav-groups'] as const,
};

// ─── localStorage cache ───────────────────────────────────────────────────────
// Same reasoning as useWorkflowTypes: the sidebar's whole shape depends on this
// query, so a cold load would otherwise render an ungrouped flash for a few
// hundred ms. Persist the last good response and seed React Query with it.
// Versioned key — a shape change must not read stale JSON.
const CACHE_KEY = 'qk_cache_nav_groups_v1';

const readCache = (): { data: NavGroup[]; updatedAt: number } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: NavGroup[]; updatedAt: number };
    if (!Array.isArray(parsed?.data)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (data: NavGroup[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ data, updatedAt: Date.now() }));
  } catch {
    /* quota or private mode — ignore */
  }
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useNavGroups = () => {
  const cached = readCache();
  return useQuery<NavGroup[]>({
    queryKey: navGroupKeys.all,
    queryFn: async () => {
      const data = (await api.get('/nav-groups')).data as NavGroup[];
      writeCache(data);
      return data;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: 30_000,
  });
};

export const useSaveNavGroups = () => {
  const qc = useQueryClient();
  return useMutation<NavGroup[], unknown, SaveNavGroupsInput>({
    mutationFn: (input) => api.put('/nav-groups', input).then((r) => r.data),
    onSuccess: (data) => {
      writeCache(data);
      qc.setQueryData(navGroupKeys.all, data);
      // Other users pick the change up on their next load/refetch — the config
      // is cached, so propagation is not instant. Called out in the editor UI.
      void qc.invalidateQueries({ queryKey: navGroupKeys.all });
    },
  });
};

/**
 * Deletes a group for real, immediately — a destructive action sitting behind a
 * confirm dialog has to be durable, not queued behind the Save button. The
 * server moves the group's modules to the fallback group in the same
 * transaction, so nothing is stranded.
 */
export const useDeleteNavGroup = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/nav-groups/${id}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: navGroupKeys.all });
    },
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** The concurrency token: newest write the client has seen. */
export const maxUpdatedAt = (groups: NavGroup[]): string | null => {
  const stamps = groups.flatMap((g) => [g.updatedAt, ...g.members.map((m) => m.updatedAt)]);
  if (!stamps.length) return null;
  return stamps.reduce((a, b) => (a > b ? a : b));
};

/**
 * Normalise the query result into the shape the sidebar consumes, falling back
 * to the compiled-in layout when the API is unreachable or the table is empty.
 * Navigation must never disappear on a network blip.
 */
export const toNavGroupConfigs = (groups: NavGroup[] | undefined): NavGroupConfig[] => {
  if (!groups?.length) return FALLBACK_NAV_GROUPS;
  return [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      key: g.key,
      title: g.title,
      icon: g.icon,
      collapsible: g.collapsible,
      defaultOpen: g.defaultOpen,
      isFallback: g.isFallback,
      isSystem: g.isSystem,
      moduleKeys: [...g.members]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => m.moduleKey),
    }));
};
