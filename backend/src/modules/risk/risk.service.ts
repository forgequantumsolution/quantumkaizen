/**
 * Risk registers and risks.
 *
 * The invariant this file exists to protect: a score is *never* accepted from
 * the client. The caller supplies factor ranks; the server resolves the
 * framework, computes the score, resolves the level, persists an immutable
 * snapshot and writes an audit-trail entry. That chain is what an inspector
 * follows from "why is this risk green?" back to the anchored scale definition.
 */
import { Prisma, RiskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import { computeScore, nextReviewDateFor } from './risk-scoring.service';
import { loadScoringFramework } from './risk-framework.service';
import { ensureCapaForRisk } from './risk-control.service';
import {
  canSeeEntity,
  linkableEntities,
  linkableEntity,
  linkableTypeNames,
  resolveRefs,
} from '../../lib/risk-entity-registry';
import { getEffectivePermissionKeys } from '../../middleware/permissions';
import { onLinkChanged, onRiskChanged } from './risk-profile.service';
import { assertControlsInPlace, escalateRisk, loadLevelPolicy } from './risk-policy.service';
import type {
  LinkUpsert,
  LinkSearchQuery,
  ListRegisterQuery,
  ListRiskQuery,
  RegisterUpsert,
  ReverseLinkQuery,
  RiskCreate,
  RiskUpdate,
  ScoreRisk,
  UpdateRiskStatus,
  HeatmapQuery,
} from './risk.schema';

// Next sequence number derived from the highest EXISTING value — not a row
// count, which collides the moment any earlier row is deleted and leaves a gap.
// Mirrors capa.service.ts so numbering behaves identically across modules.
const nextNumber = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { findFirst: (args: any) => Promise<any> },
  field: string,
  prefix: string,
  year: number,
): Promise<string> => {
  const latest = await model.findFirst({
    where: { [field]: { startsWith: `${prefix}-${year}-` } },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  });
  const parsed = latest ? Number(String(latest[field]).split('-').pop()) : 0;
  const max = Number.isFinite(parsed) ? parsed : 0;
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
};

const withUniqueRetry = async <T>(run: () => Promise<T>, tries = 5): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const isDup =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < tries;
      if (!isDup) throw err;
    }
  }
};

// ── Registers ───────────────────────────────────────────────────────────────

const registerInclude = {
  framework: { select: { id: true, name: true, methodology: true, formula: true } },
  _count: { select: { risks: true } },
} satisfies Prisma.RiskRegisterInclude;

type RegisterRow = Prisma.RiskRegisterGetPayload<{ include: typeof registerInclude }>;

const serializeRegister = (r: RegisterRow) => ({
  id: r.id,
  register_number: r.registerNumber,
  name: r.name,
  description: r.description,
  scope: r.scope,
  scope_ref: r.scopeRef,
  framework: r.framework,
  site_id: r.siteId,
  department_id: r.departmentId,
  owner_id: r.ownerId,
  is_active: r.isActive,
  risk_count: r._count.risks,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

export const listRegisters = async (q: ListRegisterQuery) => {
  const where: Prisma.RiskRegisterWhereInput = {};
  if (q.scope) where.scope = q.scope;
  if (q.siteId) where.siteId = q.siteId;
  if (q.ownerId) where.ownerId = q.ownerId;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { registerNumber: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.riskRegister.findMany({
      where,
      include: registerInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.riskRegister.count({ where }),
  ]);

  return { data: rows.map(serializeRegister), total, page: q.page, page_size: q.pageSize };
};

export const getRegister = async (id: string) => {
  const row = await prisma.riskRegister.findUnique({ where: { id }, include: registerInclude });
  if (!row) throw NotFound('Risk register not found');
  return serializeRegister(row);
};

export const createRegister = async (body: RegisterUpsert, userId?: string) => {
  if (body.frameworkId) {
    const fw = await prisma.riskFramework.findUnique({ where: { id: body.frameworkId } });
    if (!fw) throw BadRequest('Referenced risk framework does not exist');
  }

  const created = await withUniqueRetry(async () => {
    const registerNumber = await nextNumber(
      prisma.riskRegister,
      'registerNumber',
      'RR',
      new Date().getFullYear(),
    );
    return prisma.riskRegister.create({
      data: {
        registerNumber,
        name: body.name,
        description: body.description ?? null,
        scope: body.scope,
        scopeRef: body.scopeRef ?? Prisma.JsonNull,
        frameworkId: body.frameworkId ?? null,
        siteId: body.siteId ?? null,
        departmentId: body.departmentId ?? null,
        ownerId: body.ownerId ?? null,
        isActive: body.isActive,
        createdById: userId ?? null,
      },
      include: registerInclude,
    });
  });

  await writeTrail(
    { entityType: 'RiskRegister', entityId: created.id, action: 'CREATE', newValue: created.registerNumber },
    userId,
  );
  return serializeRegister(created);
};

export const updateRegister = async (id: string, body: RegisterUpsert, userId?: string) => {
  const existing = await prisma.riskRegister.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk register not found');

  const updated = await prisma.riskRegister.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
      scope: body.scope,
      scopeRef: body.scopeRef ?? Prisma.JsonNull,
      frameworkId: body.frameworkId ?? null,
      siteId: body.siteId ?? null,
      departmentId: body.departmentId ?? null,
      ownerId: body.ownerId ?? null,
      isActive: body.isActive,
    },
    include: registerInclude,
  });

  await writeTrail(
    { entityType: 'RiskRegister', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: updated.name },
    userId,
  );
  return serializeRegister(updated);
};

