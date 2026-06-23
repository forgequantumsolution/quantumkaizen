import { Prisma, type AuditFrequency } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import { raiseTicket as engineRaiseTicket } from '../workflow/engine/orchestrator';
import type {
  AuditScheduleRuleUpsertInput,
  CalendarQuery,
  ListScheduleRuleQuery,
} from './audit.schema';

// Advance a date by one period of the given frequency. ONE_TIME returns null
// (the rule is deactivated after it fires once).
export const advanceDate = (from: Date, freq: AuditFrequency): Date | null => {
  const d = new Date(from);
  switch (freq) {
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      return d;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      return d;
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      return d;
    case 'HALF_YEARLY':
      d.setMonth(d.getMonth() + 6);
      return d;
    case 'ANNUAL':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case 'ONE_TIME':
    default:
      return null;
  }
};

// Indian-style FY label (Apr–Mar). Falls back to calendar year if needed.
const financialYearFor = (date: Date): string => {
  const y = date.getFullYear();
  return date.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const ruleInclude = {
  auditMaster: {
    select: { id: true, name: true, code: true, auditType: true, defaultChecklistFormId: true },
  },
} satisfies Prisma.AuditScheduleRuleInclude;

type RuleRow = Prisma.AuditScheduleRuleGetPayload<{ include: typeof ruleInclude }>;

const serializeRule = (r: RuleRow) => ({
  id: r.id,
  name: r.name,
  audit_master: r.auditMaster,
  frequency: r.frequency,
  anchor_date: r.anchorDate,
  lead_time_days: r.leadTimeDays,
  plant: r.plant,
  default_auditor_id: r.defaultAuditorId,
  workflow_id: r.workflowId,
  checklist_form_id: r.checklistFormId,
  is_active: r.isActive,
  last_spawned_at: r.lastSpawnedAt,
  next_run_at: r.nextRunAt,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

export const listScheduleRules = async (q: ListScheduleRuleQuery) => {
  const where: Prisma.AuditScheduleRuleWhereInput = {};
  if (q.is_active !== undefined) where.isActive = q.is_active;
  if (q.audit_master_id) where.auditMasterId = q.audit_master_id;
  const items = await prisma.auditScheduleRule.findMany({
    where,
    include: ruleInclude,
    orderBy: { nextRunAt: 'asc' },
  });
  return { data: items.map(serializeRule) };
};

export const createScheduleRule = async (
  input: AuditScheduleRuleUpsertInput,
  userId?: string,
) => {
  const master = await prisma.auditMaster.findUnique({ where: { id: input.audit_master_id } });
  if (!master) throw NotFound('Audit master not found');
  const created = await prisma.auditScheduleRule.create({
    data: {
      name: input.name,
      auditMasterId: input.audit_master_id,
      frequency: input.frequency,
      anchorDate: new Date(input.anchor_date),
      leadTimeDays: input.lead_time_days,
      plant: input.plant ?? null,
      defaultAuditorId: input.default_auditor_id ?? null,
      workflowId: input.workflow_id ?? null,
      checklistFormId: input.checklist_form_id ?? null,
      isActive: input.is_active ?? true,
      nextRunAt: new Date(input.anchor_date),
      createdById: userId ?? null,
    },
    include: ruleInclude,
  });
  // Scheduled for today (or earlier) → spawn the audit + its workflow ticket (PR)
  // immediately instead of waiting for the cron sweep. Best-effort.
  await spawnNowQuietly(created.id);
  return serializeRule(await refetchRule(created.id, created));
};

const refetchRule = async (id: string, fallback: RuleRow): Promise<RuleRow> => {
  const fresh = await prisma.auditScheduleRule.findUnique({ where: { id }, include: ruleInclude });
  return fresh ?? fallback;
};

const spawnNowQuietly = async (ruleId: string) => {
  try {
    await spawnScheduleRuleNow(ruleId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[audit-schedule] immediate spawn failed for rule ${ruleId}:`,
      e instanceof Error ? e.message : e,
    );
  }
};

export const updateScheduleRule = async (id: string, input: AuditScheduleRuleUpsertInput) => {
  const existing = await prisma.auditScheduleRule.findUnique({ where: { id } });
  if (!existing) throw NotFound('Schedule rule not found');
  // Reset nextRunAt to anchor only when the anchor actually moved.
  const anchorChanged = new Date(input.anchor_date).getTime() !== existing.anchorDate.getTime();
  const updated = await prisma.auditScheduleRule.update({
    where: { id },
    data: {
      name: input.name,
      auditMasterId: input.audit_master_id,
      frequency: input.frequency,
      anchorDate: new Date(input.anchor_date),
      leadTimeDays: input.lead_time_days,
      plant: input.plant ?? null,
      defaultAuditorId: input.default_auditor_id ?? null,
      workflowId: input.workflow_id ?? null,
      checklistFormId: input.checklist_form_id ?? null,
      isActive: input.is_active ?? existing.isActive,
      ...(anchorChanged ? { nextRunAt: new Date(input.anchor_date) } : {}),
    },
    include: ruleInclude,
  });
  // If now scheduled for today (or earlier) and active, spawn immediately.
  await spawnNowQuietly(updated.id);
  return serializeRule(await refetchRule(updated.id, updated));
};

export const deleteScheduleRule = async (id: string) => {
  const r = await prisma.auditScheduleRule.findUnique({ where: { id } });
  if (!r) throw NotFound('Schedule rule not found');
  await prisma.auditScheduleRule.delete({ where: { id } });
};

type DueScheduleRule = Prisma.AuditScheduleRuleGetPayload<{ include: { auditMaster: true } }>;

interface SpawnEntry {
  rule_id: string;
  register_id: string;
  register_number: string;
  workflow_ticket_id: string | null;
  workflow_ticket_unique_id: string | null;
}

// Spawn a DRAFT register (and a workflow ticket / "PR" when the rule names a
// workflow) from a single due rule, then advance its nextRunAt. Shared by the
// cron sweep and the immediate spawn-on-create path.
const spawnFromRule = async (rule: DueScheduleRule, now: Date): Promise<SpawnEntry> => {
  {
    const plannedDate = rule.nextRunAt;
    const year = plannedDate.getFullYear();
    const master = rule.auditMaster;

    const reg = await prisma.$transaction(async (tx) => {
      const count = await tx.auditRegister.count({
        where: { registerNumber: { startsWith: `AR-${year}-` } },
      });
      const registerNumber = `AR-${year}-${String(count + 1).padStart(4, '0')}`;
      const created = await tx.auditRegister.create({
        data: {
          registerNumber,
          title: `${master.name} — ${plannedDate.toLocaleDateString()}`,
          status: 'DRAFT',
          auditMasterId: master.id,
          auditType: master.auditType,
          plant: rule.plant ?? null,
          plannedDate,
          financialYear: financialYearFor(plannedDate),
          isoStandardId: master.defaultIsoStandardId ?? null,
          // Checklist selected on the rule wins; else fall back to the master default.
          checklistFormId: rule.checklistFormId ?? master.defaultChecklistFormId ?? null,
          auditorId: rule.defaultAuditorId ?? null,
          workflowId: rule.workflowId ?? null,
          createdById: rule.createdById ?? null,
        },
      });

      const next = advanceDate(rule.nextRunAt, rule.frequency);
      await tx.auditScheduleRule.update({
        where: { id: rule.id },
        data: {
          lastSpawnedAt: now,
          // ONE_TIME → no next occurrence → deactivate.
          ...(next ? { nextRunAt: next } : { isActive: false }),
        },
      });
      return created;
    });

    // If the rule names a workflow, raise a ticket on it so the audit follows
    // that workflow (its stage checklist + progress). Best-effort: a missing /
    // inactive workflow must not block audit generation.
    let workflowTicket: { ticketId: string; uniqueId: string } | null = null;
    if (rule.workflowId) {
      const actorId = rule.createdById ?? rule.defaultAuditorId;
      try {
        if (!actorId) throw new Error('no actor available to raise the workflow ticket');
        const t = await engineRaiseTicket(
          {
            workflowId: rule.workflowId,
            title: reg.title,
            description: `Audit ${reg.registerNumber} generated from schedule rule "${rule.name}".`,
            // Carry the audit + its selected checklist onto the ticket so the
            // auditor can open/fill it when performing the audit.
            customFields: {
              audit_register_id: reg.id,
              audit_register_number: reg.registerNumber,
              audit_checklist_form_id: reg.checklistFormId ?? null,
            },
          },
          { id: actorId },
        );
        workflowTicket = { ticketId: t.ticketId, uniqueId: t.uniqueId };
        await prisma.auditRegister.update({
          where: { id: reg.id },
          data: { workflowTicketId: t.ticketId, workflowTicketUniqueId: t.uniqueId },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[audit-schedule] failed to raise workflow ticket for ${reg.registerNumber}:`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    return {
      rule_id: rule.id,
      register_id: reg.id,
      register_number: reg.registerNumber,
      workflow_ticket_id: workflowTicket?.ticketId ?? null,
      workflow_ticket_unique_id: workflowTicket?.uniqueId ?? null,
    };
  }
};

// ── The sweep: spawn DRAFT registers for any rule whose nextRunAt is due ──
// Shared by the BullMQ worker and the POST /run-now endpoint. Returns a summary.
export const spawnDueAudits = async (now = new Date()) => {
  const due = await prisma.auditScheduleRule.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
    include: { auditMaster: true },
  });
  const spawned: SpawnEntry[] = [];
  for (const rule of due) spawned.push(await spawnFromRule(rule, now));
  return { spawned_count: spawned.length, spawned };
};

// Immediately spawn for ONE rule if it's active and already due — used when a
// schedule is created/updated with a current (or past) date, so the audit and
// its workflow ticket (PR) appear right away instead of waiting for the cron.
export const spawnScheduleRuleNow = async (
  ruleId: string,
  now = new Date(),
): Promise<SpawnEntry | null> => {
  const rule = await prisma.auditScheduleRule.findFirst({
    where: { id: ruleId, isActive: true, nextRunAt: { lte: now } },
    include: { auditMaster: true },
  });
  if (!rule) return null;
  return spawnFromRule(rule, now);
};

// ── Calendar feed: planned audits (registers) within a date range ──
export const getCalendar = async (q: CalendarQuery) => {
  const where: Prisma.AuditRegisterWhereInput = {};
  if (q.from || q.to) {
    where.plannedDate = {};
    if (q.from) (where.plannedDate as Prisma.DateTimeFilter).gte = new Date(q.from);
    if (q.to) (where.plannedDate as Prisma.DateTimeFilter).lte = new Date(q.to);
  }
  const items = await prisma.auditRegister.findMany({
    where,
    select: {
      id: true,
      registerNumber: true,
      title: true,
      status: true,
      plannedDate: true,
      auditType: true,
    },
    orderBy: { plannedDate: 'asc' },
  });
  return {
    data: items.map((r) => ({
      id: r.id,
      register_number: r.registerNumber,
      title: r.title,
      status: r.status,
      audit_type: r.auditType,
      planned_date: r.plannedDate,
    })),
  };
};
