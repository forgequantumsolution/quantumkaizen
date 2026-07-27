/**
 * Risk gates on quality decisions — the sharpest edge of the integration.
 *
 * Certifying a batch, or releasing a sample, while an unresolved unacceptable
 * risk sits against that product or its supplier is precisely the failure mode
 * ICH Q9 exists to prevent, and precisely what EU GMP Annex 16 asks the QP to
 * confirm has not happened. Until now nothing in the platform could see the
 * connection, because the risk lived in one module and the release in another.
 *
 * The gate is deliberately narrow. It fires only on risks that are:
 *   - linked to the record being released (or to its product/supplier),
 *   - open (not CLOSED),
 *   - at a level whose acceptance is UNACCEPTABLE,
 *   - and NOT formally accepted.
 *
 * That last clause matters: a risk somebody signed for with a benefit-risk
 * rationale is a documented decision, not an outstanding problem. Without it the
 * gate would block every release for ever and be switched off within a week.
 *
 * Override is e-signed and permission-gated rather than absent, because a hard
 * block with no escape hatch gets worked around outside the system, which is
 * worse than a recorded, attributable override.
 *
 * See docs/RISK-cross-module-integration-plan.md §D.14.
 */
import { prisma } from '../../lib/prisma';
import { Conflict } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';

export interface Blocker {
  riskNumber: string;
  title: string;
  /** Always set — a blocker is only ever produced from an UNACCEPTABLE level. */
  levelCode: string;
  entityType: string;
  entityId: string;
}

/**
 * Unaccepted unacceptable risks attached to any of the given (type, id) pairs.
 * Batched into one link query and one risk query regardless of how many
 * entities are checked — a release path must not become N round trips.
 */
export const blockingRisksFor = async (
  targets: { entityType: string; entityId: string }[],
): Promise<Blocker[]> => {
  const live = targets.filter((t) => t.entityType && t.entityId);
  if (live.length === 0) return [];

  const links = await prisma.riskLink.findMany({
    where: { OR: live.map((t) => ({ entityType: t.entityType, entityId: t.entityId })), riskId: { not: null } },
    select: { riskId: true, entityType: true, entityId: true },
  });
  if (links.length === 0) return [];

  const risks = await prisma.risk.findMany({
    where: {
      id: { in: [...new Set(links.map((l) => l.riskId as string))] },
      status: { not: 'CLOSED' },
      acceptedAt: null, // a signed-for risk is a decision, not a blocker
    },
    select: {
      id: true, riskNumber: true, title: true,
      residualLevelId: true, initialLevelId: true,
    },
  });
  if (risks.length === 0) return [];

  const levelIds = risks
    .map((r) => r.residualLevelId ?? r.initialLevelId)
    .filter((id): id is string => !!id);
  if (levelIds.length === 0) return [];

  const levels = await prisma.riskLevelDef.findMany({
    where: { id: { in: levelIds }, acceptance: 'UNACCEPTABLE' },
    select: { id: true, code: true },
  });
  const unacceptable = new Map(levels.map((l) => [l.id, l.code]));

  const linkByRisk = new Map(links.map((l) => [l.riskId as string, l]));

  return risks
    .map((r) => {
      const levelId = r.residualLevelId ?? r.initialLevelId;
      const code = levelId ? unacceptable.get(levelId) : undefined;
      if (!code) return null;
      const link = linkByRisk.get(r.id);
      return {
        riskNumber: r.riskNumber,
        title: r.title,
        levelCode: code,
        entityType: link?.entityType ?? '',
        entityId: link?.entityId ?? '',
      };
    })
    .filter((b): b is Blocker => b !== null);
};

/**
 * Refuse a release decision while unresolved unacceptable risk is attached.
 *
 * `overridden` is honoured only by callers that have already checked
 * `risk.override_gate` and captured a signature — this layer records the
 * override on the trail, it does not authorise it.
 */
export const assertReleasable = async (
  targets: { entityType: string; entityId: string }[],
  subject: { label: string; entityType: string; entityId: string },
  opts: { overridden?: boolean; overrideReason?: string | null; userId?: string } = {},
): Promise<void> => {
  const blockers = await blockingRisksFor(targets);
  if (blockers.length === 0) return;

  const list = blockers.map((b) => `${b.riskNumber} (${b.levelCode})`).join(', ');

  if (opts.overridden) {
    await writeTrail(
      {
        entityType: subject.entityType,
        entityId: subject.entityId,
        action: 'UPDATE',
        field: 'risk_gate_override',
        newValue: list,
        reason:
          opts.overrideReason?.trim() ||
          `Released despite ${blockers.length} unresolved unacceptable risk(s): ${list}`,
      },
      opts.userId,
    );
    return;
  }

  throw Conflict(
    `${subject.label} cannot be released: ${blockers.length} unresolved unacceptable ` +
      `risk${blockers.length === 1 ? ' is' : 's are'} attached — ${list}. ` +
      'Reduce the risk, or formally accept it with a benefit-risk rationale, before releasing.',
  );
};

// ── Supplier risk tier (§D.6) ───────────────────────────────────────────────

/** Normalised severity → the tier name the rest of the QMS reasons in. */
export const tierForRank = (rank: number | null): string | null => {
  if (rank === null) return null;
  // Boundaries follow severityRankOf's bands: UNACCEPTABLE starts at 80, ALARP
  // at 40, and the ALARP band splits at its midpoint. Chosen so the tier agrees
  // with the level label the user reads — a level called "High" (rank 53 on a
  // 4-band framework) must not surface as a MEDIUM supplier tier.
  if (rank >= 80) return 'CRITICAL';
  if (rank >= 50) return 'HIGH';
  if (rank >= 40) return 'MEDIUM';
  return 'LOW';
};

/**
 * Push a supplier's derived risk tier onto the supplier record.
 *
 * Denormalised deliberately: incoming sampling, requalification frequency and
 * the supplier list all want the tier without joining through RiskProfile, and
 * the tier changes only when a risk event fires. Derived, never hand-edited —
 * `riskTierUpdatedAt` records when the derivation last ran.
 */
export const syncSupplierTier = async (supplierId: string): Promise<string | null> => {
  const profile = await prisma.riskProfile.findUnique({
    where: { entityType_entityId: { entityType: 'Supplier', entityId: supplierId } },
    select: { severityRank: true },
  });
  const tier = tierForRank(profile?.severityRank ?? null);

  const existing = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { riskTier: true },
  });
  if (!existing || existing.riskTier === tier) return tier;

  await prisma.supplier.update({
    where: { id: supplierId },
    data: { riskTier: tier, riskTierUpdatedAt: new Date() },
  });
  await writeTrail({
    entityType: 'Supplier',
    entityId: supplierId,
    action: 'UPDATE',
    field: 'risk_tier',
    oldValue: existing.riskTier,
    newValue: tier,
    reason: 'Derived from the supplier\'s linked risk profile',
  });
  return tier;
};