export const deleteRegister = async (id: string, userId?: string) => {
  const existing = await prisma.riskRegister.findUnique({
    where: { id },
    include: { _count: { select: { risks: true } } },
  });
  if (!existing) throw NotFound('Risk register not found');
  // Cascade would silently take the risks (and their score history) with it.
  if (existing._count.risks > 0) {
    throw Conflict(
      `Register "${existing.name}" still holds ${existing._count.risks} risk(s). ` +
        'Move or close them first, or deactivate the register.',
    );
  }
  await prisma.riskRegister.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskRegister', entityId: id, action: 'DELETE', oldValue: existing.registerNumber },
    userId,
  );
};

// ── Risks ───────────────────────────────────────────────────────────────────

const riskInclude = {
  register: { select: { id: true, registerNumber: true, name: true, frameworkId: true } },
  category: { select: { id: true, name: true, code: true, color: true } },
  framework: { select: { id: true, name: true, methodology: true, formula: true } },
  links: true,
  _count: { select: { snapshots: true, links: true } },
} satisfies Prisma.RiskInclude;

type RiskRow = Prisma.RiskGetPayload<{ include: typeof riskInclude }>;

// Level ids are stored on the risk; the labels/colors the UI needs live on the
// framework. Resolved in one lookup per request rather than per row.
type LevelLookup = Map<
  string,
  {
    code: string;
    label: string;
    color: string;
    acceptance: string;
    requires_approval: boolean;
    requires_control: boolean;
    requires_capa: boolean;
    requires_training: boolean;
  }
>;

/**
 * Serialize one link.
 *
 * `entity_route` is derived from the registry rather than stored, so a link
 * written before a module's routes moved still resolves to the current path —
 * and so no migration is needed when one does. `entity_label` prefers the label
 * captured at link time (a point-in-time reference the trail depends on) and
 * falls back to a freshly resolved one.
 *
 * `refs` is supplied only where a round trip per link is warranted (the detail
 * view). When it is present, `entity_exists: false` marks a link whose target
 * has since been deleted — a dangling link is a traceability defect and must be
 * visible, not silently rendered as a plausible-looking row.
 */
const serializeLink = (
  l: { id: string; entityType: string; entityId: string; label: string | null; relation: string | null; createdAt: Date },
  refs?: Map<string, { number: string; title: string }>,
) => {
  const entity = linkableEntity(l.entityType);
  const ref = refs?.get(`${l.entityType}:${l.entityId}`);
  return {
    id: l.id,
    entity_type: l.entityType,
    entity_type_label: entity?.label ?? l.entityType,
    entity_id: l.entityId,
    label: l.label ?? (ref ? `${ref.number} — ${ref.title}` : null),
    entity_number: ref?.number ?? null,
    entity_title: ref?.title ?? null,
    entity_route: entity?.route ? entity.route(l.entityId) : null,
    entity_exists: refs ? !!ref : null,
    relation: l.relation,
    created_at: l.createdAt,
  };
};

