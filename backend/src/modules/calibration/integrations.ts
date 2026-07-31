/**
 * The ONLY file in the Calibration module that touches another module's tables.
 *
 * Everything here is optional and degrades gracefully. If LIMS is not installed,
 * if no Deviation workflow type is configured, if there is no risk register, if
 * the LMS has no course — the calling feature returns a typed "not available"
 * result with a reason a human can act on, instead of throwing or failing to
 * compile. That is what makes the module independent in practice and not just
 * on the ER diagram.
 *
 * Rules for this file:
 *   1. Every export returns `IntegrationResult<T>` — never throws for an absent
 *      or misconfigured peer module. Genuine bugs still throw.
 *   2. Every peer-module read is wrapped in `attempt()`, so a schema drift in
 *      another module degrades this module to "integration unavailable" rather
 *      than taking it down.
 *   3. No other calibration file imports from outside `modules/calibration`
 *      except `lib/prisma`, `lib/httpError` and this file's own exports.
 */
import { prisma } from '../../lib/prisma';
import { writeTrail, type TrailInput } from '../audit/compliance.service';

export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; unavailable: true };

const unavailable = (reason: string): IntegrationResult<never> => ({ ok: false, reason, unavailable: true });
const ok = <T>(data: T): IntegrationResult<T> => ({ ok: true, data });

/**
 * Run a peer-module query, converting any failure into "unavailable".
 *
 * A missing table, a renamed column, a module that was never migrated in — all
 * of them mean the same thing to us: that integration cannot be used right now.
 */
const attempt = async <T>(label: string, fn: () => Promise<T>): Promise<IntegrationResult<T>> => {
  try {
    return ok(await fn());
  } catch (err) {
    const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return unavailable(`${label} is unavailable in this deployment (${detail})`);
  }
};

// ═══════════════════════════ Audit trail ═══════════════════════════

/**
 * Audit trail is platform infrastructure, not a peer module — a regulated record
 * with no trail is not a record. It is still funnelled through here so there is
 * exactly one import edge, and so `APPROVE`-style verbs get mapped to the
 * actions the platform actually accepts instead of failing at the type level.
 */
export type CalAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'SIGN' | 'TRANSITION';

const ACTION_MAP: Record<CalAction, TrailInput['action']> = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  // The platform vocabulary has no APPROVE; an approval IS a signature event.
  APPROVE: 'SIGN',
  SIGN: 'SIGN',
  TRANSITION: 'TRANSITION',
};

export const trail = async (
  input: Omit<TrailInput, 'action'> & { action: CalAction },
  userId?: string,
): Promise<void> => {
  await writeTrail({ ...input, action: ACTION_MAP[input.action] }, userId);
};

/** Electronic signature. Same reasoning as `trail` — infrastructure, one edge. */
export const signRecord = async (args: {
  entityType: string;
  entityId: string;
  meaning: string;
  meaningCode: string;
  userId?: string;
  snapshot?: unknown;
}): Promise<void> => {
  const user = args.userId
    ? await prisma.user.findUnique({ where: { id: args.userId }, select: { id: true, name: true, email: true } }).catch(() => null)
    : null;

  await prisma.eSignature.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      meaning: args.meaning,
      meaningCode: args.meaningCode,
      userId: user?.id ?? args.userId ?? 'system',
      userName: user?.name ?? user?.email ?? 'System',
      // Snapshot so a later change cannot be passed off as having been signed
      // (21 CFR 11 §11.70 signature/record linking).
      recordHash: args.snapshot === undefined ? null : fnv1a(JSON.stringify(args.snapshot)),
    },
  });
};

const fnv1a = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Signatures recorded against a calibration record, for the certificate. */
export const getSignatures = async (entityType: string, entityId: string) => {
  const rows = await prisma.eSignature
    .findMany({
      where: { entityType, entityId, invalidatedAt: null },
      orderBy: { signedAt: 'asc' },
      select: { meaning: true, meaningCode: true, userName: true, signedAt: true },
    })
    .catch(() => []);
  return rows.map((s) => ({
    meaning: s.meaning,
    meaning_code: s.meaningCode,
    user_name: s.userName,
    signed_at: s.signedAt,
  }));
};

// ═══════════════════════════ Directory lookups ═══════════════════════════

