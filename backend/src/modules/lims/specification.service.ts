/**
 * LIMS — Specification Library. A specification holds per-parameter acceptance
 * limits (min/max/target/text) bound to test methods. Editable while DRAFT;
 * approving locks it and stamps the effective date. Parameters drive the
 * OOS/OOT evaluation in the testing flow (W4).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { ListSpecQuery, SpecUpsertInput } from './specification.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.specification.count();
  return `SPEC-${String(count + 1).padStart(3, '0')}`;
};

type SpecRow = Prisma.SpecificationGetPayload<{ include: { parameters: true } }>;

const methodNames = async (ids: (string | null)[]) => {
  const u = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = u.length ? await prisma.testMethod.findMany({ where: { id: { in: u } }, select: { id: true, name: true, code: true } }) : [];
  return new Map(rows.map((m) => [m.id, `${m.code} — ${m.name}`]));
};

const serialize = (s: SpecRow, methods: Map<string, string>, full = false) => ({
  id: s.id,
  code: s.code,
  product_name: s.productName,
  version: s.version,
  status: s.status,
  pharmacopoeia: s.pharmacopoeia,
  description: s.description,
  effective_date: s.effectiveDate,
  approved_at: s.approvedAt,
  parameter_count: s.parameters.length,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
  ...(full
    ? {
        parameters: [...s.parameters]
          .sort((a, b) => a.position - b.position)
          .map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            min_value: p.minValue,
            max_value: p.maxValue,
            target_value: p.targetValue,
            text_criteria: p.textCriteria,
            method_id: p.methodId,
            method_name: p.methodId ? methods.get(p.methodId) ?? null : null,
            pharmacopoeia_ref: p.pharmacopoeiaRef,
            position: p.position,
          })),
      }
    : {}),
});

export const listSpecs = async (q: ListSpecQuery) => {
  const where: Prisma.SpecificationWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.search) {
    where.OR = [
      { productName: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.specification.count({ where }),
    prisma.specification.findMany({ where, include: { parameters: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  return { data: rows.map((r) => serialize(r, new Map())), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string): Promise<SpecRow> => {
  const s = await prisma.specification.findFirst({ where: { id, isDeleted: false }, include: { parameters: true } });
  if (!s) throw NotFound('Specification not found');
  return s;
};

export const getSpec = async (id: string) => {
  const s = await getRow(id);
  const methods = await methodNames(s.parameters.map((p) => p.methodId));
  return serialize(s, methods, true);
};

const paramCreateData = (input: SpecUpsertInput) =>
  input.parameters.map((p, i) => ({
    name: p.name,
    unit: p.unit ?? null,
    minValue: p.min_value ?? null,
    maxValue: p.max_value ?? null,
    targetValue: p.target_value ?? null,
    textCriteria: p.text_criteria ?? null,
    methodId: p.method_id ?? null,
    pharmacopoeiaRef: p.pharmacopoeia_ref ?? null,
    position: p.position ?? i,
  }));

export const createSpec = async (input: SpecUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.specification.create({
    data: {
      code,
      productName: input.product_name,
      pharmacopoeia: input.pharmacopoeia ?? null,
      description: input.description ?? null,
      isoStandardId: input.iso_standard_id ?? null,
      status: 'DRAFT',
      createdById: userId ?? null,
      parameters: { create: paramCreateData(input) },
    },
  });
  await writeTrail({ entityType: 'Specification', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getSpec(created.id);
};

export const updateSpec = async (id: string, input: SpecUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  if (existing.status !== 'DRAFT') throw BadRequest('Only DRAFT specifications can be edited');
  await prisma.$transaction([
    prisma.specParameter.deleteMany({ where: { specificationId: id } }),
    prisma.specification.update({
      where: { id },
      data: {
        productName: input.product_name,
        pharmacopoeia: input.pharmacopoeia ?? null,
        description: input.description ?? null,
        isoStandardId: input.iso_standard_id ?? null,
        parameters: { create: paramCreateData(input) },
      },
    }),
  ]);
  await writeTrail({ entityType: 'Specification', entityId: id, action: 'UPDATE' }, userId);
  return getSpec(id);
};

export const approveSpec = async (id: string, userId?: string) => {
  const s = await getRow(id);
  if (s.status !== 'DRAFT') throw BadRequest('Only DRAFT specifications can be approved');
  if (s.parameters.length === 0) throw BadRequest('Add at least one parameter before approving');
  await prisma.specification.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: userId ?? null, approvedAt: new Date(), effectiveDate: new Date() },
  });
  await writeTrail({ entityType: 'Specification', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'DRAFT', newValue: 'APPROVED' }, userId);
  return getSpec(id);
};

export const retireSpec = async (id: string, userId?: string) => {
  const s = await getRow(id);
  await prisma.specification.update({ where: { id }, data: { status: 'RETIRED' } });
  await writeTrail({ entityType: 'Specification', entityId: id, action: 'TRANSITION', field: 'status', oldValue: s.status, newValue: 'RETIRED' }, userId);
  return getSpec(id);
};

export const deleteSpec = async (id: string, userId?: string) => {
  const s = await getRow(id);
  if (s.status !== 'DRAFT') throw BadRequest('Only DRAFT specifications can be deleted');
  await prisma.specification.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'Specification', entityId: id, action: 'DELETE' }, userId);
};
