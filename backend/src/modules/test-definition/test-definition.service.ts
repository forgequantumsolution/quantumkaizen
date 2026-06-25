/**
 * LIMS — Test Definitions & Test Panels (LIMS 2.0 / L1). A test definition is a
 * reusable analytical test with an ordered set of analytes (measured results).
 * Editable while DRAFT; approving locks it. Test panels group test definitions
 * into reusable bundles for assignment in the testing flow.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  ListTestDefinitionQuery,
  TestDefinitionUpsertInput,
  ListTestPanelQuery,
  TestPanelUpsertInput,
} from './test-definition.schema';

// ── Test Definitions ────────────────────────────────────────────────────────

const nextDefCode = async (): Promise<string> => {
  const count = await prisma.testDefinition.count();
  return `TEST-${String(count + 1).padStart(3, '0')}`;
};

type DefRow = Prisma.TestDefinitionGetPayload<{ include: { analytes: true } }>;

const methodNames = async (ids: (string | null)[]) => {
  const u = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = u.length ? await prisma.testMethod.findMany({ where: { id: { in: u } }, select: { id: true, name: true, code: true } }) : [];
  return new Map(rows.map((m) => [m.id, `${m.code} — ${m.name}`]));
};

const serializeDef = (d: DefRow, methods: Map<string, string>, full = false) => ({
  id: d.id,
  code: d.code,
  name: d.name,
  technique: d.technique,
  method_id: d.methodId,
  method_name: d.methodId ? methods.get(d.methodId) ?? null : null,
  version: d.version,
  status: d.status,
  description: d.description,
  analyte_count: d.analytes.length,
  is_active: d.isActive,
  created_at: d.createdAt,
  updated_at: d.updatedAt,
  ...(full
    ? {
        analytes: [...d.analytes]
          .sort((a, b) => a.sequence - b.sequence)
          .map((a) => ({
            id: a.id,
            analyte_id: a.analyteId,
            name: a.name,
            unit: a.unit,
            data_type: a.dataType,
            decimals: a.decimals,
            calculation: a.calculation,
            sequence: a.sequence,
          })),
      }
    : {}),
});

export const listTestDefinitions = async (q: ListTestDefinitionQuery) => {
  const where: Prisma.TestDefinitionWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { technique: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.testDefinition.count({ where }),
    prisma.testDefinition.findMany({ where, include: { analytes: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map((r) => serializeDef(r, new Map())), total, page: q.page, page_size: q.page_size };
};

const getDefRow = async (id: string): Promise<DefRow> => {
  const d = await prisma.testDefinition.findFirst({ where: { id, isDeleted: false }, include: { analytes: true } });
  if (!d) throw NotFound('Test definition not found');
  return d;
};

export const getTestDefinition = async (id: string) => {
  const d = await getDefRow(id);
  const methods = await methodNames([d.methodId]);
  return serializeDef(d, methods, true);
};

const analyteCreateData = (input: TestDefinitionUpsertInput) =>
  input.analytes.map((a, i) => ({
    analyteId: a.analyte_id ?? null,
    name: a.name,
    unit: a.unit ?? null,
    dataType: a.data_type,
    decimals: a.decimals ?? null,
    calculation: a.calculation ?? null,
    sequence: a.sequence ?? i,
  }));

export const createTestDefinition = async (input: TestDefinitionUpsertInput, userId?: string) => {
  const code = await nextDefCode();
  const created = await prisma.testDefinition.create({
    data: {
      code,
      name: input.name,
      technique: input.technique ?? null,
      methodId: input.method_id ?? null,
      description: input.description ?? null,
      status: 'DRAFT',
      createdById: userId ?? null,
      analytes: { create: analyteCreateData(input) },
    },
  });
  await writeTrail({ entityType: 'TestDefinition', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getTestDefinition(created.id);
};

export const updateTestDefinition = async (id: string, input: TestDefinitionUpsertInput, userId?: string) => {
  const existing = await getDefRow(id);
  if (existing.status !== 'DRAFT') throw BadRequest('Only DRAFT test definitions can be edited');
  await prisma.$transaction([
    prisma.testAnalyte.deleteMany({ where: { testDefinitionId: id } }),
    prisma.testDefinition.update({
      where: { id },
      data: {
        name: input.name,
        technique: input.technique ?? null,
        methodId: input.method_id ?? null,
        description: input.description ?? null,
        analytes: { create: analyteCreateData(input) },
      },
    }),
  ]);
  await writeTrail({ entityType: 'TestDefinition', entityId: id, action: 'UPDATE' }, userId);
  return getTestDefinition(id);
};

export const approveTestDefinition = async (id: string, userId?: string) => {
  const d = await getDefRow(id);
  if (d.status === 'APPROVED') throw BadRequest('Test definition is already approved');
  if (d.status !== 'DRAFT') throw BadRequest('Only DRAFT test definitions can be approved');
  if (d.analytes.length === 0) throw BadRequest('Add at least one analyte before approving');
  await prisma.testDefinition.update({ where: { id }, data: { status: 'APPROVED' } });
  await writeTrail({ entityType: 'TestDefinition', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'DRAFT', newValue: 'APPROVED' }, userId);
  return getTestDefinition(id);
};

export const deleteTestDefinition = async (id: string, userId?: string) => {
  const d = await getDefRow(id);
  if (d.status === 'APPROVED') throw BadRequest('Approved test definitions cannot be deleted');
  await prisma.testDefinition.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'TestDefinition', entityId: id, action: 'DELETE' }, userId);
};

// ── Test Panels ─────────────────────────────────────────────────────────────

const nextPanelCode = async (): Promise<string> => {
  const count = await prisma.testPanel.count();
  return `PNL-${String(count + 1).padStart(3, '0')}`;
};

type PanelRow = Prisma.TestPanelGetPayload<{ include: { items: true } }>;

const serializePanel = async (p: PanelRow, full = false) => {
  const base = {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    item_count: p.items.length,
    is_active: p.isActive,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
  if (!full) return base;
  const ids = [...new Set(p.items.map((i) => i.testDefinitionId))];
  const defs = ids.length
    ? await prisma.testDefinition.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } })
    : [];
  const defMap = new Map(defs.map((d) => [d.id, d]));
  return {
    ...base,
    items: [...p.items]
      .sort((a, b) => a.sequence - b.sequence)
      .map((i) => {
        const def = defMap.get(i.testDefinitionId);
        return {
          id: i.id,
          test_definition_id: i.testDefinitionId,
          test_definition_code: def?.code ?? null,
          test_definition_name: def?.name ?? null,
          sequence: i.sequence,
        };
      }),
  };
};

export const listTestPanels = async (q: ListTestPanelQuery) => {
  const where: Prisma.TestPanelWhereInput = { isDeleted: false };
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.testPanel.count({ where }),
    prisma.testPanel.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  const data = await Promise.all(rows.map((r) => serializePanel(r)));
  return { data, total, page: q.page, page_size: q.page_size };
};

const getPanelRow = async (id: string): Promise<PanelRow> => {
  const p = await prisma.testPanel.findFirst({ where: { id, isDeleted: false }, include: { items: true } });
  if (!p) throw NotFound('Test panel not found');
  return p;
};

export const getTestPanel = async (id: string) => serializePanel(await getPanelRow(id), true);

const panelItemCreateData = (input: TestPanelUpsertInput) =>
  input.items.map((i, idx) => ({
    testDefinitionId: i.test_definition_id,
    sequence: i.sequence ?? idx,
  }));

export const createTestPanel = async (input: TestPanelUpsertInput, userId?: string) => {
  const code = await nextPanelCode();
  const created = await prisma.testPanel.create({
    data: {
      code,
      name: input.name,
      description: input.description ?? null,
      createdById: userId ?? null,
      items: { create: panelItemCreateData(input) },
    },
  });
  await writeTrail({ entityType: 'TestPanel', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getTestPanel(created.id);
};

export const updateTestPanel = async (id: string, input: TestPanelUpsertInput, userId?: string) => {
  await getPanelRow(id);
  await prisma.$transaction([
    prisma.testPanelItem.deleteMany({ where: { panelId: id } }),
    prisma.testPanel.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        items: { create: panelItemCreateData(input) },
      },
    }),
  ]);
  await writeTrail({ entityType: 'TestPanel', entityId: id, action: 'UPDATE' }, userId);
  return getTestPanel(id);
};

export const deleteTestPanel = async (id: string, userId?: string) => {
  await getPanelRow(id);
  await prisma.testPanel.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'TestPanel', entityId: id, action: 'DELETE' }, userId);
};
