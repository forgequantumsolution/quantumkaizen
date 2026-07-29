import { registry, z } from '../../openapi/registry';
import { errorResponses } from '../../openapi/common';
import { SaveNavGroupsSchema } from './nav-group.schema';

SaveNavGroupsSchema.openapi('SaveNavGroupsInput', {
  example: {
    baseUpdatedAt: '2026-07-29T09:00:00.000Z',
    groups: [
      {
        key: 'quality-system',
        title: 'Quality System',
        icon: null,
        collapsible: true,
        defaultOpen: true,
        isFallback: true,
        moduleKeys: ['wf:6f1b2c34-5d6e-4f70-8a91-2b3c4d5e6f70'],
      },
    ],
  },
});

const NavGroupRow = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    title: z.string(),
    icon: z.string().nullable(),
    sortOrder: z.number().int(),
    collapsible: z.boolean(),
    defaultOpen: z.boolean(),
    isFallback: z.boolean(),
    isSystem: z.boolean(),
    updatedAt: z.string().datetime(),
    members: z.array(
      z.object({
        id: z.string().uuid(),
        moduleKey: z.string(),
        sortOrder: z.number().int(),
        updatedAt: z.string().datetime(),
      }),
    ),
  })
  .openapi('NavGroup');

registry.registerPath({
  method: 'get',
  path: '/nav-groups',
  tags: ['Navigation Groups'],
  summary: 'List sidebar navigation groups and their modules',
  description:
    'Readable by any authenticated user — every user needs it to render their own sidebar. ' +
    'Grouping is presentation only and grants no access.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List', content: { 'application/json': { schema: z.array(NavGroupRow) } } },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'put',
  path: '/nav-groups',
  tags: ['Navigation Groups'],
  summary: 'Replace the navigation layout (full document)',
  description:
    'Send the complete layout, not a diff. Returns 409 if the config changed since `baseUpdatedAt`.',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: SaveNavGroupsSchema } } } },
  responses: {
    200: { description: 'Saved', content: { 'application/json': { schema: z.array(NavGroupRow) } } },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/nav-groups/{id}',
  tags: ['Navigation Groups'],
  summary: 'Delete a group, moving its modules to the fallback group',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404],
  },
});
