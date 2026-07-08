import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { Conflict, NotFound } from '../../lib/httpError';
import { invalidatePermissionCache } from '../../middleware/permissions';
import { computeEffectiveWithSources } from '../../lib/effective-permissions';
import { writeTrail } from '../audit/compliance.service';
import type {
  CreateUserInput,
  ListQuery,
  ResetPasswordInput,
  SetOverridesInput,
  UpdateUserInput,
} from './user.schema';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  phone: true,
  designation: true,
  isActive: true,
  joinDate: true,
  lastLoginAt: true,
  avatarUrl: true,
  locale: true,
  timezone: true,
  departmentId: true,
  roleId: true,
  siteId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, code: true, name: true } },
  role: { select: { id: true, name: true } },
  site: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, name: true, email: true } },
} as const;

const computeName = (data: { name?: string; firstName?: string | null; lastName?: string | null }, fallback = 'Unnamed User') => {
  if (data.name && data.name.trim()) return data.name.trim();
  const first = data.firstName?.trim() ?? '';
  const last = data.lastName?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  return combined || fallback;
};

export const list = async ({ page, pageSize, search, departmentId, roleId, siteId, isActive }: ListQuery) => {
  const where: Prisma.UserWhereInput = {
    ...(departmentId && { departmentId }),
    ...(roleId && { roleId }),
    ...(siteId && { siteId }),
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicSelect,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const getById = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!user) throw NotFound('User not found');
  return user;
};

/**
 * Lightweight people directory for assignment pickers (Lead Auditor, Approver,
 * team members, CAPA owner, …). Returns just id/name/designation for active
 * users. Unlike the admin `list`, this is readable by ANY authenticated user —
 * picking a colleague to assign work to isn't a user-admin capability, and
 * gating it behind `user.read` would empty every people-picker for operational
 * roles (e.g. auditors) that legitimately need it.
 */
export const directory = async (siteIds: string[] | null = null) => {
  const items = await prisma.user.findMany({
    where: {
      isActive: true,
      // null → caller may see every site (viewAll); otherwise limit to their site(s).
      ...(siteIds ? { siteId: { in: siteIds } } : {}),
    },
    // Enough for any assignment picker: name/email to display + role/department/
    // site to group, filter and label by (LMS bulk-assign, reports, etc.).
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      employeeId: true,
      roleId: true,
      departmentId: true,
      siteId: true,
      role: { select: { id: true, name: true } },
      department: { select: { id: true, code: true, name: true } },
      site: { select: { id: true, code: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
  return { items };
};

export const create = async (input: CreateUserInput) => {
  const conflictCheck: Prisma.UserWhereInput[] = [{ email: input.email }];
  if (input.employeeId) conflictCheck.push({ employeeId: input.employeeId });
  const existing = await prisma.user.findFirst({
    where: { OR: conflictCheck },
    select: { id: true, email: true, employeeId: true },
  });
  if (existing) {
    throw Conflict(
      existing.email === input.email
        ? 'Email already in use'
        : 'Employee ID already in use',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const name = computeName(input);

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      employeeId: input.employeeId ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      name,
      phone: input.phone ?? null,
      designation: input.designation ?? null,
      departmentId: input.departmentId ?? null,
      roleId: input.roleId ?? null,
      siteId: input.siteId ?? null,
      managerId: input.managerId ?? null,
      joinDate: input.joinDate ?? null,
      locale: input.locale,
      timezone: input.timezone,
      isActive: input.isActive ?? true,
    },
    select: publicSelect,
  });
};

export const update = async (id: string, input: UpdateUserInput) => {
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, employeeId: true, firstName: true, lastName: true, name: true },
  });
  if (!current) throw NotFound('User not found');

  if (input.email && input.email !== current.email) {
    const e = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (e && e.id !== id) throw Conflict('Email already in use');
  }
  if (input.employeeId && input.employeeId !== current.employeeId) {
    const e = await prisma.user.findUnique({
      where: { employeeId: input.employeeId },
      select: { id: true },
    });
    if (e && e.id !== id) throw Conflict('Employee ID already in use');
  }

  const merged = {
    name: input.name,
    firstName: input.firstName === undefined ? current.firstName : input.firstName,
    lastName: input.lastName === undefined ? current.lastName : input.lastName,
  };
  const recomputedName = computeName(merged, current.name);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      email: input.email,
      employeeId: input.employeeId,
      firstName: input.firstName,
      lastName: input.lastName,
      name: recomputedName,
      phone: input.phone,
      designation: input.designation,
      departmentId: input.departmentId,
      roleId: input.roleId,
      siteId: input.siteId,
      managerId: input.managerId,
      joinDate: input.joinDate,
      locale: input.locale,
      timezone: input.timezone,
      isActive: input.isActive,
    },
    select: publicSelect,
  });
  if (input.roleId !== undefined) invalidatePermissionCache(id);
  return updated;
};

