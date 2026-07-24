import type { Prisma } from '@prisma/client';
import type { ActorContext, AuditEventType } from './types';
import { recordAudit, type AuditAction } from '../../../lib/audit';

/**
 * Workflow-engine audit hook.
 *
 * Row-level interception cannot express what the engine actually did: a stage
 * transition, an approval decision and a hold all look like an UPDATE on
 * `Ticket` plus some inserts. This records the semantic event instead, and
 * because the caller hands over its transaction, the event and the state change
 * it describes commit or roll back together — the atomicity that ALCOA++
 * "Complete" and "Accurate" actually require.
 *
 * Note this was a no-op until the audit-trail work: every call site below was
 * emitting into a console.debug. The signature is unchanged, so no call site
 * needed editing.
 */

/** Engine event → audit action + whether it belongs in the critical review set. */
const EVENT_MAP: Record<AuditEventType, { action: AuditAction; critical: boolean }> = {
  TICKET_RAISED: { action: 'CREATE', critical: false },
  TICKET_COMPLETED: { action: 'TRANSITION', critical: true },
  TICKET_REJECTED: { action: 'REJECT', critical: true },
  TICKET_DELETED: { action: 'SOFT_DELETE', critical: true },
  TICKET_HELD: { action: 'TRANSITION', critical: true },
  TICKET_RESUMED: { action: 'TRANSITION', critical: false },
  STAGE_ENTERED: { action: 'TRANSITION', critical: false },
  STAGE_EXITED: { action: 'TRANSITION', critical: false },
  ACTION_PERFORMED: { action: 'TRANSITION', critical: false },
  STAGE_RETURNED: { action: 'TRANSITION', critical: true },
  STAGE_REASSIGNED: { action: 'TRANSITION', critical: true },
  CHILD_TICKET_SPAWNED: { action: 'CREATE', critical: false },
  APPROVAL_DECISION_RECORDED: { action: 'APPROVE', critical: true },
  APPROVAL_SATISFIED: { action: 'APPROVE', critical: true },
  APPROVAL_REJECTED: { action: 'REJECT', critical: true },
  SLA_TIMER_STARTED: { action: 'TRANSITION', critical: false },
  SLA_TIMER_COMPLETED: { action: 'TRANSITION', critical: false },
  SLA_TIMER_PAUSED: { action: 'TRANSITION', critical: false },
  SLA_TIMER_RESUMED: { action: 'TRANSITION', critical: false },
};

/** A rejection recorded through the generic decision event is still a rejection. */
const resolveAction = (eventType: AuditEventType, data: Record<string, unknown>): AuditAction => {
  const mapped = EVENT_MAP[eventType];
  if (eventType === 'APPROVAL_DECISION_RECORDED') {
    const decision = String(data.decision ?? data.outcome ?? '').toUpperCase();
    if (decision.includes('REJECT') || decision.includes('DENY')) return 'REJECT';
  }
  return mapped.action;
};

/** Free-text justification the actor supplied, wherever the engine put it. */
const reasonFrom = (data: Record<string, unknown>): string | null => {
  for (const key of ['reason', 'remarks', 'comment', 'comments', 'justification']) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.slice(0, 2000);
  }
  return null;
};

export const emitAuditEvent = async (
  tx: Prisma.TransactionClient,
  context: { ticketId?: string; workflowId?: string; flowId?: string },
  eventType: AuditEventType,
  eventData: Record<string, unknown>,
  actor: ActorContext | null
): Promise<void> => {
  const entityType = context.ticketId ? 'Ticket' : 'Workflow';
  const entityId = context.ticketId ?? context.workflowId ?? context.flowId;
  // Without a subject there is nothing to attribute the event to; recording a
  // dangling entry would add noise to the trail without adding evidence.
  if (!entityId) return;

  const mapped = EVENT_MAP[eventType];
  await recordAudit(
    {
      entityType,
      entityId,
      action: resolveAction(eventType, eventData),
      module: 'WORKFLOW',
      criticality: mapped?.critical ? 'CRITICAL' : 'NORMAL',
      field: 'workflowEvent',
      newValue: eventType,
      reason: reasonFrom(eventData),
      diff: {
        eventType,
        ...context,
        ...eventData,
      } as Prisma.InputJsonValue,
    },
    { tx, userId: actor?.id },
  );
};
