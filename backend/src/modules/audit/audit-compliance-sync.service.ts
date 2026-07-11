import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Checklist compliance → Non-Conformance aggregation
//
// Auditors mark each checklist item with a `compliance` disposition (Compliant /
// Non-Conformance / Observation / N-A). When an audit's workflow TICKET closes:
//   • every item is surfaced (read-only) in the Audit → Non-Conformance tab, and
//   • each NON_CONFORMANCE is turned into an audit Finding + Non-Conformance so it
//     becomes actionable (status, CAPA). OBSERVATION becomes a Finding only
//     (mirrors promoteFindingToNc: observations can't be promoted to NCs).
//
// The write side is idempotent: a deterministic dedupe key (per ticket ×
// submission × section × field) is stashed on the finding's `evidence`, so
// re-running the sync never duplicates.
// ─────────────────────────────────────────────────────────────────────────────

// Values must match COMPLIANCE_OPTIONS on the client (fieldCatalog.ts).
export type ComplianceResult =
  | 'COMPLIANT'
  | 'NON_CONFORMANCE'
  | 'OBSERVATION'
  | 'NOT_APPLICABLE';

const RESULTS = new Set<ComplianceResult>([
  'COMPLIANT',
  'NON_CONFORMANCE',
  'OBSERVATION',
  'NOT_APPLICABLE',
]);

const nextSeq = (prefix: string, year: number, count: number) =>
  `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;

const isCompliance = (typeName: string | null, relTypeName: string | null) =>
  typeName === 'compliance' || relTypeName === 'compliance';

const isTable = (typeName: string | null, relTypeName: string | null) =>
  typeName === 'table' || relTypeName === 'table';

// Table-checklist rows carry a per-row `compliance_status` select whose values
// differ from the scalar `compliance` field's vocabulary. Normalise both into
// the shared ComplianceResult enum. `partial_compliance` is treated as a
// non-conformance (a conformance gap that needs action).
const TABLE_STATUS_TO_RESULT: Record<string, ComplianceResult> = {
  compliance: 'COMPLIANT',
  compliant: 'COMPLIANT',
  non_compliance: 'NON_CONFORMANCE',
  noncompliance: 'NON_CONFORMANCE',
  non_conformance: 'NON_CONFORMANCE',
  partial_compliance: 'NON_CONFORMANCE',
  partial: 'NON_CONFORMANCE',
  observation: 'OBSERVATION',
  not_applicable: 'NOT_APPLICABLE',
  na: 'NOT_APPLICABLE',
};

const normStatus = (v: unknown): string =>
  String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

export interface ComplianceItem {
  submissionId: string;
  sectionName: string;
  fieldName: string;
  label: string;
  dedupeKey: string;
  result: ComplianceResult;
}

/**
 * Extract every answered `compliance` checklist item from ONE submission.
 * The dedupeKey is prefixed so the same submission read via different callers
 * (ticket vs program) stays idempotent and collision-free.
 */
const extractComplianceItems = async (
  sub: { id: string; formId: string; responses: unknown },
  dedupePrefix: string,
): Promise<ComplianceItem[]> => {
  const form = await prisma.form.findUnique({
    where: { id: sub.formId },
    select: {
      sections: {
        select: {
          name: true,
          fields: {
            select: { name: true, label: true, typeName: true, type: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!form) return [];
  const responses = (sub.responses ?? {}) as Record<string, Record<string, unknown>>;
  const items: ComplianceItem[] = [];
  for (const section of form.sections) {
    const answered = responses[section.name] ?? {};
    for (const field of section.fields) {
      const relName = field.type?.name ?? null;

      // Scalar `compliance` field: one disposition stored under the field name.
      if (isCompliance(field.typeName, relName)) {
        const value = answered[field.name] as ComplianceResult | undefined;
        if (!value || !RESULTS.has(value)) continue;
        items.push({
          submissionId: sub.id,
          sectionName: section.name,
          fieldName: field.name,
          label: field.label,
          dedupeKey: `${dedupePrefix}:${section.name}:${field.name}`,
          result: value,
        });
        continue;
      }

      // Table checklist: an array of rows, each with a `compliance_status`
      // select column. One disposition per row (dedupe by row index).
      const rows = answered[field.name];
      if (isTable(field.typeName, relName) && Array.isArray(rows)) {
        rows.forEach((row, idx) => {
          if (!row || typeof row !== 'object') return;
          const r = row as Record<string, unknown>;
          const result = TABLE_STATUS_TO_RESULT[normStatus(r.compliance_status)];
          if (!result) return; // unanswered / unrecognised → not a disposition
          const label =
            String(r.check_item_requirement ?? r.requirement ?? '').trim() ||
            `${field.label} #${idx + 1}`;
          items.push({
            submissionId: sub.id,
            sectionName: section.name,
            fieldName: field.name,
            label,
            dedupeKey: `${dedupePrefix}:${section.name}:${field.name}:${idx}`,
            result,
          });
        });
      }
    }
  }
  return items;
};

