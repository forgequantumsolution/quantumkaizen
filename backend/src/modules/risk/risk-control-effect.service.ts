/**
 * What a risk control *does* to the rest of the system.
 *
 * `RiskControl` has always been able to name the CAPA, action item, SOP and
 * training course that execute it. Those were stored, validated on write, and
 * consumed by nobody: naming an SOP created no obligation on the document, and
 * naming a course enrolled no one. A control was a promise with no mechanism.
 *
 * This file is the mechanism, in both directions:
 *
 *   outbound  a control naming a course actually assigns the training, and
 *             cannot be verified until that training completes
 *   inbound   a document that executes a control cannot be quietly retired, and
 *             revising it forces the risks it controls back into review
 *
 * Everything here is called from the modules that own those records, so DMS and
 * LMS keep their own service boundaries — they ask risk a question, rather than
 * risk reaching into their tables.
 *
 * See docs/RISK-cross-module-integration-plan.md §D.3, §D.4.
 */
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';

/** Control statuses that still represent a live obligation on the target. */
const LIVE_CONTROL_STATUSES = ['PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED'] as const;

// ── DMS: a document that executes a control ─────────────────────────────────

export interface ControllingUse {
  controlNumber: string;
  controlStatus: string;
  riskId: string;
  riskNumber: string;
  riskTitle: string;
}

/** Controls executed by this document, with the risk each one serves. */
export const controlsUsingDocument = async (documentId: string): Promise<ControllingUse[]> => {
  const controls = await prisma.riskControl.findMany({
    where: { documentId, status: { in: [...LIVE_CONTROL_STATUSES] } },
    select: {
      controlNumber: true,
      status: true,
      risk: { select: { id: true, riskNumber: true, title: true, status: true } },
    },
  });
  return controls
    .filter((c) => c.risk && c.risk.status !== 'CLOSED')
    .map((c) => ({
      controlNumber: c.controlNumber,
      controlStatus: c.status,
      riskId: c.risk!.id,
      riskNumber: c.risk!.riskNumber,
      riskTitle: c.risk!.title,
    }));
};

/**
 * Refuse to retire a document that is still executing a risk control.
 *
 * Retiring it would leave a risk whose residual score assumes a control that no
 * longer exists — a green risk backed by nothing, which is precisely the state
 * the module's INEFFECTIVE handling exists to prevent elsewhere.
 */
export const assertDocumentRetirable = async (
  documentId: string,
  docNumber: string,
): Promise<void> => {
  const uses = await controlsUsingDocument(documentId);
  if (uses.length === 0) return;

  throw Conflict(
    `${docNumber} executes ${uses.length} risk control${uses.length === 1 ? '' : 's'} and cannot be retired: ` +
      `${uses.map((u) => `${u.controlNumber} (${u.riskNumber})`).join(', ')}. ` +
      'Replace or cancel the control first, then retire the document.',
  );
};

/**
 * A revised document is not the document the control was verified against, so
 * every risk it serves goes back into review.
 *
 * Best-effort: a document revision is the user's act and must not fail because
 * a derived review row could not be opened.
 */
