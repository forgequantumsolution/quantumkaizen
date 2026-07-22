/**
 * Risk framework + category configuration.
 *
 * A framework is the tenant's methodology definition: its scoring axes, the
 * anchored levels on each axis, the risk bands and the governance policy each
 * band triggers. Everything the scoring engine needs is here, which is why an
 * approved assessment can be re-rendered years later from a pinned framework.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  CategoryUpsert,
  FrameworkUpsert,
  ListCategoryQuery,
  ListFrameworkQuery,
} from './risk.schema';
import type { ScoringFramework } from './risk-scoring.service';

const frameworkInclude = {
  factors: { include: { levels: { orderBy: { rank: 'asc' } } }, orderBy: { order: 'asc' } },
  levels: { orderBy: { order: 'asc' } },
  matrixCells: true,
  _count: { select: { risks: true, registers: true } },
} satisfies Prisma.RiskFrameworkInclude;

type FrameworkRow = Prisma.RiskFrameworkGetPayload<{ include: typeof frameworkInclude }>;

export const serializeFramework = (f: FrameworkRow) => ({
  id: f.id,
  code: f.code,
  name: f.name,
  description: f.description,
  standard: f.standard,
  methodology: f.methodology,
  formula: f.formula,
  version: f.version,
  is_active: f.isActive,
  is_default: f.isDefault,
  terminology: f.terminology,
  field_config: f.fieldConfig,
  site_id: f.siteId,
  factors: f.factors.map((factor) => ({
    id: factor.id,
    kind: factor.kind,
    key: factor.key,
    label: factor.label,
    description: factor.description,
    weight: factor.weight,
    order: factor.order,
    levels: factor.levels.map((l) => ({
      id: l.id,
      rank: l.rank,
      label: l.label,
      definition: l.definition,
      guidance: l.guidance,
      color: l.color,
    })),
  })),
  levels: f.levels.map((l) => ({
    id: l.id,
    code: l.code,
    label: l.label,
    color: l.color,
    order: l.order,
    min_score: l.minScore,
    max_score: l.maxScore,
    acceptance: l.acceptance,
    requires_capa: l.requiresCapa,
    requires_approval: l.requiresApproval,
    requires_control: l.requiresControl,
    review_months: l.reviewMonths,
    escalate_to_role_id: l.escalateToRoleId,
  })),
  matrix_cells: f.matrixCells.map((c) => ({
    id: c.id,
    row_factor_key: c.rowFactorKey,
    row_rank: c.rowRank,
    col_factor_key: c.colFactorKey,
    col_rank: c.colRank,
    score: c.score,
    level_id: c.levelId,
  })),
  risk_count: f._count.risks,
  register_count: f._count.registers,
  created_at: f.createdAt,
  updated_at: f.updatedAt,
});

/** Shape a framework row for the pure scoring engine. */
export const toScoringFramework = (f: FrameworkRow): ScoringFramework => ({
  id: f.id,
  name: f.name,
  formula: f.formula,
  factors: f.factors.map((factor) => ({
    key: factor.key,
    weight: factor.weight,
    levels: factor.levels.map((l) => ({ rank: l.rank })),
  })),
  levels: f.levels.map((l) => ({
    id: l.id,
    code: l.code,
    label: l.label,
    color: l.color,
    order: l.order,
    minScore: l.minScore,
    maxScore: l.maxScore,
    acceptance: l.acceptance,
    requiresCapa: l.requiresCapa,
    requiresApproval: l.requiresApproval,
    requiresControl: l.requiresControl,
    reviewMonths: l.reviewMonths,
  })),
  matrixCells: f.matrixCells.map((c) => ({
    rowFactorKey: c.rowFactorKey,
    rowRank: c.rowRank,
    colFactorKey: c.colFactorKey,
    colRank: c.colRank,
    score: c.score,
    levelId: c.levelId,
  })),
});

