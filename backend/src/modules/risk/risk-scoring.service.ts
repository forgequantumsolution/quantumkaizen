/**
 * Risk scoring engine — the single place a risk score is ever produced.
 *
 * Deliberately pure and DB-free: it takes a framework definition plus a map of
 * factor ranks and returns the score and the resolved level. That keeps it unit
 * testable without a database and guarantees the same numbers are produced by
 * the API, by background sweeps and by any future import path.
 *
 * The engine is standard-agnostic. ICH Q9, ISO 14971, ISO 31000 and AIAG-VDA
 * differ only in the framework rows fed to it. See
 * docs/RISK-MANAGEMENT-implementation-plan.md.
 */
import { BadRequest } from '../../lib/httpError';

export type FactorValues = Record<string, number>;

export interface ScoringFactor {
  key: string;
  weight: number;
  levels: { rank: number }[];
}

export interface ScoringLevel {
  id: string;
  code: string;
  label: string;
  color: string;
  order: number;
  minScore: number | null;
  maxScore: number | null;
  acceptance: string;
  requiresCapa: boolean;
  requiresApproval: boolean;
  requiresControl: boolean;
  reviewMonths: number | null;
}

export interface ScoringMatrixCell {
  rowFactorKey: string;
  rowRank: number;
  colFactorKey: string;
  colRank: number;
  score: number | null;
  levelId: string;
}

export interface ScoringFramework {
  id: string;
  name: string;
  formula: string;
  factors: ScoringFactor[];
  levels: ScoringLevel[];
  matrixCells: ScoringMatrixCell[];
}

export interface ScoreResult {
  score: number;
  factors: FactorValues;
  level: ScoringLevel;
  actionPriority: 'H' | 'M' | 'L' | null;
}

/**
 * AIAG-VDA action priority — the RPN-free replacement used by modern FMEA.
 * Severity dominates, then occurrence, then detection. Reproduces the published
 * table's intent without encoding all 1000 rows: it is a banded approximation
 * that is monotonic in all three inputs, which is the property that matters.
 */
const actionPriorityFor = (s: number, o: number, d: number, max: number): 'H' | 'M' | 'L' => {
  // Normalise onto 1..10 so a 5-point scale and a 10-point scale agree.
  const n = (v: number) => (max === 10 ? v : ((v - 1) / (max - 1)) * 9 + 1);
  const sn = n(s);
  const on = n(o);
  const dn = n(d);
  if (sn >= 9 && on >= 4) return 'H';
  if (sn >= 9 && on >= 2 && dn >= 5) return 'H';
  if (sn >= 7 && on >= 6) return 'H';
  if (sn >= 7 && on >= 4 && dn >= 6) return 'H';
  if (sn >= 5 && on >= 7 && dn >= 7) return 'H';
  if (sn >= 9) return 'M';
  if (sn >= 7 && on >= 2) return 'M';
  if (sn >= 4 && on >= 5) return 'M';
  if (sn >= 4 && on >= 3 && dn >= 6) return 'M';
  if (on >= 8 && dn >= 8) return 'M';
  return 'L';
};

/** Highest rank available on any factor — used to normalise mixed-length scales. */
const maxRankOf = (factor: ScoringFactor): number =>
  factor.levels.reduce((m, l) => (l.rank > m ? l.rank : m), 1);

/**
 * Validate that every factor the framework declares has a value, and that each
 * value is an actual defined rank on that factor's scale. A rank that is not on
 * the scale is a client bug, not a roundable input — reject it.
 */
