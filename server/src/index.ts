import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from './config/index.js';
import logger from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId, sanitizeRequestBody } from './middleware/security.js';
import { router as apiRouter } from './routes/index.js';
import prisma from './lib/prisma.js';

const app = express();
const httpServer = createServer(app);

// ── Socket.IO with JWT authentication ──────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
});

// Authenticate every Socket.IO connection via JWT
io.use((socket, next) => {
  try {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers?.authorization?.replace('Bearer ', '') as string);

    if (!token) {
      return next(new Error('UNAUTHORIZED'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      tenantId: string;
      role: string;
    };

    socket.data.userId = decoded.id;
    socket.data.tenantId = decoded.tenantId;
    socket.data.role = decoded.role;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
});

app.set('io', io);

// ── Trust proxy (for correct IP behind nginx/load balancer) ────────
app.set('trust proxy', 1);

// ── Security middleware ─────────────────────────────────────────────
app.use(requestId);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
// Permissions-Policy header (not yet in helmet's types for this version)
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
app.use(hpp());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = Array.isArray(config.corsOrigin)
      ? config.corsOrigin
      : [config.corsOrigin];
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'x-csrf-token'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  maxAge: 86400,
}));

// ── Rate limiting (per endpoint) ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,  // 20 auth attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' } },
});

app.use('/api', globalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/refresh', authLimiter);

// ── Body parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());
app.use(sanitizeRequestBody);

// ── Health endpoints ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
  });
});

app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};
  let overall: 'ok' | 'degraded' | 'down' = 'ok';

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (e) {
    checks.database = { status: 'down', error: 'unreachable' };
    overall = 'down';
  }

  const statusCode = overall === 'ok' ? 200 : 503;
  res.status(statusCode).json({ status: overall, checks, timestamp: new Date().toISOString() });
});

// ── API routes ──────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ── Global error handler ────────────────────────────────────────────
app.use(errorHandler);

// ── Socket.IO ───────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const { userId, tenantId } = socket.data as { userId: string; tenantId: string };
  logger.info(`Socket connected: ${socket.id} user=${userId}`);

  // Auto-join the user's own tenant room (validated via JWT above)
  socket.join(`tenant:${tenantId}`);
  socket.join(`user:${userId}`);

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id} user=${userId}`);
  });
});

// ── Start server ────────────────────────────────────────────────────
httpServer.listen(config.port, () => {
  logger.info(`Quantum Kaizen server running on port ${config.port} [${config.nodeEnv}]`);
});

export { app, io };
