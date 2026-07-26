/**
 * Risk profiles — the read side of cross-module risk integration.
 *
 * One question, asked constantly by the rest of the QMS: *how risky is this
 * record?* A supplier being tiered, an audit interval being chosen, a CoA being
 * issued, a chip being rendered in a list of two hundred documents — all of them
 * need the worst current risk level attached to some entity, and none of them
 * should walk RiskLink -> Risk -> RiskLevelDef to get it.
 *
 * `RiskProfile` is that answer, materialised. It is a pure projection: nothing
 * writes it by hand, every field is derived, and `recomputeAll()` can rebuild
 * the whole table from the risks. If it is ever wrong, it is stale, not corrupt.
 *
 * Recompute is deliberately best-effort at the call sites (see `onRiskChanged`):
 * a projection failing must never fail the scoring or linking operation that
 * triggered it. A stale chip is a nuisance; a rejected e-signed score is a
 * compliance incident.
 *
 * See docs/RISK-cross-module-integration-plan.md §C.2.
 */
import { type RiskAcceptanceLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { isLinkableType } from '../../lib/risk-entity-registry';

/** Risk statuses that no longer represent live exposure. */
const CLOSED_STATUSES = ['CLOSED'] as const;

/** Control statuses that still represent outstanding work. */
const OPEN_CONTROL_STATUSES = ['PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'INEFFECTIVE'] as const;

/**
 * Acceptance bands, worst last. This is the primary severity axis because it is
 * the only one that means the same thing in every framework: ISO 14971's
 * "unacceptable" and ICH Q9's "unacceptable" are the same judgement, whereas
 * level *order* 3 means different things in a 4-band and a 6-band framework.
 */
const ACCEPTANCE_RANK: Record<RiskAcceptanceLevel, number> = {
  ACCEPTABLE: 0,
  ALARP: 1,
  UNACCEPTABLE: 2,
};

/**
 * Normalise a level to a cross-framework 0-100 severity rank.
 *
 * Acceptance band dominates (0 / 40 / 80), and the level's relative position
 * within its own framework refines inside the band (0-19). So a "High" that is
 * top-of-scale in a 4-band framework and a "High" that is mid-scale in a 6-band
 * framework both land in the ALARP band, ordered by how extreme each is for its
 * own scale — which is the honest comparison.
 */
export const severityRankOf = (
  acceptance: RiskAcceptanceLevel,
  order: number,
  maxOrderInFramework: number,
): number => {
  const band = ACCEPTANCE_RANK[acceptance] * 40;
  const relative = maxOrderInFramework > 0 ? Math.round((order / maxOrderInFramework) * 19) : 0;
  return Math.min(100, band + relative);
};

interface LevelInfo {
  code: string;
  label: string;
  color: string;
  acceptance: RiskAcceptanceLevel;
  severityRank: number;
}

/**
 * Level id -> normalised info, for every level referenced by `levelIds`.
 * The per-framework max order is resolved alongside so `severityRankOf` has the
 * denominator it needs without a second pass.
 */
const levelInfoFor = async (levelIds: string[]): Promise<Map<string, LevelInfo>> => {
  const out = new Map<string, LevelInfo>();
  if (levelIds.length === 0) return out;

  const levels = await prisma.riskLevelDef.findMany({
    where: { id: { in: [...new Set(levelIds)] } },
    select: {
      id: true,
      code: true,
      label: true,
      color: true,
      order: true,
      acceptance: true,
      frameworkId: true,
    },
  });
  if (levels.length === 0) return out;

  const maxOrder = new Map<string, number>();
  const grouped = await prisma.riskLevelDef.groupBy({
    by: ['frameworkId'],
    where: { frameworkId: { in: [...new Set(levels.map((l) => l.frameworkId))] } },
    _max: { order: true },
  });
  for (const g of grouped) maxOrder.set(g.frameworkId, g._max.order ?? 0);

  for (const l of levels) {
    out.set(l.id, {
      code: l.code,
      label: l.label,
      color: l.color,
      acceptance: l.acceptance,
      severityRank: severityRankOf(l.acceptance, l.order, maxOrder.get(l.frameworkId) ?? 0),
    });
  }
  return out;
};

export interface RiskProfileShape {
  entity_type: string;
  entity_id: string;
  open_risk_count: number;
  total_risk_count: number;
  highest_level_code: string | null;
  highest_level_label: string | null;
  highest_level_color: string | null;
  severity_rank: number | null;
  acceptance: RiskAcceptanceLevel | null;
  max_residual_score: number | null;
  unacceptable_count: number;
  overdue_reviews: number;
  open_controls: number;
  last_risk_event_at: Date | null;
  recomputed_at: Date | null;
}

/** The shape returned for an entity that has never had a risk linked to it. */
const emptyProfile = (entityType: string, entityId: string): RiskProfileShape => ({
  entity_type: entityType,
  entity_id: entityId,
  open_risk_count: 0,
  total_risk_count: 0,
  highest_level_code: null,
  highest_level_label: null,
  highest_level_color: null,
  severity_rank: null,
  acceptance: null,
  max_residual_score: null,
  unacceptable_count: 0,
  overdue_reviews: 0,
  open_controls: 0,
  last_risk_event_at: null,
  recomputed_at: null,
});

const serialize = (row: {
  entityType: string;
  entityId: string;
  openRiskCount: number;
  totalRiskCount: number;
  highestLevelCode: string | null;
  highestLevelLabel: string | null;
  highestLevelColor: string | null;
  severityRank: number | null;
  acceptance: RiskAcceptanceLevel | null;
  maxResidualScore: number | null;
  unacceptableCount: number;
  overdueReviews: number;
  openControls: number;
  lastRiskEventAt: Date | null;
  recomputedAt: Date;
}): RiskProfileShape => ({
  entity_type: row.entityType,
  entity_id: row.entityId,
  open_risk_count: row.openRiskCount,
  total_risk_count: row.totalRiskCount,
  highest_level_code: row.highestLevelCode,
  highest_level_label: row.highestLevelLabel,
  highest_level_color: row.highestLevelColor,
  severity_rank: row.severityRank,
  acceptance: row.acceptance,
  max_residual_score: row.maxResidualScore,
  unacceptable_count: row.unacceptableCount,
  overdue_reviews: row.overdueReviews,
  open_controls: row.openControls,
  last_risk_event_at: row.lastRiskEventAt,
  recomputed_at: row.recomputedAt,
});

// ── Recompute ───────────────────────────────────────────────────────────────

/**
 * Rebuild one entity's profile from the risks currently linked to it.
 *
 * Deletes the row rather than storing zeros when nothing is linked any more, so
 * "no profile" and "a profile that says zero" never diverge — the reader treats
 * a missing row as `emptyProfile`.
 */
export const recomputeProfile = async (entityType: string, entityId: string): Promise<void> => {
  const links = await prisma.riskLink.findMany({
    where: { entityType, entityId, riskId: { not: null } },
    select: { riskId: true },
  });
  const riskIds = [...new Set(links.map((l) => l.riskId as string))];

  if (riskIds.length === 0) {
    await prisma.riskProfile
      .delete({ where: { entityType_entityId: { entityType, entityId } } })
      .catch(() => undefined); // already absent — nothing to clear
    return;
  }

  const risks = await prisma.risk.findMany({
    where: { id: { in: riskIds } },
    select: {
      id: true,
      status: true,
      residualScore: true,
      residualLevelId: true,
      initialLevelId: true,
      nextReviewAt: true,
      updatedAt: true,
      acceptedAt: true,
    },
  });

  const open = risks.filter((r) => !CLOSED_STATUSES.includes(r.status as 'CLOSED'));

  // The current judgement of a risk is its residual level when one exists, else
  // its initial — the same rule ensureCapaForRisk applies, kept identical so a
  // chip never disagrees with whether a CAPA was raised.
  const currentLevelId = (r: { residualLevelId: string | null; initialLevelId: string | null }) =>
    r.residualLevelId ?? r.initialLevelId;

  const levels = await levelInfoFor(
    open.map(currentLevelId).filter((id): id is string => id !== null),
  );

  let worst: LevelInfo | null = null;
  let unacceptable = 0;
  for (const r of open) {
    const id = currentLevelId(r);
    const info = id ? levels.get(id) : undefined;
    if (!info) continue;
    if (!worst || info.severityRank > worst.severityRank) worst = info;
    // An unacceptable risk that has been formally accepted is signed-for, not
    // outstanding — it must not keep tripping the release gate for ever.
    if (info.acceptance === 'UNACCEPTABLE' && !r.acceptedAt) unacceptable += 1;
  }

  const now = new Date();
  const overdueReviews = open.filter((r) => r.nextReviewAt && r.nextReviewAt < now).length;
  const maxResidual = open.reduce<number | null>(
    (m, r) => (r.residualScore != null && (m === null || r.residualScore > m) ? r.residualScore : m),
    null,
  );
  const lastEvent = risks.reduce<Date | null>(
    (m, r) => (m === null || r.updatedAt > m ? r.updatedAt : m),
    null,
  );

  const openControls = await prisma.riskControl.count({
    where: { riskId: { in: open.map((r) => r.id) }, status: { in: [...OPEN_CONTROL_STATUSES] } },
  });

  const data = {
    openRiskCount: open.length,
    totalRiskCount: risks.length,
    highestLevelCode: worst?.code ?? null,
    highestLevelLabel: worst?.label ?? null,
    highestLevelColor: worst?.color ?? null,
    severityRank: worst?.severityRank ?? null,
    acceptance: worst?.acceptance ?? null,
    maxResidualScore: maxResidual,
    unacceptableCount: unacceptable,
    overdueReviews,
    openControls,
    lastRiskEventAt: lastEvent,
  };

  await prisma.riskProfile.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, ...data },
    update: data,
  });
};