const serializeRisk = (
  r: RiskRow,
  levels?: LevelLookup,
  refs?: Map<string, { number: string; title: string }>,
) => {
  const level = (id: string | null) => (id && levels?.get(id)) || null;
  return {
    id: r.id,
    risk_number: r.riskNumber,
    title: r.title,
    description: r.description,
    register: r.register,
    category: r.category,
    framework: r.framework,
    hazard: r.hazard,
    hazardous_situation: r.hazardousSituation,
    harm: r.harm,
    cause: r.cause,
    consequence: r.consequence,
    status: r.status,
    treatment: r.treatment,
    initial_factors: r.initialFactors,
    initial_score: r.initialScore,
    initial_level: level(r.initialLevelId),
    residual_factors: r.residualFactors,
    residual_score: r.residualScore,
    residual_level: level(r.residualLevelId),
    target_factors: r.targetFactors,
    target_score: r.targetScore,
    target_level: level(r.targetLevelId),
    owner_id: r.ownerId,
    department_id: r.departmentId,
    site_id: r.siteId,
    identified_at: r.identifiedAt,
    accepted_at: r.acceptedAt,
    closed_at: r.closedAt,
    next_review_at: r.nextReviewAt,
    is_review_overdue: !!r.nextReviewAt && r.nextReviewAt < new Date() && r.status !== 'CLOSED',
    workflow_id: r.workflowId,
    workflow_ticket_id: r.workflowTicketId,
    workflow_ticket_unique_id: r.workflowTicketUniqueId,
    links: r.links.map((l) => serializeLink(l, refs)),
    snapshot_count: r._count.snapshots,
    link_count: r._count.links,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
};

/** Build a level id → display lookup covering every level referenced by `rows`. */
const levelLookupFor = async (rows: RiskRow[]): Promise<LevelLookup> => {
  const ids = new Set<string>();
  for (const r of rows) {
    for (const id of [r.initialLevelId, r.residualLevelId, r.targetLevelId]) {
      if (id) ids.add(id);
    }
  }
  if (ids.size === 0) return new Map();
  const levels = await prisma.riskLevelDef.findMany({
    where: { id: { in: [...ids] } },
    // The policy flags travel with the level so the client can tell whether a
    // risk needs approval or training without a second round trip per risk.
    select: {
      id: true, code: true, label: true, color: true, acceptance: true,
      requiresApproval: true, requiresControl: true, requiresCapa: true, requiresTraining: true,
    },
  });
  return new Map(
    levels.map((l) => [
      l.id,
      {
        code: l.code,
        label: l.label,
        color: l.color,
        acceptance: l.acceptance,
        requires_approval: l.requiresApproval,
        requires_control: l.requiresControl,
        requires_capa: l.requiresCapa,
        requires_training: l.requiresTraining,
      },
    ]),
  );
};

/**
 * The framework a risk scores against: its own override, else its register's,
 * else the org default. Resolved explicitly so an unconfigured risk fails loudly
 * instead of silently scoring against an arbitrary framework.
 */
const resolveFrameworkId = async (risk: { frameworkId: string | null; registerId: string }) => {
  if (risk.frameworkId) return risk.frameworkId;
  const register = await prisma.riskRegister.findUnique({
    where: { id: risk.registerId },
    select: { frameworkId: true },
  });
  if (register?.frameworkId) return register.frameworkId;
  const fallback = await prisma.riskFramework.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  if (!fallback) {
    throw BadRequest(
      'No risk framework is configured for this risk, its register, or as the organisation default',
    );
  }
  return fallback.id;
};

export const listRisks = async (q: ListRiskQuery) => {
  const where: Prisma.RiskWhereInput = {};
  if (q.registerId) where.registerId = q.registerId;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.status) where.status = q.status;
  if (q.ownerId) where.ownerId = q.ownerId;
  if (q.siteId) where.siteId = q.siteId;
  if (q.overdueReview) {
    where.nextReviewAt = { lt: new Date() };
    where.status = { not: 'CLOSED' };
  }
  if (q.levelCode) {
    const matching = await prisma.riskLevelDef.findMany({
      where: { code: q.levelCode },
      select: { id: true },
    });
    where.residualLevelId = { in: matching.map((l) => l.id) };
  }
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { riskNumber: { contains: q.search, mode: 'insensitive' } },
      { hazard: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.risk.findMany({
      where,
      include: riskInclude,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.risk.count({ where }),
  ]);

  const levels = await levelLookupFor(rows);
  return { data: rows.map((r) => serializeRisk(r, levels)), total, page: q.page, page_size: q.pageSize };
};

export const getRisk = async (id: string) => {
  const row = await prisma.risk.findUnique({ where: { id }, include: riskInclude });
  if (!row) throw NotFound('Risk not found');
  const [levels, refs] = await Promise.all([levelLookupFor([row]), resolveRefs(row.links)]);
  return serializeRisk(row, levels, refs);
};

/**
 * Score one stage of a risk. This is the only write path for score columns.
 * Everything else (status transitions, edits) leaves scores untouched.
 */
// The snapshot denormalises the actor's name so history stays readable even if
// the user is later renamed or deactivated. Resolved here, as writeTrail does.
const resolveUserName = async (userId?: string): Promise<string> => {
  if (!userId) return 'system';
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? 'unknown';
};

export const scoreRisk = async (id: string, body: ScoreRisk, userId?: string) => {
  const risk = await prisma.risk.findUnique({
    where: { id },
    select: { id: true, riskNumber: true, frameworkId: true, registerId: true, initialScore: true },
  });
  if (!risk) throw NotFound('Risk not found');

  // Residual risk means "after controls" — scoring it before an initial score
  // exists produces a delta with nothing to compare against.
  if (body.stage === 'RESIDUAL' && risk.initialScore === null) {
    throw BadRequest('Score the initial risk before recording a residual score');
  }

  const userName = await resolveUserName(userId);
  const frameworkId = await resolveFrameworkId(risk);
  const { scoring } = await loadScoringFramework(frameworkId);
  const result = computeScore(scoring, body.factors);

  // A residual score asserts "this is the risk AFTER controls". Recording one
  // against a level that demands controls, when none are in place, states
  // something untrue — so it is refused, not warned about. Checked before any
  // write so a rejected score leaves no snapshot behind.
  if (body.stage === 'RESIDUAL') {
    await assertControlsInPlace(id, risk.riskNumber, result.level);
  }

  const data: Prisma.RiskUpdateInput = { framework: { connect: { id: frameworkId } } };
  if (body.stage === 'INITIAL') {
    data.initialFactors = result.factors;
    data.initialScore = result.score;
    data.initialLevelId = result.level.id;
  } else if (body.stage === 'TARGET') {
    data.targetFactors = result.factors;
    data.targetScore = result.score;
    data.targetLevelId = result.level.id;
  } else {
    // RESIDUAL and REVIEW both land on the residual columns — a periodic review
    // that rescores is, by definition, restating the current residual risk.
    data.residualFactors = result.factors;
    data.residualScore = result.score;
    data.residualLevelId = result.level.id;
    const nextReview = nextReviewDateFor(result.level);
    if (nextReview) data.nextReviewAt = nextReview;
    if (body.stage === 'RESIDUAL') data.status = 'RESIDUAL_ASSESSED';
  }

  await prisma.$transaction(async (tx) => {
    await tx.risk.update({ where: { id }, data });
    await tx.riskScoreSnapshot.create({
      data: {
        riskId: id,
        stage: body.stage,
        factors: result.factors,
        score: result.score,
        levelCode: result.level.code,
        levelLabel: result.level.label,
        formula: scoring.formula as Prisma.RiskScoreSnapshotCreateInput['formula'],
        frameworkId,
        reason: body.reason ?? null,
        userId: userId ?? null,
        userName,
      },
    });
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: id,
      action: 'SCORE',
      field: body.stage.toLowerCase(),
      newValue: `${result.score} (${result.level.code})`,
      reason: body.reason ?? undefined,
    },
    userId,
  );

  // Scoring is the moment a risk is judged unacceptable, so it is the moment the
  // CAPA must be raised — waiting until someone adds a control would leave the
  // worst risks (scored high and then ignored) with no CAPA at all.
  // ensureCapaForRisk is idempotent, re-reads the level itself and swallows its
  // own errors, so a CAPA-side failure can never fail the score write.
  if (result.level.requiresCapa) {
    await ensureCapaForRisk(id, userId);
  }

  // Tell the level's responsible role it has landed on their desk. Best-effort,
  // for the same reason auto-CAPA is: a notification must never roll back a
  // signed score.
  const policy = await loadLevelPolicy(result.level.id);
  if (policy?.escalateToRoleId) {
    const full = await prisma.risk.findUnique({ where: { id }, select: { title: true } });
    await escalateRisk(id, risk.riskNumber, full?.title ?? risk.riskNumber, policy, userId);
  }

  // A new level is the main thing every risk chip in the platform reflects.
  await onRiskChanged(id);

  return {
    ...(await getRisk(id)),
    computed: {
      stage: body.stage,
      score: result.score,
      level: result.level,
      action_priority: result.actionPriority,
      requires_capa: result.level.requiresCapa,
      requires_approval: result.level.requiresApproval,
      requires_control: result.level.requiresControl,
    },
  };
};

export const createRisk = async (body: RiskCreate, userId?: string) => {
  const register = await prisma.riskRegister.findUnique({ where: { id: body.registerId } });
  if (!register) throw BadRequest('Referenced risk register does not exist');
  if (!register.isActive) throw BadRequest(`Register "${register.name}" is inactive`);

  const created = await withUniqueRetry(async () => {
    const riskNumber = await nextNumber(prisma.risk, 'riskNumber', 'RISK', new Date().getFullYear());
    return prisma.risk.create({
      data: {
        riskNumber,
        title: body.title,
        description: body.description ?? null,
        registerId: body.registerId,
        categoryId: body.categoryId ?? null,
        frameworkId: body.frameworkId ?? register.frameworkId,
        hazard: body.hazard ?? null,
        hazardousSituation: body.hazardousSituation ?? null,
        harm: body.harm ?? null,
        cause: body.cause ?? null,
        consequence: body.consequence ?? null,
        treatment: body.treatment ?? null,
        ownerId: body.ownerId ?? null,
        departmentId: body.departmentId ?? null,
        // Inherit the register's site when the caller does not pin one.
        siteId: body.siteId ?? register.siteId,
        createdById: userId ?? null,
      },
    });
  });

  await writeTrail(
    { entityType: 'Risk', entityId: created.id, action: 'CREATE', newValue: created.riskNumber },
    userId,
  );

  if (body.initialFactors) {
    return scoreRisk(created.id, { stage: 'INITIAL', factors: body.initialFactors, reason: 'Initial assessment' }, userId);
  }
  return getRisk(created.id);
};

export const updateRisk = async (id: string, body: RiskUpdate, userId?: string) => {
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk not found');

  const updated = await prisma.risk.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description ?? null,
      categoryId: body.categoryId ?? null,
      frameworkId: body.frameworkId ?? existing.frameworkId,
      hazard: body.hazard ?? null,
      hazardousSituation: body.hazardousSituation ?? null,
      harm: body.harm ?? null,
      cause: body.cause ?? null,
      consequence: body.consequence ?? null,
      treatment: body.treatment ?? null,
      ownerId: body.ownerId ?? null,
      departmentId: body.departmentId ?? null,
      siteId: body.siteId ?? null,
    },
  });

  await writeTrail(
    { entityType: 'Risk', entityId: id, action: 'UPDATE', oldValue: existing.title, newValue: updated.title },
    userId,
  );
  return getRisk(id);
};

