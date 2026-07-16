import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  collectSubmissionComplianceItems,
  collectTicketComplianceItems,
  type ComplianceItem,
} from '../audit/audit-compliance-sync.service';

// ─────────────────────────────────────────────────────────────────────────────
// Generic finding generation from checklist form data.
//
// The audit module turns checklist compliance dispositions into AuditFindings.
// This is the same idea for non-audit modules: any ticket whose WorkflowType has
// `supportsFindings = true` gets Findings auto-created from its checklist forms'
// NON_CONFORMANCE / OBSERVATION dispositions. Idempotent via a dedupe key stored
// on `Finding.evidence` (submission × section × field), so re-submitting never
// duplicates. Compliant / N-A items are ignored.
//
// Reuses audit's readers (collectSubmissionComplianceItems /
// collectTicketComplianceItems) verbatim — only the persist side is module-local.
// ─────────────────────────────────────────────────────────────────────────────

// Does this ticket's workflow type opt into findings?
export const ticketSupportsFindings = async (ticketId: string): Promise<boolean> => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      flows: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { workflow: { select: { type: { select: { supportsFindings: true } } } } },
      },
    },
  });
  return ticket?.flows[0]?.workflow.type?.supportsFindings === true;
};

const nextFindingNumber = (year: number, count: number) =>
  `F-${year}-${String(count + 1).padStart(4, '0')}`;

interface SyncResult {
  findingsCreated: number;
  skipped: number;
}

// Persist NON_CONFORMANCE / OBSERVATION items as generic Findings on a ticket.
// Idempotent: each finding stores its dedupeKey on `evidence`.
const persistGenericFindings = async (
  sourceTicketId: string,
  marked: ComplianceItem[],
  source: string,
): Promise<SyncResult> => {
  const result: SyncResult = { findingsCreated: 0, skipped: 0 };
  if (marked.length === 0) return result;

  const existing = await prisma.finding.findMany({
    where: { sourceTicketId },
    select: { evidence: true },
  });
  const seen = new Set<string>();
  for (const f of existing) {
    const key = (f.evidence as { dedupeKey?: string } | null)?.dedupeKey;
    if (key) seen.add(key);
  }

  const year = new Date().getFullYear();
  let count = await prisma.finding.count({
    where: { findingNumber: { startsWith: `F-${year}-` } },
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

    await prisma.finding.create({
      data: {
        findingNumber: nextFindingNumber(year, count++),
        sourceTicketId,
        severity,
        status: 'OPEN',
        title: item.label,
        description: `${item.label} — marked ${
          item.result === 'OBSERVATION' ? 'Observation' : 'Non-Conformance'
        }`,
        evidence,
      },
    });
    result.findingsCreated += 1;
  }

  return result;
};

// On a checklist submission against a findings-enabled ticket, turn its
// dispositions into Findings. Best-effort + idempotent (callers swallow errors).
export const syncSubmissionFindings = async (
  ticketId: string,
  submissionId: string,
): Promise<SyncResult> => {
  if (!(await ticketSupportsFindings(ticketId))) {
    return { findingsCreated: 0, skipped: 0 };
  }
  const marked = (await collectSubmissionComplianceItems(submissionId)).filter(
    (i) => i.result === 'NON_CONFORMANCE' || i.result === 'OBSERVATION',
  );
  return persistGenericFindings(ticketId, marked, 'checklist_submission');
};

// On ticket completion, sweep every submitted form on the ticket (catches any
// checklist not synced at submit time). Best-effort + idempotent.
export const syncTicketFindingsOnComplete = async (
  ticketId: string,
): Promise<SyncResult> => {
  if (!(await ticketSupportsFindings(ticketId))) {
    return { findingsCreated: 0, skipped: 0 };
  }
  const marked = (await collectTicketComplianceItems(ticketId)).filter(
    (i) => i.result === 'NON_CONFORMANCE' || i.result === 'OBSERVATION',
  );
  return persistGenericFindings(ticketId, marked, 'checklist_ticket_complete');
};
