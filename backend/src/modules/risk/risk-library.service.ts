/**
 * Hazard and control libraries.
 *
 * These turn a blank worksheet into a pick-list. The value is consistency: when
 * two teams describe the same hazard with the same wording and reach for the
 * same catalogued control, the register becomes aggregatable — you can finally
 * ask "how many risks share this hazard?" and get a true answer.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  ControlLibraryUpsert,
  HazardLibraryUpsert,
  ListControlLibraryQuery,
  ListHazardLibraryQuery,
} from './risk-control.schema';

// ── Hazard library ──────────────────────────────────────────────────────────

const hazardInclude = {
  category: { select: { id: true, name: true, code: true, color: true } },
} satisfies Prisma.HazardLibraryItemInclude;

type HazardRow = Prisma.HazardLibraryItemGetPayload<{ include: typeof hazardInclude }>;

const serializeHazard = (h: HazardRow) => ({
  id: h.id,
  code: h.code,
  name: h.name,
  type: h.type,
  description: h.description,
  category: h.category,
  default_severity_rank: h.defaultSeverityRank,
  tags: h.tags,
  is_active: h.isActive,
  created_at: h.createdAt,
  updated_at: h.updatedAt,
});

// A code is optional but, once given, unique — surface the collision as a
// Conflict rather than letting a raw P2002 escape as a 500.
const uniqueCodeGuard = (label: string) => (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw Conflict(`Another ${label} already uses that code`);
  }
  throw err;
};

export const listHazardLibrary = async (q: ListHazardLibraryQuery) => {
  const where: Prisma.HazardLibraryItemWhereInput = {};
  if (q.type) where.type = q.type;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.hazardLibraryItem.findMany({
      where,
      include: hazardInclude,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.hazardLibraryItem.count({ where }),
  ]);

  return { data: rows.map(serializeHazard), total, page: q.page, page_size: q.pageSize };
};

export const createHazardLibraryItem = async (body: HazardLibraryUpsert, userId?: string) => {
  if (body.categoryId) {
    const cat = await prisma.riskCategory.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!cat) throw BadRequest('Referenced risk category does not exist');
  }

  const created = await prisma.hazardLibraryItem
    .create({
      data: {
        code: body.code ?? null,
        name: body.name,
        type: body.type,
        description: body.description ?? null,
        categoryId: body.categoryId ?? null,
        defaultSeverityRank: body.defaultSeverityRank ?? null,
        tags: body.tags ?? Prisma.JsonNull,
        isActive: body.isActive,
        createdById: userId ?? null,
      },
      include: hazardInclude,
    })
    .catch(uniqueCodeGuard('hazard library item'));

  await writeTrail(
    { entityType: 'HazardLibraryItem', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return serializeHazard(created);
};

export const updateHazardLibraryItem = async (
  id: string,
  body: HazardLibraryUpsert,
  userId?: string,
) => {
  const existing = await prisma.hazardLibraryItem.findUnique({ where: { id } });
  if (!existing) throw NotFound('Hazard library item not found');
  if (body.categoryId) {
    const cat = await prisma.riskCategory.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!cat) throw BadRequest('Referenced risk category does not exist');
  }

  const updated = await prisma.hazardLibraryItem
    .update({
      where: { id },
      data: {
        code: body.code ?? null,
        name: body.name,
        type: body.type,
        description: body.description ?? null,
        categoryId: body.categoryId ?? null,
        defaultSeverityRank: body.defaultSeverityRank ?? null,
        tags: body.tags ?? Prisma.JsonNull,
        isActive: body.isActive,
      },
      include: hazardInclude,
    })
    .catch(uniqueCodeGuard('hazard library item'));

  await writeTrail(
    {
      entityType: 'HazardLibraryItem',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing.name,
      newValue: updated.name,
    },
    userId,
  );
  return serializeHazard(updated);
};

export const deleteHazardLibraryItem = async (id: string, userId?: string) => {
  const existing = await prisma.hazardLibraryItem.findUnique({ where: { id } });
  if (!existing) throw NotFound('Hazard library item not found');
  // Hazard items are copied into risks by value (no FK), so deletion cannot
  // orphan anything — the wording already captured on a risk stays intact.
  await prisma.hazardLibraryItem.delete({ where: { id } });
  await writeTrail(
    { entityType: 'HazardLibraryItem', entityId: id, action: 'DELETE', oldValue: existing.name },
    userId,
  );
};

// ── Control library ─────────────────────────────────────────────────────────

const controlLibInclude = {
  _count: { select: { controls: true } },
} satisfies Prisma.ControlLibraryItemInclude;

type ControlLibRow = Prisma.ControlLibraryItemGetPayload<{ include: typeof controlLibInclude }>;

const serializeControlLib = (c: ControlLibRow) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  type: c.type,
  hierarchy: c.hierarchy,
  description: c.description,
  effectiveness_rank: c.effectivenessRank,
  is_active: c.isActive,
  usage_count: c._count.controls,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

export const listControlLibrary = async (q: ListControlLibraryQuery) => {
  const where: Prisma.ControlLibraryItemWhereInput = {};
  if (q.type) where.type = q.type;
  if (q.hierarchy) where.hierarchy = q.hierarchy;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.controlLibraryItem.findMany({
      where,
      include: controlLibInclude,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.controlLibraryItem.count({ where }),
  ]);

  return { data: rows.map(serializeControlLib), total, page: q.page, page_size: q.pageSize };
};

export const createControlLibraryItem = async (body: ControlLibraryUpsert, userId?: string) => {
  const created = await prisma.controlLibraryItem
    .create({
      data: {
        code: body.code ?? null,
        name: body.name,
        type: body.type,
        hierarchy: body.hierarchy ?? null,
        description: body.description ?? null,
        effectivenessRank: body.effectivenessRank ?? null,
        isActive: body.isActive,
        createdById: userId ?? null,
      },
      include: controlLibInclude,
    })
    .catch(uniqueCodeGuard('control library item'));

  await writeTrail(
    { entityType: 'ControlLibraryItem', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return serializeControlLib(created);
};

export const updateControlLibraryItem = async (
  id: string,
  body: ControlLibraryUpsert,
  userId?: string,
) => {
  const existing = await prisma.controlLibraryItem.findUnique({ where: { id } });
  if (!existing) throw NotFound('Control library item not found');

  const updated = await prisma.controlLibraryItem
    .update({
      where: { id },
      data: {
        code: body.code ?? null,
        name: body.name,
        type: body.type,
        hierarchy: body.hierarchy ?? null,
        description: body.description ?? null,
        effectivenessRank: body.effectivenessRank ?? null,
        isActive: body.isActive,
      },
      include: controlLibInclude,
    })
    .catch(uniqueCodeGuard('control library item'));

  await writeTrail(
    {
      entityType: 'ControlLibraryItem',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing.name,
      newValue: updated.name,
    },
    userId,
  );
  return serializeControlLib(updated);
};

export const deleteControlLibraryItem = async (id: string, userId?: string) => {
  const existing = await prisma.controlLibraryItem.findUnique({
    where: { id },
    include: controlLibInclude,
  });
  if (!existing) throw NotFound('Control library item not found');
  // The FK is SetNull, so deleting would quietly strip the provenance of every
  // control derived from this catalogue entry. Refuse and offer deactivation.
  if (existing._count.controls > 0) {
    throw Conflict(
      `"${existing.name}" is referenced by ${existing._count.controls} risk control(s) and cannot be deleted. ` +
        'Deactivate it instead to remove it from the pick-list.',
    );
  }
  await prisma.controlLibraryItem.delete({ where: { id } });
  await writeTrail(
    { entityType: 'ControlLibraryItem', entityId: id, action: 'DELETE', oldValue: existing.name },
    userId,
  );
};