/**
 * Names for the ids the module stores without foreign keys (site, department,
 * custodian). Absent platform tables just yield empty maps, and the UI shows the
 * raw id rather than breaking.
 */
export const resolveNames = async (ids: {
  siteIds?: (string | null)[];
  departmentIds?: (string | null)[];
  userIds?: (string | null)[];
}) => {
  const uniq = (xs?: (string | null)[]) => [...new Set((xs ?? []).filter((x): x is string => !!x))];
  const siteIds = uniq(ids.siteIds);
  const deptIds = uniq(ids.departmentIds);
  const userIds = uniq(ids.userIds);

  const [sites, depts, users] = await Promise.all([
    siteIds.length ? prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, name: true } }).catch(() => []) : [],
    deptIds.length ? prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }).catch(() => []) : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }).catch(() => []) : [],
  ]);

  return {
    sites: new Map(sites.map((s) => [s.id, s.name])),
    departments: new Map(depts.map((d) => [d.id, d.name])),
    users: new Map(users.map((u) => [u.id, u.name])),
  };
};

/**
 * Resolve an active user for assignment. Returns null when the user does not
 * exist, is inactive, or the platform table is unreachable — the caller decides
 * whether that is an error.
 */
export const findAssignableUser = async (userId: string): Promise<{ id: string; name: string } | null> =>
  prisma.user
    .findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true } })
    .catch(() => null);

/** Organisation branding + industry, for the certificate header and pack hint. */
export const getOrganization = async () =>
  prisma.organization
    .findFirst({ select: { name: true, industry: true, logoUrl: true, address: true, reportFooterText: true } })
    .catch(() => null);

/** Default site id, so records land somewhere sane on single-site tenants. */
export const getDefaultSiteId = async (): Promise<string | null> => {
  const site = await prisma.site.findFirst({ where: { code: 'HQ' }, select: { id: true } }).catch(() => null);
  return site?.id ?? null;
};

// ═══════════════════════════ LIMS — impact scan ═══════════════════════════

export interface LimsImpact {
  resultIds: string[];
  qcResultIds: string[];
  sampleIds: string[];
}

/**
 * Everything a LIMS-linked instrument touched inside the window.
 *
 * Only runs when the instrument carries a soft `limsEquipmentId`. Without it —
 * a standalone deployment, or a production gauge that was never a lab
 * instrument — the caller falls back to batch references, which is the honest
 * answer rather than a silently empty one.
 */
export const scanLimsImpact = async (
  limsEquipmentId: string | null,
  from: Date,
  to: Date,
): Promise<IntegrationResult<LimsImpact>> => {
  if (!limsEquipmentId) {
    return unavailable('Instrument is not linked to a LIMS equipment record — batch references only');
  }

  return attempt('LIMS', async () => {
    const [results, qcResults, sampleTests] = await Promise.all([
      prisma.result.findMany({
        where: { instrumentId: limsEquipmentId, enteredAt: { gte: from, lte: to } },
        select: { id: true, sampleTest: { select: { sampleId: true } } },
      }),
      prisma.qcResult.findMany({
        where: { instrumentId: limsEquipmentId, measuredAt: { gte: from, lte: to } },
        select: { id: true },
      }),
      prisma.sampleTest.findMany({
        where: { instrumentId: limsEquipmentId, createdAt: { gte: from, lte: to } },
        select: { sampleId: true },
      }),
    ]);

    const sampleIds = new Set<string>();
    for (const r of results) if (r.sampleTest?.sampleId) sampleIds.add(r.sampleTest.sampleId);
    for (const t of sampleTests) if (t.sampleId) sampleIds.add(t.sampleId);

    return { resultIds: results.map((r) => r.id), qcResultIds: qcResults.map((r) => r.id), sampleIds: [...sampleIds] };
  });
};

