/**
 * LIMS — Sample lifecycle (W3). Samples are registered with a barcode and an
 * unbroken, append-only chain of custody; aliquots are drawn into storage. The
 * status moves REGISTERED → IN_TESTING → IN_REVIEW → RELEASED / REJECTED.
 */
import { Prisma, type CustodyAction, type SampleStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  AddAliquotInput,
  AddCustodyInput,
  ListSampleQuery,
  ListStorageQuery,
  RegisterSampleInput,
  StorageUpsertInput,
  TransitionSampleInput,
  UpdateSampleInput,
} from './sample.schema';

// ─── Storage locations ──────────────────────────────────────────────────────

const nextStorageCode = async () => `STO-${String((await prisma.storageLocation.count()) + 1).padStart(3, '0')}`;

const serializeStorage = (s: Prisma.StorageLocationGetPayload<object>) => ({
  id: s.id, code: s.code, name: s.name, type: s.type, temp_zone: s.tempZone,
  location: s.location, is_active: s.isActive, created_at: s.createdAt, updated_at: s.updatedAt,
});

export const listStorage = async (q: ListStorageQuery) => {
  const where: Prisma.StorageLocationWhereInput = { isDeleted: false };
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.search) where.OR = [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }];
  const rows = await prisma.storageLocation.findMany({ where, orderBy: { code: 'asc' } });
  return { data: rows.map(serializeStorage) };
};
export const createStorage = async (input: StorageUpsertInput, userId?: string) => {
  const code = await nextStorageCode();
  const r = await prisma.storageLocation.create({ data: { code, name: input.name, type: input.type ?? null, tempZone: input.temp_zone ?? null, location: input.location ?? null, isActive: input.is_active ?? true, createdById: userId ?? null } });
  await writeTrail({ entityType: 'StorageLocation', entityId: r.id, action: 'CREATE', newValue: code }, userId);
  return serializeStorage(r);
};
export const updateStorage = async (id: string, input: StorageUpsertInput, userId?: string) => {
  const e = await prisma.storageLocation.findFirst({ where: { id, isDeleted: false } });
  if (!e) throw NotFound('Storage location not found');
  const r = await prisma.storageLocation.update({ where: { id }, data: { name: input.name, type: input.type ?? null, tempZone: input.temp_zone ?? null, location: input.location ?? null, isActive: input.is_active ?? e.isActive } });
  await writeTrail({ entityType: 'StorageLocation', entityId: id, action: 'UPDATE' }, userId);
  return serializeStorage(r);
};
export const deleteStorage = async (id: string, userId?: string) => {
  const e = await prisma.storageLocation.findFirst({ where: { id, isDeleted: false } });
  if (!e) throw NotFound('Storage location not found');
  await prisma.storageLocation.update({ where: { id }, data: { isDeleted: true, isActive: false } });
  await writeTrail({ entityType: 'StorageLocation', entityId: id, action: 'DELETE' }, userId);
};

// ─── Samples ────────────────────────────────────────────────────────────────

const nextSampleNumber = async (year: number) => {
  const count = await prisma.sample.count({ where: { sampleNumber: { startsWith: `SMP-${year}-` } } });
  return `SMP-${year}-${String(count + 1).padStart(4, '0')}`;
};

type SampleRow = Prisma.SampleGetPayload<{ include: { custodyEvents: true; aliquots: true } }>;

const storageNames = async (ids: (string | null)[]) => {
  const u = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = u.length ? await prisma.storageLocation.findMany({ where: { id: { in: u } }, select: { id: true, name: true, code: true } }) : [];
  return new Map(rows.map((r) => [r.id, `${r.code} — ${r.name}`]));
};

