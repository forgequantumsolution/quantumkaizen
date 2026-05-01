import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import { PermissionSchema } from '../role/role.openapi';

const PermissionGroupSchema = z
  .object({
    module: z.string(),
    permissions: z.array(
      z.object({
        id: z.string().uuid(),
        key: z.string(),
        action: z.string(),
        description: z.string(),
      }),
    ),
  })
  .openapi('PermissionGroup');

registry.registerPath({
  method: 'get', path: '/permissions', tags: ['Permissions'],
  summary: 'List all permissions (optionally grouped by module)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      grouped: z.enum(['true', 'false']).optional().describe('Pass `true` to group by module'),
    }),
  },
  responses: {
    200: {
      description: 'Permission list (flat or grouped)',
      content: {
        'application/json': {
          schema: z.union([z.array(PermissionSchema), z.array(PermissionGroupSchema)]),
        },
      },
    },
    401: errorResponses[401],
  },
});
