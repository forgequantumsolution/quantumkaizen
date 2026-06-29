/**
 * LIMS 2.0 — L6 Quality Control (Levey-Jennings + Westgard multirule).
 * Each QC material carries an established mean + SD; every plotted result is
 * z-scored and run through the Westgard rules to ACCEPT / WARN / REJECT.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type { QcMaterialUpsertInput, ListQcMaterialQuery, RecordQcResultInput } from './qc.schema';

// ── Westgard multirule ────────────────────────────────────────────────────────
const sign = (z: number) => (z > 0 ? 1 : z < 0 ? -1 : 0);

/** Evaluate the newest point (last in the chronological z series). */
export const westgard = (zs: number[]): { status: 'ACCEPT' | 'WARN' | 'REJECT'; rules: string[] } => {
  const rules: string[] = [];
  const n = zs.length;
  if (!n) return { status: 'ACCEPT', rules };
  const i = n - 1;
  const z = zs[i];
  let reject = false;
  let warn = false;

  if (Math.abs(z) > 3) { rules.push('1-3s'); reject = true; }
  if (Math.abs(z) > 2) warn = true; // 1-2s warning
  if (n >= 2 && Math.abs(zs[i]) > 2 && Math.abs(zs[i - 1]) > 2 && sign(zs[i]) === sign(zs[i - 1])) { rules.push('2-2s'); reject = true; }
  if (n >= 2 && ((zs[i] > 2 && zs[i - 1] < -2) || (zs[i] < -2 && zs[i - 1] > 2))) { rules.push('R-4s'); reject = true; }
  if (n >= 4) {
    const last4 = zs.slice(-4);
    if (last4.every((v) => Math.abs(v) > 1 && sign(v) === sign(last4[0]) && sign(v) !== 0)) { rules.push('4-1s'); reject = true; }
  }
  if (n >= 10) {
    const last10 = zs.slice(-10);
    if (last10.every((v) => sign(v) === sign(last10[0]) && sign(v) !== 0)) { rules.push('10x'); reject = true; }
  }
  if (warn) rules.unshift('1-2s');
  return { status: reject ? 'REJECT' : warn ? 'WARN' : 'ACCEPT', rules };
};

// ── materials ─────────────────────────────────────────────────────────────────
const nextCode = async () => `QC-${String((await prisma.qcMaterial.count()) + 1).padStart(3, '0')}`;
const serializeMaterial = (m: Prisma.QcMaterialGetPayload<object>, results = 0) => ({
  id: m.id, code: m.code, name: m.name, analyte_name: m.analyteName, method_id: m.methodId, lot_no: m.lotNo,
  unit: m.unit, target_mean: m.targetMean, target_sd: m.targetSd, is_active: m.isActive, result_count: results,
  created_at: m.createdAt, updated_at: m.updatedAt,
});

export const listMaterials = async (q: ListQcMaterialQuery) => {
  const where: Prisma.QcMaterialWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }, { analyteName: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.qcMaterial.findMany({ where, orderBy: { code: 'asc' }, include: { _count: { select: { results: true } } } });
  return { data: rows.map((m) => serializeMaterial(m, m._count.results)) };
};

export const createMaterial = async (input: QcMaterialUpsertInput, userId?: string) => {
  const code = await nextCode();
  const m = await prisma.qcMaterial.create({ data: { code, name: input.name, analyteName: input.analyte_name ?? null, methodId: input.method_id ?? null, lotNo: input.lot_no ?? null, unit: input.unit ?? null, targetMean: input.target_mean ?? null, targetSd: input.target_sd ?? null, isActive: input.is_active ?? true, createdById: userId ?? null } });
  await writeTrail({ entityType: 'QcMaterial', entityId: m.id, action: 'CREATE', newValue: code }, userId);
  return serializeMaterial(m);
};

