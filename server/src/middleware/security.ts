import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ─── Request ID Middleware ────────────────────────────────────────────
// Generates a unique request ID for tracing and attaches it to the response.
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// ─── Content Security Policy ──────────────────────────────────────────
export function contentSecurityPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
}

// ─── HSTS Header ──────────────────────────────────────────────────────
export function hstsHeader(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
}

// ─── CSRF Protection ─────────────────────────────────────────────────
// Double-submit cookie pattern for CSRF protection.
// The client reads the CSRF token from a cookie and sends it in a header.
const CSRF_COOKIE = 'qk-csrf-token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Always set or refresh the CSRF cookie
  let csrfToken = req.cookies?.[CSRF_COOKIE];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false, // Client JS must read this
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  // Safe methods do not need CSRF validation
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // For state-changing requests, validate the header matches the cookie
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  if (!headerToken || headerToken !== csrfToken) {
    res.status(403).json({
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF token missing or invalid',
      },
    });
    return;
  }

  next();
}

// ─── Request Body Sanitizer ───────────────────────────────────────────
// Basic XSS prevention: strips <script> tags and common injection patterns
// from string values in the request body.
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<iframe[^>]*>/gi, '')
      .replace(/<object[^>]*>/gi, '')
      .replace(/<embed[^>]*>/gi, '');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key]);
  }
  return sanitized;
}

export function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
}

// ─── Combined Security Middleware ─────────────────────────────────────
// Apply all security middleware in one call.
export function applySecurityMiddleware() {
  return [requestId, contentSecurityPolicy, hstsHeader, sanitizeRequestBody];
}
