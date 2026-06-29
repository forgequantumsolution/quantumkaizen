/**
 * LIMS 2.0 — L7 Stability (ICH Q1A). A study defines storage conditions and a
 * timepoint schedule; activating it generates the full pull schedule
 * (condition × timepoint). A due pull is pulled into a real Sample for testing.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import { registerSample } from '../sample/sample.service';
import type { StudyUpsertInput, ListStudyQuery, ConditionInput } from './stability.schema';

const nextCode = async () => `STB-${new Date().getFullYear()}-${String((await prisma.stabilityStudy.count()) + 1).padStart(4, '0')}`;

const serializeStudy = (s: Prisma.StabilityStudyGetPayload<{ include: { conditions: true; pulls: true } }>) => ({
  id: s.id, code: s.code, product_id: s.productId, product_name: s.productName, batch_no: s.batchNo, title: s.title,
  spec_version_id: s.specVersionId, packaging: s.packaging, status: s.status, start_date: s.startDate,
  timepoints_months: s.timepointsMonths, created_at: s.createdAt, updated_at: s.updatedAt,
  conditions: s.conditions.map((c) => ({ id: c.id, name: c.name, temp_zone: c.tempZone, storage_location_id: c.storageLocationId, orientation: c.orientation })),
  pulls: [...s.pulls].sort((a, b) => +a.scheduledDate - +b.scheduledDate).map((p) => ({
    id: p.id, condition_id: p.conditionId, condition_name: p.conditionName, timepoint_label: p.timepointLabel,
    timepoint_months: p.timepointMonths, scheduled_date: p.scheduledDate, status: p.status, sample_id: p.sampleId,
    pulled_at: p.pulledAt, tested_at: p.testedAt,
  })),
});

const fullStudy = async (id: string) => {
  const s = await prisma.stabilityStudy.findFirst({ where: { id, isDeleted: false }, include: { conditions: true, pulls: true } });
  if (!s) throw NotFound('Stability study not found');
  return s;
};

export const getStudy = async (id: string) => serializeStudy(await fullStudy(id));

export const listStudies = async (q: ListStudyQuery) => {
  const where: Prisma.StabilityStudyWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.search) where.OR = [{ code: { contains: q.search, mode: 'insensitive' } }, { title: { contains: q.search, mode: 'insensitive' } }, { productName: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.stabilityStudy.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { pulls: true } } } });
  return { data: rows.map((s) => ({ id: s.id, code: s.code, title: s.title, product_name: s.productName, batch_no: s.batchNo, status: s.status, start_date: s.startDate, timepoints_months: s.timepointsMonths, pull_count: s._count.pulls, created_at: s.createdAt })) };
};

export const createStudy = async (input: StudyUpsertInput, userId?: string) => {
  const code = await nextCode();
  const s = await prisma.stabilityStudy.create({
    data: {
      code, productId: input.product_id ?? null, productName: input.product_name, batchNo: input.batch_no ?? null,
      title: input.title, specVersionId: input.spec_version_id ?? null, packaging: input.packaging ?? null,
      timepointsMonths: input.timepoints_months ?? '0,3,6,9,12,18,24', createdById: userId ?? null,
      conditions: { create: (input.conditions ?? []).map((c) => ({ name: c.name, tempZone: c.temp_zone ?? null, storageLocationId: c.storage_location_id ?? null, orientation: c.orientation ?? null })) },
    },
  });
  await writeTrail({ entityType: 'StabilityStudy', entityId: s.id, action: 'CREATE', newValue: code }, userId);
  return getStudy(s.id);
};

export const updateStudy = async (id: string, input: StudyUpsertInput, userId?: string) => {
  const s = await fullStudy(id);
  if (s.status !== 'DRAFT') throw BadRequest('Only draft studies can be edited');
  await prisma.stabilityStudy.update({ where: { id }, data: { productName: input.product_name ?? s.productName, productId: input.product_id ?? s.productId, batchNo: input.batch_no ?? s.batchNo, title: input.title ?? s.title, specVersionId: input.spec_version_id ?? s.specVersionId, packaging: input.packaging ?? s.packaging, timepointsMonths: input.timepoints_months ?? s.timepointsMonths } });
  if (input.conditions) {
    await prisma.stabilityCondition.deleteMany({ where: { studyId: id } });
    await prisma.stabilityCondition.createMany({ data: input.conditions.map((c) => ({ studyId: id, name: c.name, tempZone: c.temp_zone ?? null, storageLocationId: c.storage_location_id ?? null, orientation: c.orientation ?? null })) });
  }
  await writeTrail({ entityType: 'StabilityStudy', entityId: id, action: 'UPDATE' }, userId);
  return getStudy(id);
};

export const addCondition = async (id: string, input: ConditionInput, userId?: string) => {
  const s = await fullStudy(id);
  await prisma.stabilityCondition.create({ data: { studyId: s.id, name: input.name, tempZone: input.temp_zone ?? null, storageLocationId: input.storage_location_id ?? null, orientation: input.orientation ?? null } });
  await writeTrail({ entityType: 'StabilityStudy', entityId: id, action: 'UPDATE', field: 'condition', newValue: input.name }, userId);
  return getStudy(id);
};

/** Activate → generate the full pull schedule (each condition × each timepoint). */
export const activateStudy = async (id: string, startDateIso: string | undefined, userId?: string) => {
  const s = await fullStudy(id);
  if (s.status !== 'DRAFT') throw BadRequest('Study is not in draft');
  if (!s.conditions.length) throw BadRequest('Add at least one storage condition first');
  const start = startDateIso ? new Date(startDateIso) : new Date();
  const months = s.timepointsMonths.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
  if (!months.length) throw BadRequest('No valid timepoints');

  const pulls: Prisma.StabilityPullCreateManyInput[] = [];
  for (const c of s.conditions) {
    for (const mo of months) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + mo);
      pulls.push({ studyId: id, conditionId: c.id, conditionName: c.name, timepointLabel: `${mo}M`, timepointMonths: mo, scheduledDate: d, status: 'SCHEDULED' });
    }
  }
  await prisma.$transaction([
    prisma.stabilityPull.deleteMany({ where: { studyId: id } }),
    prisma.stabilityPull.createMany({ data: pulls }),
    prisma.stabilityStudy.update({ where: { id }, data: { status: 'ACTIVE', startDate: start } }),
  ]);
  await writeTrail({ entityType: 'StabilityStudy', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'DRAFT', newValue: 'ACTIVE', reason: `Generated ${pulls.length} pulls` }, userId);
  return getStudy(id);
};

