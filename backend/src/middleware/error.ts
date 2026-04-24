import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/httpError';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: { message: 'Route not found' } });
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { message: 'Unique constraint violation', target: err.meta?.target },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { message: 'Record not found' } });
    }
  }

  console.error('[unhandled-error]', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};
