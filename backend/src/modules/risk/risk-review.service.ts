/**
 * Periodic risk review (ICH Q9 "risk review", ISO 14971 post-production
 * monitoring).
 *
 * A risk file is only current if somebody keeps looking at it. Each review is a
 * scheduled, dated commitment with an owner-visible due date; completing one
 * records what was found and, crucially, sets the *next* due date on the risk so
 * the cycle never silently stops.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import { nextReviewDateFor } from './risk-scoring.service';
import { ensureCapaForRisk } from './risk-control.service';
import type { CompleteReview, ListReviewQuery, ReviewCreate } from './risk-control.schema';

const reviewInclude = {
  risk: {
    select: {
      id: true,
      riskNumber: true,
      title: true,
      status: true,
      registerId: true,
      ownerId: true,
      residualScore: true,
    },
  },
} satisfies Prisma.RiskReviewInclude;

type ReviewRow = Prisma.RiskReviewGetPayload<{ include: typeof reviewInclude }>;

const serializeReview = (r: ReviewRow) => ({
  id: r.id,
  risk_id: r.riskId,
  risk: r.risk
    ? {
        id: r.risk.id,
        risk_number: r.risk.riskNumber,
        title: r.risk.title,
        status: r.risk.status,
        register_id: r.risk.registerId,
        owner_id: r.risk.ownerId,
        residual_score: r.risk.residualScore,
      }
    : null,
  due_at: r.dueAt,
  reviewed_at: r.reviewedAt,
  reviewed_by_id: r.reviewedById,
  outcome: r.outcome,
  findings: r.findings,
  next_review_at: r.nextReviewAt,
  overdue_at: r.overdueAt,
  // Derived rather than stored: a review is overdue whenever it is past due and
  // still open, regardless of whether the nightly sweep has stamped overdueAt.
  is_overdue: !r.reviewedAt && r.dueAt < new Date(),
  is_complete: !!r.reviewedAt,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

export const listReviews = async (q: ListReviewQuery) => {
  const where: Prisma.RiskReviewWhereInput = {};
  if (q.riskId) where.riskId = q.riskId;
  if (q.registerId) where.risk = { registerId: q.registerId };
  if (q.outcome) where.outcome = q.outcome;
  if (q.completed !== undefined) where.reviewedAt = q.completed ? { not: null } : null;
  if (q.dueBefore) where.dueAt = { lt: q.dueBefore };
  if (q.overdue) {
    where.reviewedAt = null;
    where.dueAt = { lt: new Date() };
  }

  const [rows, total] = await Promise.all([
    prisma.riskReview.findMany({
      where,
      include: reviewInclude,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.riskReview.count({ where }),
  ]);

  return { data: rows.map(serializeReview), total, page: q.page, page_size: q.pageSize };
};

export const getReview = async (id: string) => {
  const row = await prisma.riskReview.findUnique({ where: { id }, include: reviewInclude });
  if (!row) throw NotFound('Risk review not found');
  return serializeReview(row);
};

export const listReviewsForRisk = async (riskId: string) => {
  const risk = await prisma.risk.findUnique({ where: { id: riskId }, select: { id: true } });
  if (!risk) throw NotFound('Risk not found');
  const rows = await prisma.riskReview.findMany({
    where: { riskId },
    include: reviewInclude,
    orderBy: { dueAt: 'desc' },
  });
  return rows.map(serializeReview);
};

export const createReview = async (riskId: string, body: ReviewCreate, userId?: string) => {
  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    select: { id: true, riskNumber: true, status: true, nextReviewAt: true },
  });
  if (!risk) throw NotFound('Risk not found');
  if (risk.status === 'CLOSED') throw BadRequest('Cannot schedule a review on a closed risk');

  const created = await prisma.riskReview.create({
    data: {
      riskId,
      dueAt: body.dueAt,
      findings: body.findings ?? null,
      createdById: userId ?? null,
    },
    include: reviewInclude,
  });

  // The risk's own nextReviewAt is the soonest open commitment; scheduling an
  // earlier review pulls it forward.
  if (!risk.nextReviewAt || body.dueAt < risk.nextReviewAt) {
    await prisma.risk.update({ where: { id: riskId }, data: { nextReviewAt: body.dueAt } });
  }

  await writeTrail(
    {
      entityType: 'RiskReview',
      entityId: created.id,
      action: 'CREATE',
      field: 'due_at',
      newValue: body.dueAt.toISOString(),
      reason: `Periodic review scheduled on risk ${risk.riskNumber}`,
    },
    userId,
  );
  return serializeReview(created);
};

export const updateReview = async (id: string, body: ReviewCreate, userId?: string) => {
  const existing = await prisma.riskReview.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk review not found');
  if (existing.reviewedAt) throw BadRequest('A completed review cannot be rescheduled');

  const updated = await prisma.riskReview.update({
    where: { id },
    data: { dueAt: body.dueAt, findings: body.findings ?? existing.findings },
    include: reviewInclude,
  });

  await writeTrail(
    {
      entityType: 'RiskReview',
      entityId: id,
      action: 'UPDATE',
      field: 'due_at',
      oldValue: existing.dueAt.toISOString(),
      newValue: updated.dueAt.toISOString(),
    },
    userId,
  );
  return serializeReview(updated);
};

/**
 * Resolve the next review date implied by the risk's current level cadence
 * (RiskLevelDef.reviewMonths). Returns null when the level sets no cadence — the
 * caller then leaves the risk without a further scheduled review, which is a
 * deliberate configuration choice, not an omission.
 */
