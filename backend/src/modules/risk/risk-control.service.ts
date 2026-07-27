/**
 * Risk controls and formal residual-risk acceptance (Risk Management phase 3/4).
 *
 * Two invariants this file exists to protect:
 *
 *  1. A residual score is only meaningful while the controls it assumed are
 *     actually effective. The moment a control is judged INEFFECTIVE the
 *     residual assessment is void — we clear it and push the risk back to
 *     TREATMENT_PLANNED rather than leaving a green risk backed by a control
 *     that does not work.
 *  2. Accepting residual risk is a signed act. It requires an e-signature, a
 *     justification, an existing residual score, and — when the resolved level
 *     is UNACCEPTABLE — an explicit benefit-risk rationale (ISO 14971 §8).
 */
import { Prisma, type RiskControlStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { recordSignature, writeTrail } from '../audit/compliance.service';
import { createCapa } from '../audit/capa.service';
import { onRiskChanged } from './risk-profile.service';
import { assertTrainingComplete, assignTrainingForControl } from './risk-control-effect.service';
import { assertApproved, assertWithinAppetite, loadLevelPolicy } from './risk-policy.service';
import type {
  AcceptRisk,
  DecideRiskApproval,
  RequestRiskApproval,
  ControlCreate,
  ControlStatusUpdate,
  ControlUpdate,
  ListControlQuery,
  VerifyControl,
} from './risk-control.schema';

// Next sequence number derived from the highest EXISTING value — not a row
// count, which collides the moment any earlier row is deleted and leaves a gap.
// Behaviour is identical to risk.service.ts / capa.service.ts.
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

// ── Serialization ───────────────────────────────────────────────────────────

const controlInclude = {
  risk: { select: { id: true, riskNumber: true, title: true, status: true, registerId: true } },
  libraryItem: { select: { id: true, name: true, code: true, type: true, hierarchy: true } },
} satisfies Prisma.RiskControlInclude;

type ControlRow = Prisma.RiskControlGetPayload<{ include: typeof controlInclude }>;

const isControlOverdue = (r: ControlRow) =>
  !!r.dueDate &&
  r.dueDate < new Date() &&
  r.status !== 'IMPLEMENTED' &&
  r.status !== 'VERIFIED' &&
  r.status !== 'CANCELLED';

const serializeControl = (r: ControlRow) => ({
  id: r.id,
  control_number: r.controlNumber,
  risk_id: r.riskId,
  risk: r.risk
    ? {
        id: r.risk.id,
        risk_number: r.risk.riskNumber,
        title: r.risk.title,
        status: r.risk.status,
        register_id: r.risk.registerId,
      }
    : null,
  title: r.title,
  description: r.description,
  type: r.type,
  hierarchy: r.hierarchy,
  status: r.status,
  owner_id: r.ownerId,
  due_date: r.dueDate,
  implemented_at: r.implementedAt,
  verified_by_id: r.verifiedById,
  verified_at: r.verifiedAt,
  effectiveness: r.effectiveness,
  is_effective: r.isEffective,
  capa_id: r.capaId,
  action_item_id: r.actionItemId,
  document_id: r.documentId,
  lms_course_id: r.lmsCourseId,
  library_item: r.libraryItem,
  is_overdue: isControlOverdue(r),
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

// ── Cross-module references ─────────────────────────────────────────────────

/**
 * Controls point at the objects that actually execute them (a CAPA, an action
 * item, an SOP, a training course). Those are plain id columns with no FK, so
 * existence is checked here — a dangling reference is silent data loss for
 * anyone auditing how the risk was treated.
 */
const assertReferencesExist = async (body: ControlCreate | ControlUpdate) => {
  if (body.capaId) {
    const capa = await prisma.capa.findUnique({ where: { id: body.capaId }, select: { id: true } });
    if (!capa) throw BadRequest('Referenced CAPA does not exist');
  }
  if (body.actionItemId) {
    const item = await prisma.actionItem.findUnique({
      where: { id: body.actionItemId },
      select: { id: true },
    });
    if (!item) throw BadRequest('Referenced action item does not exist');
  }
  if (body.documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: body.documentId },
      select: { id: true },
    });
    if (!doc) throw BadRequest('Referenced document does not exist');
  }
  if (body.lmsCourseId) {
    const course = await prisma.lmsCourse.findUnique({
      where: { id: body.lmsCourseId },
      select: { id: true },
    });
    if (!course) throw BadRequest('Referenced training course does not exist');
  }
  if (body.libraryItemId) {
    const lib = await prisma.controlLibraryItem.findUnique({
      where: { id: body.libraryItemId },
      select: { id: true, isActive: true },
    });
    if (!lib) throw BadRequest('Referenced control library item does not exist');
    if (!lib.isActive) throw BadRequest('Referenced control library item is inactive');
  }
};