export const openReviewsForDocumentRevision = async (
  documentId: string,
  docNumber: string,
  userId?: string,
): Promise<number> => {
  try {
    const uses = await controlsUsingDocument(documentId);
    let opened = 0;
    for (const u of uses) {
      const existing = await prisma.riskReview.findFirst({
        where: { riskId: u.riskId, reviewedAt: null },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.riskReview.create({
        data: { riskId: u.riskId, dueAt: new Date(), createdById: userId ?? null },
      });
      opened += 1;
      await writeTrail(
        {
          entityType: 'Risk',
          entityId: u.riskId,
          action: 'CREATE',
          field: 'periodic_review',
          newValue: new Date().toISOString(),
          reason: `Controlling document ${docNumber} was revised — control ${u.controlNumber} must be re-confirmed`,
        },
        userId,
      );
    }
    return opened;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[risk-control-effect] opening reviews for revised document ${docNumber} failed:`,
      e instanceof Error ? e.message : e,
    );
    return 0;
  }
};

// ── LMS: a control delivered as training ────────────────────────────────────

/** Controls delivered by this course, with the risk each one serves. */
export const controlsUsingCourse = async (courseId: string): Promise<ControllingUse[]> => {
  const controls = await prisma.riskControl.findMany({
    where: { lmsCourseId: courseId, status: { in: [...LIVE_CONTROL_STATUSES] } },
    select: {
      controlNumber: true,
      status: true,
      risk: { select: { id: true, riskNumber: true, title: true, status: true } },
    },
  });
  return controls
    .filter((c) => c.risk && c.risk.status !== 'CLOSED')
    .map((c) => ({
      controlNumber: c.controlNumber,
      controlStatus: c.status,
      riskId: c.risk!.id,
      riskNumber: c.risk!.riskNumber,
      riskTitle: c.risk!.title,
    }));
};

export interface TrainingCompletion {
  courseId: string;
  assigned: number;
  completed: number;
  /** null when nobody is assigned — "0 of 0" is not 100 %. */
  rate: number | null;
}

/** Completion of the enrollments on a course. */
export const trainingCompletionFor = async (courseId: string): Promise<TrainingCompletion> => {
  const [assigned, completed] = await Promise.all([
    prisma.lmsEnrollment.count({ where: { courseId } }),
    // A documented waiver is a recorded decision by someone accountable, not an
    // outstanding obligation — counting it as incomplete would push people to
    // fake completions instead of recording the waiver honestly.
    prisma.lmsEnrollment.count({ where: { courseId, status: { in: ['COMPLETED', 'WAIVED'] } } }),
  ]);
  return {
    courseId,
    assigned,
    completed,
    rate: assigned === 0 ? null : Math.round((completed / assigned) * 100),
  };
};

/**
 * A training control cannot be called verified while the training is
 * outstanding.
 *
 * This is the whole value of linking a course to a control: "we trained
 * everyone" stops being a claim in a comment field and becomes a number the
 * system will not let you overstate. Gated on the level's `requiresTraining`
 * so it only binds where the framework says it should.
 */
export const assertTrainingComplete = async (control: {
  controlNumber: string;
  hierarchy: string | null;
  lmsCourseId: string | null;
  riskId: string;
}): Promise<void> => {
  const risk = await prisma.risk.findUnique({
    where: { id: control.riskId },
    select: { riskNumber: true, residualLevelId: true, initialLevelId: true },
  });
  const levelId = risk?.residualLevelId ?? risk?.initialLevelId;
  if (!levelId) return;

  const level = await prisma.riskLevelDef.findUnique({
    where: { id: levelId },
    select: { code: true, label: true, requiresTraining: true },
  });
  if (!level?.requiresTraining) return;

  const isAdministrative =
    control.hierarchy === 'ADMINISTRATIVE' || control.hierarchy === 'INFORMATION_FOR_SAFETY';
  if (!isAdministrative) return;

  if (!control.lmsCourseId) {
    throw BadRequest(
      `${control.controlNumber} is an administrative control on a risk at ${level.label} (${level.code}), ` +
        'which requires training. Link the training course that delivers this control before verifying it.',
    );
  }

  const completion = await trainingCompletionFor(control.lmsCourseId);
  if (completion.assigned === 0) {
    throw BadRequest(
      `${control.controlNumber} names a training course that nobody is enrolled on. ` +
        'Assign the training before verifying the control as effective.',
    );
  }
  if (completion.rate !== null && completion.rate < 100) {
    throw BadRequest(
      `${control.controlNumber} cannot be verified: training is ${completion.rate}% complete ` +
        `(${completion.completed} of ${completion.assigned}). ` +
        'A training control is only effective once the people it covers have completed it.',
    );
  }
};

/**
 * Assign the course a control names to the risk's department.
 *
 * Best-effort and idempotent — the LMS owns enrollment, so a failure here is a
 * missing assignment to chase, never a reason to reject the control.
 */
export const assignTrainingForControl = async (
  control: { id: string; controlNumber: string; lmsCourseId: string | null; riskId: string },
  userId?: string,
): Promise<void> => {
  if (!control.lmsCourseId) return;
  try {
    const risk = await prisma.risk.findUnique({
      where: { id: control.riskId },
      select: { riskNumber: true, departmentId: true, ownerId: true },
    });
    if (!risk) return;

    // Who the control covers: the risk's department, else just its owner.
    const users = risk.departmentId
      ? await prisma.user.findMany({
          where: { departmentId: risk.departmentId, isActive: true },
          select: { id: true },
        })
      : risk.ownerId
        ? [{ id: risk.ownerId }]
        : [];
    if (users.length === 0) return;

    let created = 0;
    for (const u of users) {
      const existing = await prisma.lmsEnrollment.findFirst({
        where: { courseId: control.lmsCourseId, userId: u.id },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.lmsEnrollment.create({
        data: {
          courseId: control.lmsCourseId,
          userId: u.id,
          status: 'ASSIGNED',
          // The enrollment came from a department-wide risk control, which is
          // what DEPARTMENT means here; MATRIX is reserved for the training
          // matrix rules the LMS owns.
          source: risk.departmentId ? 'DEPARTMENT' : 'DIRECT',
          sourceRef: control.id,
          assignedById: userId ?? null,
        },
      });
      created += 1;
    }

    if (created > 0) {
      await writeTrail(
        {
          entityType: 'RiskControl',
          entityId: control.id,
          action: 'UPDATE',
          field: 'training',
          newValue: String(created),
          reason: `Assigned the control's training course to ${created} user(s) for risk ${risk.riskNumber}`,
        },
        userId,
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[risk-control-effect] training assignment for ${control.controlNumber} failed:`,
      e instanceof Error ? e.message : e,
    );
  }
};
