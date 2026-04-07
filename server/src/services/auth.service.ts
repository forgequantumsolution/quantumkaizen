import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

interface RegisterData {
  tenantId: string;
  employeeId: string;
  email: string;
  name: string;
  password: string;
  role: string;
  department?: string;
  site?: string;
}

export async function register(data: RegisterData) {
  const existingUser = await prisma.user.findFirst({
    where: { tenantId: data.tenantId, email: data.email },
  });

  if (existingUser) {
    throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      tenantId: data.tenantId,
      employeeId: data.employeeId,
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role as any,
      department: data.department,
      site: data.site,
    },
    select: {
      id: true,
      tenantId: true,
      employeeId: true,
      email: true,
      name: true,
      role: true,
      department: true,
      site: true,
      isActive: true,
      createdAt: true,
    },
  });

  return user;
}

export async function login(email: string, password: string, tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  if (!tenant || !tenant.isActive) {
    throw new AppError('Invalid tenant code', 401, 'INVALID_TENANT');
  }

  const user = await prisma.user.findFirst({
    where: { email, tenantId: tenant.id },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const payload = {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    name: user.name,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as string,
  });

  const refreshTokenValue = uuidv4();
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: refreshExpiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      site: user.site,
    },
    accessToken,
    refreshToken: refreshTokenValue,
  };
}

export async function refreshToken(token: string) {
  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.expiresAt < new Date()) {
    if (storedToken) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    }
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 401, 'INVALID_USER');
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const payload = {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    name: user.name,
  };

  const newAccessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as string,
  });

  const newRefreshTokenValue = uuidv4();
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefreshTokenValue,
      expiresAt: refreshExpiresAt,
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshTokenValue };
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isOldPasswordValid) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  await prisma.refreshToken.deleteMany({ where: { userId } });

  return { message: 'Password changed successfully' };
}
