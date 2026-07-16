import type { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../../lib/httpError';
import {
  ensureWorkflowTypePermissions,
  grantWorkflowTypePermissionsToSuperAdmin,
  deleteWorkflowTypePermissions,
} from '../../../lib/rbac-workflow-types';
import { deleteFindingTypePermissions } from '../../../lib/rbac-findings';
import { invalidatePermissionCache } from '../../../middleware/permissions';
import type {
  CreateNamedInput,
  CreateSeverityInput,
  CreateStageStatusInput,
  CreateWorkflowTypeInput,
} from './lookups.schema';

const derivePrefix = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.slice(0, 3).toUpperCase() || 'WF';
};

// Generate this type's per-type RBAC keys, grant them to SUPER_ADMIN, and drop
// the permission cache so the new module is immediately grantable in Access
// Control (see lib/rbac-workflow-types.ts).
const provisionTypePermissions = async (typeId: string, name: string) => {
  await ensureWorkflowTypePermissions(typeId, name);
  await grantWorkflowTypePermissionsToSuperAdmin(typeId, name);
  invalidatePermissionCache();
};

// ─── WorkflowType ────────────────────────────────────────────────────────────

export const listWorkflowTypes = async (search?: string) => {
  const where: Prisma.WorkflowTypeWhereInput = { isDeleted: false };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  return prisma.workflowType.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { iconConfig: true },
  });
};

export const createWorkflowType = async (input: CreateWorkflowTypeInput) => {
  const exists = await prisma.workflowType.findUnique({
    where: { name: input.name },
    select: { id: true, isDeleted: true },
  });
  if (exists && !exists.isDeleted) throw Conflict('Workflow type already exists');

  const codePrefix = input.codePrefix?.toUpperCase() ?? derivePrefix(input.name);

  if (exists?.isDeleted) {
    const revived = await prisma.workflowType.update({
      where: { id: exists.id },
      data: { isDeleted: false, codePrefix },
      include: { iconConfig: true },
    });
    await provisionTypePermissions(revived.id, revived.name);
    return revived;
  }

  const created = await prisma.workflowType.create({
    data: {
      name: input.name,
      codePrefix,
      ...(input.iconName
        ? { iconConfig: { create: { iconName: input.iconName } } }
        : {}),
    },
    include: { iconConfig: true },
  });
  await provisionTypePermissions(created.id, created.name);
  return created;
};

export const deleteWorkflowType = async (id: string, hard: boolean) => {
  const type = await prisma.workflowType.findUnique({
    where: { id },
    select: { id: true, _count: { select: { workflows: true } }, isDeleted: true },
  });
  if (!type) throw NotFound('Workflow type not found');

  if (type._count.workflows > 0) {
    if (hard) {
      throw Conflict(
        `Cannot hard-delete: ${type._count.workflows} workflow(s) still reference this type`
      );
    }
  }

  if (hard) {
    await prisma.workflowType.delete({ where: { id } });
    // Type is gone for good — remove its per-type permission rows (role/dept/user
    // grants cascade away via the M2M). Soft-delete keeps them so a restore is
    // seamless.
    await deleteWorkflowTypePermissions(id);
    await deleteFindingTypePermissions(id);
    invalidatePermissionCache();
  } else {
    if (type.isDeleted) throw BadRequest('Workflow type already deleted');
    await prisma.workflowType.update({ where: { id }, data: { isDeleted: true } });
  }
};

// ─── WorkflowStageStatus ─────────────────────────────────────────────────────

export const listStageStatuses = async (search?: string) => {
  const where: Prisma.WorkflowStageStatusWhereInput = { isDeleted: false };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  return prisma.workflowStageStatus.findMany({ where, orderBy: { name: 'asc' } });
};

export const createStageStatus = async (input: CreateStageStatusInput) => {
  const exists = await prisma.workflowStageStatus.findUnique({
    where: { name: input.name },
    select: { id: true, isDeleted: true },
  });
  if (exists && !exists.isDeleted) throw Conflict('Stage status already exists');
  if (exists?.isDeleted) {
    return prisma.workflowStageStatus.update({
      where: { id: exists.id },
      data: { isDeleted: false, behavior: input.behavior },
    });
  }
  return prisma.workflowStageStatus.create({
    data: { name: input.name, behavior: input.behavior },
  });
};

// ─── ActionType ──────────────────────────────────────────────────────────────

export const listActionTypes = async (search?: string) => {
  const where: Prisma.ActionTypeWhereInput = { isDeleted: false };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  return prisma.actionType.findMany({ where, orderBy: { name: 'asc' } });
};

export const createActionType = async (input: CreateNamedInput) => {
  const exists = await prisma.actionType.findUnique({
    where: { name: input.name },
    select: { id: true, isDeleted: true },
  });
  if (exists && !exists.isDeleted) throw Conflict('Action type already exists');
  if (exists?.isDeleted) {
    return prisma.actionType.update({
      where: { id: exists.id },
      data: { isDeleted: false },
    });
  }
  return prisma.actionType.create({ data: { name: input.name } });
};

// ─── ActionCriteria ──────────────────────────────────────────────────────────

export const listActionCriteria = async (search?: string) => {
  const where: Prisma.ActionCriteriaWhereInput = { isDeleted: false };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  return prisma.actionCriteria.findMany({ where, orderBy: { name: 'asc' } });
};

export const createActionCriteria = async (input: CreateNamedInput) => {
  return prisma.actionCriteria.create({ data: { name: input.name } });
};

// ─── Priority ────────────────────────────────────────────────────────────────

export const listPriorities = async () =>
  prisma.priority.findMany({ orderBy: { name: 'asc' } });

// ─── Severity ────────────────────────────────────────────────────────────────

export const listSeverities = async (search?: string) => {
  const where: Prisma.SeverityWhereInput = { isDeleted: false };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  return prisma.severity.findMany({
    where,
    orderBy: [{ level: 'desc' }, { name: 'asc' }],
  });
};

export const createSeverity = async (input: CreateSeverityInput) => {
  const exists = await prisma.severity.findUnique({
    where: { name: input.name },
    select: { id: true, isDeleted: true },
  });
  if (exists && !exists.isDeleted) throw Conflict('Severity already exists');
  if (exists?.isDeleted) {
    return prisma.severity.update({
      where: { id: exists.id },
      data: {
        isDeleted: false,
        level: input.level,
        color: input.color ?? null,
      },
    });
  }
  return prisma.severity.create({
    data: {
      name: input.name,
      level: input.level,
      color: input.color ?? null,
    },
  });
};

export const deleteSeverity = async (id: string) => {
  const sev = await prisma.severity.findUnique({
    where: { id },
    select: { id: true, isDeleted: true, _count: { select: { tickets: true } } },
  });
  if (!sev) throw NotFound('Severity not found');
  if (sev.isDeleted) throw BadRequest('Severity already deleted');
  // Soft-delete so existing ticket references stay intact.
  await prisma.severity.update({ where: { id }, data: { isDeleted: true } });
};
