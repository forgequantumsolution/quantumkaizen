/**
 * Training & Competency service.
 *
 * Training items (often a controlled Document/SOP) are assigned to users, who
 * complete them — or they auto-complete when the user acknowledges the linked
 * document (read & understood). `completeForDocument` is called from the DMS
 * acknowledge flow to close that loop.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  AssignInput,
  CreateItemInput,
  ListItemsQuery,
  UpdateItemInput,
} from './training.schema';

const nextCode = async (year: number): Promise<string> => {
  const count = await prisma.trainingItem.count({ where: { code: { startsWith: `TRN-${year}-` } } });
  return `TRN-${year}-${String(count + 1).padStart(4, '0')}`;
};

const resolveNames = async (userIds: (string | null | undefined)[]) => {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  return new Map(users.map((u) => [u.id, u.name]));
};

type ItemRow = Prisma.TrainingItemGetPayload<{ include: { assignments: true } }>;

const serializeItem = (i: ItemRow, names: Map<string, string>, full = false) => {
  const completed = i.assignments.filter((a) => a.status === 'COMPLETED').length;
  return {
    id: i.id,
    code: i.code,
    title: i.title,
    description: i.description,
    document_id: i.documentId,
    role_id: i.roleId,
    is_active: i.isActive,
    assigned_count: i.assignments.length,
    completed_count: completed,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
    ...(full
      ? {
          assignments: [...i.assignments]
            .sort((a, b) => +a.assignedAt - +b.assignedAt)
            .map((a) => ({
              id: a.id,
              user_id: a.userId,
              user_name: names.get(a.userId) ?? null,
              status: a.status,
              due_date: a.dueDate,
              assigned_at: a.assignedAt,
              completed_at: a.completedAt,
            })),
        }
      : {}),
  };
};

export const listItems = async (q: ListItemsQuery) => {
  const where: Prisma.TrainingItemWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.trainingItem.count({ where }),
    prisma.trainingItem.findMany({ where, include: { assignments: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map((r) => serializeItem(r, new Map())), total, page: q.page, page_size: q.page_size };
};

const getItemRow = async (id: string): Promise<ItemRow> => {
  const i = await prisma.trainingItem.findFirst({ where: { id, isDeleted: false }, include: { assignments: true } });
  if (!i) throw NotFound('Training item not found');
  return i;
};

export const getItem = async (id: string) => {
  const i = await getItemRow(id);
  const names = await resolveNames(i.assignments.map((a) => a.userId));
  return serializeItem(i, names, true);
};

export const createItem = async (input: CreateItemInput, userId?: string) => {
  const code = await nextCode(new Date().getFullYear());
  const created = await prisma.trainingItem.create({
    data: {
      code,
      title: input.title,
      description: input.description ?? null,
      documentId: input.document_id ?? null,
      roleId: input.role_id ?? null,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'TrainingItem', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getItem(created.id);
};

export const updateItem = async (id: string, input: UpdateItemInput, userId?: string) => {
  const existing = await getItemRow(id);
  await prisma.trainingItem.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      documentId: input.document_id ?? existing.documentId,
      roleId: input.role_id ?? existing.roleId,
      isActive: input.is_active ?? existing.isActive,
    },
  });
  await writeTrail({ entityType: 'TrainingItem', entityId: id, action: 'UPDATE' }, userId);
  return getItem(id);
};

export const deleteItem = async (id: string, userId?: string) => {
  await getItemRow(id);
  await prisma.trainingItem.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'TrainingItem', entityId: id, action: 'DELETE' }, userId);
};

export const assignTraining = async (id: string, input: AssignInput, userId?: string) => {
  await getItemRow(id);
  const targetIds = new Set(input.user_ids ?? []);
  if (input.role_id) {
    const users = await prisma.user.findMany({ where: { roleId: input.role_id, isActive: true }, select: { id: true } });
    users.forEach((u) => targetIds.add(u.id));
  }
  const ids = [...targetIds];
  if (!ids.length) throw BadRequest('No target users resolved');

  const existing = await prisma.trainingAssignment.findMany({ where: { trainingItemId: id, userId: { in: ids } }, select: { userId: true } });
  const have = new Set(existing.map((e) => e.userId));
  const toCreate = ids.filter((u) => !have.has(u));
  if (toCreate.length) {
    await prisma.trainingAssignment.createMany({
      data: toCreate.map((uid) => ({
        trainingItemId: id,
        userId: uid,
        dueDate: input.due_date ? new Date(input.due_date) : null,
        assignedById: userId ?? null,
      })),
    });
    await writeTrail({ entityType: 'TrainingItem', entityId: id, action: 'UPDATE', field: 'assigned', newValue: String(toCreate.length) }, userId);
  }
  return getItem(id);
};

export const completeTraining = async (id: string, userId: string) => {
  const a = await prisma.trainingAssignment.findUnique({ where: { trainingItemId_userId: { trainingItemId: id, userId } } });
  if (!a) throw NotFound('No training assignment for this user');
  if (a.status !== 'COMPLETED') {
    await prisma.trainingAssignment.update({ where: { id: a.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await writeTrail({ entityType: 'TrainingItem', entityId: id, action: 'UPDATE', field: 'completed', newValue: userId }, userId);
  }
  return getItem(id);
};

// Auto-complete training tied to a document the user just acknowledged (DMS hook).
export const completeForDocument = async (documentId: string, userId: string): Promise<void> => {
  const items = await prisma.trainingItem.findMany({ where: { documentId, isDeleted: false }, select: { id: true } });
  if (!items.length) return;
  await prisma.trainingAssignment.updateMany({
    where: { trainingItemId: { in: items.map((i) => i.id) }, userId, status: 'ASSIGNED' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
};

// "My training" — everything assigned to the user.
export const listMyTraining = async (userId: string) => {
  const rows = await prisma.trainingAssignment.findMany({
    where: { userId },
    include: { trainingItem: true },
    orderBy: [{ status: 'asc' }, { assignedAt: 'asc' }],
  });
  const active = rows.filter((r) => !r.trainingItem.isDeleted);
  return {
    pending: active.filter((r) => r.status === 'ASSIGNED').length,
    items: active.map((r) => ({
      assignment_id: r.id,
      training_item_id: r.trainingItemId,
      code: r.trainingItem.code,
      title: r.trainingItem.title,
      document_id: r.trainingItem.documentId,
      status: r.status,
      due_date: r.dueDate,
      completed_at: r.completedAt,
    })),
  };
};
