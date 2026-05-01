import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, Forbidden, NotFound } from '../../lib/httpError';
import { invalidatePermissionCache } from '../../middleware/permissions';
import type {
  CreateRoleInput,
  ListQuery,
  SetPermissionsInput,
  UpdateRoleInput,
} from './role.schema';

const baseSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: { id: true, key: true, module: true, action: true, description: true },
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  },
  _count: { select: { users: true } },
} as const;

export const list = async ({ search }: ListQuery) => {
  const where: Prisma.RoleWhereInput = search
    ? { name: { contains: search, mode: 'insensitive' } }
    : {};
  return prisma.role.findMany({
    where,
    select: baseSelect,
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
};

export const getById = async (id: string) => {
  const role = await prisma.role.findUnique({ where: { id }, select: baseSelect });
  if (!role) throw NotFound('Role not found');
  return role;
};

export const create = async (data: CreateRoleInput) => {
  const exists = await prisma.role.findUnique({ where: { name: data.name }, select: { id: true } });
  if (exists) throw Conflict('Role name already in use');

  return prisma.role.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: {
        connect: (data.permissionIds ?? []).map((id) => ({ id })),
      },
    },
    select: baseSelect,
  });
};

export const update = async (id: string, data: UpdateRoleInput) => {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true, isSystem: true },
  });
  if (!role) throw NotFound('Role not found');

  const updated = await prisma.role.update({
    where: { id },
    data: {
      description: data.description,
      ...(data.permissionIds !== undefined && {
        permissions: { set: data.permissionIds.map((pid) => ({ id: pid })) },
      }),
    },
    select: baseSelect,
  });
  if (data.permissionIds !== undefined) invalidatePermissionCache();
  return updated;
};

export const setPermissions = async (id: string, data: SetPermissionsInput) => {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!role) throw NotFound('Role not found');

  const updated = await prisma.role.update({
    where: { id },
    data: {
      permissions: { set: data.permissionIds.map((pid) => ({ id: pid })) },
    },
    select: baseSelect,
  });
  invalidatePermissionCache();
  return updated;
};

export const remove = async (id: string) => {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { isSystem: true, _count: { select: { users: true } } },
  });
  if (!role) throw NotFound('Role not found');
  if (role.isSystem) throw Forbidden('System roles cannot be deleted');
  if (role._count.users > 0)
    throw Conflict(`Cannot delete: ${role._count.users} user(s) still assigned to this role`);
  return prisma.role.delete({ where: { id } });
};
