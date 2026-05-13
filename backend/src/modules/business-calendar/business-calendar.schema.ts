/**
 * Zod schemas for the BusinessCalendar module.
 *
 * BusinessCalendar models per-team working hours + holidays so SLA timers
 * can advance only during business time. Schema fields match the Phase 3
 * Prisma model in `schema.prisma`.
 */
import { z } from 'zod';

/** "HH:MM" 24-hour clock. Allows 00:00 through 23:59. */
const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h, e.g. "09:30")');

/** One day's working hours, or `null` for "non-working day". */
const DayHoursSchema = z
  .object({ start: TimeStringSchema, end: TimeStringSchema })
  .nullable()
  .refine(
    (d) => !d || d.start < d.end,
    { message: 'start must be earlier than end (use 24h "HH:MM")' },
  );

/**
 * Weekly schedule. Each day key is optional; omitted = "non-working".
 * Matches Django's seeded shape: `{ mon: { start, end }, sat: null, ... }`.
 */
const WeeklyScheduleSchema = z.object({
  mon: DayHoursSchema.optional(),
  tue: DayHoursSchema.optional(),
  wed: DayHoursSchema.optional(),
  thu: DayHoursSchema.optional(),
  fri: DayHoursSchema.optional(),
  sat: DayHoursSchema.optional(),
  sun: DayHoursSchema.optional(),
});

/** ISO date "YYYY-MM-DD" — not a full timestamp; date-only. */
const HolidayDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const HolidaysSchema = z.array(HolidayDateSchema).max(366);

// ─── URL params ────────────────────────────────────────────────────────────

export const IdParamSchema = z.object({ id: z.string().uuid() });

// ─── Bodies ────────────────────────────────────────────────────────────────

export const CreateBusinessCalendarSchema = z.object({
  name: z.string().min(1).max(255),
  // IANA name (e.g. 'Asia/Kolkata'). Permissive at the Zod level since the
  // full IANA list is huge; the runtime can validate against
  // `Intl.supportedValuesOf('timeZone')` if needed.
  timezone: z.string().min(1).max(64).default('Asia/Kolkata'),
  weeklySchedule: WeeklyScheduleSchema,
  holidays: HolidaysSchema.default([]),
  isActive: z.boolean().default(true),
});

export const UpdateBusinessCalendarSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    timezone: z.string().min(1).max(64).optional(),
    weeklySchedule: WeeklyScheduleSchema.optional(),
    holidays: HolidaysSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'PATCH body must contain at least one field',
  });

// ─── Query params ──────────────────────────────────────────────────────────

export const ListCalendarsQuerySchema = z.object({
  /** Include soft-deleted rows. Default false. */
  includeDeleted: z.enum(['true', 'false']).optional(),
  /** Include the count of SLA policies referencing this calendar. Default false. */
  withPolicyCount: z.enum(['true', 'false']).optional(),
  /** Substring search on `name`. Case-insensitive. */
  search: z.string().min(1).max(100).optional(),
});

// ─── Inferred types ────────────────────────────────────────────────────────

export type CreateBusinessCalendarInput = z.infer<typeof CreateBusinessCalendarSchema>;
export type UpdateBusinessCalendarInput = z.infer<typeof UpdateBusinessCalendarSchema>;
export type ListCalendarsQuery = z.infer<typeof ListCalendarsQuerySchema>;