const cadenceNextReview = async (
  levelId: string | null,
  from: Date,
): Promise<Date | null> => {
  if (!levelId) return null;
  const level = await prisma.riskLevelDef.findUnique({ where: { id: levelId } });
  if (!level) return null;
  return nextReviewDateFor(level, from);
};

/**
 * Complete a scheduled review: record the outcome and findings, then roll the
 * risk's next review date forward. ESCALATED and CLOSED outcomes also move the
 * risk itself, since a review is the formal moment those decisions are taken.
 */
export const completeReview = async (id: string, body: CompleteReview, userId?: string) => {
  const existing = await prisma.riskReview.findUnique({
    where: { id },
    include: { risk: { select: { id: true, riskNumber: true, status: true, residualLevelId: true, initialLevelId: true } } },
  });
  if (!existing) throw NotFound('Risk review not found');
  if (existing.reviewedAt) throw BadRequest('This review has already been completed');

  const now = new Date();
  const nextReviewAt =
    body.nextReviewAt ??
    (body.outcome === 'CLOSED'
      ? null
      : await cadenceNextReview(existing.risk.residualLevelId ?? existing.risk.initialLevelId, now));

  const riskData: Prisma.RiskUpdateInput = { nextReviewAt };
  if (body.outcome === 'ESCALATED' && existing.risk.status !== 'CLOSED') {
    riskData.status = 'ESCALATED';
  }
  if (body.outcome === 'CLOSED' && existing.risk.status !== 'CLOSED') {
    riskData.status = 'CLOSED';
    riskData.closedAt = now;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const review = await tx.riskReview.update({
      where: { id },
      data: {
        reviewedAt: now,
        reviewedById: userId ?? null,
        outcome: body.outcome,
        findings: body.findings,
        nextReviewAt,
      },
      include: reviewInclude,
    });
    await tx.risk.update({ where: { id: existing.riskId }, data: riskData });
    return review;
  });

  await writeTrail(
    {
      entityType: 'RiskReview',
      entityId: id,
      action: 'UPDATE',
      field: 'outcome',
      newValue: body.outcome,
      reason: body.findings,
    },
    userId,
  );
  if (riskData.status) {
    await writeTrail(
      {
        entityType: 'Risk',
        entityId: existing.riskId,
        action: 'TRANSITION',
        field: 'status',
        oldValue: existing.risk.status,
        newValue: String(riskData.status),
        reason: `Periodic review outcome ${body.outcome}: ${body.findings}`,
      },
      userId,
    );
  }
  await writeTrail(
    {
      entityType: 'Risk',
      entityId: existing.riskId,
      action: 'UPDATE',
      field: 'next_review_at',
      newValue: nextReviewAt ? nextReviewAt.toISOString() : null,
      reason: `Periodic review ${body.outcome}`,
    },
    userId,
  );

  // An escalation is exactly the situation a CAPA-requiring level exists for.
  if (body.outcome === 'ESCALATED') await ensureCapaForRisk(existing.riskId, userId);

  return serializeReview(updated);
};
