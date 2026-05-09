import type { Prisma } from '@prisma/client';
import { Forbidden } from '../../../lib/httpError';

type Tx = Prisma.TransactionClient;

interface ActionAccessRow {
  allowedRoles: { id: string }[];
  allowedUsers: { id: string }[];
}

/**
 * Verify that `userId` is allowed to perform the given stage-action.
 *
 * Rules:
 * - If the action has zero allowedRoles AND zero allowedUsers → open to anyone
 *   (this matches the prod default — actions without restrictions are public).
 * - Else: user is allowed iff they appear in allowedUsers OR their role is in allowedRoles.
 */
export const assertCanPerformAction = async (
  tx: Tx,
  action: ActionAccessRow,
  userId: string
): Promise<void> => {
  if (action.allowedRoles.length === 0 && action.allowedUsers.length === 0) {
    return;
  }

  if (action.allowedUsers.some((u) => u.id === userId)) return;

  if (action.allowedRoles.length > 0) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });
    const roleId = user?.roleId;
    if (roleId && action.allowedRoles.some((r) => r.id === roleId)) return;
  }

  throw Forbidden('You do not have permission to perform this action on this stage');
};
