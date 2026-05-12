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
import permissionRoutes from './modules/permission/permission.routes';
import organizationRoutes from './modules/organization/organization.routes';
import workflowRoutes from './modules/workflow/workflow.routes';
import workflowLookupRoutes from './modules/workflow/lookups/lookups.routes';
import ticketRoutes from './modules/ticket/ticket.routes';
import dynamicFormRoutes from './modules/dynamic-form/dynamic-form.routes';
import formSubmissionRoutes from './modules/dynamic-form/submission.routes';
import auditRoutes from './modules/audit/audit.routes';
import { mountOpenApi } from './openapi';
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
  app.use('/api/permissions', permissionRoutes);
  app.use('/api/organization', organizationRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/workflow-lookups', workflowLookupRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/forms', dynamicFormRoutes);
  app.use('/api/form-submissions', formSubmissionRoutes);
  app.use('/api', auditRoutes); // ISO standards + audit schedules

  // OpenAPI / Swagger UI — public, mounted under /api so the Vite proxy serves
  // it through the frontend dev server too (http://localhost:3000/api/docs).
  app.use('/api', mountOpenApi());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
