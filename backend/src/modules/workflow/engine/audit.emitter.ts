import type { Prisma } from '@prisma/client';
import type { ActorContext, AuditEventType } from './types';

/**
 * Noop audit hook for Phase 2.
 *
 * Phase 4 will replace the body with hash-chained `AuditLogEntry` inserts.
 * Until then, this only logs to console in development. The signature is
 * frozen — Phase 4 should not need to edit any call site.
 */
export const emitAuditEvent = async (
  _tx: Prisma.TransactionClient,
  context: { ticketId?: string; workflowId?: string; flowId?: string },
  eventType: AuditEventType,
  eventData: Record<string, unknown>,
  actor: ActorContext | null
): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[audit:noop]', eventType, {
      ...context,
      actor: actor?.id ?? 'system',
      data: eventData,
    });
  }
};
