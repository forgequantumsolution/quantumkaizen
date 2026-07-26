import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFound } from '../../lib/httpError';
import type { UpsertEscalationRuleInput } from './escalation.schema';

const ruleInclude = {
  department: { select: { id: true, name: true, code: true } },
  levels: {
    orderBy: { order: 'asc' },
    select: { id: true, order: true, target: true, atThresholdName: true },
  },
} satisfies Prisma.EscalationRuleInclude;

// ─── Admin CRUD ──────────────────────────────────────────────────────────────

export const list = async () =>
  prisma.escalationRule.findMany({
    include: ruleInclude,
    // Global rule (no department) first, then departments alphabetically.
    orderBy: [{ departmentId: 'asc' }],
  });

/**
 * Upsert the rule for a department (or the global rule when departmentId is
 * null) and replace its levels wholesale. `departmentId` is `@unique` but
 * Postgres treats NULLs as distinct, so the global rule can't rely on a
 * unique-constraint upsert — we look it up explicitly.
 */
export const upsert = async (input: UpsertEscalationRuleInput) => {
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true },
    });
    if (!dept) throw NotFound('Department not found');
  }

  const existing = await prisma.escalationRule.findFirst({
    where: input.departmentId ? { departmentId: input.departmentId } : { departmentId: null },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    let ruleId: string;
    if (existing) {
      await tx.escalationRule.update({
        where: { id: existing.id },
        data: { isActive: input.isActive },
      });
      await tx.escalationLevel.deleteMany({ where: { ruleId: existing.id } });
      ruleId = existing.id;
    } else {
      const created = await tx.escalationRule.create({
        data: { departmentId: input.departmentId, isActive: input.isActive },
        select: { id: true },
      });
      ruleId = created.id;
    }
    if (input.levels.length > 0) {
      await tx.escalationLevel.createMany({
        data: input.levels.map((l) => ({
          ruleId,
          order: l.order,
          target: l.target,
          atThresholdName: l.atThresholdName ?? null,
        })),
      });
    }
    return tx.escalationRule.findUnique({ where: { id: ruleId }, include: ruleInclude });
  });
};

export const remove = async (id: string) => {
  const rule = await prisma.escalationRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) throw NotFound('Escalation rule not found');
  await prisma.escalationRule.delete({ where: { id } });
};

// ─── Threshold-name catalog (for the matrix UI) ──────────────────────────────

/**
 * Distinct SLA threshold names across all policies, so the matrix editor can
 * offer a dropdown instead of free text. A ladder level's `atThresholdName`
 * only fires when it matches a real threshold, so surfacing the actual names
 * prevents dead levels from typos.
 */
export const listThresholdNames = async (): Promise<string[]> => {
  const rows = await prisma.slaThreshold.findMany({
    distinct: ['name'],
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => r.name);
};

// ─── Runtime resolution (used by the SLA sweep) ──────────────────────────────

/**
 * The active rule governing a ticket's department: the department's own rule if
 * it has one, otherwise the global default. Returns null when neither exists.
 */
export const getActiveRuleForDepartment = async (departmentId: string | null) => {
  if (departmentId) {
    const deptRule = await prisma.escalationRule.findFirst({
      where: { departmentId, isActive: true },
      include: { levels: { orderBy: { order: 'asc' } } },
    });
    if (deptRule) return deptRule;
  }
  return prisma.escalationRule.findFirst({
    where: { departmentId: null, isActive: true },
    include: { levels: { orderBy: { order: 'asc' } } },
  });
};