/**
 * Legal status transitions. Declared explicitly rather than allowing any status
 * to follow any other, so an out-of-order client cannot record a risk as
 * ACCEPTED without a residual assessment behind it.
 */
const ALLOWED_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  IDENTIFIED: ['UNDER_ASSESSMENT', 'TREATMENT_PLANNED', 'CLOSED', 'ESCALATED'],
  UNDER_ASSESSMENT: ['TREATMENT_PLANNED', 'RESIDUAL_ASSESSED', 'ACCEPTED', 'CLOSED', 'ESCALATED'],
  TREATMENT_PLANNED: ['TREATMENT_IN_PROGRESS', 'UNDER_ASSESSMENT', 'CLOSED', 'ESCALATED'],
  TREATMENT_IN_PROGRESS: ['RESIDUAL_ASSESSED', 'TREATMENT_PLANNED', 'CLOSED', 'ESCALATED'],
  RESIDUAL_ASSESSED: ['ACCEPTED', 'TREATMENT_PLANNED', 'MONITORED', 'CLOSED', 'ESCALATED'],
  ACCEPTED: ['MONITORED', 'REOPENED', 'CLOSED', 'ESCALATED'],
  MONITORED: ['REOPENED', 'CLOSED', 'ESCALATED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['UNDER_ASSESSMENT', 'TREATMENT_PLANNED', 'CLOSED', 'ESCALATED'],
  ESCALATED: ['UNDER_ASSESSMENT', 'TREATMENT_PLANNED', 'RESIDUAL_ASSESSED', 'CLOSED'],
};

