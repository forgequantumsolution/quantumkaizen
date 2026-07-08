import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import { Conflict, Unauthorized } from '../../lib/httpError';
import { computeEffectivePermissions } from '../../lib/effective-permissions';
import type { LoginInput, RegisterInput } from './auth.schema';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  designation: true,
  isActive: true,
  departmentId: true,
  roleId: true,
  siteId: true,
  createdAt: true,
  updatedAt: true,
  site: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  role: {
    select: {
      id: true,
      name: true,
      permissions: { select: { key: true } },
    },
  },
} satisfies Prisma.UserSelect;

type RawUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * Shape the public user payload and attach the flattened effective-permission
 * list. Permissions come from the shared resolver (role ∪ department ∪ user
 * GRANT − user DENY, SUPER_ADMIN → all) so /login and /me never drift from the
 * route guard. Existing users (no dept grants / overrides) resolve identically.
 */
const flatten = async (user: RawUser) => {
  const { role, site, ...rest } = user;
  const permissions = [...(await computeEffectivePermissions(user.id))];
  // Sites the user may see/switch in the navbar. viewAll holders (admins) get
  // every active site; everyone else is pinned to their own assigned site.
  const canViewAll = permissions.includes('site.view_all');
  const allowedSites = canViewAll
    ? await prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      })
    : site
      ? [site]
      : [];
  return {
    ...rest,
    site: site ?? null,
    allowedSites,
    role: role ? { id: role.id, name: role.name } : null,
    permissions,
  };
};

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email already in use');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      departmentId: input.departmentId,
      roleId: input.roleId,
    },
    select: publicUserSelect,
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { user: await flatten(user), token };
};

export const loginUser = async (input: LoginInput) => {
  const dbUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (!dbUser || !dbUser.isActive) throw Unauthorized('Invalid credentials');

  const ok = await verifyPassword(input.password, dbUser.passwordHash);
  if (!ok) throw Unauthorized('Invalid credentials');

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: publicUserSelect,
  });
  if (!user) throw Unauthorized('Invalid credentials');

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { user: await flatten(user), token };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  return user ? await flatten(user) : null;
};
