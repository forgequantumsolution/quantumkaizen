import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import departmentRoutes from './modules/department/department.routes';
import siteRoutes from './modules/site/site.routes';
import roleRoutes from './modules/role/role.routes';
import permissionRoutes from './modules/permission/permission.routes';
import organizationRoutes from './modules/organization/organization.routes';
import workflowRoutes from './modules/workflow/workflow.routes';
import workflowLookupRoutes from './modules/workflow/lookups/lookups.routes';
import ticketRoutes from './modules/ticket/ticket.routes';
import dynamicFormRoutes from './modules/dynamic-form/dynamic-form.routes';
import formSubmissionRoutes from './modules/dynamic-form/submission.routes';
import auditRoutes from './modules/audit/audit.routes';
import dmsRoutes from './modules/dms/dms.routes';
import trainingRoutes from './modules/training/training.routes';
import lmsRoutes from './modules/lms/lms.routes';
import lmsPublicRoutes from './modules/lms/lms.public.routes';
import limsRoutes from './modules/lims/lims.routes';
import sampleRoutes from './modules/sample/sample.routes';
import limsMasterRoutes from './modules/lims-master/lims-master.routes';
import testDefinitionRoutes from './modules/test-definition/test-definition.routes';
import specVersionRoutes from './modules/spec-version/spec-version.routes';
import sampleTestingRoutes from './modules/sample-testing/sample-testing.routes';
import oosRoutes from './modules/oos/oos.routes';
import qcRoutes from './modules/qc/qc.routes';
import stabilityRoutes from './modules/stability/stability.routes';
import coaRoutes from './modules/coa/coa.routes';
import coaPublicRoutes from './modules/coa/coa.public.routes';
import limsAnalyticsRoutes from './modules/lims-analytics/lims-analytics.routes';
import navCountsRoutes from './modules/nav-counts/nav-counts.routes';
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
  app.use(express.json({ limit: '15mb' })); // raised for DMS inline document uploads
  app.use(express.urlencoded({ extended: true }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    })
  );

  app.use('/api/public/coa', coaPublicRoutes); // LIMS 2.0 — public CoA QR verify (no auth) — must precede the '/api' catch-all
  app.use('/api/public/lms', lmsPublicRoutes); // LMS — public certificate QR verify (no auth) — must precede the '/api' catch-all
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/sites', siteRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/permissions', permissionRoutes);
  app.use('/api/organization', organizationRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/workflow-lookups', workflowLookupRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/forms', dynamicFormRoutes);
  app.use('/api/form-submissions', formSubmissionRoutes);
  app.use('/api', auditRoutes); // ISO standards + audit schedules
  app.use('/api/dms', dmsRoutes); // controlled document management
  app.use('/api/training', trainingRoutes); // training & competency
  app.use('/api/lms', lmsRoutes); // LMS — learning management (courses, content)
  app.use('/api/lims', limsRoutes); // LIMS — lab registry (+ more)
  app.use('/api/samples', sampleRoutes); // LIMS — sample lifecycle
  app.use('/api/lims-master', limsMasterRoutes); // LIMS 2.0 — master data
  app.use('/api/test-definitions', testDefinitionRoutes); // LIMS 2.0 — test defs + panels
  app.use('/api/spec-versions', specVersionRoutes); // LIMS 2.0 — versioned specs
  app.use('/api/testing', sampleTestingRoutes); // LIMS 2.0 — tests, worklists, results, disposition
  app.use('/api/oos', oosRoutes); // LIMS 2.0 — OOS/OOT investigations
  app.use('/api/qc', qcRoutes); // LIMS 2.0 — QC (Levey-Jennings / Westgard)
  app.use('/api/stability', stabilityRoutes); // LIMS 2.0 — stability (ICH Q1A)
  app.use('/api/coa', coaRoutes); // LIMS 2.0 — certificate of analysis
  app.use('/api/lims-analytics', limsAnalyticsRoutes); // LIMS 2.0 — dashboard, TAT, workload, data-review
  app.use('/api/nav-counts', navCountsRoutes); // sidebar notification badges (FQS-QK-UIUX-003 §4)

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
