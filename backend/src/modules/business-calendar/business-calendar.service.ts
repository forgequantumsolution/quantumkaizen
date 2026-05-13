/**
 * BusinessCalendar module service — CRUD only.
 *
 * Calendars are referenced by `SlaPolicy.calendarId` with `onDelete: SetNull`,
 * so soft-deleting a calendar does NOT cascade: existing policies keep their
 * `calendarId` until the admin edits them. The SLA service's
 * `assertCalendarUsable` rejects future links to deleted/inactive calendars.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import type {
  CreateBusinessCalendarInput,
  ListCalendarsQuery,
  UpdateBusinessCalendarInput,
} from './business-calendar.schema';

const baseSelect = {
  id: true,
  name: true,
  timezone: true,
  weeklySchedule: true,
  holidays: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BusinessCalendarSelect;

const baseSelectWithCount = {
  ...baseSelect,
  _count: { select: { policies: { where: { isDeleted: false } } } },
} satisfies Prisma.BusinessCalendarSelect;

export const list = async (q: ListCalendarsQuery) => {
  const where: Prisma.BusinessCalendarWhereInput = {};
  if (q.includeDeleted !== 'true') where.isDeleted = false;
  if (q.search) where.name = { contains: q.search, mode: 'insensitive' };

  if (q.withPolicyCount === 'true') {
    const rows = await prisma.businessCalendar.findMany({
      where,
      orderBy: { name: 'asc' },
      select: baseSelectWithCount,
    });
    // Flatten the _count into a top-level `policyCount` for caller convenience.
    return rows.map((r) => ({
      ...r,
      policyCount: r._count.policies,
      _count: undefined,
    }));
  }

  return prisma.businessCalendar.findMany({
    where,
    orderBy: { name: 'asc' },
    select: baseSelect,
  });
};

export const getById = async (id: string) => {
  const cal = await prisma.businessCalendar.findUnique({
    where: { id },
    select: baseSelectWithCount,
  });
  if (!cal) throw NotFound(`Business calendar ${id} not found`);
  return {
    ...cal,
    policyCount: cal._count.policies,
    _count: undefined,
  };
};

export const create = async (input: CreateBusinessCalendarInput) => {
  // Name unique; surface 409 cleanly. Revive-by-name if soft-deleted with the
  // same name — preserves history and avoids "Cannot create: name in use".
  const existing = await prisma.businessCalendar.findUnique({
    where: { name: input.name },
    select: { id: true, isDeleted: true },
  });
  if (existing && !existing.isDeleted) {
    throw Conflict(`A business calendar named "${input.name}" already exists`);
  }

  if (existing?.isDeleted) {
    return prisma.businessCalendar.update({
      where: { id: existing.id },
      data: {
        timezone: input.timezone,
        weeklySchedule: input.weeklySchedule as Prisma.InputJsonValue,
        holidays: input.holidays as Prisma.InputJsonValue,
        isActive: input.isActive,
        isDeleted: false,
      },
      select: baseSelect,
    });
  }

  return prisma.businessCalendar.create({
    data: {
      name: input.name,
      timezone: input.timezone,
      weeklySchedule: input.weeklySchedule as Prisma.InputJsonValue,
      holidays: input.holidays as Prisma.InputJsonValue,
      isActive: input.isActive,
    },
    select: baseSelect,
  });
};

export const update = async (id: string, input: UpdateBusinessCalendarInput) => {
  const existing = await prisma.businessCalendar.findUnique({
    where: { id },
    select: { id: true, name: true, isDeleted: true },
  });
  if (!existing) throw NotFound(`Business calendar ${id} not found`);
  if (existing.isDeleted) throw BadRequest('Cannot update a soft-deleted calendar');

  // Renames need a name-uniqueness check.
  if (input.name !== undefined && input.name !== existing.name) {
    const clash = await prisma.businessCalendar.findUnique({
      where: { name: input.name },
      select: { id: true, isDeleted: true },
    });
    if (clash && clash.id !== id && !clash.isDeleted) {
      throw Conflict(`A business calendar named "${input.name}" already exists`);
    }
  }

  const data: Prisma.BusinessCalendarUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.weeklySchedule !== undefined) {
    data.weeklySchedule = input.weeklySchedule as Prisma.InputJsonValue;
  }
  if (input.holidays !== undefined) data.holidays = input.holidays as Prisma.InputJsonValue;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.businessCalendar.update({
    where: { id },
    data,
    select: baseSelect,
  });
};

/**
 * Soft-delete a calendar. Returns the count of still-active SLA policies that
 * were referencing it; the caller can decide whether to warn the admin.
 */
export const softDelete = async (id: string) => {
  const existing = await prisma.businessCalendar.findUnique({
    where: { id },
    select: {
      id: true,
      isDeleted: true,
      _count: { select: { policies: { where: { isDeleted: false } } } },
    },
  });
  if (!existing) throw NotFound(`Business calendar ${id} not found`);
  if (existing.isDeleted) return { affectedPolicies: 0 }; // idempotent

  await prisma.businessCalendar.update({
    where: { id },
    data: { isDeleted: true, isActive: false },
  });

  return { affectedPolicies: existing._count.policies };
};
