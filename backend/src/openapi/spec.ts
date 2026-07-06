import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';
import { env } from '../config/env';

// Pull in side-effect registrations from each module so the registry is
// fully populated before we generate the document.
import './common';
import '../modules/auth/auth.openapi';
import '../modules/user/user.openapi';
import '../modules/department/department.openapi';
import '../modules/role/role.openapi';
import '../modules/permission/permission.openapi';
import '../modules/organization/organization.openapi';
import '../modules/workflow/workflow.openapi';
import '../modules/workflow/lookups/lookups.openapi';
import '../modules/ticket/ticket.openapi';
import '../modules/approval/approval.openapi';
import '../modules/sla/sla.openapi';
import '../modules/business-calendar/business-calendar.openapi';

export const buildOpenApiSpec = () => {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Quantum Kairoz API',
      version: '1.0.0',
      description:
        'REST API for the Quantum Kairoz QMS platform. All endpoints under `/api` (except `/api/auth/login` and `/api/auth/register`) require a Bearer JWT obtained from `/api/auth/login`.',
    },
    servers: [
      { url: `http://localhost:${env.PORT}/api`, description: 'Local dev' },
      { url: '/api', description: 'Same-origin (production)' },
    ],
  });
};
