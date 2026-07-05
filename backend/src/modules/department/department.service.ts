import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';
import { invalidatePermissionCache } from '../../middleware/permissions';
import { writeTrail } from '../audit/compliance.service';
import type {
  CreateDepartmentInput,
  ListQuery,
  SetPermissionsInput,
  UpdateDepartmentInput,
} from './department.schema';

const baseSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  parentId: true,
  headUserId: true,
  costCenter: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  head: { select: { id: true, name: true, email: true } },
  parent: { select: { id: true, code: true, name: true } },
  _count: { select: { users: true, children: true } },
} as const;

// Detail select adds the department's permission grants (mirrors Role). Kept
// separate from baseSelect so list/tree stay lean.
const detailSelect = {
  ...baseSelect,
  permissions: {
    select: { id: true, key: true, module: true, action: true },
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  },
} satisfies Prisma.DepartmentSelect;

export const list = async ({ page, pageSize, search, isActive, parentId }: ListQuery) => {
  const where: Prisma.DepartmentWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (parentId) where.parentId = parentId;

  const [items, total] = await Promise.all([
    prisma.department.findMany({
      where,
      select: baseSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.department.count({ where }),
  ]);
  return { items, total, page, pageSize };
};

export const tree = async () => {
  const all = await prisma.department.findMany({
    select: baseSelect,
    orderBy: { name: 'asc' },
  });
  type Node = (typeof all)[number] & { children: Node[] };
  const byId = new Map<string, Node>();
  all.forEach((d) => byId.set(d.id, { ...d, children: [] }));
  const roots: Node[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

export const getById = async (id: string) => {
  const dept = await prisma.department.findUnique({
    where: { id },
    select: detailSelect,
  });
  if (!dept) throw NotFound('Department not found');
  return dept;
};

// Replace a department's permission grants (mirrors role.setPermissions).
// Clears the whole permission cache (v1 — 30 s TTL bounds the blast radius) and
// records a GxP audit-trail entry with the before→after key diff.
export const setPermissions = async (
  id: string,
  data: SetPermissionsInput,
  actorUserId?: string,
) => {
  const dept = await prisma.department.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      permissions: { select: { key: true } },
    },
  });
  if (!dept) throw NotFound('Department not found');

  const before = dept.permissions.map((p) => p.key).sort();

  const updated = await prisma.department.update({
    where: { id },
    data: {
      permissions: { set: data.permissionIds.map((pid) => ({ id: pid })) },
    },
    select: detailSelect,
  });
  invalidatePermissionCache();

  const after = updated.permissions.map((p) => p.key).sort();
  await writeTrail(
    {
      entityType: 'Department',
      entityId: id,
      action: 'UPDATE',
      field: 'permissions',
      oldValue: before.join(', ') || '(none)',
      newValue: after.join(', ') || '(none)',
    },
    actorUserId,
  );
  return updated;
};

export const create = async (data: CreateDepartmentInput) => {
  const exists = await prisma.department.findFirst({
    where: { OR: [{ code: data.code }, { name: data.name }] },
    select: { id: true },
  });
  if (exists) throw Conflict('Code or name already in use');
  if (data.parentId) await assertParentExists(data.parentId);
  return prisma.department.create({ data, select: baseSelect });
};

export const update = async (id: string, data: UpdateDepartmentInput) => {
  await getById(id);
  if (data.parentId === id) throw Conflict('A department cannot be its own parent');
  if (data.parentId) {
    await assertParentExists(data.parentId);
    await assertNoCycle(id, data.parentId);
  }
  if (data.code || data.name) {
    const conflict = await prisma.department.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              data.code ? { code: data.code } : undefined,
              data.name ? { name: data.name } : undefined,
            ].filter(Boolean) as Prisma.DepartmentWhereInput[],
          },
        ],
      },
      select: { id: true },
    });
    if (conflict) throw Conflict('Code or name already in use');
  }
  return prisma.department.update({ where: { id }, data, select: baseSelect });
};

export const remove = async (id: string) => {
  const dept = await prisma.department.findUnique({
    where: { id },
    select: { _count: { select: { users: true, children: true } } },
  });
  if (!dept) throw NotFound('Department not found');
  if (dept._count.users > 0)
    throw Conflict(`Cannot delete: ${dept._count.users} user(s) still assigned`);
  if (dept._count.children > 0)
    throw Conflict(`Cannot delete: ${dept._count.children} sub-department(s) attached`);
  return prisma.department.delete({ where: { id } });
};

const assertParentExists = async (parentId: string) => {
  const p = await prisma.department.findUnique({ where: { id: parentId }, select: { id: true } });
  if (!p) throw NotFound('Parent department not found');
};

const assertNoCycle = async (id: string, newParentId: string) => {
  let cursor: string | null = newParentId;
  const seen = new Set<string>([id]);
  while (cursor) {
    if (seen.has(cursor)) throw Conflict('Circular hierarchy not allowed');
    seen.add(cursor);
    const next: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = next?.parentId ?? null;
  }
};
