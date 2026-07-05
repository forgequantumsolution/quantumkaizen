import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';

/**
 * Reverse lookup for the Access Analysis "Who can do X" view (plan §6.3 #2):
 * every subject that GRANTS a given permission key —
 *   - roles that hold the permission,
 *   - departments that hold the permission,
 *   - users with an explicit GRANT override on it.
 *
 * (User DENY overrides are subtractive and never appear here; effective access
 * via role/department membership is answered per-user by
 * GET /api/users/:id/permissions.)
 */
export const whoCan = async (permissionKey: string) => {
  const perm = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { id: true, key: true },
  });
  if (!perm) throw NotFound(`Unknown permission key: ${permissionKey}`);

  const [roles, departments, grantOverrides] = await Promise.all([
    prisma.role.findMany({
      where: { permissions: { some: { key: permissionKey } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { permissions: { some: { key: permissionKey } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.userPermission.findMany({
      where: { permission: { key: permissionKey }, effect: 'GRANT' },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return {
    permissionKey: perm.key,
    roles,
    departments,
    users: grantOverrides.map((o) => o.user),
  };
};
