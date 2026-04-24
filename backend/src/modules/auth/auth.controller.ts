import type { Request, Response } from 'express';
import * as authService from './auth.service';
import { NotFound, Unauthorized } from '../../lib/httpError';

export const register = async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);
  res.status(201).json(result);
};

export const login = async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);
  res.json(result);
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) throw Unauthorized();
  const user = await authService.getCurrentUser(req.user.userId);
  if (!user) throw NotFound('User not found');
  res.json({ user });
};