const serializeSample = async (s: SampleRow, full = false) => {
  const base = {
    id: s.id, sample_number: s.sampleNumber, barcode: s.barcode, product_name: s.productName, product_id: s.productId,
    batch_no: s.batchNo, sample_type: s.sampleType, source_site: s.sourceSite, specification_id: s.specificationId,
    quantity: s.quantity, unit: s.unit, collected_at: s.collectedAt, received_at: s.receivedAt,
    status: s.status, lab_id: s.labId, current_location_id: s.currentLocationId, priority: s.priority,
    remarks: s.remarks, aliquot_count: s.aliquots.length, created_at: s.createdAt, updated_at: s.updatedAt,
  };
  if (!full) return base;
  const names = await storageNames([s.currentLocationId, ...s.aliquots.map((a) => a.storageLocationId), ...s.custodyEvents.flatMap((c) => [c.fromLocationId, c.toLocationId])]);
  const [spec, lab] = await Promise.all([
    s.specificationId ? prisma.specification.findUnique({ where: { id: s.specificationId }, select: { code: true, productName: true } }) : null,
    s.labId ? prisma.lab.findUnique({ where: { id: s.labId }, select: { name: true } }) : null,
  ]);
  return {
    ...base,
    current_location_name: s.currentLocationId ? names.get(s.currentLocationId) ?? null : null,
    specification_label: spec ? `${spec.code} — ${spec.productName}` : null,
    lab_name: lab?.name ?? null,
    custody_events: [...s.custodyEvents].sort((a, b) => +b.occurredAt - +a.occurredAt).map((c) => ({
      id: c.id, action: c.action, from_location_name: c.fromLocationId ? names.get(c.fromLocationId) ?? null : null,
      to_location_name: c.toLocationId ? names.get(c.toLocationId) ?? null : null, handler_name: c.handlerName,
      occurred_at: c.occurredAt, remarks: c.remarks,
    })),
    aliquots: [...s.aliquots].sort((a, b) => +a.createdAt - +b.createdAt).map((a) => ({
      id: a.id, code: a.code, storage_location_name: a.storageLocationId ? names.get(a.storageLocationId) ?? null : null,
      temp_zone: a.tempZone, quantity: a.quantity, unit: a.unit, expiry_at: a.expiryAt, status: a.status, created_at: a.createdAt,
    })),
  };
};

export const listSamples = async (q: ListSampleQuery) => {
  const where: Prisma.SampleWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.lab_id) where.labId = q.lab_id;
  if (q.search) where.OR = [
    { sampleNumber: { contains: q.search, mode: 'insensitive' } },
    { barcode: { contains: q.search, mode: 'insensitive' } },
    { productName: { contains: q.search, mode: 'insensitive' } },
    { batchNo: { contains: q.search, mode: 'insensitive' } },
  ];
  const [total, rows] = await Promise.all([
    prisma.sample.count({ where }),
    prisma.sample.findMany({ where, include: { custodyEvents: true, aliquots: true }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.page_size, take: q.page_size }),
  ]);
  const data = await Promise.all(rows.map((r) => serializeSample(r)));
  return { data, total, page: q.page, page_size: q.page_size };
};

const getRow = async (id: string): Promise<SampleRow> => {
  const s = await prisma.sample.findFirst({ where: { id, isDeleted: false }, include: { custodyEvents: true, aliquots: true } });
  if (!s) throw NotFound('Sample not found');
  return s;
};

export const getSample = async (id: string) => serializeSample(await getRow(id), true);

export const registerSample = async (input: RegisterSampleInput, userId?: string) => {
  const year = new Date().getFullYear();
  const sampleNumber = await nextSampleNumber(year);
  // When linked to a Product master, denormalise its name so lists/labels stay
  // consistent even if the free-text field was left blank or stale.
  const product = input.product_id
    ? await prisma.product.findFirst({ where: { id: input.product_id, isDeleted: false }, select: { name: true } })
    : null;
  if (input.product_id && !product) throw BadRequest('Linked product not found');
  const created = await prisma.sample.create({
    data: {
      sampleNumber,
      barcode: sampleNumber,
      productName: product?.name ?? input.product_name,
      productId: input.product_id ?? null,
      batchNo: input.batch_no ?? null,
      sampleType: input.sample_type ?? null,
      sourceSite: input.source_site ?? null,
      specificationId: input.specification_id ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      collectedAt: input.collected_at ? new Date(input.collected_at) : null,
      receivedAt: input.received_at ? new Date(input.received_at) : null,
      labId: input.lab_id ?? null,
      currentLocationId: input.current_location_id ?? null,
      priority: input.priority ?? null,
      remarks: input.remarks ?? null,
      createdById: userId ?? null,
      custodyEvents: {
        create: {
          action: 'REGISTERED',
          toLocationId: input.current_location_id ?? null,
          handledById: userId ?? null,
          remarks: 'Sample registered',
        },
      },
    },
  });
  await writeTrail({ entityType: 'Sample', entityId: created.id, action: 'CREATE', newValue: sampleNumber }, userId);
  return getSample(created.id);
};

