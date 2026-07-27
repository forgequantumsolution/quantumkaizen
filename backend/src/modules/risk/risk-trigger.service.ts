/**
 * Risk triggers — the write side of cross-module integration.
 *
 * "Something happened over there; raise risk work for it." A major audit
 * finding, a confirmed OOS, a deviation, a change request: each is a moment the
 * quality system already recognises as risk-relevant, and until now none of them
 * could produce a risk record. `RiskAssessment.triggerType` / `triggerId` were
 * built for exactly this and never written by any caller.
 *
 * One function serves every source module, so a new inbound integration is a
 * config row plus a button — not another bespoke create path with its own
 * numbering, trail and linking bugs.
 *
 * Routing is data, not code: `RiskTriggerRule` decides which register,
 * framework and category a given source lands in, and whether it fires
 * automatically or waits for someone to press "Assess risk". That matters
 * because the right answer differs per site and per customer, and hardcoding it
 * would make every deployment a fork.
 *
 * See docs/RISK-cross-module-integration-plan.md §C.4.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import { isLinkableType } from '../../lib/risk-entity-registry';
import { onLinkChanged } from './risk-profile.service';

export interface TriggerSeed {
  title: string;
  description?: string | null;
  hazard?: string | null;
  cause?: string | null;
  consequence?: string | null;
  ownerId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
}

export interface TriggerInput {
  triggerType: string;
  triggerId: string;
  seed: TriggerSeed;
  /** Override the rule's mode; otherwise the matched rule decides. */
  mode?: 'RISK' | 'ASSESSMENT';
  /** Source attributes the rule's `condition` is matched against. */
  attributes?: Record<string, unknown>;
  /** Relation recorded on the reciprocal link. */
  relation?: string;
}

const nextNumber = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { findFirst: (args: any) => Promise<any> },
  field: string,
  prefix: string,
  year: number,
): Promise<string> => {
  const latest = await model.findFirst({
    where: { [field]: { startsWith: `${prefix}-${year}-` } },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  });
  const parsed = latest ? Number(String(latest[field]).split('-').pop()) : 0;
  const max = Number.isFinite(parsed) ? parsed : 0;
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
};

const withUniqueRetry = async <T>(run: () => Promise<T>, tries = 5): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const isDup =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < tries;
      if (!isDup) throw err;
    }
  }
};

/**
 * Does this rule's condition match the source record?
 *
 * A condition is a flat map of attribute -> allowed values, e.g.
 * `{ "severity": ["MAJOR", "CRITICAL"] }`. Deliberately simple: anything richer
 * belongs in code where it can be tested, not in a JSON column that silently
 * stops matching when someone mistypes an operator.
 */
export const conditionMatches = (
  condition: unknown,
  attributes: Record<string, unknown> = {},
): boolean => {
  if (!condition || typeof condition !== 'object') return true;
  for (const [key, allowed] of Object.entries(condition as Record<string, unknown>)) {
    const actual = attributes[key];
    const list = Array.isArray(allowed) ? allowed : [allowed];
    if (!list.some((v) => String(v) === String(actual))) return false;
  }
  return true;
};

