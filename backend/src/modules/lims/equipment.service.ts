/**
 * LIMS — Equipment & Calibration. Instruments registered against a Lab with a
 * calibration schedule; recording a calibration advances the next-due date. An
 * instrument past its calibration due date is surfaced as overdue ("not for use").
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  EquipmentUpsertInput,
  ListEquipmentQuery,
  RecordCalibrationInput,
} from './equipment.schema';

const nextCode = async (): Promise<string> => {
  const count = await prisma.equipment.count();
  return `EQP-${String(count + 1).padStart(3, '0')}`;
};

const labNames = async (labIds: (string | null)[]) => {
  const ids = [...new Set(labIds.filter((x): x is string => !!x))];
  const labs = ids.length ? await prisma.lab.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  return new Map(labs.map((l) => [l.id, l.name]));
};

type EqRow = Prisma.EquipmentGetPayload<{ include: { calibrations: true } }>;

const serializeCal = (c: EqRow['calibrations'][number]) => ({
  id: c.id,
  calibrated_at: c.calibratedAt,
  result: c.result,
  certificate_no: c.certificateNo,
  next_due_at: c.nextDueAt,
  performed_by: c.performedBy,
  remarks: c.remarks,
  created_at: c.createdAt,
});

const serialize = (e: EqRow, names: Map<string, string>, full = false) => ({
  id: e.id,
  code: e.code,
  name: e.name,
  category: e.category,
  lab_id: e.labId,
  lab_name: e.labId ? names.get(e.labId) ?? null : null,
  serial_no: e.serialNo,
  manufacturer: e.manufacturer,
  model: e.model,
  location: e.location,
  status: e.status,
  calibration_frequency_days: e.calibrationFrequencyDays,
  last_calibrated_at: e.lastCalibratedAt,
  calibration_due_at: e.calibrationDueAt,
  calibration_overdue: !!e.calibrationDueAt && e.calibrationDueAt.getTime() < Date.now(),
  created_at: e.createdAt,
  updated_at: e.updatedAt,
  ...(full
    ? { calibrations: [...e.calibrations].sort((a, b) => +b.calibratedAt - +a.calibratedAt).map(serializeCal) }
    : {}),
});

export const listEquipment = async (q: ListEquipmentQuery) => {
  const where: Prisma.EquipmentWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.lab_id) where.labId = q.lab_id;
  if (q.calibration_due) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    where.calibrationDueAt = { lte: horizon };
  }
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
      { serialNo: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({ where, include: { calibrations: true }, orderBy: { code: 'asc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  const names = await labNames(rows.map((r) => r.labId));
  return { data: rows.map((r) => serialize(r, names)), total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string): Promise<EqRow> => {
  const e = await prisma.equipment.findFirst({ where: { id, isDeleted: false }, include: { calibrations: true } });
  if (!e) throw NotFound('Equipment not found');
  return e;
};

export const getEquipment = async (id: string) => {
  const e = await getRow(id);
  const names = await labNames([e.labId]);
  return serialize(e, names, true);
};

export const createEquipment = async (input: EquipmentUpsertInput, userId?: string) => {
  const code = await nextCode();
  const created = await prisma.equipment.create({
    data: {
      code,
      name: input.name,
      category: input.category ?? null,
      labId: input.lab_id ?? null,
      serialNo: input.serial_no ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      location: input.location ?? null,
      status: input.status ?? 'ACTIVE',
      calibrationFrequencyDays: input.calibration_frequency_days ?? null,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'Equipment', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getEquipment(created.id);
};

export const updateEquipment = async (id: string, input: EquipmentUpsertInput, userId?: string) => {
  const existing = await getRow(id);
  await prisma.equipment.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category ?? null,
      labId: input.lab_id ?? null,
      serialNo: input.serial_no ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      location: input.location ?? null,
      status: input.status ?? existing.status,
      calibrationFrequencyDays: input.calibration_frequency_days ?? existing.calibrationFrequencyDays,
    },
  });
  await writeTrail({ entityType: 'Equipment', entityId: id, action: 'UPDATE' }, userId);
  return getEquipment(id);
};

export const deleteEquipment = async (id: string, userId?: string) => {
  await getRow(id);
  await prisma.equipment.update({ where: { id }, data: { isDeleted: true, status: 'RETIRED' } });
  await writeTrail({ entityType: 'Equipment', entityId: id, action: 'DELETE' }, userId);
};

export const recordCalibration = async (id: string, input: RecordCalibrationInput, userId?: string) => {
  const e = await getRow(id);
  const calibratedAt = new Date(input.calibrated_at);
  if (Number.isNaN(calibratedAt.getTime())) throw BadRequest('Invalid calibration date');

  // Next due = explicit date, else calibratedAt + frequency.
  let nextDue: Date | null = input.next_due_at ? new Date(input.next_due_at) : null;
  if (!nextDue && e.calibrationFrequencyDays) {
    nextDue = new Date(calibratedAt);
    nextDue.setDate(nextDue.getDate() + e.calibrationFrequencyDays);
  }

  await prisma.$transaction([
    prisma.calibrationRecord.create({
      data: {
        equipmentId: id,
        calibratedAt,
        result: input.result,
        certificateNo: input.certificate_no ?? null,
        nextDueAt: nextDue,
        performedBy: input.performed_by ?? null,
        remarks: input.remarks ?? null,
        createdById: userId ?? null,
      },
    }),
    prisma.equipment.update({
      where: { id },
      data: {
        lastCalibratedAt: calibratedAt,
        calibrationDueAt: nextDue,
        // A failed calibration takes the instrument out of service.
        ...(input.result === 'FAIL' ? { status: 'OUT_OF_SERVICE' as const } : {}),
      },
    }),
  ]);
  await writeTrail({ entityType: 'Equipment', entityId: id, action: 'UPDATE', field: 'calibration', newValue: input.result }, userId);
  return getEquipment(id);
};
