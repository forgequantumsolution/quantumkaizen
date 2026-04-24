import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import { Conflict, Unauthorized } from '../../lib/httpError';
import type { LoginInput, RegisterInput } from './auth.schema';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  departmentId: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email already in use');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      departmentId: input.departmentId,
      roleId: input.roleId,
    },
    select: publicUserSelect,
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { user, token };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw Unauthorized('Invalid credentials');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw Unauthorized('Invalid credentials');

  const token = signToken({ userId: user.id, email: user.email });
  const { passwordHash: _ph, ...safe } = user;
  return { user: safe, token };
};

export const getCurrentUser = (userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
