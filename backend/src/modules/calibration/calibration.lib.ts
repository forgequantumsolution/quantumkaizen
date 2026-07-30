/**
 * Calibration shared kernel — the rules every service in this module obeys.
 *
 * Kept in one file because these are the decisions that must never diverge:
 * how a tolerance becomes limits, how a reading becomes a verdict, how a due
 * date advances, and which config governs a given instrument. A second copy of
 * any of them is a second answer to a regulated question.
 */
import { Prisma } from '@prisma/client';
import type {
  CalibrationConfig,
  CalibrationOutcome,
  CalibrationStatus,
  IntervalType,
  ToleranceType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';

// ─────────────────────────── Decimal helpers ───────────────────────────

/** Prisma Decimal | number | null → number | null, without lying about zero. */
export const num = (v: Prisma.Decimal | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  return typeof v === 'number' ? v : Number(v);
};

export const dec = (v: number | null | undefined): Prisma.Decimal | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : new Prisma.Decimal(v);

/** Rounds float noise out of derived metrology values (1e-10 artefacts). */
const tidy = (v: number): number => Number(v.toFixed(9));

// ─────────────────────────── Tolerance evaluation ───────────────────────────

export interface ToleranceInput {
  nominalValue: number;
  toleranceType: ToleranceType;
  toleranceValue: number;
  /** Instrument span, required for PERCENT_OF_SPAN. */
  spanMin?: number | null;
  spanMax?: number | null;
  /** Instrument MPE, required for MPE_MULTIPLE. */
  mpe?: number | null;
}

export interface Limits {
  lowerLimit: number;
  upperLimit: number;
  /** The ± half-width actually applied, kept for reporting. */
  halfWidth: number;
}

/**
 * Turn a tolerance declaration into concrete limits.
 *
 * PERCENT_OF_READING is evaluated against the NOMINAL, not the observed value —
 * a tolerance band that moves with the measurement is not a tolerance band, and
 * would let a badly drifted instrument pass by widening its own goalposts.
 */
export const computeLimits = (t: ToleranceInput): Limits => {
  const { nominalValue, toleranceType, toleranceValue } = t;
  let halfWidth: number;

  switch (toleranceType) {
    case 'ABSOLUTE':
      halfWidth = Math.abs(toleranceValue);
      break;
    case 'PERCENT_OF_READING':
      halfWidth = Math.abs((nominalValue * toleranceValue) / 100);
      break;
    case 'PERCENT_OF_SPAN': {
      const lo = t.spanMin ?? 0;
      const hi = t.spanMax ?? 0;
      const span = Math.abs(hi - lo);
      // No declared span → fall back to the nominal so the point is still
      // evaluable rather than silently unbounded (an unbounded point always
      // passes, which is the worst possible failure mode here).
      const basis = span > 0 ? span : Math.abs(nominalValue);
      halfWidth = Math.abs((basis * toleranceValue) / 100);
      break;
    }
    case 'MPE_MULTIPLE': {
      const mpe = t.mpe ?? 0;
      halfWidth = Math.abs(mpe * toleranceValue);
      break;
    }
    default:
      halfWidth = Math.abs(toleranceValue);
  }

  return {
    halfWidth: tidy(halfWidth),
    lowerLimit: tidy(nominalValue - halfWidth),
    upperLimit: tidy(nominalValue + halfWidth),
  };
};

export interface ReadingVerdict {
  error: number;
  inTolerance: boolean;
}

/** error = observed − nominal; in-tolerance is inclusive of the limits. */
export const evaluateReading = (
  observed: number,
  nominal: number,
  lowerLimit: number,
  upperLimit: number,
): ReadingVerdict => ({
  error: tidy(observed - nominal),
  inTolerance: observed >= lowerLimit && observed <= upperLimit,
});

/**
 * Roll per-point verdicts into an event outcome.
 *
 * `null` when nothing was recorded — an event with no readings has no outcome,
 * and inventing PASS for it is exactly the shortcut this module exists to stop.
 */
export const rollUpOutcome = (verdicts: (boolean | null)[]): CalibrationOutcome | null => {
  const known = verdicts.filter((v): v is boolean => v !== null);
  if (known.length === 0) return null;
  return known.every(Boolean) ? 'PASS' : 'FAIL';
};

/**
 * Overall outcome from the two passes.
 *
 * as-found FAIL + as-left PASS is CONDITIONAL, not PASS: the instrument is fine
 * now, but the period behind it is under suspicion and an OOT assessment is owed.
 */
export const deriveOverall = (
  asFound: CalibrationOutcome | null,
  asLeft: CalibrationOutcome | null,
): CalibrationOutcome | null => {
  if (!asFound && !asLeft) return null;
  const effective = asLeft ?? asFound;
  if (effective === 'FAIL') return 'FAIL';
  if (asFound === 'FAIL' && effective === 'PASS') return 'CONDITIONAL';
  return effective;
};

/** An as-found failure is what triggers the retrospective impact question. */
export const requiresOot = (asFound: CalibrationOutcome | null, overall: CalibrationOutcome | null): boolean =>
  asFound === 'FAIL' || overall === 'FAIL' || overall === 'CONDITIONAL';

// ─────────────────────────── Interval arithmetic ───────────────────────────

export const addDays = (d: Date, days: number): Date => {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
};

export const addMonths = (d: Date, months: number): Date => {
  const out = new Date(d);
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  // Clamp Jan-31 + 1 month to Feb-28/29 rather than rolling into March.
  if (out.getDate() < day) out.setDate(0);
  return out;
};

export interface NextDueInput {
  intervalType: IntervalType;
  intervalValue: number;
  performedAt: Date;
  /** The due date this calibration was answering, when there was one. */
  previousDueAt?: Date | null;
  basis: CalibrationConfig['intervalResetBasis'];
  /** Multiplier from the risk profile, for RISK_MODULATED plans. 1 = unchanged. */
  riskMultiplier?: number;
}

/**
 * Next due date.
 *
 * PREVIOUS_DUE_DATE anchors to the date the calibration was owed, so four days
 * late does not push every future date four days out (interval creep — the drift
 * that turns a 6-month interval into a 7-month one over a few years).
 */
export const computeNextDue = (i: NextDueInput): Date => {
  const anchor =
    i.basis === 'PREVIOUS_DUE_DATE' && i.previousDueAt ? new Date(i.previousDueAt) : new Date(i.performedAt);

  const mult = i.riskMultiplier && i.riskMultiplier > 0 ? i.riskMultiplier : 1;

  switch (i.intervalType) {
    case 'MONTHS':
      return addMonths(anchor, Math.max(1, Math.round(i.intervalValue * mult)));
    case 'DAYS':
      return addDays(anchor, Math.max(1, Math.round(i.intervalValue * mult)));
    // Usage-based intervals have no calendar answer until a meter reading
    // exists; fall back to the value as days so the instrument still surfaces.
    case 'USAGE_HOURS':
    case 'USAGE_CYCLES':
      return addDays(anchor, Math.max(1, Math.round(i.intervalValue * mult)));
    case 'RISK_MODULATED':
      return addMonths(anchor, Math.max(1, Math.round(i.intervalValue * mult)));
    default:
      return addMonths(anchor, Math.max(1, i.intervalValue));
  }
};

// ─────────────────────────── Status derivation ───────────────────────────

export interface StatusInput {
  isCalibrationRequired: boolean;
  instrumentStatus: 'ACTIVE' | 'OUT_OF_SERVICE' | 'RETIRED';
  current: CalibrationStatus;
  nextDueAt: Date | null;
  dueSoonWindowDays: number;
  graceDays: number;
  now?: Date;
}

/**
 * The single derivation of `Equipment.calibrationStatus`.
 *
 * Terminal states (UNDER_CALIBRATION, OUT_OF_SERVICE, LIMITED_USE) are owned by
 * the event lifecycle and are never overwritten by the clock — an instrument
 * sitting with the agency must not flip to OVERDUE and then back again.
 */
export const deriveCalibrationStatus = (i: StatusInput): CalibrationStatus => {
  const now = i.now ?? new Date();
  if (!i.isCalibrationRequired) return 'NOT_REQUIRED';
  if (i.instrumentStatus === 'OUT_OF_SERVICE') return 'OUT_OF_SERVICE';
  if (i.current === 'UNDER_CALIBRATION' || i.current === 'OUT_OF_SERVICE' || i.current === 'LIMITED_USE') {
    return i.current;
  }
  if (!i.nextDueAt) return 'CALIBRATED';

  const overdueAt = addDays(i.nextDueAt, i.graceDays);
  if (now > overdueAt) return 'OVERDUE';

  const dueSoonAt = addDays(i.nextDueAt, -i.dueSoonWindowDays);
  if (now >= dueSoonAt) return 'DUE_SOON';
  return 'CALIBRATED';
};

/** Statuses that block an instrument from being used to produce data. */
export const BLOCKING_STATUSES: CalibrationStatus[] = ['OVERDUE', 'OUT_OF_SERVICE'];

export const isBlocked = (status: CalibrationStatus, cfg: Pick<CalibrationConfig, 'blockUseWhenOverdue' | 'blockUseWhenFailed'>): boolean => {
  if (status === 'OVERDUE') return cfg.blockUseWhenOverdue;
  if (status === 'OUT_OF_SERVICE') return cfg.blockUseWhenFailed;
  return false;
};

// ─────────────────────────── Config resolution ───────────────────────────

/** Column defaults, used when a tenant has not configured anything yet. */
export const DEFAULT_CONFIG = {
  id: 'default',
  siteId: null,
  industryPack: 'CUSTOM',
  eventNumberPrefix: 'CAL',
  certificateNumberPrefix: 'CC',
  dueSoonWindowDays: 30,
  autoSpawnLeadDays: 14,
  graceDays: 0,
  allowEarlyCalibration: true,
  earlyWindowDays: 15,
  intervalResetBasis: 'PERFORMED_DATE',
  blockUseWhenOverdue: true,
  blockUseWhenFailed: true,
  requireCompetencyToPerform: false,
  requirePerformerSignature: true,
  requireReviewerSignature: true,
  requireApproverSignature: true,
  requireReasonForChange: true,
  ootImpactAssessmentRequired: true,
  ootImpactWindow: 'SINCE_LAST_CALIBRATION',
  ootAutoSpawn: ['DEVIATION'],
  ootRequiresCustomerNotification: false,
  ootRequiresProductHold: false,
  enableMsa: false,
  enableInUseChecks: false,
  enableLegalMetrology: false,
  enableAiqGroups: false,
  enableUsageIntervals: false,
  labelTemplate: null,
  certificateTemplate: null,
  createdById: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies CalibrationConfig;

/**
 * Config governing a site: the site's own row, else the org-wide row
 * (siteId = null), else column defaults. Never throws — a missing config must
 * degrade to sane behaviour, not a 500 on the instrument list.
 */
export const resolveConfig = async (siteId?: string | null): Promise<CalibrationConfig> => {
  if (siteId) {
    const own = await prisma.calibrationConfig.findUnique({ where: { siteId } });
    if (own) return own;
  }
  const global = await prisma.calibrationConfig.findFirst({ where: { siteId: null } });
  return global ?? DEFAULT_CONFIG;
};

/**
 * Interactive-transaction options.
 *
 * Prisma's 5s default is not enough against a remote database once the audit
 * interceptor's own writes are counted. Matches the convention already used by
 * the workflow orchestrator and SLA service.
 */
export const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

// ─────────────────────────── Numbering ───────────────────────────

/**
 * `<PREFIX>-<YYYY>-<00001>`, scoped to the calendar year.
 *
 * Derived from the max existing suffix rather than a count, so a soft-deleted or
 * cancelled record can never hand its number to a second event.
 */
export const nextSequentialNo = async (
  table: 'calibrationEvent' | 'msaStudy',
  prefix: string,
  year = new Date().getFullYear(),
): Promise<string> => {
  const head = `${prefix}-${year}-`;
  const rows =
    table === 'calibrationEvent'
      ? await prisma.calibrationEvent.findMany({
          where: { eventNo: { startsWith: head } },
          select: { eventNo: true },
        })
      : await prisma.msaStudy.findMany({
          where: { studyNo: { startsWith: head } },
          select: { studyNo: true },
        });

  const max = rows.reduce((acc, r) => {
    const raw = 'eventNo' in r ? r.eventNo : r.studyNo;
    const n = Number(raw.slice(head.length));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);

  return `${head}${String(max + 1).padStart(5, '0')}`;
};

/**
 * `INS-####` — the module's own instrument sequence.
 *
 * Deliberately not continuing LIMS's `EQP-` series: these are different
 * registries, and sharing a numbering space would imply a relationship that
 * does not exist.
 */
export const nextInstrumentCode = async (): Promise<string> => {
  const rows = await prisma.calibrationInstrument.findMany({
    where: { code: { startsWith: 'INS-' } },
    select: { code: true },
  });
  const max = rows.reduce((acc, r) => {
    const n = Number(r.code.slice(4));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `INS-${String(max + 1).padStart(4, '0')}`;
};

/** Opaque, URL-safe token behind the instrument's scannable label. */
export const makeQrToken = (): string => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 22; i += 1) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
};

// ─────────────────────────── Serialization helpers ───────────────────────────

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** Whole days from now until `d`; negative when past. Null-safe. */
export const daysUntil = (d: Date | null | undefined, now = new Date()): number | null => {
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
};