export const updateSample = async (id: string, input: UpdateSampleInput, userId?: string) => {
  const e = await getRow(id);
  if (e.status === 'RELEASED' || e.status === 'REJECTED') throw BadRequest('Released/rejected samples cannot be edited');
  const product = input.product_id
    ? await prisma.product.findFirst({ where: { id: input.product_id, isDeleted: false }, select: { name: true } })
    : null;
  if (input.product_id && !product) throw BadRequest('Linked product not found');
  await prisma.sample.update({
    where: { id },
    data: {
      productName: product?.name ?? input.product_name ?? e.productName,
      productId: input.product_id !== undefined ? input.product_id : e.productId,
      batchNo: input.batch_no ?? e.batchNo,
      sampleType: input.sample_type ?? e.sampleType,
      sourceSite: input.source_site ?? e.sourceSite,
      specificationId: input.specification_id ?? e.specificationId,
      quantity: input.quantity ?? e.quantity,
      unit: input.unit ?? e.unit,
      collectedAt: input.collected_at ? new Date(input.collected_at) : e.collectedAt,
      receivedAt: input.received_at ? new Date(input.received_at) : e.receivedAt,
      labId: input.lab_id ?? e.labId,
      priority: input.priority ?? e.priority,
      remarks: input.remarks ?? e.remarks,
    },
  });
  await writeTrail({ entityType: 'Sample', entityId: id, action: 'UPDATE' }, userId);
  return getSample(id);
};

const ALLOWED: Record<SampleStatus, SampleStatus[]> = {
  REGISTERED: ['IN_TESTING', 'CANCELLED'],
  IN_TESTING: ['IN_REVIEW', 'REJECTED', 'CANCELLED'],
  IN_REVIEW: ['RELEASED', 'REJECTED', 'IN_TESTING'],
  RELEASED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const transitionSample = async (id: string, input: TransitionSampleInput, userId?: string) => {
  const e = await getRow(id);
  if (!ALLOWED[e.status].includes(input.status)) throw BadRequest(`Cannot move from ${e.status} to ${input.status}`);
  await prisma.sample.update({ where: { id }, data: { status: input.status } });
  await writeTrail({ entityType: 'Sample', entityId: id, action: 'TRANSITION', field: 'status', oldValue: e.status, newValue: input.status, reason: input.remarks ?? undefined }, userId);
  return getSample(id);
};

export const addCustody = async (id: string, input: AddCustodyInput, userId?: string) => {
  const e = await getRow(id);
  await prisma.custodyEvent.create({
    data: {
      sampleId: id,
      action: input.action as CustodyAction,
      fromLocationId: input.from_location_id ?? null,
      toLocationId: input.to_location_id ?? null,
      handlerName: input.handler_name ?? null,
      handledById: userId ?? null,
      occurredAt: input.occurred_at ? new Date(input.occurred_at) : new Date(),
      remarks: input.remarks ?? null,
    },
  });
  // A move with a destination updates the sample's current location.
  if ((input.action === 'TRANSFERRED' || input.action === 'STORED' || input.action === 'RETURNED') && input.to_location_id) {
    await prisma.sample.update({ where: { id }, data: { currentLocationId: input.to_location_id } });
  }
  await writeTrail({ entityType: 'Sample', entityId: id, action: 'UPDATE', field: 'custody', newValue: input.action }, userId);
  return getSample(e.id);
};

export const addAliquot = async (id: string, input: AddAliquotInput, userId?: string) => {
  const e = await getRow(id);
  const code = input.code?.trim() || `${e.sampleNumber}-A${String(e.aliquots.length + 1).padStart(2, '0')}`;
  await prisma.$transaction([
    prisma.aliquot.create({
      data: {
        sampleId: id, code,
        storageLocationId: input.storage_location_id ?? null,
        tempZone: input.temp_zone ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        expiryAt: input.expiry_at ? new Date(input.expiry_at) : null,
        createdById: userId ?? null,
      },
    }),
    prisma.custodyEvent.create({
      data: { sampleId: id, action: 'ALIQUOTED', toLocationId: input.storage_location_id ?? null, handledById: userId ?? null, remarks: `Aliquot ${code} created` },
    }),
  ]);
  await writeTrail({ entityType: 'Sample', entityId: id, action: 'UPDATE', field: 'aliquot', newValue: code }, userId);
  return getSample(id);
};

export const deleteSample = async (id: string, userId?: string) => {
  const e = await getRow(id);
  if (e.status !== 'REGISTERED') throw BadRequest('Only REGISTERED samples can be deleted');
  await prisma.sample.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'Sample', entityId: id, action: 'DELETE' }, userId);
};