// ── Auto-CAPA ───────────────────────────────────────────────────────────────

/**
 * Raise a CAPA when the risk's resolved level demands one (RiskLevelDef.
 * requiresCapa) and no open CAPA is already linked, then record the linkage as
 * a RiskLink so the risk detail page shows it.
 *
 * Best-effort by design: an unavailable CAPA workflow, a misconfigured level or
 * any other failure must never block the control / review operation that
 * triggered it. The caller is not told whether a CAPA was raised.
 */
export const ensureCapaForRisk = async (riskId: string, userId?: string): Promise<void> => {
  try {
    const risk = await prisma.risk.findUnique({
      where: { id: riskId },
      select: {
        id: true,
        riskNumber: true,
        title: true,
        description: true,
        status: true,
        ownerId: true,
        departmentId: true,
        initialLevelId: true,
        residualLevelId: true,
      },
    });
    if (!risk) return;
    if (risk.status === 'CLOSED') return;

    // The current judgement of the risk: residual when one exists, else initial.
    const levelId = risk.residualLevelId ?? risk.initialLevelId;
    if (!levelId) return;
    const level = await prisma.riskLevelDef.findUnique({
      where: { id: levelId },
      select: { code: true, label: true, requiresCapa: true },
    });
    if (!level?.requiresCapa) return;

    // Already covered? Any linked CAPA that is not closed or cancelled counts.
    const links = await prisma.riskLink.findMany({
      where: { riskId, entityType: 'Capa' },
      select: { entityId: true },
    });
    if (links.length > 0) {
      const open = await prisma.capa.count({
        where: { id: { in: links.map((l) => l.entityId) }, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      });
      if (open > 0) return;
    }

    const capa = await createCapa(
      {
        title: `${risk.riskNumber} — ${risk.title}`,
        description:
          `Automatically raised because risk ${risk.riskNumber} resolved to level ` +
          `${level.label} (${level.code}), which requires a CAPA.` +
          (risk.description ? `\n\n${risk.description}` : ''),
        type: 'CORRECTIVE',
        owner_id: risk.ownerId ?? null,
        department_id: risk.departmentId ?? null,
      },
      userId,
    );

    await prisma.riskLink.create({
      data: {
        riskId,
        entityType: 'Capa',
        entityId: capa.id,
        label: capa.capa_number,
        relation: 'MITIGATED_BY',
        createdById: userId ?? null,
      },
    });

    await writeTrail(
      {
        entityType: 'Risk',
        entityId: riskId,
        action: 'UPDATE',
        field: 'links',
        newValue: `Capa:${capa.id}`,
        reason: `Auto-raised CAPA ${capa.capa_number}: risk level ${level.code} requires a CAPA`,
      },
      userId,
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[risk-control] auto-CAPA for risk ${riskId} failed:`,
      e instanceof Error ? e.message : e,
    );
  }
};

// ── Controls: queries ───────────────────────────────────────────────────────

export const listControls = async (q: ListControlQuery) => {
  const where: Prisma.RiskControlWhereInput = {};
  if (q.riskId) where.riskId = q.riskId;
  if (q.registerId) where.risk = { registerId: q.registerId };
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  if (q.hierarchy) where.hierarchy = q.hierarchy;
  if (q.ownerId) where.ownerId = q.ownerId;
  if (q.dueBefore) where.dueDate = { lt: q.dueBefore };
  if (q.overdue) {
    // Overdue means "past due and not yet delivered" — an implemented or
    // verified control is never overdue, whatever its due date said.
    where.dueDate = { ...(where.dueDate as Prisma.DateTimeFilter | undefined), lt: new Date() };
    where.status = { in: ['PLANNED', 'IN_PROGRESS', 'INEFFECTIVE'] };
  }
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { controlNumber: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.riskControl.findMany({
      where,
      include: controlInclude,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.riskControl.count({ where }),
  ]);

  return { data: rows.map(serializeControl), total, page: q.page, page_size: q.pageSize };
};

export const getControl = async (id: string) => {
  const row = await prisma.riskControl.findUnique({ where: { id }, include: controlInclude });
  if (!row) throw NotFound('Risk control not found');
  return serializeControl(row);
};

export const listControlsForRisk = async (riskId: string) => {
  const risk = await prisma.risk.findUnique({ where: { id: riskId }, select: { id: true } });
  if (!risk) throw NotFound('Risk not found');
  const rows = await prisma.riskControl.findMany({
    where: { riskId },
    include: controlInclude,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(serializeControl);
};

// ── Controls: mutations ─────────────────────────────────────────────────────

export const createControl = async (riskId: string, body: ControlCreate, userId?: string) => {
  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    select: { id: true, status: true },
  });
  if (!risk) throw NotFound('Risk not found');
  if (risk.status === 'CLOSED') throw BadRequest('Cannot add controls to a closed risk');
  await assertReferencesExist(body);

  const created = await withUniqueRetry(async () => {
    const controlNumber = await nextNumber(
      prisma.riskControl,
      'controlNumber',
      'RC',
      new Date().getFullYear(),
    );
    return prisma.riskControl.create({
      data: {
        controlNumber,
        riskId,
        title: body.title,
        description: body.description ?? null,
        type: body.type,
        hierarchy: body.hierarchy ?? null,
        ownerId: body.ownerId ?? null,
        dueDate: body.dueDate ?? null,
        capaId: body.capaId ?? null,
        actionItemId: body.actionItemId ?? null,
        documentId: body.documentId ?? null,
        lmsCourseId: body.lmsCourseId ?? null,
        libraryItemId: body.libraryItemId ?? null,
        createdById: userId ?? null,
      },
      include: controlInclude,
    });
  });

  await writeTrail(
    {
      entityType: 'RiskControl',
      entityId: created.id,
      action: 'CREATE',
      newValue: created.controlNumber,
      reason: `Control planned on risk ${created.risk.riskNumber}`,
    },
    userId,
  );

  // Planning a treatment is the point at which a CAPA-requiring level should
  // already have a CAPA behind it. Best-effort; never blocks the response.
  await ensureCapaForRisk(riskId, userId);
  // A control that names a training course should actually assign that
  // training — otherwise the link is a note, not a control.
  await assignTrainingForControl(
    { id: created.id, controlNumber: created.controlNumber, lmsCourseId: created.lmsCourseId, riskId },
    userId,
  );
  // openControls is part of the profile, so a new control shifts it.
  await onRiskChanged(riskId);

  return serializeControl(created);
};

export const updateControl = async (id: string, body: ControlUpdate, userId?: string) => {
  const existing = await prisma.riskControl.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk control not found');
  if (existing.status === 'CANCELLED') throw BadRequest('A cancelled control cannot be edited');
  await assertReferencesExist(body);

  const updated = await prisma.riskControl.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description === undefined ? existing.description : body.description,
      type: body.type ?? existing.type,
      hierarchy: body.hierarchy === undefined ? existing.hierarchy : body.hierarchy,
      ownerId: body.ownerId === undefined ? existing.ownerId : body.ownerId,
      dueDate: body.dueDate === undefined ? existing.dueDate : body.dueDate,
      capaId: body.capaId === undefined ? existing.capaId : body.capaId,
      actionItemId: body.actionItemId === undefined ? existing.actionItemId : body.actionItemId,
      documentId: body.documentId === undefined ? existing.documentId : body.documentId,
      lmsCourseId: body.lmsCourseId === undefined ? existing.lmsCourseId : body.lmsCourseId,
      libraryItemId: body.libraryItemId === undefined ? existing.libraryItemId : body.libraryItemId,
    },
    include: controlInclude,
  });

  await writeTrail(
    {
      entityType: 'RiskControl',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing.title,
      newValue: updated.title,
    },
    userId,
  );
  return serializeControl(updated);
};

/**
 * Legal control transitions. Declared explicitly so a client cannot record a
 * control as VERIFIED without it ever having been implemented.
 *
 * INEFFECTIVE is a verdict, not an end state: rework restarts at IN_PROGRESS.
 */
const ALLOWED_CONTROL_TRANSITIONS: Record<RiskControlStatus, RiskControlStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IMPLEMENTED', 'CANCELLED'],
  IMPLEMENTED: ['VERIFIED', 'INEFFECTIVE'],
  VERIFIED: ['INEFFECTIVE'],
  INEFFECTIVE: ['IN_PROGRESS'],
  CANCELLED: [],
};

/**
 * Void the residual assessment of a risk whose control turned out not to work.
 *
 * The residual score was computed *assuming* the control was effective. Leaving
 * it in place would leave the register showing a treated, tolerable risk that in
 * fact is not treated at all — the single most damaging kind of stale data in a
 * risk file. Also drops the acceptance date: an acceptance made against a void
 * residual score no longer stands.
 */
const invalidateResidual = async (riskId: string, controlNumber: string, userId?: string) => {
  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    select: { id: true, status: true, residualScore: true, residualLevelId: true, acceptedAt: true },
  });
  if (!risk) return;
  if (risk.residualScore === null && risk.residualLevelId === null && risk.status !== 'ACCEPTED') return;

  const reason =
    `Control ${controlNumber} was judged ineffective — the residual assessment it ` +
    'supported no longer holds and has been cleared.';

  await prisma.risk.update({
    where: { id: riskId },
    data: {
      residualFactors: Prisma.JsonNull,
      residualScore: null,
      residualLevelId: null,
      acceptedAt: null,
      // Closed risks keep their end state; anything else goes back to planning.
      status: risk.status === 'CLOSED' ? risk.status : 'TREATMENT_PLANNED',
    },
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: riskId,
      action: 'UPDATE',
      field: 'residual_score',
      oldValue: risk.residualScore === null ? null : String(risk.residualScore),
      newValue: null,
      reason,
    },
    userId,
  );
  if (risk.status !== 'CLOSED' && risk.status !== 'TREATMENT_PLANNED') {
    await writeTrail(
      {
        entityType: 'Risk',
        entityId: riskId,
        action: 'TRANSITION',
        field: 'status',
        oldValue: risk.status,
        newValue: 'TREATMENT_PLANNED',
        reason,
      },
      userId,
    );
  }
};

export const updateControlStatus = async (
  id: string,
  body: ControlStatusUpdate,
  userId?: string,
) => {
  const existing = await prisma.riskControl.findUnique({
    where: { id },
    include: { risk: { select: { id: true } } },
  });
  if (!existing) throw NotFound('Risk control not found');
  if (existing.status === body.status) return getControl(id);

  const allowed = ALLOWED_CONTROL_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(body.status)) {
    throw BadRequest(
      `Cannot move control from ${existing.status} to ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }

  const updated = await prisma.riskControl.update({
    where: { id },
    data: {
      status: body.status,
      implementedAt:
        body.status === 'IMPLEMENTED' ? (existing.implementedAt ?? new Date()) : existing.implementedAt,
      // Re-opening for rework voids the previous effectiveness verdict.
      ...(body.status === 'IN_PROGRESS'
        ? { isEffective: null, verifiedAt: null, verifiedById: null }
        : {}),
    },
    include: controlInclude,
  });

  await writeTrail(
    {
      entityType: 'RiskControl',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: existing.status,
      newValue: updated.status,
      reason: body.reason ?? undefined,
    },
    userId,
  );

  if (body.status === 'INEFFECTIVE') {
    await invalidateResidual(existing.riskId, existing.controlNumber, userId);
    await ensureCapaForRisk(existing.riskId, userId);
  }
  await onRiskChanged(existing.riskId);

  return serializeControl(updated);
};

/**
 * Record the effectiveness verification of an implemented control. An effective
 * control lands on VERIFIED; an ineffective one lands on INEFFECTIVE and voids
 * the residual assessment it was supporting.
 */
export const verifyControl = async (id: string, body: VerifyControl, userId?: string) => {
  const existing = await prisma.riskControl.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk control not found');
  if (existing.status !== 'IMPLEMENTED' && existing.status !== 'VERIFIED') {
    throw BadRequest(
      `Only an implemented control can be verified (control is ${existing.status})`,
    );
  }

  // "We trained everyone" stops being a claim and becomes a number the system
  // will not let you overstate. Only binds when the risk's level sets
  // requiresTraining AND the control is an administrative one.
  if (body.isEffective) {
    await assertTrainingComplete({
      controlNumber: existing.controlNumber,
      hierarchy: existing.hierarchy,
      lmsCourseId: existing.lmsCourseId,
      riskId: existing.riskId,
    });
  }

  const status: RiskControlStatus = body.isEffective ? 'VERIFIED' : 'INEFFECTIVE';
  const updated = await prisma.riskControl.update({
    where: { id },
    data: {
      status,
      isEffective: body.isEffective,
      effectiveness: body.effectiveness,
      verifiedAt: body.verifiedAt ?? new Date(),
      verifiedById: userId ?? null,
      implementedAt: existing.implementedAt ?? new Date(),
    },
    include: controlInclude,
  });

  await writeTrail(
    {
      entityType: 'RiskControl',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: existing.status,
      newValue: status,
      reason: `Effectiveness verification: ${body.isEffective ? 'effective' : 'NOT effective'} — ${body.effectiveness}`,
    },
    userId,
  );

  if (!body.isEffective) {
    await invalidateResidual(existing.riskId, existing.controlNumber, userId);
    await ensureCapaForRisk(existing.riskId, userId);
  }
  await onRiskChanged(existing.riskId);

  return serializeControl(updated);
};

export const deleteControl = async (id: string, userId?: string) => {
  const existing = await prisma.riskControl.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk control not found');
  // A verified control is evidence of how the residual risk was reached; it is
  // cancelled, never deleted.
  if (existing.status === 'VERIFIED') {
    throw Conflict(
      `Control ${existing.controlNumber} has been verified and cannot be deleted. Mark it INEFFECTIVE instead.`,
    );
  }
  await prisma.riskControl.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskControl', entityId: id, action: 'DELETE', oldValue: existing.controlNumber },
    userId,
  );
  await onRiskChanged(existing.riskId);
};

// ── Residual-risk acceptance ────────────────────────────────────────────────

const serializeAcceptance = (a: {
  id: string;
  riskId: string;
  justification: string;
  residualScore: number | null;
  residualLevelCode: string | null;
  benefitRiskRationale: string | null;
  acceptedById: string | null;
  acceptedAt: Date;
  eSignatureId: string | null;
}) => ({
  id: a.id,
  risk_id: a.riskId,
  justification: a.justification,
  residual_score: a.residualScore,
  residual_level_code: a.residualLevelCode,
  benefit_risk_rationale: a.benefitRiskRationale,
  accepted_by_id: a.acceptedById,
  accepted_at: a.acceptedAt,
  e_signature_id: a.eSignatureId,
});

/**
 * Formal, e-signed acceptance of residual risk.
 *
 * Requires a residual score (there is nothing to accept otherwise), a
 * justification, and — when the residual level's acceptance policy is
 * UNACCEPTABLE — a benefit-risk rationale, which is the ISO 14971 §8 condition
 * for keeping an otherwise unacceptable risk.
 */
export const acceptRisk = async (riskId: string, body: AcceptRisk, userId?: string) => {
  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    select: {
      id: true,
      riskNumber: true,
      status: true,
      residualScore: true,
      residualLevelId: true,
      siteId: true,
      categoryId: true,
    },
  });
  if (!risk) throw NotFound('Risk not found');
  if (risk.status === 'CLOSED') throw BadRequest('A closed risk cannot be accepted');
  if (risk.residualScore === null || !risk.residualLevelId) {
    throw BadRequest('A residual score is required before residual risk can be accepted');
  }

  const level = await prisma.riskLevelDef.findUnique({
    where: { id: risk.residualLevelId },
    select: { code: true, label: true, acceptance: true },
  });
  if (!level) throw BadRequest('The residual risk level of this risk no longer exists — rescore it first');

  if (level.acceptance === 'UNACCEPTABLE' && !body.benefitRiskRationale?.trim()) {
    throw BadRequest(
      `Residual risk is ${level.label} (UNACCEPTABLE). A benefit-risk rationale is required to accept it (ISO 14971 §8).`,
    );
  }

  // Policy gates, evaluated before the signature is taken so a rejected
  // acceptance never burns a credential or leaves a dangling ESignature row.
  const policy = await loadLevelPolicy(risk.residualLevelId);
  if (policy) {
    // Segregation of duties: someone other than the acceptor must have approved.
    await assertApproved(riskId, risk.riskNumber, policy, userId);
    // ISO 31000 §6.3.4 — a risk above the organisation's stated tolerance needs
    // the review that appetite demands, not just a justification.
    await assertWithinAppetite(
      risk.riskNumber,
      risk.siteId,
      risk.categoryId,
      policy.severityRank,
      !!body.boardReviewReference?.trim(),
    );
  }

  // Re-authenticates the signer and writes the ESignature + SIGN trail entry.
  const signature = await recordSignature(
    {
      entity_type: 'Risk',
      entity_id: riskId,
      meaning: body.meaning ?? `Accept residual risk ${risk.riskNumber} (${level.code})`,
      credential: body.credential,
    },
    userId,
  );

  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.riskAcceptanceRecord.create({
      data: {
        riskId,
        justification: body.justification,
        residualScore: risk.residualScore,
        residualLevelCode: level.code,
        benefitRiskRationale: body.benefitRiskRationale ?? null,
        acceptedById: userId ?? null,
        acceptedAt: now,
        eSignatureId: signature.id,
      },
    });
    await tx.risk.update({
      where: { id: riskId },
      data: { status: 'ACCEPTED', acceptedAt: now },
    });
    return created;
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: riskId,
      action: 'TRANSITION',
      field: 'status',
      oldValue: risk.status,
      newValue: 'ACCEPTED',
      reason: `Residual risk accepted (${level.code}, score ${risk.residualScore}): ${body.justification}`,
    },
    userId,
  );
  // Acceptance clears the risk from unacceptableCount — the field the CoA and
  // batch-release gates key off — so the profile must not lag behind the
  // signature that authorised it.
  await onRiskChanged(riskId);

  return { ...serializeAcceptance(record), signature };
};

