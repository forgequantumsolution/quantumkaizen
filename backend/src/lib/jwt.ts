import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  /**
   * Audit-trail provenance. Optional so tokens issued before this was added
   * keep verifying until they expire — the audit writer falls back to a DB
   * lookup for the name, and a missing sessionId is recorded as such rather
   * than blocking the request.
   */
  name?: string;
  sessionId?: string;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, env.JWT_SECRET) as JwtPayload;
