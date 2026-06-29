/**
 * LIMS 2.0 — L8 Certificate of Analysis. Generated from a sample's reviewed
 * test results (snapshotted at generation), issued with an e-signature and a
 * QR public-verification token, and publicly verifiable by that token.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import type { CoaTemplateUpsertInput, GenerateCoaInput, IssueCoaInput, RevokeCoaInput, ListCoaQuery, ListTemplateQuery } from './coa.schema';

// ── templates ─────────────────────────────────────────────────────────────────
const nextTemplateCode = async () => `COAT-${String((await prisma.coaTemplate.count()) + 1).padStart(3, '0')}`;
const serializeTemplate = (t: Prisma.CoaTemplateGetPayload<object>) => ({
  id: t.id, code: t.code, name: t.name, title: t.title, header_html: t.headerHtml, footer_html: t.footerHtml,
  sections: t.sections.split(',').filter(Boolean), customer_id: t.customerId, is_active: t.isActive, created_at: t.createdAt, updated_at: t.updatedAt,
});

export const listTemplates = async (q: ListTemplateQuery) => {
  const where: Prisma.CoaTemplateWhereInput = { isDeleted: false };
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.coaTemplate.findMany({ where, orderBy: { code: 'asc' } });
  return { data: rows.map(serializeTemplate) };
};
export const createTemplate = async (input: CoaTemplateUpsertInput, userId?: string) => {
  const code = await nextTemplateCode();
  const t = await prisma.coaTemplate.create({ data: { code, name: input.name, title: input.title ?? null, headerHtml: input.header_html ?? null, footerHtml: input.footer_html ?? null, sections: (input.sections ?? ['description', 'results', 'conclusion', 'signatures']).join(','), customerId: input.customer_id ?? null, isActive: input.is_active ?? true, createdById: userId ?? null } });
  await writeTrail({ entityType: 'CoaTemplate', entityId: t.id, action: 'CREATE', newValue: code }, userId);
  return serializeTemplate(t);
};
export const updateTemplate = async (id: string, input: CoaTemplateUpsertInput, userId?: string) => {
  const t = await prisma.coaTemplate.findFirst({ where: { id, isDeleted: false } });
  if (!t) throw NotFound('Template not found');
  const u = await prisma.coaTemplate.update({ where: { id }, data: { name: input.name ?? t.name, title: input.title ?? t.title, headerHtml: input.header_html ?? t.headerHtml, footerHtml: input.footer_html ?? t.footerHtml, sections: input.sections ? input.sections.join(',') : t.sections, customerId: input.customer_id ?? t.customerId, isActive: input.is_active ?? t.isActive } });
  await writeTrail({ entityType: 'CoaTemplate', entityId: id, action: 'UPDATE' }, userId);
  return serializeTemplate(u);
};
export const deleteTemplate = async (id: string, userId?: string) => {
  const t = await prisma.coaTemplate.findFirst({ where: { id, isDeleted: false } });
  if (!t) throw NotFound('Template not found');
  await prisma.coaTemplate.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'CoaTemplate', entityId: id, action: 'DELETE' }, userId);
};

// ── certificates ────────────────────────────────────────────────────────────
const nextCoaNumber = async () => `COA-${new Date().getFullYear()}-${String((await prisma.coa.count()) + 1).padStart(4, '0')}`;

const serializeCoa = (c: Prisma.CoaGetPayload<object>, withResults = false) => ({
  id: c.id, coa_number: c.coaNumber, sample_id: c.sampleId, product_name: c.productName, batch_no: c.batchNo,
  spec_version_id: c.specVersionId, template_id: c.templateId, customer_id: c.customerId, status: c.status,
  verify_token: c.verifyToken, conclusion: c.conclusion, issued_at: c.issuedAt, revoked_at: c.revokedAt,
  created_at: c.createdAt, updated_at: c.updatedAt,
  ...(withResults ? { results: c.resultsJson ? JSON.parse(c.resultsJson) : [] } : {}),
});

/** Snapshot a sample's tests + results into a DRAFT certificate. */
export const generateCoa = async (input: GenerateCoaInput, userId?: string) => {
  const sample = await prisma.sample.findFirst({ where: { id: input.sample_id, isDeleted: false }, include: { sampleTests: { include: { results: true } } } });
  if (!sample) throw NotFound('Sample not found');
  if (!sample.sampleTests.length) throw BadRequest('Sample has no tests to certify');

  const snapshot = sample.sampleTests.map((t) => ({
    test_name: t.testName, status: t.status, review_status: t.reviewStatus, overall_result: t.overallResult,
    results: t.results.map((r) => ({ analyte_name: r.analyteName, value: r.numericValue ?? r.textValue, unit: r.unit, evaluation: r.evaluation, min_value: r.minValue, max_value: r.maxValue })),
  }));
  const coaNumber = await nextCoaNumber();
  const c = await prisma.coa.create({
    data: {
      coaNumber, sampleId: sample.id, productName: sample.productName, batchNo: sample.batchNo,
      specVersionId: sample.specVersionId, templateId: input.template_id ?? null, customerId: input.customer_id ?? null,
      conclusion: input.conclusion ?? null, resultsJson: JSON.stringify(snapshot), status: 'DRAFT', createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Coa', entityId: c.id, action: 'CREATE', newValue: coaNumber }, userId);
  return serializeCoa(c, true);
};

export const listCoas = async (q: ListCoaQuery) => {
  const where: Prisma.CoaWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.sample_id) where.sampleId = q.sample_id;
  if (q.search) where.OR = [{ coaNumber: { contains: q.search, mode: 'insensitive' } }, { productName: { contains: q.search, mode: 'insensitive' } }, { batchNo: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.coa.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  return { data: rows.map((c) => serializeCoa(c)) };
};

export const getCoa = async (id: string) => {
  const c = await prisma.coa.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw NotFound('Certificate not found');
  return serializeCoa(c, true);
};

export const issueCoa = async (id: string, input: IssueCoaInput, userId?: string) => {
  const c = await prisma.coa.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw NotFound('Certificate not found');
  if (c.status !== 'DRAFT') throw BadRequest('Only draft certificates can be issued');
  if (input.credential) await recordSignature({ entity_type: 'Coa', entity_id: id, meaning: 'CoA issued', credential: input.credential }, userId);
  const token = randomUUID().replace(/-/g, '');
  const u = await prisma.coa.update({ where: { id }, data: { status: 'ISSUED', verifyToken: token, issuedById: userId ?? null, issuedAt: new Date() } });
  await writeTrail({ entityType: 'Coa', entityId: id, action: 'SIGN', field: 'status', newValue: 'ISSUED' }, userId);
  return serializeCoa(u, true);
};

export const revokeCoa = async (id: string, input: RevokeCoaInput, userId?: string) => {
  const c = await prisma.coa.findFirst({ where: { id, isDeleted: false } });
  if (!c) throw NotFound('Certificate not found');
  if (c.status !== 'ISSUED') throw BadRequest('Only issued certificates can be revoked');
  if (input.credential) await recordSignature({ entity_type: 'Coa', entity_id: id, meaning: 'CoA revoked', credential: input.credential }, userId);
  const u = await prisma.coa.update({ where: { id }, data: { status: 'REVOKED', revokedById: userId ?? null, revokedAt: new Date() } });
  await writeTrail({ entityType: 'Coa', entityId: id, action: 'TRANSITION', field: 'status', newValue: 'REVOKED', reason: input.reason ?? undefined }, userId);
  return serializeCoa(u, true);
};

/** Public, unauthenticated verification by QR token. */
export const verifyByToken = async (token: string) => {
  const c = await prisma.coa.findFirst({ where: { verifyToken: token, isDeleted: false } });
  if (!c) return { valid: false as const };
  return {
    valid: c.status === 'ISSUED',
    coa_number: c.coaNumber, product_name: c.productName, batch_no: c.batchNo,
    status: c.status, issued_at: c.issuedAt, conclusion: c.conclusion,
  };
};