const readFactors = (framework: ScoringFramework, input: FactorValues): FactorValues => {
  if (framework.factors.length === 0) {
    throw BadRequest(`Risk framework "${framework.name}" has no scoring factors configured`);
  }
  const out: FactorValues = {};
  for (const factor of framework.factors) {
    const raw = input[factor.key];
    if (raw === undefined || raw === null) {
      throw BadRequest(`Missing value for risk factor "${factor.key}"`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw BadRequest(`Risk factor "${factor.key}" must be a number`);
    }
    if (!factor.levels.some((l) => l.rank === value)) {
      const allowed = factor.levels.map((l) => l.rank).sort((a, b) => a - b).join(', ');
      throw BadRequest(`Value ${value} is not a defined rank for factor "${factor.key}" (allowed: ${allowed})`);
    }
    out[factor.key] = value;
  }
  return out;
};

/**
 * Resolve a numeric score into a level band.
 *
 * An unmapped score throws rather than returning null: a risk that cannot be
 * classified is a framework configuration defect and must surface at save time,
 * not silently persist as an unclassified row that no heat map will ever show.
 */
const levelForScore = (framework: ScoringFramework, score: number): ScoringLevel => {
  const match = framework.levels.find((l) => {
    const aboveMin = l.minScore === null || score >= l.minScore;
    const belowMax = l.maxScore === null || score <= l.maxScore;
    return aboveMin && belowMax;
  });
  if (!match) {
    throw BadRequest(
      `Score ${score} does not fall into any risk level band of framework "${framework.name}". ` +
        'Check the level minScore/maxScore configuration.',
    );
  }
  return match;
};

export const computeScore = (framework: ScoringFramework, input: FactorValues): ScoreResult => {
  const factors = readFactors(framework, input);

  let score: number;
  let level: ScoringLevel;

  if (framework.formula === 'MATRIX_LOOKUP') {
    // Explicit cell mapping — requires exactly two axes to index the grid.
    if (framework.factors.length < 2) {
      throw BadRequest('MATRIX_LOOKUP frameworks need at least two factors');
    }
    const [row, col] = framework.factors;
    const cell = framework.matrixCells.find(
      (c) =>
        c.rowFactorKey === row.key &&
        c.rowRank === factors[row.key] &&
        c.colFactorKey === col.key &&
        c.colRank === factors[col.key],
    );
    if (!cell) {
      throw BadRequest(
        `No matrix cell defined for ${row.key}=${factors[row.key]}, ${col.key}=${factors[col.key]}`,
      );
    }
    const found = framework.levels.find((l) => l.id === cell.levelId);
    if (!found) throw BadRequest('Matrix cell points at a level that no longer exists');
    level = found;
    score = cell.score ?? factors[row.key] * factors[col.key];
  } else {
    switch (framework.formula) {
      case 'SUM':
        score = framework.factors.reduce((acc, f) => acc + factors[f.key], 0);
        break;
      case 'WEIGHTED_PRODUCT':
        score = Math.round(
          framework.factors.reduce((acc, f) => acc * Math.pow(factors[f.key], f.weight), 1),
        );
        break;
      // ACTION_PRIORITY still carries an RPN alongside the H/M/L verdict so the
      // register stays sortable and the heat map still has a number to bucket.
      case 'ACTION_PRIORITY':
      case 'PRODUCT':
      default:
        score = framework.factors.reduce((acc, f) => acc * factors[f.key], 1);
        break;
    }
    level = levelForScore(framework, score);
  }

  let actionPriority: 'H' | 'M' | 'L' | null = null;
  if (framework.formula === 'ACTION_PRIORITY') {
    const sev = framework.factors.find((f) => f.key === 'S');
    const occ = framework.factors.find((f) => f.key === 'O');
    const det = framework.factors.find((f) => f.key === 'D');
    if (!sev || !occ || !det) {
      throw BadRequest('ACTION_PRIORITY frameworks require factors keyed S, O and D');
    }
    actionPriority = actionPriorityFor(
      factors.S,
      factors.O,
      factors.D,
      Math.max(maxRankOf(sev), maxRankOf(occ), maxRankOf(det)),
    );
  }

  return { score, factors, level, actionPriority };
};

/** Review due date implied by the level's cadence, or null when it sets none. */
export const nextReviewDateFor = (level: ScoringLevel, from = new Date()): Date | null => {
  if (!level.reviewMonths || level.reviewMonths <= 0) return null;
  const due = new Date(from);
  due.setMonth(due.getMonth() + level.reviewMonths);
  return due;
};