export const listAcceptances = async (riskId: string) => {
  const risk = await prisma.risk.findUnique({ where: { id: riskId }, select: { id: true } });
  if (!risk) throw NotFound('Risk not found');
  const rows = await prisma.riskAcceptanceRecord.findMany({
    where: { riskId },
    orderBy: { acceptedAt: 'desc' },
  });
  return rows.map(serializeAcceptance);
};

// ── Second-person approval (requiresApproval) ───────────────────────────────

const serializeApproval = (a: {
  id: string;
  riskId: string;
  levelCode: string | null;
  status: string;
  requestedById: string | null;
  requestedAt: Date;
  decidedById: string | null;
  decidedAt: Date | null;
  decision: string | null;
  comment: string | null;
  eSignatureId: string | null;
}) => ({
  id: a.id,
  risk_id: a.riskId,
  level_code: a.levelCode,
  status: a.status,
  requested_by_id: a.requestedById,
  requested_at: a.requestedAt,
  decided_by_id: a.decidedById,
  decided_at: a.decidedAt,
  decision: a.decision,
  comment: a.comment,
  e_signature_id: a.eSignatureId,
});

export const listApprovals = async (riskId: string) => {
  const risk = await prisma.risk.findUnique({ where: { id: riskId }, select: { id: true } });
  if (!risk) throw NotFound('Risk not found');
  const rows = await prisma.riskApproval.findMany({
    where: { riskId },
    orderBy: { requestedAt: 'desc' },
  });
  return rows.map(serializeApproval);
};