/** The active rule governing a source type, or null when none is configured. */
export const ruleFor = async (
  triggerType: string,
  attributes: Record<string, unknown> = {},
) => {
  const rules = await prisma.riskTriggerRule.findMany({
    where: { triggerType, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return rules.find((r) => conditionMatches(r.condition, attributes)) ?? null;
};

/** Resolve the register a triggered risk lands in. */
const resolveRegisterId = async (ruleRegisterId: string | null): Promise<string> => {
  if (ruleRegisterId) {
    const r = await prisma.riskRegister.findUnique({
      where: { id: ruleRegisterId },
      select: { id: true, isActive: true, name: true },
    });
    if (r?.isActive) return r.id;
  }
  // No rule register, or it has been retired — fall back to any active one so a
  // trigger never silently drops the risk it was asked to raise.
  const fallback = await prisma.riskRegister.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!fallback) {
    throw BadRequest(
      'No active risk register exists to raise this risk in. Create one, or point the trigger rule at an active register.',
    );
  }
  return fallback.id;
};

export interface TriggerResult {
  created: boolean;
  mode: 'RISK' | 'ASSESSMENT';
  id: string;
  number: string;
  /** Set when an existing record already covered this source. */
  reused?: boolean;
}

/**
 * Raise a risk (or an assessment) from another module's record, link the two,
 * and refresh the source's risk profile — atomically enough that a caller never
 * sees a risk with no link back to what caused it.
 *
 * Idempotent per source: if risk work already exists for this exact
 * (triggerType, triggerId) it is returned rather than duplicated. Two people
 * pressing "Assess risk" on the same finding must not produce two risks.
 */
export const createRiskFromTrigger = async (
  input: TriggerInput,
  userId?: string,
): Promise<TriggerResult> => {
  if (!isLinkableType(input.triggerType)) {
    throw BadRequest(`"${input.triggerType}" is not a record type risk work can be raised from`);
  }

  const rule = await ruleFor(input.triggerType, input.attributes);
  const mode = input.mode ?? ((rule?.mode as 'RISK' | 'ASSESSMENT') ?? 'RISK');

  if (mode === 'ASSESSMENT') {
    const existing = await prisma.riskAssessment.findFirst({
      where: { triggerType: input.triggerType, triggerId: input.triggerId },
      select: { id: true, assessmentNumber: true },
    });
    if (existing) {
      return { created: false, reused: true, mode, id: existing.id, number: existing.assessmentNumber };
    }

    const frameworkId =
      rule?.frameworkId ??
      (await prisma.riskFramework.findFirst({ where: { isDefault: true, isActive: true }, select: { id: true } }))?.id;
    if (!frameworkId) {
      throw BadRequest('No risk framework is configured to raise an assessment against');
    }

    const created = await withUniqueRetry(async () => {
      const number = await nextNumber(prisma.riskAssessment, 'assessmentNumber', 'RA', new Date().getFullYear());
      return prisma.riskAssessment.create({
        data: {
          assessmentNumber: number,
          title: input.seed.title,
          objective: input.seed.description ?? null,
          frameworkId,
          registerId: rule?.registerId ?? null,
          siteId: input.seed.siteId ?? null,
          departmentId: input.seed.departmentId ?? null,
          leadId: input.seed.ownerId ?? null,
          triggerType: input.triggerType,
          triggerId: input.triggerId,
          createdById: userId ?? null,
        },
      });
    });

    await prisma.riskLink.create({
      data: {
        assessmentId: created.id,
        entityType: input.triggerType,
        entityId: input.triggerId,
        relation: input.relation ?? 'CAUSED_BY',
        label: input.seed.title.slice(0, 300),
        createdById: userId ?? null,
      },
    });

    await writeTrail(
      {
        entityType: 'RiskAssessment',
        entityId: created.id,
        action: 'CREATE',
        newValue: created.assessmentNumber,
        reason: `Raised from ${input.triggerType} ${input.triggerId}`,
      },
      userId,
    );

    return { created: true, mode, id: created.id, number: created.assessmentNumber };
  }

  // ── mode === 'RISK' ───────────────────────────────────────────────────────
  // Idempotency for risks is expressed through the link, since Risk itself has
  // no trigger columns — a link of this relation from this source IS the record
  // that risk work already exists.
  const existingLink = await prisma.riskLink.findFirst({
    where: {
      entityType: input.triggerType,
      entityId: input.triggerId,
      relation: input.relation ?? 'CAUSED_BY',
      riskId: { not: null },
    },
    select: { riskId: true },
  });
  if (existingLink?.riskId) {
    const risk = await prisma.risk.findUnique({
      where: { id: existingLink.riskId },
      select: { id: true, riskNumber: true },
    });
    if (risk) return { created: false, reused: true, mode, id: risk.id, number: risk.riskNumber };
  }

  const registerId = await resolveRegisterId(rule?.registerId ?? null);
  const register = await prisma.riskRegister.findUnique({
    where: { id: registerId },
    select: { frameworkId: true, siteId: true },
  });

  const created = await withUniqueRetry(async () => {
    const number = await nextNumber(prisma.risk, 'riskNumber', 'RISK', new Date().getFullYear());
    return prisma.risk.create({
      data: {
        riskNumber: number,
        title: input.seed.title,
        description: input.seed.description ?? null,
        registerId,
        frameworkId: rule?.frameworkId ?? register?.frameworkId ?? null,
        categoryId: rule?.categoryId ?? null,
        hazard: input.seed.hazard ?? null,
        cause: input.seed.cause ?? null,
        consequence: input.seed.consequence ?? null,
        ownerId: input.seed.ownerId ?? null,
        departmentId: input.seed.departmentId ?? null,
        siteId: input.seed.siteId ?? register?.siteId ?? null,
        createdById: userId ?? null,
      },
    });
  });

  await prisma.riskLink.create({
    data: {
      riskId: created.id,
      entityType: input.triggerType,
      entityId: input.triggerId,
      relation: input.relation ?? 'CAUSED_BY',
      label: input.seed.title.slice(0, 300),
      createdById: userId ?? null,
    },
  });

  await writeTrail(
    {
      entityType: 'Risk',
      entityId: created.id,
      action: 'CREATE',
      newValue: created.riskNumber,
      reason: `Raised from ${input.triggerType} ${input.triggerId}`,
    },
    userId,
  );

  await onLinkChanged(input.triggerType, input.triggerId);

  return { created: true, mode, id: created.id, number: created.riskNumber };
};

/**
 * Fire a trigger only when a rule says to do it automatically.
 *
 * This is what source modules call from their own event handlers. Best-effort:
 * a trigger failing must never fail the OOS closure or finding creation that
 * prompted it — the source record is the system of record, the risk is derived.
 */
export const maybeAutoTrigger = async (
  input: TriggerInput,
  userId?: string,
): Promise<TriggerResult | null> => {
  try {
    const rule = await ruleFor(input.triggerType, input.attributes);
    if (!rule?.autoCreate) return null;
    return await createRiskFromTrigger({ ...input, mode: rule.mode as 'RISK' | 'ASSESSMENT' }, userId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[risk-trigger] auto-trigger from ${input.triggerType} ${input.triggerId} failed:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
};

// ── Rule administration ─────────────────────────────────────────────────────

const serializeRule = (r: {
  id: string;
  name: string;
  triggerType: string;
  condition: Prisma.JsonValue;
  mode: string;
  registerId: string | null;
  frameworkId: string | null;
  categoryId: string | null;
  autoCreate: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: r.id,
  name: r.name,
  trigger_type: r.triggerType,
  condition: r.condition,
  mode: r.mode,
  register_id: r.registerId,
  framework_id: r.frameworkId,
  category_id: r.categoryId,
  auto_create: r.autoCreate,
  is_active: r.isActive,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

export const listTriggerRules = async (q: { triggerType?: string; isActive?: boolean }) => {
  const rows = await prisma.riskTriggerRule.findMany({
    where: {
      ...(q.triggerType ? { triggerType: q.triggerType } : {}),
      ...(q.isActive === undefined ? {} : { isActive: q.isActive }),
    },
    orderBy: [{ triggerType: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serializeRule);
};

export const createTriggerRule = async (
  body: {
    name: string;
    triggerType: string;
    condition?: unknown;
    mode: 'RISK' | 'ASSESSMENT';
    registerId?: string | null;
    frameworkId?: string | null;
    categoryId?: string | null;
    autoCreate: boolean;
    isActive: boolean;
  },
  userId?: string,
) => {
  if (!isLinkableType(body.triggerType)) {
    throw BadRequest(`"${body.triggerType}" is not a record type risk work can be raised from`);
  }
  const created = await prisma.riskTriggerRule.create({
    data: {
      name: body.name,
      triggerType: body.triggerType,
      condition: (body.condition ?? null) as Prisma.InputJsonValue,
      mode: body.mode,
      registerId: body.registerId ?? null,
      frameworkId: body.frameworkId ?? null,
      categoryId: body.categoryId ?? null,
      autoCreate: body.autoCreate,
      isActive: body.isActive,
      createdById: userId ?? null,
    },
  });
  await writeTrail(
    { entityType: 'RiskTriggerRule', entityId: created.id, action: 'CREATE', newValue: created.name },
    userId,
  );
  return serializeRule(created);
};

export const updateTriggerRule = async (
  id: string,
  body: Partial<{
    name: string;
    condition: unknown;
    mode: 'RISK' | 'ASSESSMENT';
    registerId: string | null;
    frameworkId: string | null;
    categoryId: string | null;
    autoCreate: boolean;
    isActive: boolean;
  }>,
  userId?: string,
) => {
  const existing = await prisma.riskTriggerRule.findUnique({ where: { id } });
  if (!existing) throw NotFound('Trigger rule not found');

  const updated = await prisma.riskTriggerRule.update({
    where: { id },
    data: {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.condition === undefined ? {} : { condition: body.condition as Prisma.InputJsonValue }),
      ...(body.mode === undefined ? {} : { mode: body.mode }),
      ...(body.registerId === undefined ? {} : { registerId: body.registerId }),
      ...(body.frameworkId === undefined ? {} : { frameworkId: body.frameworkId }),
      ...(body.categoryId === undefined ? {} : { categoryId: body.categoryId }),
      ...(body.autoCreate === undefined ? {} : { autoCreate: body.autoCreate }),
      ...(body.isActive === undefined ? {} : { isActive: body.isActive }),
    },
  });
  await writeTrail(
    { entityType: 'RiskTriggerRule', entityId: id, action: 'UPDATE', oldValue: existing.name, newValue: updated.name },
    userId,
  );
  return serializeRule(updated);
};

export const deleteTriggerRule = async (id: string, userId?: string) => {
  const existing = await prisma.riskTriggerRule.findUnique({ where: { id } });
  if (!existing) throw NotFound('Trigger rule not found');
  await prisma.riskTriggerRule.delete({ where: { id } });
  await writeTrail(
    { entityType: 'RiskTriggerRule', entityId: id, action: 'DELETE', oldValue: existing.name },
    userId,
  );
};
