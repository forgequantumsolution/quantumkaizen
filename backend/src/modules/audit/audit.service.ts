import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';

const json = (v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue);
import type {
  AuditScheduleUpsertInput,
  IsoUpsertInput,
  ListAuditQuery,
  ListIsoQuery,
  UpdateAuditDateInput,
} from './audit.schema';

// ────────────────────── ISO standards ──────────────────────

export const listIsoStandards = async (q: ListIsoQuery) => {
  const where: Prisma.IsoStandardWhereInput = {};
  if (q.search) where.name = { contains: q.search, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.isoStandard.findMany({
      where,
      include: {
        clauses: {
          include: { subClauses: { orderBy: { position: 'asc' } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    prisma.isoStandard.count({ where }),
  ]);

  return {
    data: items.map(serializeStandard),
    pagination: { total_items: total, page: q.page, page_size: q.page_size },
  };
};

export const createIsoStandard = async (input: IsoUpsertInput) => {
  const exists = await prisma.isoStandard.findUnique({ where: { name: input.name } });
  if (exists) throw Conflict('ISO standard with this name already exists');

  return prisma.isoStandard.create({
    data: {
      name: input.name,
      remarks: input.remarks ?? null,
      isActive: input.is_active ?? true,
      clauses: {
        create: input.clauses.map((c, idx) => ({
          clauseNumber: c.clause_number,
          clauseTitle: c.clause_title,
          position: c.position ?? idx,
          subClauses: {
            create: c.sub_clauses.map((s, sIdx) => ({
              subClauseNumber: s.sub_clause_number,
              subClauseTitle: s.sub_clause_title,
              requirementText: s.requirement_text ?? null,
              position: s.position ?? sIdx,
            })),
          },
        })),
      },
    },
  });
};

export const updateIsoStandard = async (id: string, input: IsoUpsertInput) => {
  const existing = await prisma.isoStandard.findUnique({ where: { id } });
  if (!existing) throw NotFound('ISO standard not found');

  await prisma.$transaction(async (tx) => {
    await tx.isoClause.deleteMany({ where: { standardId: id } });
    await tx.isoStandard.update({
      where: { id },
      data: {
        name: input.name,
        remarks: input.remarks ?? null,
        isActive: input.is_active ?? existing.isActive,
        clauses: {
          create: input.clauses.map((c, idx) => ({
            clauseNumber: c.clause_number,
            clauseTitle: c.clause_title,
            position: c.position ?? idx,
            subClauses: {
              create: c.sub_clauses.map((s, sIdx) => ({
                subClauseNumber: s.sub_clause_number,
                subClauseTitle: s.sub_clause_title,
                requirementText: s.requirement_text ?? null,
                position: s.position ?? sIdx,
              })),
            },
          })),
        },
      },
    });
  });
};

export const deleteIsoStandard = async (id: string) => {
  const std = await prisma.isoStandard.findUnique({ where: { id } });
  if (!std) throw NotFound('ISO standard not found');
  await prisma.isoStandard.delete({ where: { id } });
};

const serializeStandard = (s: {
  id: string;
  name: string;
  remarks: string | null;
  isActive: boolean;
  clauses: Array<{
    id: string;
    clauseNumber: string;
    clauseTitle: string;
    position: number;
    subClauses: Array<{
      id: string;
      subClauseNumber: string;
      subClauseTitle: string;
      requirementText: string | null;
      position: number;
    }>;
  }>;
}) => ({
  id: s.id,
  name: s.name,
  remarks: s.remarks,
  is_active: s.isActive,
  clauses_count: s.clauses.length,
  clauses: s.clauses.map((c) => ({
    id: c.id,
    clause_number: c.clauseNumber,
    clause_title: c.clauseTitle,
    sub_clauses_count: c.subClauses.length,
    sub_clauses: c.subClauses.map((sc) => ({
      id: sc.id,
      sub_clause_number: sc.subClauseNumber,
      sub_clause_title: sc.subClauseTitle,
      requirement_text: sc.requirementText,
    })),
  })),
});

// ────────────────────── Audit schedules ──────────────────────

export const listAuditSchedules = async (q: ListAuditQuery) => {
  const where: Prisma.AuditScheduleWhereInput = {};
  if (q.title) where.title = { contains: q.title, mode: 'insensitive' };
  if (q.financial_year) where.financialYear = q.financial_year;
  // location filter requires JSON containment — best-effort string match
  if (q.location_id) {
    where.locations = { not: Prisma.JsonNull } as unknown as Prisma.JsonNullableFilter;
  }

  const items = await prisma.auditSchedule.findMany({
    where,
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { auditDate: 'asc' },
  });
  return { data: items.map(serializeSchedule) };
};

export const createAuditSchedule = async (
  input: AuditScheduleUpsertInput,
  userId?: string
) => {
  return prisma.auditSchedule.create({
    data: scheduleData(input, userId),
  });
};

export const updateAuditSchedule = async (id: string, input: AuditScheduleUpsertInput) => {
  const exists = await prisma.auditSchedule.findUnique({ where: { id } });
  if (!exists) throw NotFound('Audit schedule not found');
  return prisma.auditSchedule.update({
    where: { id },
    data: scheduleData(input),
  });
};

export const updateAuditDate = async (id: string, input: UpdateAuditDateInput) => {
  const exists = await prisma.auditSchedule.findUnique({ where: { id } });
  if (!exists) throw NotFound('Audit schedule not found');
  return prisma.auditSchedule.update({
    where: { id },
    data: { auditDate: new Date(input.audit_date) },
  });
};

export const deleteAuditSchedule = async (id: string) => {
  const exists = await prisma.auditSchedule.findUnique({ where: { id } });
  if (!exists) throw NotFound('Audit schedule not found');
  await prisma.auditSchedule.delete({ where: { id } });
};

export const auditScheduleFilters = async () => {
  const items = await prisma.auditSchedule.findMany({
    select: { title: true, financialYear: true, locations: true },
  });
  const titles = Array.from(new Set(items.map((i) => i.title)));
  const financial_years = Array.from(
    new Set(items.map((i) => i.financialYear).filter(Boolean) as string[])
  );
  const locationMap = new Map<string, { id: string | number; name: string }>();
  for (const i of items) {
    const arr = (i.locations as Array<{ id: string | number; name: string }> | null) ?? [];
    for (const loc of arr) locationMap.set(String(loc.id), loc);
  }
  return {
    data: {
      titles,
      locations: Array.from(locationMap.values()),
      financial_years,
    },
  };
};

const scheduleData = (input: AuditScheduleUpsertInput, userId?: string) => ({
  title: input.title,
  plant: input.plant ?? null,
  description: input.description ?? null,
  auditDate: new Date(input.audit_date),
  previousAuditDate: input.previous_audit_date ? new Date(input.previous_audit_date) : null,
  financialYear: input.financial_year ?? null,
  auditMethod: input.audit_method ?? null,
  isActive: input.is_active ?? true,
  locations: json(input.locations),
  mainProcesses: json(input.main_processes),
  subProcesses: json(input.sub_processes),
  criteria: json(input.criteria),
  departments: json(input.departments),
  focusAreas: json(input.focus_areas),
  createdById: userId ?? null,
});

const serializeSchedule = (s: {
  id: string;
  title: string;
  plant: string | null;
  description: string | null;
  auditDate: Date;
  previousAuditDate: Date | null;
  financialYear: string | null;
  auditMethod: string | null;
  isActive: boolean;
  locations: unknown;
  mainProcesses: unknown;
  subProcesses: unknown;
  criteria: unknown;
  departments: unknown;
  focusAreas: unknown;
  createdBy: { id: string; name: string } | null;
}) => ({
  schedule_id: s.id,
  title: s.title,
  plant: s.plant,
  description: s.description,
  audit_date: s.auditDate,
  previous_audit_date: s.previousAuditDate,
  financial_year: s.financialYear,
  audit_method: s.auditMethod,
  is_active: s.isActive,
  location: s.locations ?? [],
  main_process: s.mainProcesses ?? [],
  sub_process: s.subProcesses ?? [],
  criteria: s.criteria ?? [],
  department: s.departments ?? [],
  focus_area: s.focusAreas ?? [],
  created_by: s.createdBy ?? {},
});
