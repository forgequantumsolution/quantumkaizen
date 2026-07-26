import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppNotification } from '@/stores/notificationStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  type: AppNotification['type'];
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: ApiNotification[];
  unreadCount: number;
}

// Deep-link a notification to its entity where we know the route.
const linkFor = (n: ApiNotification): string | undefined =>
  n.entityType === 'ticket' && n.entityId ? `/tickets/${n.entityId}` : undefined;

/** Map the API shape onto the store's AppNotification shape. */
export const toAppNotification = (n: ApiNotification): AppNotification => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.body ?? '',
  entityType: n.entityType ?? undefined,
  entityId: n.entityId ?? undefined,
  link: linkFor(n),
  isRead: n.isRead,
  createdAt: n.createdAt,
});

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const notificationKeys = { all: ['notifications'] as const };

export const useNotifications = () =>
  useQuery<NotificationsResponse>({
    queryKey: notificationKeys.all,
    queryFn: () => api.get('/notifications').then((r) => r.data),
    // Poll so escalations/hand-offs surface without a manual refresh.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.post(`/notifications/${id}/read`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: () => api.post('/notifications/read-all').then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
};
