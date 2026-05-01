import { z } from './registry';

export const HttpErrorSchema = z
  .object({
    error: z.object({
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .openapi('HttpError', {
    description: 'Standard error envelope returned by every error response.',
  });

export const ValidationErrorSchema = z
  .object({
    error: z.object({
      message: z.literal('Validation failed'),
      details: z.record(z.array(z.string())).optional(),
    }),
  })
  .openapi('ValidationError');

export const PaginationMeta = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const errorResponses = {
  400: { description: 'Bad request — validation failed', content: { 'application/json': { schema: ValidationErrorSchema } } },
  401: { description: 'Unauthorized — missing/invalid token', content: { 'application/json': { schema: HttpErrorSchema } } },
  403: { description: 'Forbidden — missing required permission', content: { 'application/json': { schema: HttpErrorSchema } } },
  404: { description: 'Not found', content: { 'application/json': { schema: HttpErrorSchema } } },
  409: { description: 'Conflict — duplicate or constraint violation', content: { 'application/json': { schema: HttpErrorSchema } } },
} as const;
