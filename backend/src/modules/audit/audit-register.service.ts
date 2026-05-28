import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound, Conflict } from '../../lib/httpError';
import type {
  AuditMasterUpsertInput,
  AuditRegisterUpsertInput,
  CompleteAuditProgramInput,
  FindingUpsertInput,
  ListAuditMasterQuery,
  ListAuditProgramQuery,
  ListAuditRegisterQuery,
  ListFindingQuery,
  ListNcQuery,
  PromoteFindingToNcInput,
  RaiseCapaInput,
  RejectAuditRegisterInput,
  StartAuditProgramInput,
  UpdateNcStatusInput,
} from './audit.schema';

const jsonOrNull = (
  v: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

// Generate next sequence number for register/program/finding/NC.
// Simple count-based scheme; fine for current scale, swap for a sequence table later.
const nextSeq = async (prefix: string, year: number, count: number) =>
  `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;

// ────────────────────── Audit Master ──────────────────────

export const listAuditMasters = async (q: ListAuditMasterQuery) => {
  const where: Prisma.AuditMasterWhereInput = {};
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  if (q.audit_type) where.auditType = q.audit_type;
  if (q.is_active !== undefined) where.isActive = q.is_active;

  const [items, total] = await Promise.all([
    prisma.auditMaster.findMany({
      where,
      include: {
        defaultIsoStandard: { select: { id: true, name: true } },
        defaultChecklistForm: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    prisma.auditMaster.count({ where }),
  ]);
  return {
    data: items.map(serializeMaster),
    pagination: { total_items: total, page: q.page, page_size: q.page_size },
  };
};

export const createAuditMaster = async (input: AuditMasterUpsertInput, userId?: string) => {
  const exists = await prisma.auditMaster.findUnique({ where: { code: input.code } });
  if (exists) throw Conflict('Audit master with this code already exists');
  const created = await prisma.auditMaster.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      auditType: input.audit_type,
      frequency: input.frequency,
      defaultIsoStandardId: input.default_iso_standard_id ?? null,
      defaultChecklistFormId: input.default_checklist_form_id ?? null,
      scoringRules: jsonOrNull(input.scoring_rules),
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
    include: {
      defaultIsoStandard: { select: { id: true, name: true } },
      defaultChecklistForm: { select: { id: true, title: true } },
    },
  });
  return serializeMaster(created);
};

export const updateAuditMaster = async (id: string, input: AuditMasterUpsertInput) => {
  const existing = await prisma.auditMaster.findUnique({ where: { id } });
  if (!existing) throw NotFound('Audit master not found');
  const updated = await prisma.auditMaster.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      auditType: input.audit_type,
      frequency: input.frequency,
      defaultIsoStandardId: input.default_iso_standard_id ?? null,
      defaultChecklistFormId: input.default_checklist_form_id ?? null,
      scoringRules: jsonOrNull(input.scoring_rules),
      isActive: input.is_active ?? existing.isActive,
    },
    include: {
      defaultIsoStandard: { select: { id: true, name: true } },
      defaultChecklistForm: { select: { id: true, title: true } },
    },
  });
  return serializeMaster(updated);
};

export const deleteAuditMaster = async (id: string) => {
  const m = await prisma.auditMaster.findUnique({ where: { id } });
  if (!m) throw NotFound('Audit master not found');
  await prisma.auditMaster.delete({ where: { id } });
};

// ────────────────────── Audit Register ──────────────────────

export const listAuditRegisters = async (q: ListAuditRegisterQuery) => {
  const where: Prisma.AuditRegisterWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.audit_type) where.auditType = q.audit_type;
  if (q.financial_year) where.financialYear = q.financial_year;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { registerNumber: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.auditRegister.findMany({
      where,
      include: {
        auditMaster: { select: { id: true, code: true, name: true } },
        isoStandard: { select: { id: true, name: true } },
        checklistForm: { select: { id: true, title: true } },
        auditor: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        program: { select: { id: true, programNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
    prisma.auditRegister.count({ where }),
  ]);
  return {
    data: items.map(serializeRegister),
    pagination: { total_items: total, page: q.page, page_size: q.page_size },
  };
};

export const getAuditRegister = async (id: string) => {
  const r = await prisma.auditRegister.findUnique({
    where: { id },
    include: {
      auditMaster: { select: { id: true, code: true, name: true } },
      isoStandard: { select: { id: true, name: true } },
      checklistForm: { select: { id: true, title: true, kind: true } },
      auditor: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      program: { select: { id: true, programNumber: true, status: true } },
    },
  });
  if (!r) throw NotFound('Audit register not found');
  return serializeRegister(r);
};

export const createAuditRegister = async (input: AuditRegisterUpsertInput, userId?: string) => {
  const year = new Date(input.planned_date).getFullYear();
  const count = await prisma.auditRegister.count({
    where: { registerNumber: { startsWith: `AR-${year}-` } },
  });
  const registerNumber = await nextSeq('AR', year, count);

  const created = await prisma.auditRegister.create({
    data: {
      registerNumber,
      title: input.title,
      status: 'DRAFT',
      auditMasterId: input.audit_master_id ?? null,
      auditType: input.audit_type,
      plant: input.plant ?? null,
      description: input.description ?? null,
      plannedDate: new Date(input.planned_date),
      previousAuditDate: input.previous_audit_date ? new Date(input.previous_audit_date) : null,
      financialYear: input.financial_year ?? null,
      auditMethod: input.audit_method ?? null,
      isoStandardId: input.iso_standard_id ?? null,
      locations: jsonOrNull(input.locations),
      mainProcesses: jsonOrNull(input.main_processes),
      subProcesses: jsonOrNull(input.sub_processes),
      criteria: jsonOrNull(input.criteria),
      departments: jsonOrNull(input.departments),
      focusAreas: jsonOrNull(input.focus_areas),
      checklistFormId: input.checklist_form_id ?? null,
      auditorId: input.auditor_id ?? null,
      approverId: input.approver_id ?? null,
      createdById: userId ?? null,
    },
  });
  return getAuditRegister(created.id);
};

export const updateAuditRegister = async (id: string, input: AuditRegisterUpsertInput) => {
  const existing = await prisma.auditRegister.findUnique({ where: { id } });
  if (!existing) throw NotFound('Audit register not found');
  if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
    throw BadRequest('Only DRAFT or REJECTED registers can be edited');
  }
  await prisma.auditRegister.update({
    where: { id },
    data: {
      title: input.title,
      auditMasterId: input.audit_master_id ?? null,
      auditType: input.audit_type,
      plant: input.plant ?? null,
      description: input.description ?? null,
      plannedDate: new Date(input.planned_date),
      previousAuditDate: input.previous_audit_date ? new Date(input.previous_audit_date) : null,
      financialYear: input.financial_year ?? null,
      auditMethod: input.audit_method ?? null,
      isoStandardId: input.iso_standard_id ?? null,
      locations: jsonOrNull(input.locations),
      mainProcesses: jsonOrNull(input.main_processes),
      subProcesses: jsonOrNull(input.sub_processes),
      criteria: jsonOrNull(input.criteria),
      departments: jsonOrNull(input.departments),
      focusAreas: jsonOrNull(input.focus_areas),
      checklistFormId: input.checklist_form_id ?? null,
      auditorId: input.auditor_id ?? null,
      approverId: input.approver_id ?? null,
    },
  });
  return getAuditRegister(id);
};

export const submitAuditRegister = async (id: string) => {
  const r = await prisma.auditRegister.findUnique({ where: { id } });
  if (!r) throw NotFound('Audit register not found');
  if (r.status !== 'DRAFT' && r.status !== 'REJECTED') {
    throw BadRequest('Only DRAFT or REJECTED registers can be submitted');
  }
  if (!r.approverId) throw BadRequest('An approver must be set before submitting');
  await prisma.auditRegister.update({
    where: { id },
    data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), rejectionReason: null },
  });
  return getAuditRegister(id);
};

export const approveAuditRegister = async (id: string, userId: string) => {
  const r = await prisma.auditRegister.findUnique({ where: { id } });
  if (!r) throw NotFound('Audit register not found');
  if (r.status !== 'PENDING_APPROVAL') throw BadRequest('Register is not awaiting approval');

  const year = (r.plannedDate ?? new Date()).getFullYear();
  const programCount = await prisma.auditProgram.count({
    where: { programNumber: { startsWith: `AP-${year}-` } },
  });
  const programNumber = await nextSeq('AP', year, programCount);

  await prisma.$transaction(async (tx) => {
    await tx.auditRegister.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: userId,
        rejectionReason: null,
      },
    });
    await tx.auditProgram.create({
      data: {
        programNumber,
        registerId: id,
        status: 'PLANNED',
      },
    });
  });
  return getAuditRegister(id);
};

export const rejectAuditRegister = async (
  id: string,
  input: RejectAuditRegisterInput,
  userId: string
) => {
  const r = await prisma.auditRegister.findUnique({ where: { id } });
  if (!r) throw NotFound('Audit register not found');
  if (r.status !== 'PENDING_APPROVAL') throw BadRequest('Register is not awaiting approval');
  await prisma.auditRegister.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: input.reason,
      approvedById: userId,
      approvedAt: new Date(),
    },
  });
  return getAuditRegister(id);
};

export const deleteAuditRegister = async (id: string) => {
  const r = await prisma.auditRegister.findUnique({ where: { id } });
  if (!r) throw NotFound('Audit register not found');
  if (r.status !== 'DRAFT' && r.status !== 'CANCELLED' && r.status !== 'REJECTED') {
    throw BadRequest('Only DRAFT, REJECTED or CANCELLED registers can be deleted');
  }
  await prisma.auditRegister.delete({ where: { id } });
};

// ────────────────────── Audit Program ──────────────────────

export const listAuditPrograms = async (q: ListAuditProgramQuery) => {
  const where: Prisma.AuditProgramWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.financial_year) where.register = { financialYear: q.financial_year };
  if (q.search) {
    where.OR = [
      { programNumber: { contains: q.search, mode: 'insensitive' } },
      { register: { title: { contains: q.search, mode: 'insensitive' } } },
    ];
  }
  const items = await prisma.auditProgram.findMany({
    where,
    include: {
      register: {
        include: {
          auditor: { select: { id: true, name: true } },
          checklistForm: { select: { id: true, title: true } },
        },
      },
      _count: { select: { findings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return { data: items.map(serializeProgram) };
};

export const getAuditProgram = async (id: string) => {
  const p = await prisma.auditProgram.findUnique({
    where: { id },
    include: {
      register: {
        include: {
          auditor: { select: { id: true, name: true } },
          checklistForm: { select: { id: true, title: true, kind: true } },
          isoStandard: { select: { id: true, name: true } },
        },
      },
      checklistSubmission: { select: { id: true, status: true, submittedAt: true } },
      findings: {
        include: {
          isoSubClause: { select: { id: true, subClauseNumber: true, subClauseTitle: true } },
          nonConformance: { select: { id: true, ncNumber: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!p) throw NotFound('Audit program not found');
  return serializeProgram(p);
};

export const startAuditProgram = async (id: string, _input: StartAuditProgramInput) => {
  const p = await prisma.auditProgram.findUnique({ where: { id } });
  if (!p) throw NotFound('Audit program not found');
  if (p.status !== 'PLANNED') throw BadRequest('Program is not in PLANNED status');
  await prisma.$transaction([
    prisma.auditProgram.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    }),
    prisma.auditRegister.update({
      where: { id: p.registerId },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);
  return getAuditProgram(id);
};

export const completeAuditProgram = async (id: string, input: CompleteAuditProgramInput) => {
  const p = await prisma.auditProgram.findUnique({ where: { id } });
  if (!p) throw NotFound('Audit program not found');
  if (p.status !== 'IN_PROGRESS') throw BadRequest('Program is not IN_PROGRESS');
  await prisma.$transaction([
    prisma.auditProgram.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        summary: input.summary ?? null,
        score: input.score ?? null,
        checklistSubmissionId: input.checklist_submission_id ?? null,
      },
    }),
    prisma.auditRegister.update({
      where: { id: p.registerId },
      data: { status: 'COMPLETED' },
    }),
  ]);
  return getAuditProgram(id);
};

// ────────────────────── Audit Finding ──────────────────────

export const listFindings = async (q: ListFindingQuery) => {
  const where: Prisma.AuditFindingWhereInput = {};
  if (q.program_id) where.programId = q.program_id;
  if (q.status) where.status = q.status;
  if (q.severity) where.severity = q.severity;
  const items = await prisma.auditFinding.findMany({
    where,
    include: {
      program: { select: { id: true, programNumber: true } },
      isoSubClause: { select: { id: true, subClauseNumber: true, subClauseTitle: true } },
      nonConformance: { select: { id: true, ncNumber: true, status: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return { data: items.map(serializeFinding) };
};

export const createFinding = async (input: FindingUpsertInput, userId?: string) => {
  const program = await prisma.auditProgram.findUnique({ where: { id: input.program_id } });
  if (!program) throw NotFound('Audit program not found');
  if (program.status === 'COMPLETED' || program.status === 'CANCELLED') {
    throw BadRequest('Cannot add findings to a completed/cancelled program');
  }
  const year = new Date().getFullYear();
  const count = await prisma.auditFinding.count({
    where: { findingNumber: { startsWith: `AF-${year}-` } },
  });
  const findingNumber = await nextSeq('AF', year, count);
  const created = await prisma.auditFinding.create({
    data: {
      findingNumber,
      programId: input.program_id,
      severity: input.severity,
      status: input.status ?? 'OPEN',
      clauseRef: input.clause_ref ?? null,
      isoSubClauseId: input.iso_sub_clause_id ?? null,
      description: input.description,
      evidence: jsonOrNull(input.evidence),
      recommendation: input.recommendation ?? null,
      createdById: userId ?? null,
    },
    include: {
      isoSubClause: { select: { id: true, subClauseNumber: true, subClauseTitle: true } },
    },
  });
  return serializeFinding({ ...created, program: null, nonConformance: null, createdBy: null });
};

export const updateFinding = async (id: string, input: FindingUpsertInput) => {
  const f = await prisma.auditFinding.findUnique({ where: { id } });
  if (!f) throw NotFound('Finding not found');
  await prisma.auditFinding.update({
    where: { id },
    data: {
      severity: input.severity,
      status: input.status ?? f.status,
      clauseRef: input.clause_ref ?? null,
      isoSubClauseId: input.iso_sub_clause_id ?? null,
      description: input.description,
      evidence: jsonOrNull(input.evidence),
      recommendation: input.recommendation ?? null,
    },
  });
  return listFindings({ program_id: f.programId } as ListFindingQuery);
};

export const deleteFinding = async (id: string) => {
  const f = await prisma.auditFinding.findUnique({ where: { id } });
  if (!f) throw NotFound('Finding not found');
  await prisma.auditFinding.delete({ where: { id } });
};

// ────────────────────── Non-Conformance ──────────────────────

export const promoteFindingToNc = async (
  findingId: string,
  input: PromoteFindingToNcInput,
  userId?: string
) => {
  const f = await prisma.auditFinding.findUnique({
    where: { id: findingId },
    include: { nonConformance: true },
  });
  if (!f) throw NotFound('Finding not found');
  if (f.nonConformance) throw Conflict('Finding has already been promoted to a non-conformance');
  if (f.severity === 'OBSERVATION') {
    throw BadRequest('Observations cannot be promoted to non-conformance');
  }
  const year = new Date().getFullYear();
  const count = await prisma.nonConformance.count({
    where: { ncNumber: { startsWith: `NC-${year}-` } },
  });
  const ncNumber = await nextSeq('NC', year, count);
  const nc = await prisma.nonConformance.create({
    data: {
      ncNumber,
      findingId,
      severity: f.severity,
      track: input.track ?? null,
      departmentId: input.department_id ?? null,
      dueDate: input.due_date ? new Date(input.due_date) : null,
      createdById: userId ?? null,
    },
    include: {
      finding: { select: { id: true, findingNumber: true, description: true, severity: true } },
      department: { select: { id: true, name: true, code: true } },
      capaTicket: { select: { id: true, uniqueId: true, title: true } },
    },
  });
  return serializeNc(nc);
};

export const listNcs = async (q: ListNcQuery) => {
  const where: Prisma.NonConformanceWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.track) where.track = q.track;
  if (q.department_id) where.departmentId = q.department_id;
  if (q.severity) where.severity = q.severity;
  const items = await prisma.nonConformance.findMany({
    where,
    include: {
      finding: {
        select: {
          id: true,
          findingNumber: true,
          description: true,
          severity: true,
          program: {
            select: {
              id: true,
              programNumber: true,
              register: { select: { id: true, title: true, registerNumber: true } },
            },
          },
        },
      },
      department: { select: { id: true, name: true, code: true } },
      capaTicket: { select: { id: true, uniqueId: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return { data: items.map(serializeNc) };
};

export const raiseCapa = async (ncId: string, input: RaiseCapaInput) => {
  const nc = await prisma.nonConformance.findUnique({ where: { id: ncId } });
  if (!nc) throw NotFound('Non-conformance not found');
  const ticket = await prisma.ticket.findUnique({ where: { id: input.capa_ticket_id } });
  if (!ticket) throw NotFound('CAPA ticket not found');
  if (nc.capaTicketId) throw Conflict('CAPA ticket already linked');
  await prisma.nonConformance.update({
    where: { id: ncId },
    data: { capaTicketId: input.capa_ticket_id, status: 'CAPA_RAISED' },
  });
  return prisma.nonConformance.findUnique({
    where: { id: ncId },
    include: {
      finding: { select: { id: true, findingNumber: true } },
      department: { select: { id: true, name: true } },
      capaTicket: { select: { id: true, uniqueId: true, title: true } },
    },
  });
};

export const updateNcStatus = async (id: string, input: UpdateNcStatusInput) => {
  const nc = await prisma.nonConformance.findUnique({ where: { id } });
  if (!nc) throw NotFound('Non-conformance not found');
  await prisma.nonConformance.update({
    where: { id },
    data: {
      status: input.status,
      closedAt:
        input.status === 'CLOSED'
          ? input.closed_at
            ? new Date(input.closed_at)
            : new Date()
          : null,
    },
  });
  return prisma.nonConformance.findUnique({
    where: { id },
    include: {
      finding: { select: { id: true, findingNumber: true } },
      department: { select: { id: true, name: true } },
      capaTicket: { select: { id: true, uniqueId: true, title: true } },
    },
  });
};

// ────────────────────── Serializers ──────────────────────

type MasterRow = Prisma.AuditMasterGetPayload<{
  include: {
    defaultIsoStandard: { select: { id: true; name: true } };
    defaultChecklistForm: { select: { id: true; title: true } };
  };
}>;

const serializeMaster = (m: MasterRow) => ({
  id: m.id,
  code: m.code,
  name: m.name,
  description: m.description,
  audit_type: m.auditType,
  frequency: m.frequency,
  default_iso_standard: m.defaultIsoStandard,
  default_checklist_form: m.defaultChecklistForm,
  scoring_rules: m.scoringRules,
  is_active: m.isActive,
  created_at: m.createdAt,
  updated_at: m.updatedAt,
});

type RegisterRow = Prisma.AuditRegisterGetPayload<{
  include: {
    auditMaster: { select: { id: true; code: true; name: true } };
    isoStandard: { select: { id: true; name: true } };
    checklistForm: { select: { id: true; title: true; kind: true } };
    auditor: { select: { id: true; name: true } };
    approver: { select: { id: true; name: true } };
    approvedBy: { select: { id: true; name: true } };
    createdBy: { select: { id: true; name: true } };
    program: { select: { id: true; programNumber: true; status: true } };
  };
}>;

const serializeRegister = (
  r: RegisterRow | (Omit<RegisterRow, 'checklistForm'> & { checklistForm: { id: string; title: string } | null })
) => ({
  id: r.id,
  register_number: r.registerNumber,
  title: r.title,
  status: r.status,
  audit_master: r.auditMaster,
  audit_type: r.auditType,
  plant: r.plant,
  description: r.description,
  planned_date: r.plannedDate,
  previous_audit_date: r.previousAuditDate,
  financial_year: r.financialYear,
  audit_method: r.auditMethod,
  iso_standard: r.isoStandard,
  locations: r.locations ?? [],
  main_processes: r.mainProcesses ?? [],
  sub_processes: r.subProcesses ?? [],
  criteria: r.criteria ?? [],
  departments: r.departments ?? [],
  focus_areas: r.focusAreas ?? [],
  checklist_form: r.checklistForm,
  auditor: r.auditor,
  approver: r.approver,
  submitted_at: r.submittedAt,
  approved_at: r.approvedAt,
  approved_by: r.approvedBy,
  rejection_reason: r.rejectionReason,
  program: r.program,
  created_by: r.createdBy,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

const serializeProgram = (p: {
  id: string;
  programNumber: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  summary: string | null;
  score: number | null;
  checklistSubmissionId?: string | null;
  checklistSubmission?: { id: string; status: string; submittedAt: Date | null } | null;
  register: {
    id: string;
    title: string;
    registerNumber: string;
    plannedDate: Date;
    financialYear: string | null;
    auditType: string;
    plant?: string | null;
    auditor?: { id: string; name: string } | null;
    checklistForm?: { id: string; title: string; kind?: string } | null;
    isoStandard?: { id: string; name: string } | null;
  };
  findings?: Array<{
    id: string;
    findingNumber: string;
    severity: string;
    status: string;
    description: string;
    clauseRef: string | null;
    isoSubClause?: { id: string; subClauseNumber: string; subClauseTitle: string } | null;
    nonConformance?: { id: string; ncNumber: string; status: string } | null;
    createdAt: Date;
  }>;
  _count?: { findings: number };
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: p.id,
  program_number: p.programNumber,
  status: p.status,
  started_at: p.startedAt,
  completed_at: p.completedAt,
  summary: p.summary,
  score: p.score,
  checklist_submission_id: p.checklistSubmissionId ?? null,
  checklist_submission: p.checklistSubmission ?? null,
  register: {
    id: p.register.id,
    register_number: p.register.registerNumber,
    title: p.register.title,
    planned_date: p.register.plannedDate,
    financial_year: p.register.financialYear,
    audit_type: p.register.auditType,
    plant: p.register.plant ?? null,
    auditor: p.register.auditor ?? null,
    checklist_form: p.register.checklistForm ?? null,
    iso_standard: p.register.isoStandard ?? null,
  },
  findings: p.findings?.map((f) => ({
    id: f.id,
    finding_number: f.findingNumber,
    severity: f.severity,
    status: f.status,
    description: f.description,
    clause_ref: f.clauseRef,
    iso_sub_clause: f.isoSubClause ?? null,
    non_conformance: f.nonConformance ?? null,
    created_at: f.createdAt,
  })),
  findings_count: p._count?.findings ?? p.findings?.length ?? 0,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const serializeFinding = (f: {
  id: string;
  findingNumber: string;
  severity: string;
  status: string;
  clauseRef: string | null;
  description: string;
  evidence: unknown;
  recommendation: string | null;
  program?: { id: string; programNumber: string } | null;
  isoSubClause?: { id: string; subClauseNumber: string; subClauseTitle: string } | null;
  nonConformance?: { id: string; ncNumber: string; status: string } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: Date;
}) => ({
  id: f.id,
  finding_number: f.findingNumber,
  severity: f.severity,
  status: f.status,
  clause_ref: f.clauseRef,
  description: f.description,
  evidence: f.evidence,
  recommendation: f.recommendation,
  program: f.program ?? null,
  iso_sub_clause: f.isoSubClause ?? null,
  non_conformance: f.nonConformance ?? null,
  created_by: f.createdBy ?? null,
  created_at: f.createdAt,
});

const serializeNc = (n: {
  id: string;
  ncNumber: string;
  status: string;
  severity: string;
  track: string | null;
  dueDate: Date | null;
  closedAt: Date | null;
  finding: {
    id: string;
    findingNumber: string;
    description?: string;
    severity?: string;
    program?: {
      id: string;
      programNumber: string;
      register?: { id: string; title: string; registerNumber: string } | null;
    } | null;
  };
  department?: { id: string; name: string; code?: string } | null;
  capaTicket?: { id: string; uniqueId: string; title: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: n.id,
  nc_number: n.ncNumber,
  status: n.status,
  severity: n.severity,
  track: n.track,
  due_date: n.dueDate,
  closed_at: n.closedAt,
  finding: n.finding,
  department: n.department ?? null,
  capa_ticket: n.capaTicket ?? null,
  created_at: n.createdAt,
  updated_at: n.updatedAt,
});
