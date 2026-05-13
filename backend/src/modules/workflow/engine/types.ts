/**
 * Shared engine types.
 *
 * Phase 2 keeps these minimal — Phase 4 will expand AuditEventType, Phase 3
 * will add ApprovalDecision etc.
 */
export type AuditEventType =
  | 'TICKET_RAISED'
  | 'TICKET_COMPLETED'
  | 'TICKET_DELETED'
  | 'TICKET_HELD'
  | 'TICKET_RESUMED'
  | 'STAGE_ENTERED'
  | 'STAGE_EXITED'
  | 'ACTION_PERFORMED'
  | 'STAGE_RETURNED'
  | 'STAGE_REASSIGNED'
  | 'CHILD_TICKET_SPAWNED'
  // Phase 3 — Approvals + SLA
  | 'APPROVAL_DECISION_RECORDED'
  | 'APPROVAL_SATISFIED'
  | 'APPROVAL_REJECTED'
  | 'SLA_TIMER_STARTED'
  | 'SLA_TIMER_COMPLETED'
  | 'SLA_TIMER_PAUSED'
  | 'SLA_TIMER_RESUMED';

export interface ActorContext {
  id: string;
  name?: string;
  email?: string;
}

export interface PerformActionPayload {
  remarks?: string;
  returnToStageId?: string;
  reassignToUserId?: string;
  reassignToRoleId?: string;
}

export type PerformActionStatus =
  | 'transitioned'
  | 'completed'
  | 'held'
  | 'returned'
  | 'reassigned'
  // Phase 3 — Approvals: returned when an approval policy intercepted the
  // action and the policy isn't satisfied yet (more approvers needed).
  | 'pending_approval'
  // Phase 3 — Approvals: returned when the approval was rejected. Ticket stays
  // in stage (Q5 signed-off); caller can invoke a separate REJECT-behavior
  // action to walk back.
  | 'approval_rejected';

export interface PerformActionResult {
  status: PerformActionStatus;
  ticketId: string;
  flowId: string;
  enteredStages: { id: string; name: string }[];
  exitedStages: { id: string; name: string }[];
  isCompleted: boolean;
  /** Set when status is `pending_approval` or `approval_rejected`. */
  approval?: {
    instanceId: string;
    remaining?: { rolesRequired: number; recordedApprovers: number };
  };
}

export interface PerformActionPayloadWithApproval extends PerformActionPayload {
  /**
   * If set AND the action's approval policy has an open instance, this is
   * applied as the user's decision before any transition is attempted.
   * (Without this field, an action-on-a-policy-stage with no existing
   * instance creates one in PENDING.)
   */
  approvalDecision?: 'APPROVED' | 'REJECTED';
  approvalComment?: string;
}