/** Human-readable detail for the ids stored on an assessment. */
export const describeLimsRecords = async (ids: {
  resultIds: string[];
  sampleIds: string[];
  qcResultIds: string[];
}) => {
  const CAP = 500;
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => fn().catch(() => fallback);

  const [results, samples, qcResults] = await Promise.all([
    ids.resultIds.length
      ? safe(
          () =>
            prisma.result.findMany({
              where: { id: { in: ids.resultIds.slice(0, CAP) } },
              select: {
                id: true,
                analyteName: true,
                numericValue: true,
                unit: true,
                evaluation: true,
                enteredAt: true,
                sampleTest: { select: { sample: { select: { id: true, sampleNumber: true } } } },
              },
            }),
          [],
        )
      : [],
    ids.sampleIds.length
      ? safe(
          () =>
            prisma.sample.findMany({
              where: { id: { in: ids.sampleIds.slice(0, CAP) } },
              select: { id: true, sampleNumber: true, status: true, batchNo: true },
            }),
          [],
        )
      : [],
    ids.qcResultIds.length
      ? safe(
          () =>
            prisma.qcResult.findMany({
              where: { id: { in: ids.qcResultIds.slice(0, CAP) } },
              select: { id: true, value: true, status: true, measuredAt: true, qcMaterial: { select: { name: true } } },
            }),
          [],
        )
      : [],
  ]);

  return {
    results: results.map((r) => ({
      id: r.id,
      analyte: r.analyteName,
      value: r.numericValue,
      unit: r.unit,
      evaluation: r.evaluation,
      entered_at: r.enteredAt,
      sample_id: r.sampleTest?.sample?.id ?? null,
      sample_no: r.sampleTest?.sample?.sampleNumber ?? null,
    })),
    samples: samples.map((s) => ({ id: s.id, sample_no: s.sampleNumber, status: s.status, batch_no: s.batchNo })),
    qc_results: qcResults.map((q) => ({
      id: q.id,
      material: q.qcMaterial?.name ?? null,
      value: q.value,
      status: q.status,
      measured_at: q.measuredAt,
    })),
  };
};

