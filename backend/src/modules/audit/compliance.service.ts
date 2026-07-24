import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound, Unauthorized } from '../../lib/httpError';
import { verifyPassword } from '../../lib/password';
import { recordAudit } from '../../lib/audit';
import { criticalityFor, moduleFor } from '../../lib/audit-scope';

export interface TrailInput {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'TRANSITION' | 'SIGN' | 'DELETE' | 'SCORE';
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
}

/**
 * Append an immutable audit-trail entry.
 *
 * Thin wrapper kept for the existing call sites; new code should call
 * `recordAudit` directly and hand it the surrounding transaction. Identity,
 * provenance and the hash chain now come from `lib/audit`, so the explicit
 * `userId` argument is only a fallback for callers with no request context.
 *
 * This used to swallow write failures to protect the business operation. It no
 * longer does: a silently dropped entry makes the system claim a completeness
 * it does not have, which is the more serious of the two failures.
 */
export const writeTrail = async (input: TrailInput, userId?: string): Promise<void> => {
  await recordAudit(
    {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      field: input.field ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      reason: input.reason ?? null,
      // Derived from the same registry the interceptor uses, so hand-written
      // and automatic entries are filterable and classifiable alike — otherwise
      // manual entries are invisible to a module or criticality filter.
      module: moduleFor(input.entityType),
      criticality: criticalityFor(input.entityType),
    },
    { userId },
  );
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
