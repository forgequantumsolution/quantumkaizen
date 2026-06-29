/**
 * LIMS 2.0 — L1 Specification Versions. Versioned, multi-stage specifications
 * that become the limit authority for result evaluation. A SpecVersion holds
 * per-analyte acceptance lines (min/max/target/text + rounding rules). Editable
 * while DRAFT; approving locks it, stamps the effective date and supersedes any
 * other APPROVED version covering the same product/stage/grade/market scope.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListSpecVersionQuery, SpecVersionUpsertInput } from './spec-version.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.specVersion.count();
  return `SPECV-${String(count + 1).padStart(3, '0')}`;
};

type SpecVersionRow = Prisma.SpecVersionGetPayload<{ include: { lines: true } }>;

const productNames = async (ids: (string | null)[]) => {
  const u = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = u.length
    ? await prisma.product.findMany({ where: { id: { in: u } }, select: { id: true, name: true, code: true } })
    : [];
  return new Map(rows.map((p) => [p.id, p.code ? `${p.code} — ${p.name}` : p.name]));
};

const specificationLabels = async (ids: (string | null)[]) => {
  const u = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = u.length
    ? await prisma.specification.findMany({ where: { id: { in: u } }, select: { id: true, code: true, productName: true } })
    : [];
  return new Map(rows.map((s) => [s.id, `${s.code} — ${s.productName}`]));
};

const serializeLine = (l: SpecVersionRow['lines'][number]) => ({
  id: l.id,
  analyte_id: l.analyteId,
  test_definition_id: l.testDefinitionId,
  name: l.name,
  unit: l.unit,
  min_value: l.minValue,
  max_value: l.maxValue,
  target_value: l.targetValue,
  text_criteria: l.textCriteria,
  decimals: l.decimals,
  sig_figs: l.sigFigs,
  mandatory: l.mandatory,
  sequence: l.sequence,
});

const serialize = (
  s: SpecVersionRow,
  products: Map<string, string>,
  specs: Map<string, string>,
  full = false,
) => ({
  id: s.id,
  code: s.code,
  specification_id: s.specificationId,
  specification_label: s.specificationId ? specs.get(s.specificationId) ?? null : null,
  product_id: s.productId,
  product_name: s.productId ? products.get(s.productId) ?? null : null,
  name: s.name,
  stage: s.stage,
  grade: s.grade,
  market: s.market,
  version: s.version,
  status: s.status,
  pharmacopoeia: s.pharmacopoeia,
  effective_date: s.effectiveDate,
  approved_at: s.approvedAt,
  approved_by_id: s.approvedById,
  line_count: s.lines.length,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
  ...(full
    ? { lines: [...s.lines].sort((a, b) => a.sequence - b.sequence).map(serializeLine) }
    : {}),
});

export const listSpecVersions = async (q: ListSpecVersionQuery) => {
  const where: Prisma.SpecVersionWhereInput = { isDeleted: false };
  if (q.stage) where.stage = q.stage;
  if (q.status) where.status = q.status;
  if (q.product_id) where.productId = q.product_id;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.specVersion.count({ where }),
    prisma.specVersion.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);
  const products = await productNames(rows.map((r) => r.productId));
  const specs = await specificationLabels(rows.map((r) => r.specificationId));
  return {
    data: rows.map((r) => serialize(r, products, specs)),
    total,
    page: q.page,
    page_size: q.page_size,
  };
};

const getRow = async (id: string): Promise<SpecVersionRow> => {
  const s = await prisma.specVersion.findFirst({ where: { id, isDeleted: false }, include: { lines: true } });
  if (!s) throw NotFound('Spec version not found');
  return s;
};

export const getSpecVersion = async (id: string) => {
  const s = await getRow(id);
  const products = await productNames([s.productId]);
  const specs = await specificationLabels([s.specificationId]);
  return serialize(s, products, specs, true);
};

const lineCreateData = (input: SpecVersionUpsertInput) =>
  input.lines.map((l, i) => ({
    analyteId: l.analyte_id ?? null,
    testDefinitionId: l.test_definition_id ?? null,
    name: l.name,
    unit: l.unit ?? null,
    minValue: l.min_value ?? null,
    maxValue: l.max_value ?? null,
    targetValue: l.target_value ?? null,
    textCriteria: l.text_criteria ?? null,
    decimals: l.decimals ?? null,
    sigFigs: l.sig_figs ?? null,
    mandatory: l.mandatory ?? true,
    sequence: l.sequence ?? i,
  }));

export const createSpecVersion = async (input: SpecVersionUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.specVersion.create({
    data: {
      code,
      name: input.name,
      productId: input.product_id ?? null,
      specificationId: input.specification_id ?? null,
      stage: input.stage,
      grade: input.grade ?? null,
      market: input.market ?? null,
      pharmacopoeia: input.pharmacopoeia ?? null,
      status: 'DRAFT',
      version: 1,
      createdById: userId ?? null,
      lines: { create: lineCreateData(input) },
    },
  });
  await writeTrail({ entityType: 'SpecVersion', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getSpecVersion(created.id);
};

export const updateSpecVersion = async (id: string, input: SpecVersionUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  if (existing.status === 'APPROVED') throw BadRequest('Approved spec versions cannot be edited — create a revision instead');
  if (existing.status !== 'DRAFT') throw BadRequest('Only DRAFT spec versions can be edited');
  await prisma.$transaction([
    prisma.specLine.deleteMany({ where: { specVersionId: id } }),
    prisma.specVersion.update({
      where: { id },
      data: {
        name: input.name,
        productId: input.product_id ?? null,
        specificationId: input.specification_id ?? null,
        stage: input.stage,
        grade: input.grade ?? null,
        market: input.market ?? null,
        pharmacopoeia: input.pharmacopoeia ?? null,
        lines: { create: lineCreateData(input) },
      },
    }),
  ]);
  await writeTrail({ entityType: 'SpecVersion', entityId: id, action: 'UPDATE' }, userId);
  return getSpecVersion(id);
};

export const approveSpecVersion = async (id: string, userId?: string) => {
  const s = await getRow(id);
  if (s.status !== 'DRAFT') throw BadRequest('Only DRAFT spec versions can be approved');
  if (s.lines.length === 0) throw BadRequest('Add at least one acceptance line before approving');
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Supersede any other APPROVED version covering the same scope.
    await tx.specVersion.updateMany({
      where: {
        id: { not: id },
        status: 'APPROVED',
        isDeleted: false,
        productId: s.productId,
        stage: s.stage,
        grade: s.grade,
        market: s.market,
      },
      data: { status: 'SUPERSEDED' },
    });
    await tx.specVersion.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId ?? null, approvedAt: now, effectiveDate: now },
    });
  });
  await writeTrail(
    { entityType: 'SpecVersion', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'DRAFT', newValue: 'APPROVED' },
    userId,
  );
  return getSpecVersion(id);
};

export const reviseSpecVersion = async (id: string, userId?: string) => {
  const s = await getRow(id);
  if (s.status !== 'APPROVED') throw BadRequest('Only APPROVED spec versions can be revised');
  const code = await nextCode();
  const created = await prisma.specVersion.create({
    data: {
      code,
      name: s.name,
      productId: s.productId,
      specificationId: s.specificationId,
      stage: s.stage,
      grade: s.grade,
      market: s.market,
      pharmacopoeia: s.pharmacopoeia,
      status: 'DRAFT',
      version: s.version + 1,
      createdById: userId ?? null,
      lines: {
        create: [...s.lines]
          .sort((a, b) => a.sequence - b.sequence)
          .map((l) => ({
            analyteId: l.analyteId,
            testDefinitionId: l.testDefinitionId,
            name: l.name,
            unit: l.unit,
            minValue: l.minValue,
            maxValue: l.maxValue,
            targetValue: l.targetValue,
            textCriteria: l.textCriteria,
            decimals: l.decimals,
            sigFigs: l.sigFigs,
            mandatory: l.mandatory,
            sequence: l.sequence,
          })),
      },
    },
  });
  await writeTrail(
    { entityType: 'SpecVersion', entityId: created.id, action: 'CREATE', field: 'version', oldValue: String(s.version), newValue: String(s.version + 1) },
    userId,
  );
  return getSpecVersion(created.id);
};

export const removeSpecVersion = async (id: string, userId?: string) => {
  const s = await getRow(id);
  if (s.status === 'APPROVED') throw BadRequest('Approved spec versions cannot be deleted');
  await prisma.specVersion.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'SpecVersion', entityId: id, action: 'DELETE' }, userId);
};