/**
 * Recompute every profile a given risk feeds.
 *
 * Call this after anything that changes a risk's level, status, controls or
 * links. Best-effort by contract — see `onRiskChanged`.
 */
export const recomputeForRisk = async (riskId: string): Promise<void> => {
  const links = await prisma.riskLink.findMany({
    where: { riskId },
    select: { entityType: true, entityId: true },
  });
  const seen = new Set<string>();
  for (const l of links) {
    const key = `${l.entityType}:${l.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await recomputeProfile(l.entityType, l.entityId);
  }
};

/**
 * Fire-and-forget recompute for a risk-side event.
 *
 * The projection must never be able to fail the operation that triggered it:
 * scoring is e-signed and audit-trailed, and rejecting a valid score because a
 * derived chip could not be refreshed would be strictly worse than a stale chip.
 * Errors are logged, not raised — the same contract `ensureCapaForRisk` uses.
 */
export const onRiskChanged = async (riskId: string): Promise<void> => {
  try {
    await recomputeForRisk(riskId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[risk-profile] recompute for risk ${riskId} failed:`,
      e instanceof Error ? e.message : e,
    );
  }
};

/** Same contract as `onRiskChanged`, for a link that was just added or removed. */
export const onLinkChanged = async (entityType: string, entityId: string): Promise<void> => {
  try {
    await recomputeProfile(entityType, entityId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[risk-profile] recompute for ${entityType}:${entityId} failed:`,
      e instanceof Error ? e.message : e,
    );
  }
};

/**
 * Rebuild every profile from scratch. Safe to run at any time — this is the
 * backfill after deploying phase 2, and the repair path if the table is ever
 * suspected stale.
 */
export const recomputeAll = async (): Promise<{ entities: number }> => {
  const links = await prisma.riskLink.findMany({
    where: { riskId: { not: null } },
    select: { entityType: true, entityId: true },
    distinct: ['entityType', 'entityId'],
  });
  for (const l of links) await recomputeProfile(l.entityType, l.entityId);

  // Drop rows for entities that no longer have any link at all.
  const live = new Set(links.map((l) => `${l.entityType}:${l.entityId}`));
  const existing = await prisma.riskProfile.findMany({ select: { id: true, entityType: true, entityId: true } });
  const orphans = existing.filter((p) => !live.has(`${p.entityType}:${p.entityId}`)).map((p) => p.id);
  if (orphans.length) await prisma.riskProfile.deleteMany({ where: { id: { in: orphans } } });

  return { entities: links.length };
};

// ── Read ────────────────────────────────────────────────────────────────────

/** One entity's profile. Never throws for "no risks" — returns a zeroed shape. */
export const getProfile = async (entityType: string, entityId: string): Promise<RiskProfileShape> => {
  const row = await prisma.riskProfile.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });
  return row ? serialize(row) : emptyProfile(entityType, entityId);
};

/**
 * Batch read for list views — one query for a page of suppliers or documents
 * rather than one per row. Entities with no risks come back zeroed, so the
 * caller can index the result without null checks.
 */
export const getProfiles = async (
  entityType: string,
  entityIds: string[],
): Promise<RiskProfileShape[]> => {
  const ids = [...new Set(entityIds)];
  if (ids.length === 0) return [];
  const rows = await prisma.riskProfile.findMany({
    where: { entityType, entityId: { in: ids } },
  });
  const byId = new Map(rows.map((r) => [r.entityId, r]));
  return ids.map((id) => {
    const row = byId.get(id);
    return row ? serialize(row) : emptyProfile(entityType, id);
  });
};

/**
 * The riskiest entities of a type — powers "top risk suppliers" style panels and
 * the risk-weighted audit scheduling in phase 6.
 */
export const listByRisk = async (entityType: string, take: number): Promise<RiskProfileShape[]> => {
  const rows = await prisma.riskProfile.findMany({
    where: { entityType, severityRank: { not: null } },
    orderBy: [{ severityRank: 'desc' }, { maxResidualScore: 'desc' }],
    take,
  });
  return rows.map(serialize);
};

/** Guard shared by the routes — keeps the registry the one list of valid types. */
export const assertLinkableType = (entityType: string): boolean => isLinkableType(entityType);