/**
 * Read every answered `compliance` checklist item on a ticket's submitted forms.
 * Returns ALL dispositions (including Compliant / N-A) — callers filter as needed.
 */
export const collectTicketComplianceItems = async (
  ticketId: string,
): Promise<ComplianceItem[]> => {
  const submissions = await prisma.formSubmission.findMany({
    where: { ticketId, status: 'SUBMITTED' },
    select: { id: true, formId: true, responses: true },
  });
  if (submissions.length === 0) return [];

  const items: ComplianceItem[] = [];
  for (const sub of submissions) {
    items.push(...(await extractComplianceItems(sub, `${ticketId}:${sub.id}`)));
  }
  return items;
};

/**
 * Read compliance items from a single form submission (the checklist an auditor
 * filled during program execution). Submission id is globally unique, so it is
 * a sufficient dedupe prefix on its own.
 */
export const collectSubmissionComplianceItems = async (
  submissionId: string,
): Promise<ComplianceItem[]> => {
  const sub = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, formId: true, responses: true },
  });
  if (!sub) return [];
  return extractComplianceItems(sub, sub.id);
};

export interface SyncResult {
  findingsCreated: number;
  ncsCreated: number;
  skipped: number;
}

/**
 * Persist NON_CONFORMANCE / OBSERVATION checklist items as Findings (+ NCs for
 * non-conformances) under a program. Idempotent: re-running never duplicates
 * because each finding stores its dedupeKey on `evidence`.
 */
const persistFindingsFromItems = async (
  programId: string,
  marked: ComplianceItem[],
  source: string,
): Promise<SyncResult> => {
  const result: SyncResult = { findingsCreated: 0, ncsCreated: 0, skipped: 0 };
  if (marked.length === 0) return result;

  // Dedupe against findings already synced for this program.
  const existing = await prisma.auditFinding.findMany({
    where: { programId },
    select: { evidence: true },
  });
  const seen = new Set<string>();
  for (const f of existing) {
    const key = (f.evidence as { dedupeKey?: string } | null)?.dedupeKey;
    if (key) seen.add(key);
  }

  const year = new Date().getFullYear();
  let afCount = await prisma.auditFinding.count({
    where: { findingNumber: { startsWith: `AF-${year}-` } },
  });
  let ncCount = await prisma.nonConformance.count({
    where: { ncNumber: { startsWith: `NC-${year}-` } },
  });

  for (const item of marked) {
    if (seen.has(item.dedupeKey)) {
      result.skipped += 1;
      continue;
    }
    seen.add(item.dedupeKey);

    const severity = item.result === 'OBSERVATION' ? 'OBSERVATION' : 'MAJOR';
    const evidence: Prisma.InputJsonValue = {
      dedupeKey: item.dedupeKey,
      source,
      submissionId: item.submissionId,
      section: item.sectionName,
      field: item.fieldName,
      result: item.result,
    };

    const finding = await prisma.auditFinding.create({
      data: {
        findingNumber: nextSeq('AF', year, afCount++),
        programId,
        severity,
        status: 'OPEN',
        description: `${item.label} — marked ${
          item.result === 'OBSERVATION' ? 'Observation' : 'Non-Conformance'
        }`,
        evidence,
      },
      select: { id: true },
    });
    result.findingsCreated += 1;

    if (item.result === 'NON_CONFORMANCE') {
      await prisma.nonConformance.create({
        data: { ncNumber: nextSeq('NC', year, ncCount++), findingId: finding.id, severity },
      });
      result.ncsCreated += 1;
    }
  }

  return result;
};

