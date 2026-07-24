import type { Request, Response, NextFunction } from 'express';
import { getAuditContext, runWithAuditContext, type AuditContext } from '../lib/audit-context';
import { newRequestId } from '../lib/audit-hash';
import type { JwtPayload } from '../lib/jwt';

/** First hop of X-Forwarded-For, else the socket address. Requires `trust proxy`. */
const clientIp = (req: Request): string | undefined => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0]!.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? undefined;
};

const headerStr = (req: Request, name: string): string | undefined => {
  const v = req.headers[name];
  return typeof v === 'string' && v.trim().length ? v.trim() : undefined;
};

/**
 * Opens an audit context for the request and echoes the correlation id.
 *
 * Mounted globally (before the routers) so unauthenticated traffic — failed
 * logins above all — still carries an IP, user agent and request id. Identity
 * fields are filled in only when `requireAuth` has already run for the route;
 * the remaining actor details (employee id, role, department) are hydrated
 * lazily by the audit writer, so a request that writes no trail entry pays
 * nothing.
 */
export const auditContext = (req: Request, res: Response, next: NextFunction) => {
  const requestId = headerStr(req, 'x-request-id') ?? newRequestId();
  res.setHeader('X-Request-Id', requestId);

  const tzRaw = headerStr(req, 'x-client-tz-offset');
  const tzParsed = tzRaw !== undefined ? Number(tzRaw) : Number.NaN;

  const ctx: AuditContext = {
    userId: req.user?.userId,
    userEmail: req.user?.email,
    userName: req.user?.name ?? 'anonymous',
    sessionId: req.user?.sessionId,
    actorType: 'USER',
    source: 'WEB',
    ipAddress: clientIp(req),
    userAgent: headerStr(req, 'user-agent'),
    requestId,
    reason: headerStr(req, 'x-change-reason'),
    reasonCode: headerStr(req, 'x-change-reason-code'),
    clientTzOffsetMin: Number.isFinite(tzParsed) ? tzParsed : undefined,
  };

  runWithAuditContext(ctx, () => next());
};

/**
 * Stamps the verified identity onto the ambient context.
 *
 * `auditContext` runs before the routers — so anonymous traffic is still
 * traceable — which is necessarily before `requireAuth` has decoded the token.
 * `requireAuth` calls this the moment it has a payload, rather than every
 * protected router having to mount a second middleware and risk forgetting.
 */
export const applyIdentityToAuditContext = (user: JwtPayload) => {
  const ctx = getAuditContext();
  if (!ctx) return;
  ctx.userId = user.userId;
  ctx.userEmail = user.email;
  if (user.name) ctx.userName = user.name;
  if (user.sessionId) ctx.sessionId = user.sessionId;
};
