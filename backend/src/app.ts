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
import {
  workflowScopedPolicyRouter as approvalWorkflowScopedRouter,
  policyRouter as approvalPolicyRouter,
  instanceRouter as approvalInstanceRouter,
  ticketScopedInstanceRouter as approvalTicketScopedRouter,
} from './modules/approval/approval.routes';
import {
  workflowScopedPolicyRouter as slaWorkflowScopedRouter,
  policyRouter as slaPolicyRouter,
  thresholdRouter as slaThresholdRouter,
  timerRouter as slaTimerRouter,
  extensionRouter as slaExtensionRouter,
  ticketScopedSlaRouter,
} from './modules/sla/sla.routes';
import businessCalendarRoutes from './modules/business-calendar/business-calendar.routes';
import {
  workflowScopedBindingRouter as stageFormWorkflowScopedRouter,
  bindingRouter as stageFormBindingRouter,
  ticketScopedFormsRouter as stageFormTicketScopedRouter,
  ticketScopedSubmissionRouter as ticketScopedFormSubmissionRouter,
} from './modules/stage-form/stage-form.routes';
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

  // Phase 3 — Approval module. Mounted as four routers so we don't have to
  // collide path-namespaces with the existing workflow + ticket routers.
  app.use('/api/workflows', approvalWorkflowScopedRouter);   // /:id/approval-policies (LIST + POST)
  app.use('/api/approval-policies', approvalPolicyRouter);    // /:id (GET, PATCH, DELETE)
  app.use('/api/approvals', approvalInstanceRouter);          // /:instanceId (GET)
  app.use('/api/tickets', approvalTicketScopedRouter);        // /:id/approvals (GET)

  // Phase 3 — SLA module. Same multi-router pattern.
  app.use('/api/workflows', slaWorkflowScopedRouter);   // /:id/sla-policies (GET)
  app.use('/api/sla-policies', slaPolicyRouter);         // POST, /:id GET/PATCH/DELETE, /:id/thresholds POST
  app.use('/api/sla-thresholds', slaThresholdRouter);    // /:id DELETE
  app.use('/api/sla/timers', slaTimerRouter);            // GET, /:id/extend POST
  app.use('/api/sla/extensions', slaExtensionRouter);    // /:id/decide POST
  app.use('/api/tickets', ticketScopedSlaRouter);        // /:id/sla (GET)

  // Phase 3 — Business calendars admin.
  app.use('/api/business-calendars', businessCalendarRoutes);

  // Phase 3.5 — StageFormBinding admin + ticket-scoped reads + workflow-bound
  // form submission. See docs/WORKFLOW_PHASE_3_5_PLAN.md §4.
  app.use('/api/workflows', stageFormWorkflowScopedRouter);  // /:id/stage-form-bindings
  app.use('/api/stage-form-bindings', stageFormBindingRouter); // /:id (GET/PATCH/DELETE)
  app.use('/api/tickets', stageFormTicketScopedRouter);       // /:id/stage-forms
  app.use('/api/tickets', ticketScopedFormSubmissionRouter);  // /:id/forms/:formId/submissions

  // OpenAPI / Swagger UI — public, mounted under /api so the Vite proxy serves
  // it through the frontend dev server too (http://localhost:3000/api/docs).
  app.use('/api', mountOpenApi());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
