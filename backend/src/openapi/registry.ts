import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// One-time extension of zod with .openapi() so all module schemas can use it.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Bearer JWT — registered once globally so each protected route can reference it.
export const bearerAuth = registry.registerComponent(
  'securitySchemes',
  'bearerAuth',
  {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Paste the `token` returned by `POST /api/auth/login` (without the `Bearer ` prefix).',
  },
);

export { z };
