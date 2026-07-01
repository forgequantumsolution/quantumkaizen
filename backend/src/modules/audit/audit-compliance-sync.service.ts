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

export interface ComplianceItem {
  submissionId: string;
  sectionName: string;
  fieldName: string;
  label: string;
  dedupeKey: string;
  result: ComplianceResult;
}

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
    if (!form) continue;
    const responses = (sub.responses ?? {}) as Record<string, Record<string, unknown>>;
    for (const section of form.sections) {
      const answered = responses[section.name] ?? {};
      for (const field of section.fields) {
        if (!isCompliance(field.typeName, field.type?.name ?? null)) continue;
        const value = answered[field.name] as ComplianceResult | undefined;
        if (!value || !RESULTS.has(value)) continue;
        items.push({
          submissionId: sub.id,
          sectionName: section.name,
          fieldName: field.name,
          label: field.label,
          dedupeKey: `${ticketId}:${sub.id}:${section.name}:${field.name}`,
          result: value,
        });
      }
    }
  }
  return items;
};

/**
 * On audit-ticket completion, turn NON_CONFORMANCE / OBSERVATION dispositions into
 * Findings (+ NCs for non-conformances). Best-effort and idempotent; callers
 * should swallow errors so a workflow transition is never blocked.
 */
export const syncTicketComplianceFindings = async (
  ticketId: string,
): Promise<{ findingsCreated: number; ncsCreated: number; skipped: number }> => {
  const result = { findingsCreated: 0, ncsCreated: 0, skipped: 0 };

  const register = await prisma.auditRegister.findFirst({
    where: { workflowTicketId: ticketId },
    select: { program: { select: { id: true } } },
  });
  const programId = register?.program?.id;
  if (!programId) return result; // not an audit ticket (or no program)

  const marked = (await collectTicketComplianceItems(ticketId)).filter(
    (i) => i.result === 'NON_CONFORMANCE' || i.result === 'OBSERVATION',
  );
  if (marked.length === 0) return result;

  // Dedupe against findings already synced from this ticket/program.
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
      source: 'checklist_compliance',
      ticketId,
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
  // Present only for NON_CONFORMANCE items that were synced into an NC.
  nc: { id: string; nc_number: string; status: string } | null;
}

export const listAuditComplianceResults = async (filter?: {
  register_id?: string;
  program_id?: string;
}): Promise<{ data: ComplianceResultRow[] }> => {
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
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: ComplianceResultRow[] = [];
  for (const reg of registers) {
    if (!reg.program || !reg.workflowTicketId) continue;
    if (filter?.program_id && reg.program.id !== filter.program_id) continue;

    const items = await collectTicketComplianceItems(reg.workflowTicketId);
    if (items.length === 0) continue;

    // Map dedupeKey → NC (for the non-conformance items that were synced).
    const findings = await prisma.auditFinding.findMany({
      where: { programId: reg.program.id },
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
        nc: nc ? { id: nc.id, nc_number: nc.ncNumber, status: nc.status } : null,
      });
    }
  }
  return { data: rows };
};