export const updateRiskStatus = async (id: string, body: UpdateRiskStatus, userId?: string) => {
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk not found');
  if (existing.status === body.status) return getRisk(id);

  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(body.status)) {
    throw BadRequest(
      `Cannot move risk from ${existing.status} to ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }

  // Accepting a risk asserts the residual level is tolerable — there must be a
  // residual score to have formed that judgement against.
  if (body.status === 'ACCEPTED' && existing.residualScore === null) {
    throw BadRequest('A residual score is required before a risk can be accepted');
  }

  const updated = await prisma.risk.update({
    where: { id },
    data: {
      status: body.status,
      acceptedAt: body.status === 'ACCEPTED' ? new Date() : existing.acceptedAt,
      closedAt: body.status === 'CLOSED' ? new Date() : body.status === 'REOPENED' ? null : existing.closedAt,
    },
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: existing.status,
      newValue: updated.status,
      reason: body.reason ?? undefined,
    },
    userId,
  );
  // CLOSED / REOPENED move a risk in and out of the open population every
  // profile counts, so a status change is as material as a re-score.
  await onRiskChanged(id);
  return getRisk(id);
};

export const deleteRisk = async (id: string, userId?: string) => {
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk not found');

  // Read the links before the delete cascades them away — afterwards there is
  // nothing left to tell us which entities' profiles just went stale.
  const affected = await prisma.riskLink.findMany({
    where: { riskId: id },
    select: { entityType: true, entityId: true },
  });

  await prisma.risk.delete({ where: { id } });
  await writeTrail(
    { entityType: 'Risk', entityId: id, action: 'DELETE', oldValue: existing.riskNumber },
    userId,
  );

  for (const a of affected) await onLinkChanged(a.entityType, a.entityId);
};

export const getRiskHistory = async (id: string) => {
  const risk = await prisma.risk.findUnique({ where: { id }, select: { id: true } });
  if (!risk) throw NotFound('Risk not found');
  const rows = await prisma.riskScoreSnapshot.findMany({
    where: { riskId: id },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((s) => ({
    id: s.id,
    stage: s.stage,
    factors: s.factors,
    score: s.score,
    level_code: s.levelCode,
    level_label: s.levelLabel,
    formula: s.formula,
    reason: s.reason,
    user_id: s.userId,
    user_name: s.userName,
    created_at: s.createdAt,
  }));
};

// ── Links ───────────────────────────────────────────────────────────────────

export const addLink = async (riskId: string, body: LinkUpsert, userId?: string) => {
  const risk = await prisma.risk.findUnique({ where: { id: riskId }, select: { id: true } });
  if (!risk) throw NotFound('Risk not found');

  // A link is a traceability claim. Both halves of it must be true at the moment
  // it is written: the type must be one the platform knows how to resolve, and
  // the record must actually exist. Neither was checked before, which is how the
  // links tab ended up rendering raw UUIDs nobody could follow.
  const entity = linkableEntity(body.entityType);
  if (!entity) {
    throw BadRequest(
      `"${body.entityType}" is not a linkable record type. Known types: ${linkableTypeNames().join(', ')}`,
    );
  }
  const ref = await entity.find(body.entityId);
  if (!ref) {
    throw BadRequest(`No ${entity.label} exists with id ${body.entityId}`);
  }

  // The label is a point-in-time reference: it must keep reading correctly even
  // after the target is renamed, so it is captured now rather than resolved on
  // every read. A caller-supplied label still wins — some links want prose.
  const label = body.label?.trim() || `${ref.number} — ${ref.title}`;

  const created = await prisma.riskLink
    .create({
      data: {
        riskId,
        entityType: body.entityType,
        entityId: body.entityId,
        label,
        relation: body.relation ?? null,
        createdById: userId ?? null,
      },
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw Conflict('That link already exists on this risk');
      }
      throw err;
    });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: riskId,
      action: 'UPDATE',
      field: 'links',
      newValue: `${body.entityType}:${body.entityId}`,
      reason: `Linked ${entity.label} ${ref.number}`,
    },
    userId,
  );
  await onLinkChanged(body.entityType, body.entityId);
  return serializeLink(created, new Map([[`${body.entityType}:${body.entityId}`, ref]]));
};

// ── Reverse lookup + typeahead ──────────────────────────────────────────────

/**
 * The risks linked to some other record — the endpoint every other module's
 * risk panel calls. Without it links were one-directional: a CAPA raised from a
 * risk had no way to say so.
 *
 * Results are filtered by the caller's `risk.read`, which the route already
 * enforces; the risks themselves are the payload, so no per-target permission
 * check is needed here (unlike `resolveLinksFor`, which walks the other way).
 */
export const listRisksLinkedTo = async (q: ReverseLinkQuery) => {
  const entity = linkableEntity(q.entityType);
  if (!entity) {
    throw BadRequest(
      `"${q.entityType}" is not a linkable record type. Known types: ${linkableTypeNames().join(', ')}`,
    );
  }

  const links = await prisma.riskLink.findMany({
    where: { entityType: q.entityType, entityId: q.entityId, riskId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, relation: true, createdAt: true, riskId: true },
  });
  if (links.length === 0) return [];

  const rows = await prisma.risk.findMany({
    where: { id: { in: links.map((l) => l.riskId as string) } },
    include: riskInclude,
  });
  const levels = await levelLookupFor(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));

  return links
    .map((l) => {
      const row = byId.get(l.riskId as string);
      if (!row) return null;
      return {
        link_id: l.id,
        relation: l.relation,
        linked_at: l.createdAt,
        risk: serializeRisk(row, levels),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
};

/** The record types a risk may be linked to. Drives the client's picker. */
export const listLinkableTypes = () =>
  linkableEntities().map((e) => ({
    type: e.type,
    label: e.label,
    has_route: !!e.route,
  }));

/**
 * Typeahead over one linkable type, filtered to what the caller may read.
 *
 * The permission filter is the point: a risk owner who cannot read CAPAs must
 * not be able to enumerate CAPA numbers through this picker. `canSeeEntity`
 * handles the two types gated by dynamic per-workflow-type keys.
 */
export const searchLinkable = async (q: LinkSearchQuery, userId?: string) => {
  const entity = linkableEntity(q.type);
  if (!entity) {
    throw BadRequest(
      `"${q.type}" is not a linkable record type. Known types: ${linkableTypeNames().join(', ')}`,
    );
  }

  const hits = await entity.search(q.q, q.take);
  if (hits.length === 0) return [];

  const keys = userId ? await getEffectivePermissionKeys(userId) : new Set<string>();
  const visible = await Promise.all(
    hits.map(async (h) => ((await canSeeEntity(entity, h.id, keys)) ? h : null)),
  );

  return visible
    .filter((h): h is NonNullable<typeof h> => h !== null)
    .map((h) => ({
      id: h.id,
      number: h.number,
      title: h.title,
      label: `${h.number} — ${h.title}`,
      route: entity.route ? entity.route(h.id) : null,
    }));
};

export const removeLink = async (linkId: string, userId?: string) => {
  const existing = await prisma.riskLink.findUnique({ where: { id: linkId } });
  if (!existing) throw NotFound('Risk link not found');
  await prisma.riskLink.delete({ where: { id: linkId } });
  // A link hangs off either a risk or an assessment — trail it against whichever
  // parent it actually belonged to, so the removal shows up on that record.
  const parent = existing.riskId
    ? { entityType: 'Risk', entityId: existing.riskId }
    : { entityType: 'RiskAssessment', entityId: existing.assessmentId ?? linkId };
  await writeTrail(
    {
      ...parent,
      action: 'UPDATE',
      field: 'links',
      oldValue: `${existing.entityType}:${existing.entityId}`,
    },
    userId,
  );
  await onLinkChanged(existing.entityType, existing.entityId);
};

// ── Analytics ───────────────────────────────────────────────────────────────

/**
 * Heat-map cell counts for a framework's two primary axes. Returns the grid
 * definition alongside the counts so the client can render the matrix without a
 * second round trip, and without inventing its own axis labels.
 */
export const getHeatmap = async (q: HeatmapQuery) => {
  const frameworkId =
    q.frameworkId ??
    (await prisma.riskFramework.findFirst({ where: { isDefault: true, isActive: true }, select: { id: true } }))?.id;
  if (!frameworkId) throw BadRequest('No risk framework specified and no default is configured');

  const { row: framework } = await loadScoringFramework(frameworkId);
  const [rowFactor, colFactor] = framework.factors;
  if (!rowFactor || !colFactor) throw BadRequest('Framework needs at least two factors to build a heat map');

  const where: Prisma.RiskWhereInput = { frameworkId, status: { not: 'CLOSED' } };
  if (q.registerId) where.registerId = q.registerId;
  if (q.siteId) where.siteId = q.siteId;

  const risks = await prisma.risk.findMany({
    where,
    select: {
      id: true,
      riskNumber: true,
      title: true,
      initialFactors: true,
      residualFactors: true,
      initialLevelId: true,
      residualLevelId: true,
    },
  });

  const key = q.stage === 'INITIAL' ? 'initialFactors' : 'residualFactors';
  const levelKey = q.stage === 'INITIAL' ? 'initialLevelId' : 'residualLevelId';
  const counts = new Map<string, { count: number; risk_ids: string[] }>();
  let unscored = 0;

  for (const risk of risks) {
    const factors = risk[key] as Record<string, number> | null;
    if (!factors || factors[rowFactor.key] === undefined || factors[colFactor.key] === undefined) {
      unscored += 1;
      continue;
    }
    const cellKey = `${factors[rowFactor.key]}:${factors[colFactor.key]}`;
    const cell = counts.get(cellKey) ?? { count: 0, risk_ids: [] };
    cell.count += 1;
    cell.risk_ids.push(risk.id);
    counts.set(cellKey, cell);
  }

  const levelById = new Map(framework.levels.map((l) => [l.id, l]));
  const byLevel: Record<string, number> = {};
  for (const risk of risks) {
    const lvl = risk[levelKey] ? levelById.get(risk[levelKey] as string) : null;
    const code = lvl?.code ?? 'UNSCORED';
    byLevel[code] = (byLevel[code] ?? 0) + 1;
  }

  return {
    stage: q.stage,
    framework: { id: framework.id, name: framework.name, methodology: framework.methodology },
    axes: {
      row: {
        key: rowFactor.key,
        label: rowFactor.label,
        levels: rowFactor.levels.map((l) => ({ rank: l.rank, label: l.label, color: l.color })),
      },
      col: {
        key: colFactor.key,
        label: colFactor.label,
        levels: colFactor.levels.map((l) => ({ rank: l.rank, label: l.label, color: l.color })),
      },
    },
    cells: [...counts.entries()].map(([k, v]) => {
      const [rowRank, colRank] = k.split(':').map(Number);
      return { row_rank: rowRank, col_rank: colRank, count: v.count, risk_ids: v.risk_ids };
    }),
    by_level: byLevel,
    total: risks.length,
    unscored,
  };
};

/** Register-level KPI summary for the dashboard. */
export const getSummary = async (q: HeatmapQuery) => {
  const where: Prisma.RiskWhereInput = {};
  if (q.registerId) where.registerId = q.registerId;
  if (q.siteId) where.siteId = q.siteId;

  const [byStatus, total, overdueReviews, unscored] = await Promise.all([
    prisma.risk.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.risk.count({ where }),
    prisma.risk.count({ where: { ...where, nextReviewAt: { lt: new Date() }, status: { not: 'CLOSED' } } }),
    prisma.risk.count({ where: { ...where, initialScore: null } }),
  ]);

  return {
    total,
    by_status: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    overdue_reviews: overdueReviews,
    unscored,
  };
};