/**
 * Open an approval request. Only one may be pending at a time — a second open
 * request would let two approvers each satisfy the rule independently, which is
 * exactly the ambiguity segregation of duties exists to remove.
 */
export const requestApproval = async (riskId: string, body: RequestRiskApproval, userId?: string) => {
  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    select: { id: true, riskNumber: true, status: true, residualLevelId: true, initialLevelId: true },
  });
  if (!risk) throw NotFound('Risk not found');
  if (risk.status === 'CLOSED') throw BadRequest('A closed risk does not need approval');

  const pending = await prisma.riskApproval.findFirst({
    where: { riskId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) throw Conflict('An approval request is already open on this risk');

  const levelId = risk.residualLevelId ?? risk.initialLevelId;
  const level = levelId
    ? await prisma.riskLevelDef.findUnique({ where: { id: levelId }, select: { code: true } })
    : null;

  const created = await prisma.riskApproval.create({
    data: {
      riskId,
      levelCode: level?.code ?? null,
      status: 'PENDING',
      requestedById: userId ?? null,
      comment: body.comment ?? null,
    },
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: riskId,
      action: 'UPDATE',
      field: 'approval',
      newValue: 'PENDING',
      reason: body.comment ?? `Approval requested for level ${level?.code ?? 'unscored'}`,
    },
    userId,
  );
  return serializeApproval(created);
};

/**
 * Decide an open approval. E-signed, because this is the judgement the
 * acceptance later leans on — an unsigned approval would weaken the acceptance
 * signature it is supposed to reinforce.
 */
export const decideApproval = async (
  approvalId: string,
  body: DecideRiskApproval,
  userId?: string,
) => {
  const existing = await prisma.riskApproval.findUnique({ where: { id: approvalId } });
  if (!existing) throw NotFound('Approval request not found');
  if (existing.status !== 'PENDING') {
    throw Conflict(`This approval has already been ${existing.status.toLowerCase()}`);
  }
  if (existing.requestedById && existing.requestedById === userId) {
    throw BadRequest(
      'You raised this approval request. A second person must decide it — that is the point of the rule.',
    );
  }

  const risk = await prisma.risk.findUnique({
    where: { id: existing.riskId },
    select: { riskNumber: true },
  });

  const signature = await recordSignature(
    {
      entity_type: 'Risk',
      entity_id: existing.riskId,
      meaning: body.meaning ?? `${body.decision} risk ${risk?.riskNumber ?? existing.riskId}`,
      credential: body.credential,
    },
    userId,
  );

  const updated = await prisma.riskApproval.update({
    where: { id: approvalId },
    data: {
      status: body.decision,
      decision: body.decision,
      decidedById: userId ?? null,
      decidedAt: new Date(),
      comment: body.comment ?? existing.comment,
      eSignatureId: signature.id,
    },
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: existing.riskId,
      action: 'TRANSITION',
      field: 'approval',
      oldValue: 'PENDING',
      newValue: body.decision,
      reason: body.comment ?? undefined,
    },
    userId,
  );
  return { ...serializeApproval(updated), signature };
};
