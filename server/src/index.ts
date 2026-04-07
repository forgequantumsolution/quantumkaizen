import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import config from './config/index.js';
import logger from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { router as apiRouter } from './routes/index.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
});

// Make io accessible in routes
app.set('io', io);

// Security middleware
app.use(helmet());
app.use(hpp());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// API routes
app.use('/api/v1', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use(errorHandler);

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join-tenant', (tenantId: string) => {
    socket.join(`tenant:${tenantId}`);
    logger.debug(`Socket ${socket.id} joined tenant:${tenantId}`);
  });

  socket.on('join-user', (userId: string) => {
    socket.join(`user:${userId}`);
    logger.debug(`Socket ${socket.id} joined user:${userId}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// Start server
httpServer.listen(config.port, () => {
  logger.info(`Quantum Kaizen server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

export { app, io };