/** Pull a timepoint → register a stability Sample and link it. */
export const pullTimepoint = async (pullId: string, userId?: string) => {
  const pull = await prisma.stabilityPull.findUnique({ where: { id: pullId } });
  if (!pull) throw NotFound('Pull not found');
  if (pull.status === 'PULLED' || pull.status === 'TESTED') throw BadRequest('Already pulled');
  const study = await prisma.stabilityStudy.findUnique({ where: { id: pull.studyId } });
  const sample = await registerSample({
    product_name: study?.productName ?? 'Stability sample', batch_no: study?.batchNo ?? null, sample_type: 'Stability',
    specification_id: null, remarks: `${study?.code} · ${pull.conditionName} · ${pull.timepointLabel}`,
  } as never, userId);
  await prisma.stabilityPull.update({ where: { id: pullId }, data: { status: 'PULLED', sampleId: sample.id, pulledAt: new Date() } });
  await writeTrail({ entityType: 'StabilityStudy', entityId: pull.studyId, action: 'UPDATE', field: 'pull', newValue: `${pull.timepointLabel} pulled → ${sample.sample_number}` }, userId);
  return { pull_id: pullId, sample_id: sample.id, sample_number: sample.sample_number };
};

export const completeStudy = async (id: string, userId?: string) => {
  await fullStudy(id);
  await prisma.stabilityStudy.update({ where: { id }, data: { status: 'COMPLETED' } });
  await writeTrail({ entityType: 'StabilityStudy', entityId: id, action: 'TRANSITION', field: 'status', newValue: 'COMPLETED' }, userId);
  return getStudy(id);
};

/** Cron sweep — flag SCHEDULED pulls whose date has arrived as DUE. */
export const flagDuePulls = async () => {
  const res = await prisma.stabilityPull.updateMany({ where: { status: 'SCHEDULED', scheduledDate: { lte: new Date() } }, data: { status: 'DUE' } });
  return res.count;
};
