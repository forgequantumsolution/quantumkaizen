import prisma from '../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

interface CreateAuditEntryParams {
  tenantId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  changedFields?: string[];
  ipAddress: string;
  sessionId: string;
  userAgent: string;
}

export async function createAuditEntry(params: CreateAuditEntryParams) {
  return prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeState: params.beforeState ?? undefined,
      afterState: params.afterState ?? undefined,
      changedFields: params.changedFields ?? [],
      ipAddress: params.ipAddress,
      sessionId: params.sessionId || 'system',
      userAgent: params.userAgent,
    },
  });
}

interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
}

export async function getAuditLog(
  tenantId: string,
  filters: AuditLogFilters,
  query: Record<string, unknown>
) {
  const pagination = parsePagination(query);

  const where: Record<string, unknown> = { tenantId };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.dateFrom || filters.dateTo) {
    where.timestampUtc = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }

  // AuditLog has no `createdAt` column — the timestamp field is `timestampUtc`.
  const sortBy = pagination.sortBy === 'createdAt' ? 'timestampUtc' : pagination.sortBy;
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { [sortBy]: pagination.sortOrder },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return buildPaginationResponse(data, total, pagination.page, pagination.limit);
}