export const resetPassword = async (id: string, { password }: ResetPasswordInput) => {
  await getById(id);
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
};

export const deactivate = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw NotFound('User not found');
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: publicSelect,
  });
  invalidatePermissionCache(id);
  return updated;
};

// Raw override rows for a user (permissionId + key + effect + reason) — lets the
// UI edit overrides directly (sources[] only carries keys, not ids).
const overrideRows = async (userId: string) => {
  const rows = await prisma.userPermission.findMany({
    where: { userId },
    select: {
      permissionId: true,
      effect: true,
      reason: true,
      permission: { select: { key: true } },
    },
  });
  return rows.map((r) => ({
    permissionId: r.permissionId,
    key: r.permission.key,
    effect: r.effect,
    reason: r.reason,
  }));
};

/**
 * GET /api/users/:id/permissions — the effective permission set for a user plus
 * the source breakdown (role / department / grants / denies) and the raw
 * override rows. Powers the Access Analysis + User matrix (plan §6.3).
 */
export const getPermissions = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw NotFound('User not found');
  const resolved = await computeEffectiveWithSources(id);
  return { ...resolved, overrides: await overrideRows(id) };
};

/**
 * PUT /api/users/:id/permissions — set the user's override list to EXACTLY the
 * provided payload. Upserts each (user, permission) row and deletes any override
 * not present. Records grantedById on every row, invalidates the user's cache,
 * and writes a GxP audit-trail entry with the before→after override diff.
 */
export const setOverrides = async (
  id: string,
  data: SetOverridesInput,
  actorUserId?: string,
) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw NotFound('User not found');

  // Reject duplicate permissionIds in the payload (unique row per permission).
  const ids = data.overrides.map((o) => o.permissionId);
  if (new Set(ids).size !== ids.length) {
    throw Conflict('Duplicate permissionId in overrides payload');
  }

  const before = await overrideRows(id);

  await prisma.$transaction([
    // Delete overrides not present in the payload.
    prisma.userPermission.deleteMany({
      where: { userId: id, permissionId: { notIn: ids.length ? ids : ['__none__'] } },
    }),
    // Upsert each desired override (unique on userId+permissionId).
    ...data.overrides.map((o) =>
      prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: id, permissionId: o.permissionId } },
        create: {
          userId: id,
          permissionId: o.permissionId,
          effect: o.effect,
          reason: o.reason ?? null,
          grantedById: actorUserId ?? null,
        },
        update: {
          effect: o.effect,
          reason: o.reason ?? null,
          grantedById: actorUserId ?? null,
        },
      }),
    ),
  ]);

  invalidatePermissionCache(id);

  const after = await overrideRows(id);
  const fmt = (rows: typeof before) =>
    rows.map((r) => `${r.effect}:${r.key}`).sort().join(', ') || '(none)';
  await writeTrail(
    {
      entityType: 'User',
      entityId: id,
      action: 'UPDATE',
      field: 'permissionOverrides',
      oldValue: fmt(before),
      newValue: fmt(after),
      reason: data.overrides.find((o) => o.reason)?.reason ?? null,
    },
    actorUserId,
  );

  const resolved = await computeEffectiveWithSources(id);
  return { ...resolved, overrides: after };
};
