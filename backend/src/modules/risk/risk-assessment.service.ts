/**
 * Risk assessments and their FMEA / matrix worksheets.
 *
 * Three invariants this file exists to protect:
 *
 *  1. No score ever arrives from the client. A line carries factor *ranks*; the
 *     server resolves the assessment's framework, computes the score, resolves
 *     the level band and persists both. Same engine as risk.service.ts, so a
 *     worksheet line and the risk promoted from it always agree.
 *  2. An APPROVED assessment is immutable. Approval e-signs the record and
 *     freezes the entire framework definition into `frameworkSnapshot`, so the
 *     analysis can be reconstructed years later even after the framework has
 *     been re-versioned. Changing an approved assessment means revising to v+1.
 *  3. Status only ever moves along an explicitly declared adjacency map — an
 *     out-of-order client cannot land an assessment in APPROVED without passing
 *     through review and approval.
 */
import { Prisma, RiskAssessmentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { recordSignature, writeTrail } from '../audit/compliance.service';
import { computeScore, nextReviewDateFor } from './risk-scoring.service';
import type { FactorValues, ScoringFramework, ScoringLevel } from './risk-scoring.service';
import { loadScoringFramework, serializeFramework } from './risk-framework.service';
import { onRiskChanged } from './risk-profile.service';
import { linkableEntity, linkableTypeNames } from '../../lib/risk-entity-registry';
import type { LinkUpsert } from './risk.schema';
import type {
  ApproveAssessment,
  AssessmentCreate,
  AssessmentUpdate,
  BulkLines,
  LineUpsert,
  ListAssessmentQuery,
  ListLineQuery,
  PromoteLine,
  RejectAssessment,
  ReviseAssessment,
  UpdateAssessmentStatus,
} from './risk-assessment.schema';

// ── Numbering ───────────────────────────────────────────────────────────────
// Duplicated verbatim from risk.service.ts (module-private there) so numbering
// behaviour stays identical across the module. Next value is derived from the
// highest EXISTING number, not a row count — a count collides the moment any
// earlier row is deleted and leaves a gap.

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

// ── Shapes ──────────────────────────────────────────────────────────────────

const lineInclude = {
  risk: { select: { id: true, riskNumber: true, title: true, status: true } },
} satisfies Prisma.RiskAssessmentLineInclude;

type LineRow = Prisma.RiskAssessmentLineGetPayload<{ include: typeof lineInclude }>;

const assessmentInclude = {
  framework: { select: { id: true, name: true, methodology: true, formula: true, version: true } },
  register: { select: { id: true, registerNumber: true, name: true } },
  _count: { select: { lines: true, versions: true } },
} satisfies Prisma.RiskAssessmentInclude;

type AssessmentRow = Prisma.RiskAssessmentGetPayload<{ include: typeof assessmentInclude }>;

const assessmentDetailInclude = {
  ...assessmentInclude,
  parent: { select: { id: true, assessmentNumber: true, version: true, status: true } },
  versions: {
    select: { id: true, assessmentNumber: true, version: true, status: true },
    orderBy: { version: 'asc' },
  },
  lines: { include: lineInclude, orderBy: { lineNumber: 'asc' } },
  links: true,
} satisfies Prisma.RiskAssessmentInclude;

type AssessmentDetailRow = Prisma.RiskAssessmentGetPayload<{ include: typeof assessmentDetailInclude }>;

// Level ids are stored on the row; the labels/colours the UI needs live on the
// framework. Resolved in one lookup per request rather than per row.
type LevelLookup = Map<string, { id: string; code: string; label: string; color: string; acceptance: string }>;

const levelLookupFor = async (lines: { initialLevelId: string | null; residualLevelId: string | null }[]): Promise<LevelLookup> => {
  const ids = new Set<string>();
  for (const l of lines) {
    if (l.initialLevelId) ids.add(l.initialLevelId);
    if (l.residualLevelId) ids.add(l.residualLevelId);
  }
  if (ids.size === 0) return new Map();
  const levels = await prisma.riskLevelDef.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, code: true, label: true, color: true, acceptance: true },
  });
  return new Map(levels.map((l) => [l.id, { ...l }]));
};

