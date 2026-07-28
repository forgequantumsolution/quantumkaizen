import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import { Conflict, Unauthorized } from '../../lib/httpError';
import { computeEffectivePermissions } from '../../lib/effective-permissions';
import { recordAudit } from '../../lib/audit';
import { syncMatrixForUser } from '../lms/lms-assign.service';
import type { LoginInput, RegisterInput } from './auth.schema';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  designation: true,
  avatarUrl: true,
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

  // Self-registration is a join too — same treatment as an admin-created user
  // (see applyTrainingMatrix in user.service.ts). Never allowed to fail signup.
  try {
    await syncMatrixForUser(user.id);
  } catch {
    // Swallowed by design: a matrix misconfiguration must not block registration.
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    sessionId: randomUUID(),
  });
  return { user: await flatten(user), token };
};

/**
 * Records a rejected authentication attempt.
 *
 * Failed logins are the events a security review looks for first, and they are
 * the ones the system never wrote down before. The attempted address is
 * recorded (it is an identifier, not a secret); the submitted password never is.
 * A miss on an unknown address is still recorded — repeated attempts against
 * addresses that do not exist is exactly the pattern worth seeing.
 */
const recordFailedLogin = async (email: string, userId: string | null, why: string) => {
  await recordAudit({
    entityType: 'User',
    entityId: userId ?? 'unknown',
    action: 'LOGIN_FAILED',
    module: 'SECURITY',
    criticality: 'CRITICAL',
    entityLabel: email,
    newValue: email,
    reason: why,
  });
};

export const loginUser = async (input: LoginInput) => {
  const dbUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (!dbUser) {
    await recordFailedLogin(input.email, null, 'No account for this address');
    throw Unauthorized('Invalid credentials');
  }
  if (!dbUser.isActive) {
    await recordFailedLogin(input.email, dbUser.id, 'Account is deactivated');
    throw Unauthorized('Invalid credentials');
  }

  const ok = await verifyPassword(input.password, dbUser.passwordHash);
  if (!ok) {
    await recordFailedLogin(input.email, dbUser.id, 'Incorrect password');
    throw Unauthorized('Invalid credentials');
  }

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: publicUserSelect,
  });
  if (!user) throw Unauthorized('Invalid credentials');

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { lastLoginAt: new Date() },
  });

  // One session id per login, carried in the token and stamped on every audit
  // entry, so a run of actions can be tied back to a single authentication.
  const sessionId = randomUUID();
  const token = signToken({
    userId: user.id,
    email: user.email,
    name: dbUser.name,
    sessionId,
  });

  // Stamped onto the context first so the LOGIN entry carries the same session
  // id as every action that follows it.
  await recordAudit(
    {
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN',
      module: 'SECURITY',
      entityLabel: user.email,
    },
    { userId: user.id, context: { sessionId, userName: dbUser.name } },
  );

  return { user: await flatten(user), token };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  return user ? await flatten(user) : null;
};
