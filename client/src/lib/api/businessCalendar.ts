/**
 * Phase 3 — BusinessCalendar admin API client.
 *
 * Endpoints (gated by `business-calendar.*` permissions):
 *   GET    /business-calendars                       (?search, ?includeDeleted, ?withPolicyCount)
 *   POST   /business-calendars
 *   GET    /business-calendars/:id                   (always includes policyCount)
 *   PATCH  /business-calendars/:id
 *   DELETE /business-calendars/:id                   (200 w/ affectedPolicies OR 204)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayHours {
  start: string; // "HH:MM" 24h
  end: string;
}

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WeeklySchedule = Partial<Record<WeekDay, DayHours | null>>;

export interface BusinessCalendar {
  id: string;
  name: string;
  timezone: string;
  weeklySchedule: WeeklySchedule;
  holidays: string[]; // YYYY-MM-DD
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  /** Only set on GET /:id or list with ?withPolicyCount=true */
  policyCount?: number;
}

export interface CreateBusinessCalendarBody {
  name: string;
  timezone?: string;
  weeklySchedule: WeeklySchedule;
  holidays?: string[];
  isActive?: boolean;
}

export type UpdateBusinessCalendarBody = Partial<CreateBusinessCalendarBody>;

export interface ListCalendarsQuery {
  search?: string;
  includeDeleted?: boolean;
  withPolicyCount?: boolean;
}

export interface DeleteCalendarResult {
  affectedPolicies: number;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const calendarKeys = {
  all: ['business-calendars'] as const,
  list: (q: ListCalendarsQuery) => ['business-calendars', 'list', q] as const,
  detail: (id: string) => ['business-calendars', 'detail', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useCalendars = (q: ListCalendarsQuery = {}) =>
  useQuery<BusinessCalendar[]>({
    queryKey: calendarKeys.list(q),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (q.search) params.search = q.search;
      if (q.includeDeleted) params.includeDeleted = 'true';
      if (q.withPolicyCount) params.withPolicyCount = 'true';
      return api.get('/business-calendars', { params }).then((r) => r.data);
    },
  });

export const useCalendar = (id: string | undefined) =>
  useQuery<BusinessCalendar>({
    queryKey: calendarKeys.detail(id ?? ''),
    queryFn: () => api.get(`/business-calendars/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateCalendar = () => {
  const qc = useQueryClient();
  return useMutation<BusinessCalendar, unknown, CreateBusinessCalendarBody>({
    mutationFn: (body) => api.post('/business-calendars', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarKeys.all }),
  });
};

export const useUpdateCalendar = (id: string) => {
  const qc = useQueryClient();
  return useMutation<BusinessCalendar, unknown, UpdateBusinessCalendarBody>({
    mutationFn: (body) =>
      api.patch(`/business-calendars/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
};

/**
 * Soft-delete a calendar. The backend returns 204 when no SLA policies were
 * referencing the calendar, OR 200 with `{ affectedPolicies: N }` when one or
 * more policies still point at this calendar. The mutation surfaces both
 * forms uniformly — `affectedPolicies = 0` when the backend returned 204.
 */
export const useDeleteCalendar = () => {
  const qc = useQueryClient();
  return useMutation<DeleteCalendarResult, unknown, string>({
    mutationFn: (id) =>
      api.delete(`/business-calendars/${id}`).then((r) => {
        // 204 → empty body; 200 → { affectedPolicies: N }
        if (r.status === 204 || !r.data) return { affectedPolicies: 0 };
        return r.data;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarKeys.all }),
  });
};
