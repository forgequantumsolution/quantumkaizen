/**
 * Risk policy engine — makes the level flags mean something.
 *
 * `RiskLevelDef` has always carried the policy a level implies: does it demand a
 * CAPA, controls, approval, training, escalation? Only `requiresCapa` ever
 * acted. The rest were stored, serialized, returned to the client and enforced
 * nowhere, which meant a CRITICAL risk could be residual-scored with no controls
 * and accepted with nobody's sign-off but the acceptor's.
 *
 * This file is where each of those becomes a real gate. Two rules shape it:
 *
 *  1. **Every block explains itself.** The 400 names the rule, the level and the
 *     records at fault, because ALCOA+ "complete" means the record shows why an
 *     action was refused, not merely that it succeeded. The risk module already
 *     returns actionable prose everywhere else; this matches it.
 *
 *  2. **Blocks are hard, escalation is best-effort.** Refusing to score or
 *     accept is the point and must never be swallowed. Sending a notification is
 *     a side effect and must never fail the operation that triggered it.
 *
 * See docs/RISK-cross-module-integration-plan.md §C.3.
 */
import { BadRequest, Conflict } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { writeTrail } from '../audit/compliance.service';
import { notify } from '../escalation/notify';
import { severityRankOf } from './risk-profile.service';

/** Controls that count as delivered for the `requiresControl` gate. */
const DELIVERED_CONTROL_STATUSES = ['IMPLEMENTED', 'VERIFIED'] as const;

export interface LevelPolicy {
  id: string;
  code: string;
  label: string;
  acceptance: 'ACCEPTABLE' | 'ALARP' | 'UNACCEPTABLE';
  requiresCapa: boolean;
  requiresApproval: boolean;
  requiresControl: boolean;
  requiresTraining: boolean;
  blocksChangeApproval: boolean;
  escalateToRoleId: string | null;
  severityRank: number;
}

/** Load a level with its policy flags and normalised severity rank. */
export const loadLevelPolicy = async (levelId: string): Promise<LevelPolicy | null> => {
  const level = await prisma.riskLevelDef.findUnique({
    where: { id: levelId },
    select: {
      id: true, code: true, label: true, order: true, acceptance: true,
      requiresCapa: true, requiresApproval: true, requiresControl: true,
      requiresTraining: true, blocksChangeApproval: true,
      escalateToRoleId: true, frameworkId: true,
    },
  });
  if (!level) return null;

  const max = await prisma.riskLevelDef.aggregate({
    where: { frameworkId: level.frameworkId },
    _max: { order: true },
  });

  return {
    id: level.id,
    code: level.code,
    label: level.label,
    acceptance: level.acceptance,
    requiresCapa: level.requiresCapa,
    requiresApproval: level.requiresApproval,
    requiresControl: level.requiresControl,
    requiresTraining: level.requiresTraining,
    blocksChangeApproval: level.blocksChangeApproval,
    escalateToRoleId: level.escalateToRoleId,
    severityRank: severityRankOf(level.acceptance, level.order, max._max.order ?? 0),
  };
};

/** The level a risk is currently judged at: residual when scored, else initial. */
export const currentLevelIdOf = (risk: {
  residualLevelId: string | null;
  initialLevelId: string | null;
}): string | null => risk.residualLevelId ?? risk.initialLevelId;

// ── requiresControl ─────────────────────────────────────────────────────────

/**
 * A residual score asserts "this is the risk *after* controls". Recording one
 * against a level that demands controls, when none have been delivered, states
 * something untrue about the risk — so it is refused rather than warned about.
 *
 * PLANNED and IN_PROGRESS do not count: a control that has not been implemented
 * has not reduced anything yet.
 */