export const updateMaterial = async (id: string, input: QcMaterialUpsertInput, userId?: string) => {
  const m = await prisma.qcMaterial.findFirst({ where: { id, isDeleted: false } });
  if (!m) throw NotFound('QC material not found');
  const u = await prisma.qcMaterial.update({ where: { id }, data: { name: input.name ?? m.name, analyteName: input.analyte_name ?? m.analyteName, methodId: input.method_id ?? m.methodId, lotNo: input.lot_no ?? m.lotNo, unit: input.unit ?? m.unit, targetMean: input.target_mean ?? m.targetMean, targetSd: input.target_sd ?? m.targetSd, isActive: input.is_active ?? m.isActive } });
  await writeTrail({ entityType: 'QcMaterial', entityId: id, action: 'UPDATE' }, userId);
  return serializeMaterial(u);
};

export const deleteMaterial = async (id: string, userId?: string) => {
  const m = await prisma.qcMaterial.findFirst({ where: { id, isDeleted: false } });
  if (!m) throw NotFound('QC material not found');
  await prisma.qcMaterial.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'QcMaterial', entityId: id, action: 'DELETE' }, userId);
};

// ── results + Levey-Jennings chart ────────────────────────────────────────────
const serializeResult = (r: Prisma.QcResultGetPayload<object>) => ({
  id: r.id, value: r.value, z_score: r.zScore, status: r.status, violated_rules: r.violatedRules ? r.violatedRules.split(',') : [],
  analyst_name: r.analystName, instrument_id: r.instrumentId, measured_at: r.measuredAt, remarks: r.remarks, created_at: r.createdAt,
});

export const recordResult = async (materialId: string, input: RecordQcResultInput, userId?: string) => {
  const m = await prisma.qcMaterial.findFirst({ where: { id: materialId, isDeleted: false } });
  if (!m) throw NotFound('QC material not found');
  if (m.targetMean == null || m.targetSd == null || m.targetSd <= 0) throw BadRequest('Set the material target mean and SD before recording results');

  const z = (input.value - m.targetMean) / m.targetSd;
  // Build the chronological z series of the prior 11 results + this one.
  const prior = await prisma.qcResult.findMany({ where: { qcMaterialId: materialId }, orderBy: { measuredAt: 'desc' }, take: 11 });
  const series = [...prior.reverse().map((r) => r.zScore ?? (r.value - m.targetMean!) / m.targetSd!), z];
  const { status, rules } = westgard(series);

  const created = await prisma.qcResult.create({
    data: {
      qcMaterialId: materialId, value: input.value, zScore: z, status, violatedRules: rules.length ? rules.join(',') : null,
      analystName: input.analyst_name ?? null, instrumentId: input.instrument_id ?? null,
      measuredAt: input.measured_at ? new Date(input.measured_at) : new Date(), remarks: input.remarks ?? null, createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'QcResult', entityId: created.id, action: 'CREATE', field: 'status', newValue: `${status}${rules.length ? ' (' + rules.join(',') + ')' : ''}` }, userId);
  return serializeResult(created);
};

export const getChart = async (materialId: string, limit = 60) => {
  const m = await prisma.qcMaterial.findFirst({ where: { id: materialId, isDeleted: false } });
  if (!m) throw NotFound('QC material not found');
  const rows = await prisma.qcResult.findMany({ where: { qcMaterialId: materialId }, orderBy: { measuredAt: 'desc' }, take: limit });
  const points = rows.reverse().map(serializeResult);
  const mean = m.targetMean ?? 0;
  const sd = m.targetSd ?? 0;
  return {
    material: serializeMaterial(m, rows.length),
    control_lines: { mean, plus1: mean + sd, plus2: mean + 2 * sd, plus3: mean + 3 * sd, minus1: mean - sd, minus2: mean - 2 * sd, minus3: mean - 3 * sd },
    points,
    summary: { total: points.length, reject: points.filter((p) => p.status === 'REJECT').length, warn: points.filter((p) => p.status === 'WARN').length },
  };
};
