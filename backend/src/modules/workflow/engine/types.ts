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
  | 'CHILD_TICKET_SPAWNED';

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

export type PerformActionStatus = 'transitioned' | 'completed' | 'held' | 'returned' | 'reassigned';

export interface PerformActionResult {
  status: PerformActionStatus;
  ticketId: string;
  flowId: string;
  enteredStages: { id: string; name: string }[];
  exitedStages: { id: string; name: string }[];
  isCompleted: boolean;
}
