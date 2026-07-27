/**
 * Sweep: periodic risk review (ICH Q9 "Review" stage).
 *
 * Two jobs, in order:
 *   1. Every open risk whose `nextReviewAt` has passed must have an *open*
 *      `RiskReview` row to work against — the sweep opens one if none exists, so
 *      the review obligation is a tracked record rather than an implicit date.
 *   2. Every pending review past its due date gets `overdueAt` stamped, which is
 *      what the overdue analytics and the review badge count.
 *
 * Pure Prisma; runs on the worker's audit-schedule cron tick alongside the DMS /
 * LIMS sweeps. Idempotent: re-running it creates nothing and re-stamps nothing.
 */
import { prisma } from '../../lib/prisma';
import { writeTrail } from '../../modules/audit/compliance.service';
import { onRiskChanged } from '../../modules/risk/risk-profile.service';

export const flagOverdueRiskReviews = async (now = new Date()) => {
  // Risks past their review date that are still live. CLOSED risks keep their
  // historic nextReviewAt but carry no review obligation.
  const risks = await prisma.risk.findMany({
    where: { nextReviewAt: { lt: now }, status: { not: 'CLOSED' } },
    select: {
      id: true,
      riskNumber: true,
      nextReviewAt: true,
      reviews: { where: { reviewedAt: null }, select: { id: true } },
    },
  });

  let reviewsCreated = 0;
  for (const risk of risks) {
    if (risk.reviews.length > 0) continue; // an open review already covers it
    const created = await prisma.riskReview.create({
      data: { riskId: risk.id, dueAt: risk.nextReviewAt ?? now },
      select: { id: true, dueAt: true },
    });
    reviewsCreated += 1;
    await writeTrail(
      {
        entityType: 'Risk',
        entityId: risk.id,
        action: 'CREATE',
        field: 'periodic_review',
        newValue: created.dueAt.toISOString(),
        reason: 'Periodic review opened by scheduled sweep',
      },
      undefined,
    );
  }

  // Stamp overdueAt on every pending review past due — including the ones just
  // created, whose dueAt is the already-elapsed nextReviewAt.
  const flagged = await prisma.riskReview.updateMany({
    where: { reviewedAt: null, overdueAt: null, dueAt: { lt: now } },
    data: { overdueAt: now },
  });

  // A review tipping overdue changes the `overdueReviews` count on every profile
  // the risk feeds. Nothing else in the system would notice — the risk row is
  // untouched by this sweep — so the projection has to be refreshed here or the
  // chips silently under-report until the next unrelated edit.
  for (const risk of risks) await onRiskChanged(risk.id);

  return { risksOverdue: risks.length, reviewsCreated, reviewsFlagged: flagged.count };
};
