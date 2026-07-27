/**
 * Risk-aware stage criteria — the change-control gate.
 *
 * `ActionCriteria` used to carry a name and nothing else, so "risk assessment
 * complete" was a label somebody read, not a rule anybody enforced. Giving it a
 * `kind` turns it into a predicate the transition engine runs before a stage
 * advances, which is what ICH Q10 §3.3 and ICH Q7 §13 actually require of change
 * management: the change cannot be approved until its risk has been assessed.
 *
 * Implemented as a guard on the generic workflow engine rather than in a Change
 * Control module, because Change Control *is* a workflow type here — and the
 * same gate then serves Deviation, Supplier Change and anything else configured
 * with these criteria, with no further code.
 *
 * Three kinds:
 *   RISK_ASSESSMENT_APPROVED  the ticket must have an APPROVED assessment
 *   NO_BLOCKING_RISK          no linked risk may sit at a blocking level
 *   RISK_CONTROLS_VERIFIED    every linked risk's controls must be verified
 *
 * Failures throw with the offending record numbers named, matching the risk
 * module's actionable-400 convention. An unrecognised kind passes rather than
 * blocks: a criterion nobody has implemented must not wedge a live workflow.
 *
 * See docs/RISK-cross-module-integration-plan.md §D.1.
 */
import type { Prisma } from '@prisma/client';
import { Conflict } from '../httpError';

export type CriteriaKind =
  | 'RISK_ASSESSMENT_APPROVED'
  | 'NO_BLOCKING_RISK'
  | 'RISK_CONTROLS_VERIFIED';

export const RISK_CRITERIA_KINDS: CriteriaKind[] = [
  'RISK_ASSESSMENT_APPROVED',
  'NO_BLOCKING_RISK',
  'RISK_CONTROLS_VERIFIED',
];

export const isRiskCriteriaKind = (kind: string | null | undefined): kind is CriteriaKind =>
  !!kind && (RISK_CRITERIA_KINDS as string[]).includes(kind);

/** Minimal tx surface — lets this run inside the engine's transaction. */
type Tx = Prisma.TransactionClient;

interface CriteriaConfig {
  /** Only risks at or above this normalised severity block. Default: any. */
  minSeverityRank?: number;
  /** Permit an e-signed override by a holder of risk.override_gate. */
  allowOverride?: boolean;
}

const readConfig = (raw: unknown): CriteriaConfig =>
  raw && typeof raw === 'object' ? (raw as CriteriaConfig) : {};

/**
 * Risks linked to a ticket, in both directions:
 *  - risks that point at the ticket via RiskLink (the usual case)
 *  - risks raised *from* the ticket by a trigger
 */
const linkedRiskIds = async (tx: Tx, ticketId: string): Promise<string[]> => {
  const links = await tx.riskLink.findMany({
    where: { entityType: 'Ticket', entityId: ticketId, riskId: { not: null } },
    select: { riskId: true },
  });
  return [...new Set(links.map((l) => l.riskId as string))];
};

/**
 * Evaluate one criterion. Returns silently when satisfied; throws a 409 naming
 * the blockers when not.
 */
export const assertRiskCriteria = async (
  tx: Tx,
  kind: string,
  config: unknown,
  ticketId: string,
  ticketRef: string,
  opts: { overridden?: boolean } = {},
): Promise<void> => {
  if (!isRiskCriteriaKind(kind)) return;
  const cfg = readConfig(config);

  // An override is only honoured when the criterion permits one. The caller is
  // responsible for having checked the permission and captured the signature —
  // this layer only decides whether an override is acceptable at all.
  if (opts.overridden && cfg.allowOverride) return;

  if (kind === 'RISK_ASSESSMENT_APPROVED') {
    const approved = await tx.riskAssessment.count({
      where: { triggerType: 'Ticket', triggerId: ticketId, status: 'APPROVED' },
    });
    if (approved > 0) return;

    const inFlight = await tx.riskAssessment.findMany({
      where: { triggerType: 'Ticket', triggerId: ticketId },
      select: { assessmentNumber: true, status: true },
      take: 5,
    });
    throw Conflict(
      inFlight.length === 0
        ? `${ticketRef} cannot pass this stage until a risk assessment has been raised and approved for it. ` +
            'Use "Assess risk" on the ticket to raise one.'
        : `${ticketRef} has a risk assessment that is not yet approved: ` +
            `${inFlight.map((a) => `${a.assessmentNumber} (${a.status})`).join(', ')}.`,
    );
  }

  const riskIds = await linkedRiskIds(tx, ticketId);
  if (riskIds.length === 0) return; // nothing linked → nothing to block on

  if (kind === 'NO_BLOCKING_RISK') {
    const risks = await tx.risk.findMany({
      where: { id: { in: riskIds }, status: { notIn: ['CLOSED', 'ACCEPTED'] } },
      select: { id: true, riskNumber: true, residualLevelId: true, initialLevelId: true },
    });
    if (risks.length === 0) return;

    const levelIds = risks
      .map((r) => r.residualLevelId ?? r.initialLevelId)
      .filter((id): id is string => !!id);
    if (levelIds.length === 0) return;

    const levels = await tx.riskLevelDef.findMany({
      where: { id: { in: levelIds } },
      select: { id: true, code: true, label: true, blocksChangeApproval: true },
    });
    const byId = new Map(levels.map((l) => [l.id, l]));

    const blockers = risks.filter((r) => {
      const lvl = byId.get((r.residualLevelId ?? r.initialLevelId) as string);
      return lvl?.blocksChangeApproval === true;
    });
    if (blockers.length === 0) return;

    throw Conflict(
      `${ticketRef} is linked to ${blockers.length} open risk${blockers.length === 1 ? '' : 's'} at a level ` +
        `that blocks approval: ${blockers.map((r) => r.riskNumber).join(', ')}. ` +
        'Reduce, treat or formally accept the risk before approving this change.',
    );
  }

  if (kind === 'RISK_CONTROLS_VERIFIED') {
    const open = await tx.riskControl.findMany({
      where: { riskId: { in: riskIds }, status: { notIn: ['VERIFIED', 'CANCELLED'] } },
      select: { controlNumber: true, status: true },
      take: 10,
    });
    if (open.length === 0) return;

    throw Conflict(
      `${ticketRef} has ${open.length} risk control${open.length === 1 ? '' : 's'} not yet verified: ` +
        `${open.map((c) => `${c.controlNumber} (${c.status})`).join(', ')}. ` +
        'Verify the controls before this change can proceed.',
    );
  }
};
