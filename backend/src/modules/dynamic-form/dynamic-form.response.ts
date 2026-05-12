// Response envelope expected by the DynamicFormApp frontend:
//   GET  -> { status: 200, data: <payload> }
//   POST -> { status: 'success'|'failed', message, data? }
// Used only by this module so existing endpoints stay JSON-plain.
import type { Response } from 'express';

export const ok = <T>(res: Response, data: T) =>
  res.json({ status: 200, data });

export const success = <T = undefined>(
  res: Response,
  message: string,
  data?: T,
  http = 200
) => res.status(http).json({ status: 'success', message, data: data ?? null });

export const failed = (res: Response, message: string, http = 400) =>
  res.status(http).json({ status: 'failed', message, data: null });