export const assertControlsInPlace = async (
  riskId: string,
  riskNumber: string,
  level: { code: string; label: string; requiresControl: boolean },
): Promise<void> => {
  if (!level.requiresControl) return;

  const delivered = await prisma.riskControl.count({
    where: { riskId, status: { in: [...DELIVERED_CONTROL_STATUSES] } },
  });
  if (delivered > 0) return;

  const planned = await prisma.riskControl.count({
    where: { riskId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
  });

  throw BadRequest(
    `${riskNumber} resolves to ${level.label} (${level.code}), which requires risk controls before a ` +
      `residual score can be recorded. ` +
      (planned > 0
        ? `${planned} control${planned === 1 ? ' is' : 's are'} planned but not yet implemented — ` +
          `mark ${planned === 1 ? 'it' : 'them'} IMPLEMENTED or VERIFIED first.`
        : 'Add and implement at least one control first.'),
  );
};

// ── requiresApproval ────────────────────────────────────────────────────────

/**
 * Segregation of duties on acceptance. When the level demands approval, someone
 * other than the acceptor must have signed off first.
 *
 * This is not the workflow `ApprovalInstance`: that is anchored to a ticket and
 * needs a policy bound to a workflow stage and action, none of which a risk has.
 * `RiskApproval` records the same judgement without inventing a fake stage.
 */
export const assertApproved = async (
  riskId: string,
  riskNumber: string,
  level: { code: string; label: string; requiresApproval: boolean },
  acceptingUserId?: string,
): Promise<void> => {
  if (!level.requiresApproval) return;

  const approvals = await prisma.riskApproval.findMany({
    where: { riskId, status: 'APPROVED' },
    orderBy: { decidedAt: 'desc' },
    select: { decidedById: true },
  });

  if (approvals.length === 0) {
    const pending = await prisma.riskApproval.count({ where: { riskId, status: 'PENDING' } });
    throw BadRequest(
      `${riskNumber} is at ${level.label} (${level.code}), which requires a second-person approval ` +
        `before the residual risk can be accepted. ` +
        (pending > 0
          ? 'An approval request is already open and awaiting a decision.'
          : 'Request an approval first (POST /api/risk/risks/:id/approvals).'),
    );
  }

  // Self-approval defeats the entire purpose of the rule.
  const byOther = approvals.some((a) => a.decidedById && a.decidedById !== acceptingUserId);
  if (!byOther) {
    throw BadRequest(
      `${riskNumber} has been approved only by the same person now accepting it. ` +
        `${level.label} (${level.code}) requires approval by a second person.`,
    );
  }
};

// ── escalateToRoleId ────────────────────────────────────────────────────────

/**
 * Tell the responsible role that a risk has reached their level.
 *
 * Best-effort by contract, for the same reason auto-CAPA is: a notification
 * failure must never roll back an e-signed score. Idempotent per (risk, level)
 * within a day so a re-score at the same level does not spam.
 */
export const escalateRisk = async (
  riskId: string,
  riskNumber: string,
  riskTitle: string,
  level: { code: string; label: string; escalateToRoleId: string | null },
  userId?: string,
): Promise<void> => {
  if (!level.escalateToRoleId) return;
  try {
    const users = await prisma.user.findMany({
      where: { roleId: level.escalateToRoleId, isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return;

    const title = `Risk ${riskNumber} escalated to ${level.label}`;
    const since = new Date(Date.now() - 86_400_000);
    const already = await prisma.notification.findFirst({
      where: { entityType: 'Risk', entityId: riskId, title, createdAt: { gte: since } },
      select: { id: true },
    });
    if (already) return;

    for (const u of users) {
      await notify({
        userId: u.id,
        type: 'ESCALATED',
        title,
        body: `${riskTitle}\n\nThe risk resolved to ${level.label} (${level.code}), which escalates to your role.`,
        entityType: 'Risk',
        entityId: riskId,
      });
    }

    await writeTrail(
      {
        entityType: 'Risk',
        entityId: riskId,
        action: 'UPDATE',
        field: 'escalation',
        newValue: level.code,
        reason: `Escalated to ${users.length} holder(s) of the level's responsible role`,
      },
      userId,
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[risk-policy] escalation for ${riskNumber} failed:`, e instanceof Error ? e.message : e);
  }
};

// ── Risk appetite (phase 12) ────────────────────────────────────────────────

export interface AppetiteVerdict {
  toleranceRank: number;
  name: string;
  requiresBoardReview: boolean;
  statement: string | null;
  outOfAppetite: boolean;
}

/**
 * The appetite statement governing a risk — most specific match wins:
 * category+site, then site, then category, then organisation-wide.
 *
 * Tolerance is a normalised severity rank rather than a level id, which is what
 * lets one organisation-level statement span frameworks. Comparing a level id
 * would have meant an appetite per framework, which is not what ISO 31000
 * §6.3.4 describes.
 */
export const appetiteFor = async (
  siteId: string | null,
  categoryId: string | null,
  severityRank: number | null,
): Promise<AppetiteVerdict | null> => {
  const rules = await prisma.riskAppetite.findMany({ where: { isActive: true } });
  if (rules.length === 0) return null;

  const score = (r: { siteId: string | null; categoryId: string | null }): number => {
    // Reject rules that name a different site or category outright.
    if (r.siteId && r.siteId !== siteId) return -1;
    if (r.categoryId && r.categoryId !== categoryId) return -1;
    return (r.siteId ? 2 : 0) + (r.categoryId ? 1 : 0);
  };

  let best: (typeof rules)[number] | null = null;
  let bestScore = -1;
  for (const r of rules) {
    const s = score(r);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  if (!best || bestScore < 0) return null;

  return {
    toleranceRank: best.toleranceRank,
    name: best.name,
    requiresBoardReview: best.requiresBoardReview,
    statement: best.statement,
    outOfAppetite: severityRank !== null && severityRank > best.toleranceRank,
  };
};

/**
 * Block acceptance of a risk sitting above the organisation's stated tolerance
 * when that appetite demands board review. Without this, an appetite statement
 * is a decorative field.
 */
export const assertWithinAppetite = async (
  riskNumber: string,
  siteId: string | null,
  categoryId: string | null,
  severityRank: number | null,
  hasBoardReview: boolean,
): Promise<void> => {
  const verdict = await appetiteFor(siteId, categoryId, severityRank);
  if (!verdict || !verdict.outOfAppetite || !verdict.requiresBoardReview || hasBoardReview) return;

  throw Conflict(
    `${riskNumber} exceeds the risk appetite "${verdict.name}" (tolerance rank ${verdict.toleranceRank}, ` +
      `this risk ${severityRank}). That appetite requires board-level review before acceptance.` +
      (verdict.statement ? `\n\n${verdict.statement}` : ''),
  );
};
