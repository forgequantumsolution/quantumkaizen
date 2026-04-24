import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequest } from '../lib/httpError';

type Source = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(BadRequest('Validation failed', result.error.flatten().fieldErrors));
    }
    (req as any)[source] = result.data;
    next();
  };