const serializeLine = (l: LineRow, levels?: LevelLookup) => {
  const level = (id: string | null) => (id && levels?.get(id)) || null;
  return {
    id: l.id,
    assessment_id: l.assessmentId,
    line_number: l.lineNumber,
    item_function: l.itemFunction,
    failure_mode: l.failureMode,
    effect: l.effect,
    cause: l.cause,
    current_controls: l.currentControls,
    hazard: l.hazard,
    consequence: l.consequence,
    initial_factors: l.initialFactors,
    initial_score: l.initialScore,
    initial_level: level(l.initialLevelId),
    action_priority: l.actionPriority,
    recommended_action: l.recommendedAction,
    owner_id: l.ownerId,
    due_date: l.dueDate,
    residual_factors: l.residualFactors,
    residual_score: l.residualScore,
    residual_level: level(l.residualLevelId),
    risk_id: l.riskId,
    risk: l.risk,
    is_promoted: !!l.riskId,
    is_critical: l.isCritical,
    notes: l.notes,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
};

const serializeAssessment = (a: AssessmentRow) => ({
  id: a.id,
  assessment_number: a.assessmentNumber,
  title: a.title,
  objective: a.objective,
  scope_text: a.scopeText,
  methodology: a.methodology,
  status: a.status,
  register: a.register,
  framework: a.framework,
  framework_id: a.frameworkId,
  has_framework_snapshot: a.frameworkSnapshot !== null,
  version: a.version,
  parent_id: a.parentId,
  team_members: a.teamMembers,
  lead_id: a.leadId,
  site_id: a.siteId,
  department_id: a.departmentId,
  started_at: a.startedAt,
  completed_at: a.completedAt,
  approved_at: a.approvedAt,
  approved_by_id: a.approvedById,
  rejection_reason: a.rejectionReason,
  conclusion: a.conclusion,
  next_review_at: a.nextReviewAt,
  is_review_overdue:
    !!a.nextReviewAt && a.nextReviewAt < new Date() && !['CLOSED', 'CANCELLED', 'SUPERSEDED'].includes(a.status),
  is_locked: LOCKED_STATUSES.includes(a.status),
  trigger_type: a.triggerType,
  trigger_id: a.triggerId,
  workflow_id: a.workflowId,
  workflow_ticket_id: a.workflowTicketId,
  workflow_ticket_unique_id: a.workflowTicketUniqueId,
  line_count: a._count.lines,
  version_count: a._count.versions,
  created_by_id: a.createdById,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

const serializeAssessmentDetail = (a: AssessmentDetailRow, levels: LevelLookup) => ({
  ...serializeAssessment(a),
  framework_snapshot: a.frameworkSnapshot,
  parent: a.parent,
  versions: a.versions.map((v) => ({
    id: v.id,
    assessment_number: v.assessmentNumber,
    version: v.version,
    status: v.status,
  })),
  lines: a.lines.map((l) => serializeLine(l, levels)),
  links: a.links.map((l) => ({
    id: l.id,
    entity_type: l.entityType,
    entity_id: l.entityId,
    label: l.label,
    relation: l.relation,
    created_at: l.createdAt,
  })),
});

// ── Status machine ──────────────────────────────────────────────────────────

/**
 * Legal transitions. Declared explicitly rather than allowing any status to
 * follow any other: an assessment must be reviewed before it can be approved,
 * and nothing may leave a terminal state.
 *
 * APPROVED and REJECTED are reachable here for completeness, but the generic
 * status endpoint refuses them — they carry side effects (e-signature, snapshot
 * freeze, rejection reason) and have dedicated endpoints.
 */
const ALLOWED_TRANSITIONS: Record<RiskAssessmentStatus, RiskAssessmentStatus[]> = {
  DRAFT: ['IN_ASSESSMENT', 'CANCELLED'],
  IN_ASSESSMENT: ['PENDING_REVIEW', 'DRAFT', 'CANCELLED'],
  PENDING_REVIEW: ['PENDING_APPROVAL', 'REJECTED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['PERIODIC_REVIEW', 'SUPERSEDED', 'CLOSED'],
  // Rejection sends the worksheet back to the assessors.
  REJECTED: ['IN_ASSESSMENT', 'CANCELLED'],
  PERIODIC_REVIEW: ['SUPERSEDED', 'CLOSED'],
  SUPERSEDED: [],
  CLOSED: [],
  CANCELLED: [],
};

/** States in which the record and its worksheet are frozen. */
const LOCKED_STATUSES: RiskAssessmentStatus[] = ['APPROVED', 'SUPERSEDED', 'CLOSED', 'CANCELLED'];

const assertTransition = (from: RiskAssessmentStatus, to: RiskAssessmentStatus) => {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw BadRequest(
      `Cannot move assessment from ${from} to ${to}. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }
};

const assertEditable = (a: { assessmentNumber: string; status: RiskAssessmentStatus }) => {
  if (!LOCKED_STATUSES.includes(a.status)) return;
  if (a.status === 'APPROVED') {
    throw Conflict(
      `Assessment ${a.assessmentNumber} is APPROVED and immutable. ` +
        'Use POST /assessments/:id/revise to create a new version.',
    );
  }
  throw Conflict(`Assessment ${a.assessmentNumber} is ${a.status} and can no longer be edited.`);
};

// ── Scoring ─────────────────────────────────────────────────────────────────

interface LineScore {
  factors: Prisma.InputJsonValue;
  score: number | null;
  levelId: string | null;
  actionPriority: string | null;
  level: ScoringLevel | null;
}

const EMPTY_SCORE: LineScore = {
  factors: Prisma.JsonNull as unknown as Prisma.InputJsonValue,
  score: null,
  levelId: null,
  actionPriority: null,
  level: null,
};

/**
 * Score one worksheet cell-set. A worksheet is a working paper: a row that is
 * only half filled in is normal and must save, so a partial rank map persists
 * with a null score rather than failing the whole grid. What is *not* tolerated
 * is a rank that does not exist on the scale, or a factor the framework does
 * not define — both are client bugs that would produce an indefensible score.
 */
const scoreLine = (
  scoring: ScoringFramework,
  input: FactorValues | null | undefined,
  label: string,
): LineScore => {
  if (!input || Object.keys(input).length === 0) return EMPTY_SCORE;

  const byKey = new Map(scoring.factors.map((f) => [f.key, f]));
  const cleaned: FactorValues = {};
  for (const [key, raw] of Object.entries(input)) {
    const factor = byKey.get(key);
    if (!factor) {
      throw BadRequest(`${label}: "${key}" is not a scoring factor of framework "${scoring.name}"`);
    }
    const value = Number(raw);
    if (!factor.levels.some((l) => l.rank === value)) {
      const allowed = factor.levels.map((l) => l.rank).sort((a, b) => a - b).join(', ');
      throw BadRequest(`${label}: ${value} is not a defined rank for factor "${key}" (allowed: ${allowed})`);
    }
    cleaned[key] = value;
  }

  const complete = scoring.factors.every((f) => cleaned[f.key] !== undefined);
  if (!complete) {
    return { factors: cleaned, score: null, levelId: null, actionPriority: null, level: null };
  }

  const result = computeScore(scoring, cleaned);
  return {
    factors: result.factors,
    score: result.score,
    levelId: result.level.id,
    actionPriority: result.actionPriority,
    level: result.level,
  };
};

/**
 * The framework an assessment scores against: the explicit choice, else its
 * register's, else the org default. Resolved explicitly so an unconfigured
 * assessment fails loudly instead of silently scoring against an arbitrary one.
 */
const resolveFrameworkId = async (frameworkId?: string | null, registerId?: string | null) => {
  if (frameworkId) return frameworkId;
  if (registerId) {
    const register = await prisma.riskRegister.findUnique({
      where: { id: registerId },
      select: { frameworkId: true },
    });
    if (register?.frameworkId) return register.frameworkId;
  }
  const fallback = await prisma.riskFramework.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  if (!fallback) {
    throw BadRequest(
      'No risk framework was supplied for this assessment, its register has none, and no organisation default is configured',
    );
  }
  return fallback.id;
};

const loadAssessmentOrThrow = async (id: string) => {
  const row = await prisma.riskAssessment.findUnique({ where: { id } });
  if (!row) throw NotFound('Risk assessment not found');
  return row;
};

/** Denormalised actor name for score snapshots, mirroring risk.service.ts. */
const resolveUserName = async (userId?: string): Promise<string> => {
  if (!userId) return 'system';
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? 'unknown';
};

// ── Assessment CRUD ─────────────────────────────────────────────────────────

export const listAssessments = async (q: ListAssessmentQuery) => {
  const where: Prisma.RiskAssessmentWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.methodology) where.methodology = q.methodology;
  if (q.registerId) where.registerId = q.registerId;
  if (q.siteId) where.siteId = q.siteId;
  if (q.frameworkId) where.frameworkId = q.frameworkId;
  if (q.leadId) where.leadId = q.leadId;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { assessmentNumber: { contains: q.search, mode: 'insensitive' } },
      { objective: { contains: q.search, mode: 'insensitive' } },
      { scopeText: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.riskAssessment.findMany({
      where,
      include: assessmentInclude,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.riskAssessment.count({ where }),
  ]);

  return { data: rows.map(serializeAssessment), total, page: q.page, page_size: q.pageSize };
};

export const getAssessment = async (id: string) => {
  const row = await prisma.riskAssessment.findUnique({ where: { id }, include: assessmentDetailInclude });
  if (!row) throw NotFound('Risk assessment not found');
  const levels = await levelLookupFor(row.lines);
  return serializeAssessmentDetail(row, levels);
};

export const createAssessment = async (body: AssessmentCreate, userId?: string) => {
  if (body.registerId) {
    const register = await prisma.riskRegister.findUnique({ where: { id: body.registerId } });
    if (!register) throw BadRequest('Referenced risk register does not exist');
    if (!register.isActive) throw BadRequest(`Register "${register.name}" is inactive`);
  }

  const frameworkId = await resolveFrameworkId(body.frameworkId, body.registerId);
  // Fails loudly if the framework is missing or inactive.
  const { row: framework } = await loadScoringFramework(frameworkId);

  const created = await withUniqueRetry(async () => {
    const assessmentNumber = await nextNumber(
      prisma.riskAssessment,
      'assessmentNumber',
      'RA',
      new Date().getFullYear(),
    );
    return prisma.riskAssessment.create({
      data: {
        assessmentNumber,
        title: body.title,
        objective: body.objective ?? null,
        scopeText: body.scopeText ?? null,
        methodology: body.methodology ?? framework.methodology,
        registerId: body.registerId ?? null,
        frameworkId,
        teamMembers: (body.teamMembers ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        leadId: body.leadId ?? null,
        siteId: body.siteId ?? null,
        departmentId: body.departmentId ?? null,
        startedAt: body.startedAt ?? null,
        conclusion: body.conclusion ?? null,
        nextReviewAt: body.nextReviewAt ?? null,
        triggerType: body.triggerType ?? null,
        triggerId: body.triggerId ?? null,
        workflowId: body.workflowId ?? null,
        workflowTicketId: body.workflowTicketId ?? null,
        workflowTicketUniqueId: body.workflowTicketUniqueId ?? null,
        createdById: userId ?? null,
      },
    });
  });

  await writeTrail(
    { entityType: 'RiskAssessment', entityId: created.id, action: 'CREATE', newValue: created.assessmentNumber },
    userId,
  );
  return getAssessment(created.id);
};

export const updateAssessment = async (id: string, body: AssessmentUpdate, userId?: string) => {
  const existing = await loadAssessmentOrThrow(id);
  assertEditable(existing);

  if (body.registerId) {
    const register = await prisma.riskRegister.findUnique({ where: { id: body.registerId } });
    if (!register) throw BadRequest('Referenced risk register does not exist');
  }

  const data: Prisma.RiskAssessmentUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.objective !== undefined) data.objective = body.objective ?? null;
  if (body.scopeText !== undefined) data.scopeText = body.scopeText ?? null;
  if (body.methodology !== undefined && body.methodology !== null) data.methodology = body.methodology;
  if (body.registerId !== undefined) {
    data.register = body.registerId ? { connect: { id: body.registerId } } : { disconnect: true };
  }
  if (body.teamMembers !== undefined) {
    data.teamMembers = (body.teamMembers ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (body.leadId !== undefined) data.leadId = body.leadId ?? null;
  if (body.siteId !== undefined) data.siteId = body.siteId ?? null;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId ?? null;
  if (body.startedAt !== undefined) data.startedAt = body.startedAt ?? null;
  if (body.conclusion !== undefined) data.conclusion = body.conclusion ?? null;
  if (body.nextReviewAt !== undefined) data.nextReviewAt = body.nextReviewAt ?? null;
  if (body.triggerType !== undefined) data.triggerType = body.triggerType ?? null;
  if (body.triggerId !== undefined) data.triggerId = body.triggerId ?? null;
  if (body.workflowId !== undefined) data.workflowId = body.workflowId ?? null;
  if (body.workflowTicketId !== undefined) data.workflowTicketId = body.workflowTicketId ?? null;
  if (body.workflowTicketUniqueId !== undefined) {
    data.workflowTicketUniqueId = body.workflowTicketUniqueId ?? null;
  }

  const updated = await prisma.riskAssessment.update({ where: { id }, data });

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing.title,
      newValue: updated.title,
    },
    userId,
  );
  return getAssessment(id);
};

export const deleteAssessment = async (id: string, userId?: string) => {
  const existing = await prisma.riskAssessment.findUnique({
    where: { id },
    include: { _count: { select: { versions: true } }, lines: { select: { riskId: true } } },
  });
  if (!existing) throw NotFound('Risk assessment not found');

  // An approved (or superseded) assessment is a signed record — it is retained,
  // never deleted. Cancel it instead.
  if (LOCKED_STATUSES.includes(existing.status)) {
    throw Conflict(
      `Assessment ${existing.assessmentNumber} is ${existing.status} and is a retained record; it cannot be deleted.`,
    );
  }
  if (existing._count.versions > 0) {
    throw Conflict(
      `Assessment ${existing.assessmentNumber} has ${existing._count.versions} later version(s); delete those first.`,
    );
  }
  const promoted = existing.lines.filter((l) => l.riskId).length;
  if (promoted > 0) {
    throw Conflict(
      `Assessment ${existing.assessmentNumber} has ${promoted} line(s) promoted to tracked risks; ` +
        'cancel the assessment instead of deleting it.',
    );
  }

  await prisma.riskAssessment.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskAssessment', entityId: id, action: 'DELETE', oldValue: existing.assessmentNumber },
    userId,
  );
};

// ── Status transitions ──────────────────────────────────────────────────────

export const updateAssessmentStatus = async (
  id: string,
  body: UpdateAssessmentStatus,
  userId?: string,
) => {
  const existing = await loadAssessmentOrThrow(id);
  if (existing.status === body.status) return getAssessment(id);

  if (body.status === 'APPROVED') {
    throw BadRequest('Approval requires an e-signature — use POST /assessments/:id/approve');
  }
  if (body.status === 'REJECTED') {
    throw BadRequest('Rejection requires a reason — use POST /assessments/:id/reject');
  }
  if (body.status === 'SUPERSEDED' && existing.status === 'APPROVED') {
    // Superseding is a side effect of revising; doing it by hand would strand
    // the approved analysis with no successor.
    throw BadRequest('An approved assessment is superseded by POST /assessments/:id/revise');
  }
  assertTransition(existing.status, body.status);

  // Moving into assessment for the first time stamps the start of the work.
  const startedAt =
    body.status === 'IN_ASSESSMENT' && !existing.startedAt ? new Date() : existing.startedAt;

  await prisma.riskAssessment.update({
    where: { id },
    data: {
      status: body.status,
      startedAt,
      completedAt: body.status === 'PENDING_APPROVAL' ? new Date() : existing.completedAt,
      // Re-opening for rework clears the stale rejection note.
      rejectionReason: body.status === 'IN_ASSESSMENT' ? null : existing.rejectionReason,
    },
  });

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: existing.status,
      newValue: body.status,
      reason: body.reason ?? undefined,
    },
    userId,
  );
  return getAssessment(id);
};

/**
 * Approve — the compliance heart of the module.
 *
 * Re-authenticates the approver (21 CFR Part 11 §11.200), freezes the framework
 * definition onto the record so the analysis stays reconstructable after the
 * framework is re-versioned, and locks the assessment against further edits.
 */
export const approveAssessment = async (id: string, body: ApproveAssessment, userId?: string) => {
  const existing = await loadAssessmentOrThrow(id);
  assertTransition(existing.status, 'APPROVED');

  const lineCount = await prisma.riskAssessmentLine.count({ where: { assessmentId: id } });
  if (lineCount === 0) {
    throw BadRequest('An assessment cannot be approved with an empty worksheet');
  }
  const unscored = await prisma.riskAssessmentLine.count({
    where: { assessmentId: id, initialScore: null },
  });
  if (unscored > 0) {
    throw BadRequest(
      `${unscored} worksheet line(s) have no initial score. Complete the scoring before approval.`,
    );
  }

  // The full framework graph as it stands right now — factors, anchored level
  // definitions, bands and matrix cells.
  const { row: framework } = await loadScoringFramework(existing.frameworkId);
  const snapshot = serializeFramework(framework);

  // Signature first: a failed re-authentication must not leave the record
  // half-approved. recordSignature throws on a bad credential.
  const signature = await recordSignature(
    {
      entity_type: 'RiskAssessment',
      entity_id: id,
      meaning: body.meaning,
      credential: body.password,
    },
    userId,
  );

  const now = new Date();
  await prisma.riskAssessment.update({
    where: { id },
    data: {
      status: 'APPROVED',
      frameworkSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      approvedAt: now,
      approvedById: userId ?? null,
      completedAt: existing.completedAt ?? now,
      conclusion: body.conclusion ?? existing.conclusion,
      nextReviewAt: body.nextReviewAt ?? existing.nextReviewAt,
      rejectionReason: null,
    },
  });

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: existing.status,
      newValue: 'APPROVED',
      reason: body.reason ?? body.meaning,
    },
    userId,
  );

  return { ...(await getAssessment(id)), signature };
};

export const rejectAssessment = async (id: string, body: RejectAssessment, userId?: string) => {
  const existing = await loadAssessmentOrThrow(id);
  assertTransition(existing.status, 'REJECTED');

  await prisma.riskAssessment.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: body.reason },
  });

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: existing.status,
      newValue: 'REJECTED',
      reason: body.reason,
    },
    userId,
  );
  return getAssessment(id);
};

/**
 * Revise — the only way to change an approved assessment. Forks version+1 as a
 * DRAFT with every line copied, points it at the source via `parentId`, and
 * marks the source SUPERSEDED. The signed original stays byte-for-byte intact.
 */
export const reviseAssessment = async (id: string, body: ReviseAssessment, userId?: string) => {
  const source = await prisma.riskAssessment.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  });
  if (!source) throw NotFound('Risk assessment not found');

  if (!['APPROVED', 'PERIODIC_REVIEW'].includes(source.status)) {
    throw BadRequest(
      `Only an APPROVED or PERIODIC_REVIEW assessment can be revised; ${source.assessmentNumber} is ${source.status}. ` +
        'Edit it directly instead.',
    );
  }
  const alreadyRevised = await prisma.riskAssessment.count({ where: { parentId: id } });
  if (alreadyRevised > 0) {
    throw Conflict(`Assessment ${source.assessmentNumber} has already been revised`);
  }

  const created = await withUniqueRetry(async () => {
    const assessmentNumber = await nextNumber(
      prisma.riskAssessment,
      'assessmentNumber',
      'RA',
      new Date().getFullYear(),
    );
    return prisma.$transaction(async (tx) => {
      const copy = await tx.riskAssessment.create({
        data: {
          assessmentNumber,
          title: body.title ?? source.title,
          objective: source.objective,
          scopeText: source.scopeText,
          methodology: source.methodology,
          status: 'DRAFT',
          registerId: source.registerId,
          frameworkId: source.frameworkId,
          version: source.version + 1,
          parentId: source.id,
          teamMembers: source.teamMembers ?? Prisma.JsonNull,
          leadId: source.leadId,
          siteId: source.siteId,
          departmentId: source.departmentId,
          startedAt: null,
          conclusion: source.conclusion,
          nextReviewAt: source.nextReviewAt,
          triggerType: source.triggerType,
          triggerId: source.triggerId,
          createdById: userId ?? null,
        },
      });

      if (source.lines.length > 0) {
        await tx.riskAssessmentLine.createMany({
          data: source.lines.map((l) => ({
            assessmentId: copy.id,
            lineNumber: l.lineNumber,
            itemFunction: l.itemFunction,
            failureMode: l.failureMode,
            effect: l.effect,
            cause: l.cause,
            currentControls: l.currentControls,
            hazard: l.hazard,
            consequence: l.consequence,
            initialFactors: l.initialFactors ?? Prisma.JsonNull,
            initialScore: l.initialScore,
            initialLevelId: l.initialLevelId,
            actionPriority: l.actionPriority,
            recommendedAction: l.recommendedAction,
            ownerId: l.ownerId,
            dueDate: l.dueDate,
            residualFactors: l.residualFactors ?? Prisma.JsonNull,
            residualScore: l.residualScore,
            residualLevelId: l.residualLevelId,
            // The tracked risk a line already produced carries over — revising
            // must not orphan or duplicate it.
            riskId: l.riskId,
            isCritical: l.isCritical,
            notes: l.notes,
            createdById: userId ?? null,
          })),
        });
      }

      await tx.riskAssessment.update({ where: { id: source.id }, data: { status: 'SUPERSEDED' } });
      return copy;
    });
  });

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: source.id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: source.status,
      newValue: 'SUPERSEDED',
      reason: body.reason ?? `Revised as ${created.assessmentNumber}`,
    },
    userId,
  );
  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: created.id,
      action: 'CREATE',
      newValue: `${created.assessmentNumber} (v${created.version}, revision of ${source.assessmentNumber})`,
      reason: body.reason ?? undefined,
    },
    userId,
  );

  return getAssessment(created.id);
};

// ── Worksheet lines ─────────────────────────────────────────────────────────

export const listLines = async (assessmentId: string, q: ListLineQuery) => {
  const assessment = await prisma.riskAssessment.findUnique({
    where: { id: assessmentId },
    select: { id: true },
  });
  if (!assessment) throw NotFound('Risk assessment not found');

  const where: Prisma.RiskAssessmentLineWhereInput = { assessmentId };
  if (q.isCritical !== undefined) where.isCritical = q.isCritical;
  if (q.promoted !== undefined) where.riskId = q.promoted ? { not: null } : null;
  if (q.search) {
    where.OR = [
      { itemFunction: { contains: q.search, mode: 'insensitive' } },
      { failureMode: { contains: q.search, mode: 'insensitive' } },
      { hazard: { contains: q.search, mode: 'insensitive' } },
      { effect: { contains: q.search, mode: 'insensitive' } },
      { cause: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.riskAssessmentLine.findMany({
    where,
    include: lineInclude,
    orderBy: { lineNumber: 'asc' },
  });
  const levels = await levelLookupFor(rows);
  return rows.map((r) => serializeLine(r, levels));
};

/** Common field mapping for a line write — scores are always the server's. */
const lineWriteData = (body: LineUpsert, initial: LineScore, residual: LineScore) => ({
  itemFunction: body.itemFunction ?? null,
  failureMode: body.failureMode ?? null,
  effect: body.effect ?? null,
  cause: body.cause ?? null,
  currentControls: body.currentControls ?? null,
  hazard: body.hazard ?? null,
  consequence: body.consequence ?? null,
  initialFactors: initial.factors,
  initialScore: initial.score,
  initialLevelId: initial.levelId,
  actionPriority: initial.actionPriority,
  recommendedAction: body.recommendedAction ?? null,
  ownerId: body.ownerId ?? null,
  dueDate: body.dueDate ?? null,
  residualFactors: residual.factors,
  residualScore: residual.score,
  residualLevelId: residual.levelId,
  isCritical: body.isCritical,
  notes: body.notes ?? null,
});

export const createLine = async (assessmentId: string, body: LineUpsert, userId?: string) => {
  const assessment = await loadAssessmentOrThrow(assessmentId);
  assertEditable(assessment);

  const { scoring } = await loadScoringFramework(assessment.frameworkId);

  const created = await withUniqueRetry(async () => {
    const last = await prisma.riskAssessmentLine.findFirst({
      where: { assessmentId },
      orderBy: { lineNumber: 'desc' },
      select: { lineNumber: true },
    });
    const lineNumber = body.lineNumber ?? (last ? last.lineNumber + 1 : 1);
    const label = `Line ${lineNumber}`;
    const initial = scoreLine(scoring, body.initialFactors, `${label} (initial)`);
    const residual = scoreLine(scoring, body.residualFactors, `${label} (residual)`);
    return prisma.riskAssessmentLine.create({
      data: {
        assessmentId,
        lineNumber,
        ...lineWriteData(body, initial, residual),
        createdById: userId ?? null,
      },
      include: lineInclude,
    });
  });

  await writeTrail(
    {
      entityType: 'RiskAssessmentLine',
      entityId: created.id,
      action: 'CREATE',
      field: 'line',
      newValue: `${assessment.assessmentNumber} line ${created.lineNumber}`,
    },
    userId,
  );

  const levels = await levelLookupFor([created]);
  return serializeLine(created, levels);
};

export const updateLine = async (lineId: string, body: LineUpsert, userId?: string) => {
  const existing = await prisma.riskAssessmentLine.findUnique({
    where: { id: lineId },
    include: { assessment: true },
  });
  if (!existing) throw NotFound('Worksheet line not found');
  assertEditable(existing.assessment);

  const { scoring } = await loadScoringFramework(existing.assessment.frameworkId);
  const lineNumber = body.lineNumber ?? existing.lineNumber;
  const label = `Line ${lineNumber}`;
  const initial = scoreLine(scoring, body.initialFactors, `${label} (initial)`);
  const residual = scoreLine(scoring, body.residualFactors, `${label} (residual)`);

  const updated = await prisma.riskAssessmentLine
    .update({
      where: { id: lineId },
      data: { lineNumber, ...lineWriteData(body, initial, residual) },
      include: lineInclude,
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw Conflict(`Line number ${lineNumber} is already used in this worksheet`);
      }
      throw err;
    });

  await writeTrail(
    {
      entityType: 'RiskAssessmentLine',
      entityId: lineId,
      action: 'UPDATE',
      field: 'line',
      oldValue: existing.initialScore === null ? null : String(existing.initialScore),
      newValue: updated.initialScore === null ? null : String(updated.initialScore),
    },
    userId,
  );

  const levels = await levelLookupFor([updated]);
  return serializeLine(updated, levels);
};

export const deleteLine = async (lineId: string, userId?: string) => {
  const existing = await prisma.riskAssessmentLine.findUnique({
    where: { id: lineId },
    include: { assessment: true },
  });
  if (!existing) throw NotFound('Worksheet line not found');
  assertEditable(existing.assessment);
  if (existing.riskId) {
    throw Conflict(
      'This line has been promoted to a tracked risk and can no longer be deleted. Close the risk instead.',
    );
  }

  await prisma.riskAssessmentLine.delete({ where: { id: lineId } });
  await writeTrail(
    {
      entityType: 'RiskAssessmentLine',
      entityId: lineId,
      action: 'DELETE',
      field: 'line',
      oldValue: `${existing.assessment.assessmentNumber} line ${existing.lineNumber}`,
    },
    userId,
  );
};

/**
 * Bulk worksheet save — one atomic write behind a spreadsheet-style grid.
 *
 * Rows carrying an `id` are updated, rows without one are created, and in
 * `replace` mode rows absent from the payload are deleted. Everything happens in
 * a single transaction so a grid can never be left half-saved.
 *
 * Renumbering is the subtle part: (assessmentId, lineNumber) is unique, so
 * swapping two rows' positions would collide mid-write. Surviving rows are first
 * parked on temporary negative numbers, then given their final ones.
 */
export const saveLinesBulk = async (assessmentId: string, body: BulkLines, userId?: string) => {
  const assessment = await loadAssessmentOrThrow(assessmentId);
  assertEditable(assessment);

  const { scoring } = await loadScoringFramework(assessment.frameworkId);

  // Resolve every target line number up front so collisions surface before any
  // write, and score every row against the framework (throws on a bad rank).
  const prepared = body.lines.map((line, index) => {
    const lineNumber = line.lineNumber ?? index + 1;
    const label = `Line ${lineNumber}`;
    return {
      id: line.id ?? null,
      lineNumber,
      body: line as LineUpsert,
      initial: scoreLine(scoring, line.initialFactors, `${label} (initial)`),
      residual: scoreLine(scoring, line.residualFactors, `${label} (residual)`),
    };
  });

  const seenNumbers = new Set<number>();
  const seenIds = new Set<string>();
  for (const p of prepared) {
    if (seenNumbers.has(p.lineNumber)) {
      throw BadRequest(`Duplicate line number ${p.lineNumber} in the worksheet payload`);
    }
    seenNumbers.add(p.lineNumber);
    if (p.id) {
      if (seenIds.has(p.id)) throw BadRequest(`Line ${p.id} appears more than once in the payload`);
      seenIds.add(p.id);
    }
  }

  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.riskAssessmentLine.findMany({
        where: { assessmentId },
        select: { id: true, riskId: true, lineNumber: true },
        orderBy: { lineNumber: 'asc' },
      });
      const existingById = new Map(existing.map((l) => [l.id, l]));

      for (const id of seenIds) {
        if (!existingById.has(id)) {
          throw BadRequest(`Line ${id} does not belong to assessment ${assessment.assessmentNumber}`);
        }
      }

      const removed = body.replace ? existing.filter((l) => !seenIds.has(l.id)) : [];
      const promoted = removed.filter((l) => l.riskId);
      if (promoted.length > 0) {
        throw Conflict(
          `${promoted.length} line(s) omitted from the payload have been promoted to tracked risks and ` +
            'cannot be removed. Keep them in the worksheet or close the risks first.',
        );
      }

      if (removed.length > 0) {
        await tx.riskAssessmentLine.deleteMany({ where: { id: { in: removed.map((l) => l.id) } } });
      }

      // Park survivors on unique temporary numbers so any reordering in the
      // payload cannot trip the (assessmentId, lineNumber) unique index.
      const survivors = existing.filter((l) => !removed.some((r) => r.id === l.id));
      let temp = -1;
      for (const s of survivors) {
        await tx.riskAssessmentLine.update({ where: { id: s.id }, data: { lineNumber: temp-- } });
      }

      for (const p of prepared) {
        const data = lineWriteData(p.body, p.initial, p.residual);
        if (p.id) {
          await tx.riskAssessmentLine.update({
            where: { id: p.id },
            data: { lineNumber: p.lineNumber, ...data },
          });
        } else {
          await tx.riskAssessmentLine.create({
            data: {
              assessmentId,
              lineNumber: p.lineNumber,
              ...data,
              createdById: userId ?? null,
            },
          });
        }
      }
    },
    { timeout: 60_000, maxWait: 15_000 },
  );

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: assessmentId,
      action: 'UPDATE',
      field: 'lines',
      newValue: `${prepared.length} line(s) saved${body.replace ? ' (worksheet replaced)' : ''}`,
      reason: body.reason ?? undefined,
    },
    userId,
  );

  return listLines(assessmentId, { });
};

// ── Promotion ───────────────────────────────────────────────────────────────

/**
 * Turn a worksheet line into a tracked risk in the register.
 *
 * The worksheet is a working paper; the register is the system of record. The
 * promoted risk carries the line's factors and computed scores verbatim — they
 * are not recomputed, because the line was already scored server-side against
 * the same framework, and score snapshots are written so the register's history
 * shows where the numbers came from.
 */
export const promoteLine = async (lineId: string, body: PromoteLine, userId?: string) => {
  const line = await prisma.riskAssessmentLine.findUnique({
    where: { id: lineId },
    include: { assessment: true },
  });
  if (!line) throw NotFound('Worksheet line not found');
  if (line.riskId) {
    throw Conflict('This worksheet line has already been promoted to a tracked risk');
  }

  const assessment = line.assessment;
  const registerId = body.registerId ?? assessment.registerId;
  if (!registerId) {
    throw BadRequest(
      'This assessment is not attached to a risk register — supply a registerId to promote the line into',
    );
  }
  const register = await prisma.riskRegister.findUnique({ where: { id: registerId } });
  if (!register) throw BadRequest('Referenced risk register does not exist');
  if (!register.isActive) throw BadRequest(`Register "${register.name}" is inactive`);

  if (line.initialScore === null) {
    throw BadRequest('Score the line before promoting it to a tracked risk');
  }

  const title =
    body.title ?? line.failureMode ?? line.hazard ?? line.itemFunction ?? `${assessment.assessmentNumber} line ${line.lineNumber}`;

  const { scoring } = await loadScoringFramework(assessment.frameworkId);
  const levelById = new Map(scoring.levels.map((l) => [l.id, l]));
  const residualLevel = line.residualLevelId ? levelById.get(line.residualLevelId) : undefined;
  const nextReviewAt = residualLevel ? nextReviewDateFor(residualLevel) : null;
  const userName = await resolveUserName(userId);

  const risk = await withUniqueRetry(async () => {
    const riskNumber = await nextNumber(prisma.risk, 'riskNumber', 'RISK', new Date().getFullYear());
    return prisma.$transaction(async (tx) => {
      const created = await tx.risk.create({
        data: {
          riskNumber,
          title: title.slice(0, 300),
          description: line.effect ?? line.notes ?? null,
          registerId,
          frameworkId: assessment.frameworkId,
          categoryId: body.categoryId ?? null,
          hazard: line.hazard,
          cause: line.cause,
          consequence: line.consequence,
          status: line.residualScore !== null ? 'RESIDUAL_ASSESSED' : 'IDENTIFIED',
          initialFactors: line.initialFactors ?? Prisma.JsonNull,
          initialScore: line.initialScore,
          initialLevelId: line.initialLevelId,
          residualFactors: line.residualFactors ?? Prisma.JsonNull,
          residualScore: line.residualScore,
          residualLevelId: line.residualLevelId,
          ownerId: body.ownerId ?? line.ownerId ?? assessment.leadId,
          departmentId: assessment.departmentId,
          siteId: assessment.siteId ?? register.siteId,
          nextReviewAt,
          createdById: userId ?? null,
        },
      });

      // Score history: the register must be able to explain its own numbers.
      const snapshots: Prisma.RiskScoreSnapshotCreateManyInput[] = [];
      const initialLevel = line.initialLevelId ? levelById.get(line.initialLevelId) : undefined;
      if (line.initialScore !== null && initialLevel) {
        snapshots.push({
          riskId: created.id,
          stage: 'INITIAL',
          factors: (line.initialFactors ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          score: line.initialScore,
          levelCode: initialLevel.code,
          levelLabel: initialLevel.label,
          formula: scoring.formula as Prisma.RiskScoreSnapshotCreateManyInput['formula'],
          frameworkId: assessment.frameworkId,
          reason: `Promoted from ${assessment.assessmentNumber} line ${line.lineNumber}`,
          userId: userId ?? null,
          userName,
        });
      }
      if (line.residualScore !== null && residualLevel) {
        snapshots.push({
          riskId: created.id,
          stage: 'RESIDUAL',
          factors: (line.residualFactors ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          score: line.residualScore,
          levelCode: residualLevel.code,
          levelLabel: residualLevel.label,
          formula: scoring.formula as Prisma.RiskScoreSnapshotCreateManyInput['formula'],
          frameworkId: assessment.frameworkId,
          reason: `Promoted from ${assessment.assessmentNumber} line ${line.lineNumber}`,
          userId: userId ?? null,
          userName,
        });
      }
      if (snapshots.length > 0) await tx.riskScoreSnapshot.createMany({ data: snapshots });

      // Inherit the assessment's links. Without this a risk promoted out of a
      // change-control assessment has no connection to the change that produced
      // it: the ticket's Risk panel stays empty, and the NO_BLOCKING_RISK and
      // RISK_CONTROLS_VERIFIED stage gates find nothing to evaluate — they would
      // pass a change carrying a critical risk. The trigger source is included,
      // so the chain ticket → assessment → risk is complete in both directions.
      const inherited = await tx.riskLink.findMany({
        where: { assessmentId: assessment.id },
        select: { entityType: true, entityId: true, label: true, relation: true },
      });
      const seen = new Set(inherited.map((l) => `${l.entityType}:${l.entityId}`));
      if (
        assessment.triggerType &&
        assessment.triggerId &&
        !seen.has(`${assessment.triggerType}:${assessment.triggerId}`)
      ) {
        inherited.push({
          entityType: assessment.triggerType,
          entityId: assessment.triggerId,
          label: null,
          relation: 'APPLIES_TO',
        });
      }
      for (const l of inherited) {
        await tx.riskLink.create({
          data: {
            riskId: created.id,
            entityType: l.entityType,
            entityId: l.entityId,
            label: l.label,
            relation: l.relation ?? 'APPLIES_TO',
            createdById: userId ?? null,
          },
        }).catch(() => undefined); // a duplicate link is not a promotion failure
      }

      await tx.riskAssessmentLine.update({ where: { id: lineId }, data: { riskId: created.id } });
      return created;
    });
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: risk.id,
      action: 'CREATE',
      newValue: `${risk.riskNumber} (promoted from ${assessment.assessmentNumber} line ${line.lineNumber})`,
      reason: body.reason ?? undefined,
    },
    userId,
  );
  await writeTrail(
    {
      entityType: 'RiskAssessmentLine',
      entityId: lineId,
      action: 'UPDATE',
      field: 'riskId',
      newValue: risk.riskNumber,
      reason: body.reason ?? undefined,
    },
    userId,
  );

  // The promoted risk now feeds every entity it inherited a link to.
  await onRiskChanged(risk.id);

  const promoted = await prisma.riskAssessmentLine.findUniqueOrThrow({
    where: { id: lineId },
    include: lineInclude,
  });
  const levels = await levelLookupFor([promoted]);
  return {
    line: serializeLine(promoted, levels),
    risk: { id: risk.id, risk_number: risk.riskNumber, title: risk.title, status: risk.status },
  };
};

// ── Links on an assessment ──────────────────────────────────────────────────

/**
 * Attach an assessment to a record it bears on.
 *
 * Two routes lead here and both matter. An assessment raised *from* a change
 * ticket carries that ticket as its trigger; an assessment authored
 * independently — a periodic process FMEA, say — has no trigger but may still be
 * the assessment a change relies on. Without this, the second case could never
 * satisfy a change-control gate, and teams would be forced to re-do work they
 * had already done properly.
 *
 * Risks promoted from the assessment inherit these links, so attaching an
 * assessment to a ticket also connects everything the assessment produces.
 */
export const addAssessmentLink = async (
  assessmentId: string,
  body: LinkUpsert,
  userId?: string,
) => {
  const assessment = await prisma.riskAssessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, assessmentNumber: true },
  });
  if (!assessment) throw NotFound('Risk assessment not found');

  const entity = linkableEntity(body.entityType);
  if (!entity) {
    throw BadRequest(
      `"${body.entityType}" is not a linkable record type. Known types: ${linkableTypeNames().join(', ')}`,
    );
  }
  const ref = await entity.find(body.entityId);
  if (!ref) throw BadRequest(`No ${entity.label} exists with id ${body.entityId}`);

  const existing = await prisma.riskLink.findFirst({
    where: {
      assessmentId,
      entityType: body.entityType,
      entityId: body.entityId,
      relation: body.relation ?? null,
    },
    select: { id: true },
  });
  if (existing) throw Conflict('That link already exists on this assessment');

  const created = await prisma.riskLink.create({
    data: {
      assessmentId,
      entityType: body.entityType,
      entityId: body.entityId,
      label: body.label?.trim() || `${ref.number} — ${ref.title}`,
      relation: body.relation ?? null,
      createdById: userId ?? null,
    },
  });

  await writeTrail(
    {
      entityType: 'RiskAssessment',
      entityId: assessmentId,
      action: 'UPDATE',
      field: 'links',
      newValue: `${body.entityType}:${body.entityId}`,
      reason: `Linked ${entity.label} ${ref.number}`,
    },
    userId,
  );

  return {
    id: created.id,
    entity_type: created.entityType,
    entity_type_label: entity.label,
    entity_id: created.entityId,
    label: created.label,
    entity_route: entity.route ? entity.route(created.entityId) : null,
    relation: created.relation,
    created_at: created.createdAt,
  };
};

/** Assessments attached to a record — the reverse of `addAssessmentLink`. */
export const listAssessmentsLinkedTo = async (entityType: string, entityId: string) => {
  const links = await prisma.riskLink.findMany({
    where: { entityType, entityId, assessmentId: { not: null } },
    select: { id: true, relation: true, createdAt: true, assessmentId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (links.length === 0) return [];

  const rows = await prisma.riskAssessment.findMany({
    where: { id: { in: links.map((l) => l.assessmentId as string) } },
    include: assessmentInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return links
    .map((l) => {
      const row = byId.get(l.assessmentId as string);
      if (!row) return null;
      return {
        link_id: l.id,
        relation: l.relation,
        linked_at: l.createdAt,
        assessment: serializeAssessment(row),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
};