/** Typeahead for linking an instrument to its LIMS equipment row. */
export const searchLimsEquipment = async (q: string, take = 20): Promise<IntegrationResult<{ id: string; code: string; name: string }[]>> =>
  attempt('LIMS equipment registry', async () => {
    const rows = await prisma.equipment.findMany({
      where: {
        isDeleted: false,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' as const } },
                { name: { contains: q, mode: 'insensitive' as const } },
                { serialNo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take,
    });
    return rows;
  });

// ═══════════════════════════ LMS — competency gate ═══════════════════════════

/**
 * Has this user completed the course a plan requires?
 *
 * Returns `unavailable` when the LMS is absent, which the caller treats as
 * "cannot verify" — configurable per site whether that blocks or warns. Never
 * silently passes: an unverifiable competency claim is not a verified one.
 */
export const hasCompletedCourse = async (userId: string, courseId: string): Promise<IntegrationResult<boolean>> =>
  attempt('Training (LMS)', async () => {
    const row = await prisma.lmsEnrollment.findFirst({
      where: { courseId, userId, status: 'COMPLETED' },
      select: { id: true },
    });
    return !!row;
  });

// ═══════════════════════════ Tickets — Deviation / CAPA ═══════════════════════════

export interface SpawnedTicket {
  id: string;
  uniqueId: string;
}

/**
 * Raise a Deviation or CAPA from an out-of-tolerance assessment.
 *
 * Creates a ticket of the named workflow type so the spawned record inherits
 * SLA, escalation, comments and the existing module page. If the type is not
 * configured, the caller gets a clear reason and the OOT stays self-contained —
 * the assessment is still valid, it just did not hand off.
 */
export const spawnTicket = async (args: {
  typeName: 'Deviation' | 'CAPA';
  uniqueIdHint: string;
  title: string;
  description: string;
  reason: string;
  siteId: string | null;
  userId?: string;
}): Promise<IntegrationResult<SpawnedTicket>> => {
  const found = await attempt('Workflow engine', async () => {
    const type = await prisma.workflowType.findFirst({
      where: { isDeleted: false, name: { equals: args.typeName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (!type) return null;
    const workflow = await prisma.workflow.findFirst({
      where: { typeId: type.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, version: true },
    });
    return { type, workflow };
  });

  if (!found.ok) return found;
  if (!found.data) {
    return unavailable(`No "${args.typeName}" workflow type is configured — the assessment was saved without one`);
  }
  const { workflow } = found.data;
  if (!workflow) {
    return unavailable(`The "${args.typeName}" workflow type has no workflow published yet`);
  }

  return attempt('Ticket engine', async () => {
    const siteId = args.siteId ?? (await getDefaultSiteId());
    // Unique-id collisions are possible if the same OOT is spawned twice after a
    // failure; suffix keeps it idempotent-ish without a second round trip.
    const existing = await prisma.ticket.count({ where: { uniqueId: { startsWith: args.uniqueIdHint } } });
    const uniqueId = existing === 0 ? args.uniqueIdHint : `${args.uniqueIdHint}-${existing + 1}`;

    const ticket = await prisma.ticket.create({
      data: {
        uniqueId,
        title: args.title,
        description: args.description,
        ticketReason: args.reason,
        siteId,
        createdById: args.userId ?? null,
        flows: {
          create: {
            workflowId: workflow.id,
            // TicketFlow snapshots the workflow it was started under.
            workflowName: workflow.name,
            workflowVersion: workflow.version,
          },
        },
      },
      select: { id: true, uniqueId: true },
    });
    return { id: ticket.id, uniqueId: ticket.uniqueId };
  });
};

// ═══════════════════════════ Risk ═══════════════════════════

/**
 * Raise a risk from a calibration finding, linked back to the instrument.
 *
 * GAMP 5 / USP <1058> risk-based qualification wants the instrument's risk to be
 * data, not a spreadsheet opinion. Needs a register to exist; without one the
 * caller is told so rather than having a register invented for it.
 */
export const spawnRisk = async (args: {
  title: string;
  description: string;
  instrumentId: string;
  instrumentCode: string;
  siteId: string | null;
  userId?: string;
}): Promise<IntegrationResult<{ id: string; riskNumber: string }>> => {
  const reg = await attempt('Risk module', async () =>
    prisma.riskRegister.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, frameworkId: true },
    }),
  );
  if (!reg.ok) return reg;
  if (!reg.data) return unavailable('No active risk register exists — create one before raising a risk from calibration');

  return attempt('Risk module', async () => {
    const year = new Date().getFullYear();
    const head = `RISK-${year}-`;
    const rows = await prisma.risk.findMany({ where: { riskNumber: { startsWith: head } }, select: { riskNumber: true } });
    const max = rows.reduce((acc, r) => {
      const n = Number(r.riskNumber.slice(head.length));
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    const riskNumber = `${head}${String(max + 1).padStart(4, '0')}`;

    const risk = await prisma.risk.create({
      data: {
        riskNumber,
        registerId: reg.data!.id,
        frameworkId: reg.data!.frameworkId,
        title: args.title,
        description: args.description,
        status: 'IDENTIFIED',
        siteId: args.siteId,
        createdById: args.userId ?? null,
      },
      select: { id: true, riskNumber: true },
    });

    // Link it back so the risk module can render the instrument reference.
    await prisma.riskLink
      .create({
        data: {
          riskId: risk.id,
          entityType: 'CalibrationInstrument',
          entityId: args.instrumentId,
          label: args.instrumentCode,
          relation: 'SOURCE',
          createdById: args.userId ?? null,
        },
      })
      .catch(() => undefined); // a missing link is cosmetic, not a failure

    return risk;
  });
};

// ═══════════════════════════ Capability probe ═══════════════════════════

/**
 * Which integrations are actually usable in this deployment.
 *
 * The UI reads this to hide the buttons it cannot honour, so a standalone
 * install never offers a "Raise CAPA" action that would only ever return a
 * reason string.
 */
export const probeIntegrations = async () => {
  const has = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  };

  const [lims, deviation, capa, risk, lms] = await Promise.all([
    has(() => prisma.equipment.count()),
    prisma.workflowType
      .count({ where: { isDeleted: false, name: { equals: 'Deviation', mode: 'insensitive' } } })
      .then((n) => n > 0)
      .catch(() => false),
    prisma.workflowType
      .count({ where: { isDeleted: false, name: { equals: 'CAPA', mode: 'insensitive' } } })
      .then((n) => n > 0)
      .catch(() => false),
    prisma.riskRegister
      .count({ where: { isActive: true } })
      .then((n) => n > 0)
      .catch(() => false),
    has(() => prisma.lmsCourse.count()),
  ]);

  return {
    lims: { available: lims, label: 'LIMS — result impact scan' },
    deviation: { available: deviation, label: 'Deviation — spawn from out-of-tolerance' },
    capa: { available: capa, label: 'CAPA — spawn from out-of-tolerance' },
    risk: { available: risk, label: 'Risk — raise from calibration finding' },
    lms: { available: lms, label: 'Training — competency gate' },
  };
};
