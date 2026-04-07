import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

// Paths to skip logging (health checks, readiness probes)
const SKIP_PATHS = new Set(['/health', '/healthz', '/ready', '/readiness', '/favicon.ico']);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip logging for health check endpoints
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();
  const requestId = (req.headers['x-request-id'] as string) || '-';

  // Capture the original end method to measure response time
  const originalEnd = res.end;

  res.end = function (this: Response, ...args: unknown[]): Response {
    const elapsedNs = process.hrtime.bigint() - startTime;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const contentLength = res.getHeader('content-length') || '-';

    const logData = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      responseTimeMs: Math.round(elapsedMs * 100) / 100,
      contentLength,
      userAgent: req.headers['user-agent'] || '-',
      ip: req.ip || req.socket.remoteAddress || '-',
      userId: (req as Record<string, unknown>).user
        ? ((req as Record<string, unknown>).user as Record<string, string>).id
        : undefined,
    };

    // Log at appropriate level based on status code
    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(2)}ms`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(2)}ms`, logData);
    } else {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(2)}ms`, logData);
    }

    // Call original end
    return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
  } as typeof res.end;

  next();
}

export default requestLogger;
