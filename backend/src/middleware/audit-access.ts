import type { Request, Response, NextFunction } from 'express';
import { recordAudit, type AuditAction, type AuditModule } from '../lib/audit';

/**
 * Records access to a controlled record — who opened, exported or printed it.
 *
 * Applied deliberately and sparingly: only to single-record reads of controlled
 * content (documents, certificates of analysis, generated reports), never to
 * list or search endpoints. Logging every read would bury the change history
 * under traffic and make the periodic review unworkable, which is a worse
 * outcome than not having the read logged at all.
 *
 * Unlike change events, a failure here cannot fail the request: the response
 * has already been sent by the time the outcome is known. Read-access logging
 * is therefore best-effort by nature, and it is the one place in the audit
 * system where that is acceptable — no data has changed.
 */
export const auditAccess = (
  entityType: string,
  module: AuditModule,
  action: AuditAction = 'VIEW',
) => (req: Request, res: Response, next: NextFunction) => {
  const raw = req.params.id;
  const entityId = Array.isArray(raw) ? raw[0] : raw;
  if (!entityId) return next();

  res.on('finish', () => {
    // Only successful reads are access events; a 403 is an access *denial*,
    // already visible as an authorisation failure.
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    void recordAudit({ entityType, entityId, action, module }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[audit-access] failed to record read event', e instanceof Error ? e.message : e);
    });
  });

  next();
};
