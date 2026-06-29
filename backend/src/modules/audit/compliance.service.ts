import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound, Unauthorized } from '../../lib/httpError';
import { verifyPassword } from '../../lib/password';

export interface TrailInput {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'TRANSITION' | 'SIGN' | 'DELETE';
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
}

/**
 * Append an immutable audit-trail entry. Best-effort: trail logging must never
 * break the underlying business operation, so failures are swallowed (logged).
 * Resolves userName from the actor id when available.
 */
export const writeTrail = async (input: TrailInput, userId?: string): Promise<void> => {
  try {
    let userName = 'system';
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      userName = u?.name ?? 'unknown';
    }
    await prisma.auditTrailEntry.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        field: input.field ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        reason: input.reason ?? null,
        userId: userId ?? null,
        userName,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[audit-trail] failed to write entry', e instanceof Error ? e.message : e);
  }
};

export const getTrail = async (entityType: string, entityId: string) => {
  const items = await prisma.auditTrailEntry.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
  return {
    data: items.map((t) => ({
      id: t.id,
      action: t.action,
      field: t.field,
      old_value: t.oldValue,
      new_value: t.newValue,
      reason: t.reason,
      user_name: t.userName,
      created_at: t.createdAt,
    })),
  };
};

export const getSignatures = async (entityType: string, entityId: string) => {
  const items = await prisma.eSignature.findMany({
    where: { entityType, entityId },
    orderBy: { signedAt: 'desc' },
  });
  return {
    data: items.map((s) => ({
      id: s.id,
      meaning: s.meaning,
      user_name: s.userName,
      signed_at: s.signedAt,
    })),
  };
};

export interface SignInput {
  entity_type: string;
  entity_id: string;
  meaning: string;
  // Credential: the user's signature PIN if enrolled, else their login password.
  credential: string;
}

/**
 * Record a 21 CFR Part 11–style e-signature. Re-authenticates the signer via
 * their enrolled signature PIN (preferred) or account password, then writes an
 * ESignature row + a SIGN audit-trail entry.
 */
export const recordSignature = async (input: SignInput, userId?: string) => {
  if (!userId) throw Unauthorized('Authentication required to sign');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, passwordHash: true, signaturePinHash: true },
  });
  if (!user) throw NotFound('User not found');

  const hash = user.signaturePinHash ?? user.passwordHash;
  if (!hash) throw BadRequest('No signature credential is configured for this account');
  const ok = await verifyPassword(input.credential, hash);
  if (!ok) throw Unauthorized('Signature credential is incorrect');

  const sig = await prisma.eSignature.create({
    data: {
      entityType: input.entity_type,
      entityId: input.entity_id,
      meaning: input.meaning,
      userId,
      userName: user.name,
    },
  });
  await writeTrail(
    {
      entityType: input.entity_type,
      entityId: input.entity_id,
      action: 'SIGN',
      newValue: input.meaning,
    },
    userId,
  );
  return { id: sig.id, meaning: sig.meaning, user_name: user.name, signed_at: sig.signedAt };
};
