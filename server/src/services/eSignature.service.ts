import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

interface CreateSignatureParams {
  tenantId: string;
  userId: string;
  password: string;
  meaning: string;
  entityType: string;
  entityId: string;
  entityVersion: string;
  ipAddress: string;
  userAgent: string;
}

export async function createSignature(params: CreateSignatureParams) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const isPasswordValid = await bcrypt.compare(params.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials for electronic signature', 401, 'INVALID_CREDENTIALS');
  }

  const timestampUtc = new Date();
  const hashInput = [
    params.userId,
    user.name,
    user.role,
    params.meaning,
    timestampUtc.toISOString(),
    params.ipAddress,
    params.userAgent,
    params.entityType,
    params.entityId,
    params.entityVersion,
  ].join('|');

  const signatureHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  const signature = await prisma.electronicSignature.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      userName: user.name,
      userRole: user.role,
      meaning: params.meaning,
      entityType: params.entityType,
      entityId: params.entityId,
      entityVersion: params.entityVersion,
      timestampUtc,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      signatureHash,
    },
  });

  return signature;
}

export async function verifySignatureIntegrity(signatureId: string) {
  const sig = await prisma.electronicSignature.findUnique({ where: { id: signatureId } });
  if (!sig) {
    throw new AppError('Signature not found', 404, 'SIGNATURE_NOT_FOUND');
  }

  const hashInput = [
    sig.userId,
    sig.userName,
    sig.userRole,
    sig.meaning,
    sig.timestampUtc.toISOString(),
    sig.ipAddress,
    sig.userAgent,
    sig.entityType,
    sig.entityId,
    sig.entityVersion,
  ].join('|');

  const recomputedHash = crypto.createHash('sha256').update(hashInput).digest('hex');
  return { isValid: recomputedHash === sig.signatureHash, signature: sig };
}

export async function getSignaturesForEntity(entityType: string, entityId: string) {
  return prisma.electronicSignature.findMany({
    where: { entityType, entityId },
    orderBy: { timestampUtc: 'asc' },
  });
}