/**
 * On audit-ticket completion, turn NON_CONFORMANCE / OBSERVATION dispositions into
 * Findings (+ NCs for non-conformances). Best-effort and idempotent; callers
 * should swallow errors so a workflow transition is never blocked.
 */
export const syncTicketComplianceFindings = async (ticketId: string): Promise<SyncResult> => {
  const register = await prisma.auditRegister.findFirst({
    where: { workflowTicketId: ticketId },
    select: { program: { select: { id: true } } },
  });
  const programId = register?.program?.id;
  if (!programId) return { findingsCreated: 0, ncsCreated: 0, skipped: 0 };

  const marked = (await collectTicketComplianceItems(ticketId)).filter(
    (i) => i.result === 'NON_CONFORMANCE' || i.result === 'OBSERVATION',
  );
  return persistFindingsFromItems(programId, marked, 'checklist_compliance_ticket');
};

/**
 * On audit-program completion, turn the auditor's checklist dispositions
 * (stored on program.checklistSubmissionId) into Findings + NCs. This is the
 * counterpart of syncTicketComplianceFindings for the program-execution flow.
 * Best-effort and idempotent.
 */
export const syncProgramComplianceFindings = async (programId: string): Promise<SyncResult> => {
  const program = await prisma.auditProgram.findUnique({
    where: { id: programId },
    select: { id: true, checklistSubmissionId: true },
  });
  if (!program?.checklistSubmissionId) return { findingsCreated: 0, ncsCreated: 0, skipped: 0 };

  const marked = (await collectSubmissionComplianceItems(program.checklistSubmissionId)).filter(
    (i) => i.result === 'NON_CONFORMANCE' || i.result === 'OBSERVATION',
  );
  return persistFindingsFromItems(programId, marked, 'checklist_compliance_program');
};

/**
 * On checklist submission against an audit's workflow ticket, link the
 * submission to the register's program and turn NON_CONFORMANCE / OBSERVATION
 * dispositions into Findings (+ NCs) so they surface immediately — the auditor
 * doesn't have to complete the program first. Best-effort and idempotent.
 */
export const syncSubmissionComplianceFindings = async (
  registerId: string,
  submissionId: string,
): Promise<SyncResult> => {
  const program = await prisma.auditProgram.findUnique({
    where: { registerId },
    select: { id: true, status: true },
  });
  if (!program) return { findingsCreated: 0, ncsCreated: 0, skipped: 0 };
  if (program.status === 'CANCELLED') {
    return { findingsCreated: 0, ncsCreated: 0, skipped: 0 };
  }

  // Point the program at this checklist submission (and start it if planned) so
  // the compliance-results read model and completion sync both resolve it.
  await prisma.auditProgram.update({
    where: { id: program.id },
    data: {
      checklistSubmissionId: submissionId,
      ...(program.status === 'PLANNED'
        ? { status: 'IN_PROGRESS', startedAt: new Date() }
        : {}),
    },
  });

  const marked = (await collectSubmissionComplianceItems(submissionId)).filter(
    (i) => i.result === 'NON_CONFORMANCE' || i.result === 'OBSERVATION',
  );
  return persistFindingsFromItems(program.id, marked, 'checklist_compliance_submission');
};

// ── Read model for the Non-Conformance tab ──────────────────────────────────
// Every disposition across audits, so the tab can display Compliant / Observation
// / N-A alongside the actionable Non-Conformances.

export interface ComplianceResultRow {
  id: string; // dedupeKey — globally unique (includes ticketId)
  result: ComplianceResult;
  label: string;
  section: string;
  ticket_id: string;
  audit: {
    register_id: string;
    program_id: string;
    title: string;
    register_number: string;
  };
  // The audit's auditor — used for "by user" filtering on the performance view.
  auditor: { id: string; name: string } | null;
  // Present only for NON_CONFORMANCE items that were synced into an NC.
  nc: { id: string; nc_number: string; status: string } | null;
}