/** Load a framework in the shape the scoring engine expects, or throw. */
export const loadScoringFramework = async (frameworkId: string) => {
  const row = await prisma.riskFramework.findUnique({
    where: { id: frameworkId },
    include: frameworkInclude,
  });
  if (!row) throw NotFound('Risk framework not found');
  if (!row.isActive) throw BadRequest(`Risk framework "${row.name}" is inactive and cannot be used for scoring`);
  return { row, scoring: toScoringFramework(row) };
};

export const listFrameworks = async (q: ListFrameworkQuery) => {
  const where: Prisma.RiskFrameworkWhereInput = {};
  if (q.methodology) where.methodology = q.methodology;
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.siteId) where.siteId = q.siteId;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { standard: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.riskFramework.findMany({
    where,
    include: frameworkInclude,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return rows.map(serializeFramework);
};

export const getFramework = async (id: string) => {
  const row = await prisma.riskFramework.findUnique({ where: { id }, include: frameworkInclude });
  if (!row) throw NotFound('Risk framework not found');
  return serializeFramework(row);
};

/**
 * Write a framework and its whole child graph in one transaction. Factors,
 * levels and cells are replaced wholesale rather than diffed — a framework is
 * small, and a partial write would leave an unscoreable configuration behind.
 */
const writeFrameworkGraph = async (
  tx: Prisma.TransactionClient,
  frameworkId: string,
  body: FrameworkUpsert,
) => {
  await tx.riskMatrixCell.deleteMany({ where: { frameworkId } });
  await tx.riskFactor.deleteMany({ where: { frameworkId } });
  await tx.riskLevelDef.deleteMany({ where: { frameworkId } });

  for (const factor of body.factors) {
    await tx.riskFactor.create({
      data: {
        frameworkId,
        kind: factor.kind,
        key: factor.key,
        label: factor.label,
        description: factor.description ?? null,
        weight: factor.weight,
        order: factor.order,
        levels: {
          create: factor.levels.map((l) => ({
            rank: l.rank,
            label: l.label,
            definition: l.definition ?? null,
            guidance: l.guidance ?? null,
            color: l.color ?? null,
          })),
        },
      },
    });
  }

  const levelIdByCode = new Map<string, string>();
  for (const level of body.levels) {
    const created = await tx.riskLevelDef.create({
      data: {
        frameworkId,
        code: level.code,
        label: level.label,
        color: level.color,
        order: level.order,
        minScore: level.minScore ?? null,
        maxScore: level.maxScore ?? null,
        acceptance: level.acceptance,
        requiresCapa: level.requiresCapa,
        requiresApproval: level.requiresApproval,
        requiresControl: level.requiresControl,
        reviewMonths: level.reviewMonths ?? null,
        escalateToRoleId: level.escalateToRoleId ?? null,
      },
    });
    levelIdByCode.set(level.code, created.id);
  }

  for (const cell of body.matrixCells ?? []) {
    const levelId = levelIdByCode.get(cell.levelCode);
    if (!levelId) throw BadRequest(`Matrix cell references unknown level "${cell.levelCode}"`);
    await tx.riskMatrixCell.create({
      data: {
        frameworkId,
        rowFactorKey: cell.rowFactorKey,
        rowRank: cell.rowRank,
        colFactorKey: cell.colFactorKey,
        colRank: cell.colRank,
        score: cell.score ?? null,
        levelId,
      },
    });
  }
};

/** Only one framework may be the default; clear the flag on the others. */
const enforceSingleDefault = async (tx: Prisma.TransactionClient, frameworkId: string) => {
  await tx.riskFramework.updateMany({
    where: { id: { not: frameworkId }, isDefault: true },
    data: { isDefault: false },
  });
};

export const createFramework = async (body: FrameworkUpsert, userId?: string) => {
  if (body.code) {
    const clash = await prisma.riskFramework.findUnique({ where: { code: body.code } });
    if (clash) throw Conflict(`A risk framework with code "${body.code}" already exists`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const framework = await tx.riskFramework.create({
      data: {
        code: body.code ?? null,
        name: body.name,
        description: body.description ?? null,
        standard: body.standard ?? null,
        methodology: body.methodology,
        formula: body.formula,
        isActive: body.isActive,
        isDefault: body.isDefault,
        terminology: (body.terminology ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        fieldConfig: (body.fieldConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        siteId: body.siteId ?? null,
        createdById: userId ?? null,
      },
    });
    await writeFrameworkGraph(tx, framework.id, body);
    if (body.isDefault) await enforceSingleDefault(tx, framework.id);
    return framework;
  });

  await writeTrail(
    { entityType: 'RiskFramework', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return getFramework(created.id);
};

/**
 * Editing a framework that risks already reference silently rewrites history —
 * a score computed under the old scale would no longer reproduce. Once it is in
 * use, the configuration is frozen and the caller must clone to a new version.
 */
export const updateFramework = async (id: string, body: FrameworkUpsert, userId?: string) => {
  const existing = await prisma.riskFramework.findUnique({
    where: { id },
    include: { _count: { select: { risks: true } } },
  });
  if (!existing) throw NotFound('Risk framework not found');

  const structureChanged =
    existing.formula !== body.formula || existing.methodology !== body.methodology;
  if (existing._count.risks > 0 && structureChanged) {
    throw Conflict(
      `Framework "${existing.name}" is used by ${existing._count.risks} risk(s); its methodology and ` +
        'formula are frozen. Clone it to a new version instead.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.riskFramework.update({
      where: { id },
      data: {
        code: body.code ?? null,
        name: body.name,
        description: body.description ?? null,
        standard: body.standard ?? null,
        methodology: body.methodology,
        formula: body.formula,
        isActive: body.isActive,
        isDefault: body.isDefault,
        terminology: (body.terminology ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        fieldConfig: (body.fieldConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        siteId: body.siteId ?? null,
      },
    });
    await writeFrameworkGraph(tx, id, body);
    if (body.isDefault) await enforceSingleDefault(tx, id);
  });

  await writeTrail(
    { entityType: 'RiskFramework', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: body.name },
    userId,
  );
  return getFramework(id);
};

/** Clone a framework as version+1 — the supported way to evolve a used config. */
export const cloneFramework = async (id: string, userId?: string) => {
  const source = await prisma.riskFramework.findUnique({ where: { id }, include: frameworkInclude });
  if (!source) throw NotFound('Risk framework not found');

  const created = await prisma.$transaction(async (tx) => {
    const framework = await tx.riskFramework.create({
      data: {
        code: source.code ? `${source.code}_V${source.version + 1}` : null,
        name: `${source.name} (v${source.version + 1})`,
        description: source.description,
        standard: source.standard,
        methodology: source.methodology,
        formula: source.formula,
        version: source.version + 1,
        isActive: true,
        isDefault: false,
        terminology: source.terminology ?? Prisma.JsonNull,
        fieldConfig: source.fieldConfig ?? Prisma.JsonNull,
        siteId: source.siteId,
        createdById: userId ?? null,
      },
    });

    for (const factor of source.factors) {
      await tx.riskFactor.create({
        data: {
          frameworkId: framework.id,
          kind: factor.kind,
          key: factor.key,
          label: factor.label,
          description: factor.description,
          weight: factor.weight,
          order: factor.order,
          levels: {
            create: factor.levels.map((l) => ({
              rank: l.rank,
              label: l.label,
              definition: l.definition,
              guidance: l.guidance,
              color: l.color,
            })),
          },
        },
      });
    }

    const levelIdByCode = new Map<string, string>();
    for (const level of source.levels) {
      const copy = await tx.riskLevelDef.create({
        data: {
          frameworkId: framework.id,
          code: level.code,
          label: level.label,
          color: level.color,
          order: level.order,
          minScore: level.minScore,
          maxScore: level.maxScore,
          acceptance: level.acceptance,
          requiresCapa: level.requiresCapa,
          requiresApproval: level.requiresApproval,
          requiresControl: level.requiresControl,
          reviewMonths: level.reviewMonths,
          escalateToRoleId: level.escalateToRoleId,
        },
      });
      levelIdByCode.set(level.code, copy.id);
    }

    // Cells must point at the *clone's* levels, not the source's.
    for (const cell of source.matrixCells) {
      const sourceLevel = source.levels.find((l) => l.id === cell.levelId);
      const levelId = sourceLevel ? levelIdByCode.get(sourceLevel.code) : undefined;
      if (!levelId) continue;
      await tx.riskMatrixCell.create({
        data: {
          frameworkId: framework.id,
          rowFactorKey: cell.rowFactorKey,
          rowRank: cell.rowRank,
          colFactorKey: cell.colFactorKey,
          colRank: cell.colRank,
          score: cell.score,
          levelId,
        },
      });
    }
    return framework;
  });

  await writeTrail(
    { entityType: 'RiskFramework', entityId: created.id, action: 'CREATE', newValue: `Cloned from ${source.name}` },
    userId,
  );
  return getFramework(created.id);
};

export const deleteFramework = async (id: string, userId?: string) => {
  const existing = await prisma.riskFramework.findUnique({
    where: { id },
    include: { _count: { select: { risks: true, registers: true } } },
  });
  if (!existing) throw NotFound('Risk framework not found');
  if (existing._count.risks > 0 || existing._count.registers > 0) {
    throw Conflict(
      `Framework "${existing.name}" is in use by ${existing._count.risks} risk(s) and ` +
        `${existing._count.registers} register(s). Deactivate it instead of deleting.`,
    );
  }
  await prisma.riskFramework.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskFramework', entityId: id, action: 'DELETE', oldValue: existing.name },
    userId,
  );
};

// ── Categories ──────────────────────────────────────────────────────────────

const serializeCategory = (c: {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  description: c.description,
  color: c.color,
  is_active: c.isActive,
  parent_id: c.parentId,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

export const listCategories = async (q: ListCategoryQuery) => {
  const where: Prisma.RiskCategoryWhereInput = {};
  if (q.isActive !== undefined) where.isActive = q.isActive;
  if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
  const rows = await prisma.riskCategory.findMany({ where, orderBy: { name: 'asc' } });
  return rows.map(serializeCategory);
};

export const createCategory = async (body: CategoryUpsert, userId?: string) => {
  const created = await prisma.riskCategory.create({
    data: {
      code: body.code ?? null,
      name: body.name,
      description: body.description ?? null,
      color: body.color ?? null,
      parentId: body.parentId ?? null,
      isActive: body.isActive,
      createdById: userId ?? null,
    },
  });
  await writeTrail(
    { entityType: 'RiskCategory', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return serializeCategory(created);
};

export const updateCategory = async (id: string, body: CategoryUpsert, userId?: string) => {
  const existing = await prisma.riskCategory.findUnique({ where: { id } });
  if (!existing) throw NotFound('Risk category not found');
  // A category that is its own ancestor makes the tree walk non-terminating.
  if (body.parentId === id) throw BadRequest('A category cannot be its own parent');

  const updated = await prisma.riskCategory.update({
    where: { id },
    data: {
      code: body.code ?? null,
      name: body.name,
      description: body.description ?? null,
      color: body.color ?? null,
      parentId: body.parentId ?? null,
      isActive: body.isActive,
    },
  });
  await writeTrail(
    { entityType: 'RiskCategory', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: updated.name },
    userId,
  );
  return serializeCategory(updated);
};

export const deleteCategory = async (id: string, userId?: string) => {
  const existing = await prisma.riskCategory.findUnique({
    where: { id },
    include: { _count: { select: { risks: true, children: true } } },
  });
  if (!existing) throw NotFound('Risk category not found');
  if (existing._count.risks > 0) {
    throw Conflict(`Category "${existing.name}" is used by ${existing._count.risks} risk(s)`);
  }
  if (existing._count.children > 0) {
    throw Conflict(`Category "${existing.name}" has child categories; delete or reparent them first`);
  }
  await prisma.riskCategory.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskCategory', entityId: id, action: 'DELETE', oldValue: existing.name },
    userId,
  );
};
