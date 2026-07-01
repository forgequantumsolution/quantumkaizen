// Shapes + parsers for the CAPA's structured JSON fields (rootCauseData,
// effectivenessData). Stored loosely as JSON on the backend, so we normalise
// unknown → typed here and always return a safe default.

export const FISHBONE_CATEGORIES = [
  'Man',
  'Machine',
  'Material',
  'Method',
  'Measurement',
  'Environment',
] as const;

export type FishboneCategory = (typeof FISHBONE_CATEGORIES)[number];

export interface RootCauseData {
  /** Up to five "why" answers, in order. */
  fiveWhys: string[];
  /** Contributing causes grouped by Ishikawa category. */
  fishbone: Record<FishboneCategory, string[]>;
  /** The confirmed root cause conclusion. */
  conclusion: string;
}

export const emptyFishbone = (): Record<FishboneCategory, string[]> =>
  FISHBONE_CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c]: [] as string[] }),
    {} as Record<FishboneCategory, string[]>,
  );

export const parseRootCauseData = (raw: unknown): RootCauseData => {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fishbone = emptyFishbone();
  const fb = d.fishbone as Record<string, unknown> | undefined;
  if (fb && typeof fb === 'object') {
    for (const c of FISHBONE_CATEGORIES) {
      const v = fb[c];
      if (Array.isArray(v)) fishbone[c] = v.filter((x): x is string => typeof x === 'string');
    }
  }
  const fiveWhys = Array.isArray(d.fiveWhys)
    ? (d.fiveWhys as unknown[]).map((x) => (typeof x === 'string' ? x : '')).slice(0, 5)
    : [];
  while (fiveWhys.length < 5) fiveWhys.push('');
  return {
    fiveWhys,
    fishbone,
    conclusion: typeof d.conclusion === 'string' ? d.conclusion : '',
  };
};

export type CheckInDay = 30 | 60 | 90;
export type CheckInStatus = 'pending' | 'pass' | 'fail';

export interface EffectivenessCheckIn {
  day: CheckInDay;
  status: CheckInStatus;
  notes: string;
}

export interface EffectivenessData {
  checkIns: EffectivenessCheckIn[];
}

export const DEFAULT_CHECKIN_DAYS: CheckInDay[] = [30, 60, 90];

export const parseEffectivenessData = (raw: unknown): EffectivenessData => {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const byDay = new Map<CheckInDay, EffectivenessCheckIn>();
  if (Array.isArray(d.checkIns)) {
    for (const item of d.checkIns as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const day = Number(o.day) as CheckInDay;
      if (!DEFAULT_CHECKIN_DAYS.includes(day)) continue;
      const status = (['pending', 'pass', 'fail'] as const).includes(o.status as CheckInStatus)
        ? (o.status as CheckInStatus)
        : 'pending';
      byDay.set(day, { day, status, notes: typeof o.notes === 'string' ? o.notes : '' });
    }
  }
  return {
    checkIns: DEFAULT_CHECKIN_DAYS.map(
      (day) => byDay.get(day) ?? { day, status: 'pending', notes: '' },
    ),
  };
};
