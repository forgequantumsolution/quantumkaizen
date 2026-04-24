import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import departmentRoutes from './modules/department/department.routes';
import roleRoutes from './modules/role/role.routes';
import { prisma } from './lib/prisma';
import { asyncHandler } from './lib/asyncHandler';

export const buildApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/roles', roleRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