// Map every synced finding's dedupeKey → its NC (if it became one) for a program.
const ncMapForProgram = async (programId: string) => {
  const findings = await prisma.auditFinding.findMany({
    where: { programId },
    select: {
      evidence: true,
      nonConformance: { select: { id: true, ncNumber: true, status: true } },
    },
  });
  const ncByKey = new Map<string, { id: string; ncNumber: string; status: string }>();
  for (const f of findings) {
    const key = (f.evidence as { dedupeKey?: string } | null)?.dedupeKey;
    if (key && f.nonConformance) ncByKey.set(key, f.nonConformance);
  }
  return ncByKey;
};

export const listAuditComplianceResults = async (filter?: {
  register_id?: string;
  program_id?: string;
}): Promise<{ data: ComplianceResultRow[] }> => {
  const rows: ComplianceResultRow[] = [];
  const seenProgramIds = new Set<string>();

  // ── Program-execution audits: checklist stored on program.checklistSubmissionId ──
  const programs = await prisma.auditProgram.findMany({
    where: {
      checklistSubmissionId: { not: null },
      ...(filter?.program_id ? { id: filter.program_id } : {}),
      ...(filter?.register_id ? { registerId: filter.register_id } : {}),
    },
    select: {
      id: true,
      checklistSubmissionId: true,
      register: {
        select: {
          id: true,
          title: true,
          registerNumber: true,
          workflowTicketId: true,
          auditor: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const prog of programs) {
    if (!prog.register || !prog.checklistSubmissionId) continue;
    const items = await collectSubmissionComplianceItems(prog.checklistSubmissionId);
    if (items.length === 0) continue;
    seenProgramIds.add(prog.id);
    const ncByKey = await ncMapForProgram(prog.id);
    for (const it of items) {
      const nc = ncByKey.get(it.dedupeKey) ?? null;
      rows.push({
        id: it.dedupeKey,
        result: it.result,
        label: it.label,
        section: it.sectionName,
        ticket_id: prog.register.workflowTicketId ?? prog.id,
        audit: {
          register_id: prog.register.id,
          program_id: prog.id,
          title: prog.register.title,
          register_number: prog.register.registerNumber,
        },
        auditor: prog.register.auditor
          ? { id: prog.register.auditor.id, name: prog.register.auditor.name }
          : null,
        nc: nc ? { id: nc.id, nc_number: nc.ncNumber, status: nc.status } : null,
      });
    }
  }

  // ── Workflow-ticket audits: checklist on the ticket's submitted forms ──
  const registers = await prisma.auditRegister.findMany({
    where: {
      workflowTicketId: { not: null },
      ...(filter?.register_id ? { id: filter.register_id } : {}),
    },
    select: {
      id: true,
      title: true,
      registerNumber: true,
      workflowTicketId: true,
      program: { select: { id: true } },
      auditor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const reg of registers) {
    if (!reg.program || !reg.workflowTicketId) continue;
    if (filter?.program_id && reg.program.id !== filter.program_id) continue;
    if (seenProgramIds.has(reg.program.id)) continue; // already covered by program path

    const items = await collectTicketComplianceItems(reg.workflowTicketId);
    if (items.length === 0) continue;
    const ncByKey = await ncMapForProgram(reg.program.id);
    for (const it of items) {
      const nc = ncByKey.get(it.dedupeKey) ?? null;
      rows.push({
        id: it.dedupeKey,
        result: it.result,
        label: it.label,
        section: it.sectionName,
        ticket_id: reg.workflowTicketId,
        audit: {
          register_id: reg.id,
          program_id: reg.program.id,
          title: reg.title,
          register_number: reg.registerNumber,
        },
        auditor: reg.auditor ? { id: reg.auditor.id, name: reg.auditor.name } : null,
        nc: nc ? { id: nc.id, nc_number: nc.ncNumber, status: nc.status } : null,
      });
    }
  }

  return { data: rows };
};
