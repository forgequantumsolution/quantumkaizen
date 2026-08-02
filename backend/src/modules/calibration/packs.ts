/**
 * Industry packs — the multi-industry answer, expressed as data.
 *
 * A pack is a `CalibrationConfig` row plus a set of `EquipmentCategory` rows
 * with their `CalibrationPointTemplate` children. Applying a pack seeds those;
 * every value stays editable afterwards. Nothing in the service layer branches
 * on industry — the config columns are the only switch, which is what lets a
 * chemical or medical-device tenant be a new pack rather than a new sprint.
 *
 * Suggested from `Organization.industry` (already collected), never forced:
 * a pharma group with a captive packaging plant runs different packs per site,
 * which `CalibrationConfig.siteId` handles without a second deployment.
 *
 * See docs/CALIBRATION-module-implementation-plan.md §F.
 */
import type {
  InstrumentKind,
  InstrumentCriticality,
  InUseFrequency,
  IntervalBasis,
  OotWindow,
  ToleranceType,
} from '@prisma/client';

export type PackKey = 'PHARMA' | 'AUTOMOTIVE' | 'FMCG';

export interface PackPointTemplate {
  sequence: number;
  label: string;
  /** Absolute nominal, when the point is a fixed value (a 200 g check weight). */
  nominalValue?: number;
  /** Span-relative nominal, resolved per instrument from its measurement range. */
  nominalPercentOfSpan?: number;
  toleranceType: ToleranceType;
  toleranceValue: number;
}

/** One line of a category's in-use verification checklist. */
export interface PackCheckItem {
  sequence: number;
  label: string;
  checkType: 'NUMERIC' | 'PASS_FAIL';
  nominalValue?: number;
  toleranceValue?: number;
  unitCode?: string;
  isRequired?: boolean;
  guidance?: string;
}

export interface PackCategory {
  code: string;
  name: string;
  kind: InstrumentKind;
  description?: string;
  defaultIntervalDays: number;
  defaultCriticality: InstrumentCriticality;
  defaultToleranceType?: ToleranceType;
  defaultToleranceValue?: number;
  requiresMsa?: boolean;
  requiresInUseCheck?: boolean;
  inUseCheckFrequency?: InUseFrequency;
  points: PackPointTemplate[];
  /** What the shift/daily check actually consists of for this device. */
  checkItems?: PackCheckItem[];
}

export interface PackConfig {
  dueSoonWindowDays: number;
  autoSpawnLeadDays: number;
  graceDays: number;
  allowEarlyCalibration: boolean;
  earlyWindowDays: number;
  intervalResetBasis: IntervalBasis;
  blockUseWhenOverdue: boolean;
  blockUseWhenFailed: boolean;
  requireCompetencyToPerform: boolean;
  requirePerformerSignature: boolean;
  requireReviewerSignature: boolean;
  requireApproverSignature: boolean;
  requireReasonForChange: boolean;
  ootImpactAssessmentRequired: boolean;
  ootImpactWindow: OotWindow;
  ootAutoSpawn: string[];
  ootRequiresCustomerNotification: boolean;
  ootRequiresProductHold: boolean;
  enableMsa: boolean;
  enableInUseChecks: boolean;
  enableLegalMetrology: boolean;
  enableAiqGroups: boolean;
  enableUsageIntervals: boolean;
}

export interface IndustryPack {
  key: PackKey;
  label: string;
  /** Shown in the pack picker so the choice is defensible, not cosmetic. */
  standards: string[];
  summary: string;
  /** `Organization.industry` values that should suggest this pack. */
  suggestedFor: string[];
  config: PackConfig;
  categories: PackCategory[];
}

const ABS: ToleranceType = 'ABSOLUTE';
const PCT_READ: ToleranceType = 'PERCENT_OF_READING';
const PCT_SPAN: ToleranceType = 'PERCENT_OF_SPAN';

// ─────────────────────────────── PHARMA ───────────────────────────────

const PHARMA: IndustryPack = {
  key: 'PHARMA',
  label: 'Pharmaceuticals (GxP)',
  standards: ['21 CFR Part 11', 'EU GMP Annex 11', 'EU GMP Annex 15', 'USP <1058>', 'GAMP 5', 'ICH Q7 §5.3'],
  summary:
    'Three-signature records, mandatory out-of-tolerance impact assessment back to the ' +
    'previous calibration, competency-gated execution, and AIQ group classification.',
  suggestedFor: ['Pharmaceuticals', 'Biotechnology', 'Medical Devices'],
  config: {
    dueSoonWindowDays: 30,
    autoSpawnLeadDays: 21,
    graceDays: 0,
    allowEarlyCalibration: true,
    earlyWindowDays: 15,
    // Anniversary-based, so a late calibration cannot walk the schedule forward.
    intervalResetBasis: 'PREVIOUS_DUE_DATE',
    blockUseWhenOverdue: true,
    blockUseWhenFailed: true,
    requireCompetencyToPerform: true,
    requirePerformerSignature: true,
    requireReviewerSignature: true,
    requireApproverSignature: true,
    requireReasonForChange: true,
    ootImpactAssessmentRequired: true,
    ootImpactWindow: 'SINCE_LAST_CALIBRATION',
    ootAutoSpawn: ['DEVIATION', 'RISK'],
    ootRequiresCustomerNotification: false,
    ootRequiresProductHold: false,
    enableMsa: false,
    enableInUseChecks: true, // daily balance check-weight verification
    enableLegalMetrology: false,
    enableAiqGroups: true,
    enableUsageIntervals: false,
  },
  categories: [
    {
      code: 'BALANCE_ANALYTICAL',
      name: 'Analytical Balance',
      kind: 'LAB_INSTRUMENT',
      description: 'USP <41>/<1251> — daily check-weight verification, periodic calibration with E2 weights.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      defaultToleranceType: PCT_READ,
      defaultToleranceValue: 0.1,
      requiresInUseCheck: true,
      inUseCheckFrequency: 'DAILY',
      checkItems: [
        { sequence: 1, label: 'Level bubble centred', checkType: 'PASS_FAIL', guidance: 'Confirm the spirit level is centred before weighing.' },
        { sequence: 2, label: 'Check weight 10 g', checkType: 'NUMERIC', nominalValue: 10, toleranceValue: 0.01, unitCode: 'g' },
        { sequence: 3, label: 'Check weight 100 g', checkType: 'NUMERIC', nominalValue: 100, toleranceValue: 0.1, unitCode: 'g' },
        { sequence: 4, label: 'Pan clean and draught shield closed', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: '10% of span', nominalPercentOfSpan: 10, toleranceType: PCT_READ, toleranceValue: 0.1 },
        { sequence: 2, label: '50% of span', nominalPercentOfSpan: 50, toleranceType: PCT_READ, toleranceValue: 0.1 },
        { sequence: 3, label: '100% of span', nominalPercentOfSpan: 100, toleranceType: PCT_READ, toleranceValue: 0.1 },
      ],
    },
    {
      code: 'HPLC',
      name: 'HPLC / UPLC System',
      kind: 'LAB_INSTRUMENT',
      description: 'USP <1058> Group C instrument — full OQ point set.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: 'Flow rate accuracy (1.0 mL/min)', nominalValue: 1.0, toleranceType: PCT_READ, toleranceValue: 2 },
        { sequence: 2, label: 'Wavelength accuracy (254 nm)', nominalValue: 254, toleranceType: ABS, toleranceValue: 1 },
        { sequence: 3, label: 'Injector precision (%RSD)', nominalValue: 0, toleranceType: ABS, toleranceValue: 1 },
        { sequence: 4, label: 'Column oven temperature (40 °C)', nominalValue: 40, toleranceType: ABS, toleranceValue: 1 },
      ],
    },
    {
      code: 'PH_METER',
      name: 'pH Meter',
      kind: 'LAB_INSTRUMENT',
      defaultIntervalDays: 90,
      defaultCriticality: 'MAJOR',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'DAILY',
      checkItems: [
        { sequence: 1, label: 'Buffer pH 4.01', checkType: 'NUMERIC', nominalValue: 4.01, toleranceValue: 0.05, unitCode: 'pH' },
        { sequence: 2, label: 'Buffer pH 7.00', checkType: 'NUMERIC', nominalValue: 7.0, toleranceValue: 0.05, unitCode: 'pH' },
        { sequence: 3, label: 'Electrode clean, no visible damage', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Buffer pH 4.01', nominalValue: 4.01, toleranceType: ABS, toleranceValue: 0.05 },
        { sequence: 2, label: 'Buffer pH 7.00', nominalValue: 7.0, toleranceType: ABS, toleranceValue: 0.05 },
        { sequence: 3, label: 'Buffer pH 10.01', nominalValue: 10.01, toleranceType: ABS, toleranceValue: 0.05 },
      ],
    },
    {
      code: 'DISSOLUTION',
      name: 'Dissolution Apparatus',
      kind: 'LAB_INSTRUMENT',
      description: 'USP <711> mechanical qualification.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: 'Paddle speed (50 rpm)', nominalValue: 50, toleranceType: PCT_READ, toleranceValue: 4 },
        { sequence: 2, label: 'Bath temperature (37 °C)', nominalValue: 37, toleranceType: ABS, toleranceValue: 0.5 },
        { sequence: 3, label: 'Shaft wobble (mm)', nominalValue: 0, toleranceType: ABS, toleranceValue: 1 },
        { sequence: 4, label: 'Vessel centering (mm)', nominalValue: 0, toleranceType: ABS, toleranceValue: 2 },
      ],
    },
    {
      code: 'AUTOCLAVE',
      name: 'Autoclave / Steam Sterilizer',
      kind: 'UTILITY',
      description: 'Qualified (IQ/OQ/PQ) rather than calibrated — Annex 15.',
      defaultIntervalDays: 365,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: 'Chamber temperature at 121 °C', nominalValue: 121, toleranceType: ABS, toleranceValue: 1 },
        { sequence: 2, label: 'Chamber pressure (bar)', nominalValue: 1.1, toleranceType: ABS, toleranceValue: 0.1 },
        { sequence: 3, label: 'Cycle hold time (min)', nominalValue: 15, toleranceType: ABS, toleranceValue: 1 },
      ],
    },
    {
      code: 'STABILITY_CHAMBER',
      name: 'Stability Chamber',
      kind: 'UTILITY',
      description: 'ICH Q1A storage conditions — mapping points.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: '25 °C long-term', nominalValue: 25, toleranceType: ABS, toleranceValue: 2 },
        { sequence: 2, label: '60 %RH long-term', nominalValue: 60, toleranceType: ABS, toleranceValue: 5 },
        { sequence: 3, label: '40 °C accelerated', nominalValue: 40, toleranceType: ABS, toleranceValue: 2 },
        { sequence: 4, label: '75 %RH accelerated', nominalValue: 75, toleranceType: ABS, toleranceValue: 5 },
      ],
    },
    {
      code: 'THERMOMETER_LOGGER',
      name: 'Thermometer / Data Logger',
      kind: 'MONITORING_DEVICE',
      description: 'Cold-chain and storage monitoring.',
      defaultIntervalDays: 365,
      defaultCriticality: 'MAJOR',
      points: [
        { sequence: 1, label: '2 °C', nominalValue: 2, toleranceType: ABS, toleranceValue: 0.5 },
        { sequence: 2, label: '8 °C', nominalValue: 8, toleranceType: ABS, toleranceValue: 0.5 },
        { sequence: 3, label: '25 °C', nominalValue: 25, toleranceType: ABS, toleranceValue: 0.5 },
      ],
    },
    {
      code: 'REF_WEIGHT_SET',
      name: 'Reference Weight Set',
      kind: 'REFERENCE_STANDARD',
      description: 'OIML E2/F1 — traceable to NPL / NIST.',
      defaultIntervalDays: 730,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: '1 g', nominalValue: 1, toleranceType: ABS, toleranceValue: 0.00003 },
        { sequence: 2, label: '100 g', nominalValue: 100, toleranceType: ABS, toleranceValue: 0.0005 },
        { sequence: 3, label: '1000 g', nominalValue: 1000, toleranceType: ABS, toleranceValue: 0.0016 },
      ],
    },
  ],
};

// ───────────────────────────── AUTOMOTIVE ─────────────────────────────

const AUTOMOTIVE: IndustryPack = {
  key: 'AUTOMOTIVE',
  label: 'Automotive (IATF 16949)',
  standards: ['IATF 16949 §7.1.5.1', '§7.1.5.2', '§7.1.5.3', 'ISO 9001 §7.1.5', 'AIAG MSA 4th ed.', 'ISO/IEC 17025'],
  summary:
    'MSA / Gage R&R gating, as-received out-of-spec impact assessment, and mandatory ' +
    'customer notification when suspect product has already shipped (§7.1.5.2.1).',
  suggestedFor: ['Automotive', 'Aerospace', 'Electronics', 'Manufacturing'],
  config: {
    dueSoonWindowDays: 30,
    autoSpawnLeadDays: 14,
    graceDays: 0,
    allowEarlyCalibration: true,
    earlyWindowDays: 15,
    intervalResetBasis: 'PREVIOUS_DUE_DATE',
    blockUseWhenOverdue: true,
    blockUseWhenFailed: true,
    requireCompetencyToPerform: true,
    requirePerformerSignature: true,
    requireReviewerSignature: true,
    requireApproverSignature: false,
    requireReasonForChange: true,
    ootImpactAssessmentRequired: true,
    ootImpactWindow: 'SINCE_LAST_CALIBRATION',
    ootAutoSpawn: ['DEVIATION', 'CAPA'],
    // The distinctive IATF obligation — suspect product already shipped.
    ootRequiresCustomerNotification: true,
    ootRequiresProductHold: true,
    enableMsa: true,
    enableInUseChecks: false,
    enableLegalMetrology: false,
    enableAiqGroups: false,
    enableUsageIntervals: false,
  },
  categories: [
    {
      code: 'TORQUE_WRENCH',
      name: 'Torque Wrench',
      kind: 'PRODUCTION_GAUGE',
      description: 'ISO 6789 — three trials per point; MSA required before plan activation.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      defaultToleranceType: PCT_READ,
      defaultToleranceValue: 4,
      requiresMsa: true,
      points: [
        { sequence: 1, label: '20% of range', nominalPercentOfSpan: 20, toleranceType: PCT_READ, toleranceValue: 6 },
        { sequence: 2, label: '60% of range', nominalPercentOfSpan: 60, toleranceType: PCT_READ, toleranceValue: 4 },
        { sequence: 3, label: '100% of range', nominalPercentOfSpan: 100, toleranceType: PCT_READ, toleranceValue: 4 },
      ],
    },
    {
      code: 'CALIPER_MICROMETER',
      name: 'Vernier Caliper / Micrometer',
      kind: 'PRODUCTION_GAUGE',
      description: 'Verified against gauge-block steps across the range.',
      defaultIntervalDays: 365,
      defaultCriticality: 'MAJOR',
      defaultToleranceType: ABS,
      defaultToleranceValue: 0.02,
      requiresMsa: true,
      points: [
        { sequence: 1, label: 'Gauge block 10 mm', nominalValue: 10, toleranceType: ABS, toleranceValue: 0.02 },
        { sequence: 2, label: 'Gauge block 25 mm', nominalValue: 25, toleranceType: ABS, toleranceValue: 0.02 },
        { sequence: 3, label: 'Gauge block 50 mm', nominalValue: 50, toleranceType: ABS, toleranceValue: 0.03 },
        { sequence: 4, label: 'Gauge block 100 mm', nominalValue: 100, toleranceType: ABS, toleranceValue: 0.03 },
      ],
    },
    {
      code: 'DIAL_BORE_GAUGE',
      name: 'Dial Gauge / Bore Gauge',
      kind: 'PRODUCTION_GAUGE',
      defaultIntervalDays: 365,
      defaultCriticality: 'MAJOR',
      requiresMsa: true,
      points: [
        { sequence: 1, label: '25% of range', nominalPercentOfSpan: 25, toleranceType: ABS, toleranceValue: 0.01 },
        { sequence: 2, label: '50% of range', nominalPercentOfSpan: 50, toleranceType: ABS, toleranceValue: 0.01 },
        { sequence: 3, label: '75% of range', nominalPercentOfSpan: 75, toleranceType: ABS, toleranceValue: 0.01 },
        { sequence: 4, label: '100% of range', nominalPercentOfSpan: 100, toleranceType: ABS, toleranceValue: 0.015 },
      ],
    },
    {
      code: 'PLUG_RING_GAUGE',
      name: 'Plug / Ring / Snap Gauge',
      kind: 'PRODUCTION_GAUGE',
      description: 'Go / No-Go wear check — attribute agreement study rather than variable GRR.',
      defaultIntervalDays: 365,
      defaultCriticality: 'MAJOR',
      requiresMsa: true,
      points: [
        { sequence: 1, label: 'GO member wear', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.005 },
        { sequence: 2, label: 'NO-GO member wear', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.005 },
      ],
    },
    {
      code: 'CMM',
      name: 'Coordinate Measuring Machine',
      kind: 'PRODUCTION_GAUGE',
      description: 'ISO 10360 artefact / ball-bar verification.',
      defaultIntervalDays: 365,
      defaultCriticality: 'CRITICAL',
      requiresMsa: true,
      points: [
        { sequence: 1, label: 'Length measurement error E0', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.003 },
        { sequence: 2, label: 'Probing error P', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.002 },
        { sequence: 3, label: 'Ball-bar circularity', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.005 },
      ],
    },
    {
      code: 'PRESSURE_GAUGE',
      name: 'Pressure Gauge',
      kind: 'MONITORING_DEVICE',
      defaultIntervalDays: 365,
      defaultCriticality: 'MAJOR',
      points: [
        { sequence: 1, label: '25% FS', nominalPercentOfSpan: 25, toleranceType: PCT_SPAN, toleranceValue: 1 },
        { sequence: 2, label: '50% FS', nominalPercentOfSpan: 50, toleranceType: PCT_SPAN, toleranceValue: 1 },
        { sequence: 3, label: '75% FS', nominalPercentOfSpan: 75, toleranceType: PCT_SPAN, toleranceValue: 1 },
        { sequence: 4, label: '100% FS', nominalPercentOfSpan: 100, toleranceType: PCT_SPAN, toleranceValue: 1 },
      ],
    },
    {
      code: 'LEAK_TEST',
      name: 'Leak Test Machine',
      kind: 'MONITORING_DEVICE',
      description: 'Verified against a master leak part.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'DAILY',
      checkItems: [
        { sequence: 1, label: 'Master leak part', checkType: 'NUMERIC', nominalValue: 0.5, toleranceValue: 0.05, unitCode: 'cc/min', guidance: 'Run the certified master leak part through a normal cycle.' },
        { sequence: 2, label: 'Zero / blank part', checkType: 'NUMERIC', nominalValue: 0, toleranceValue: 0.05, unitCode: 'cc/min' },
        { sequence: 3, label: 'Machine rejects the master leak part', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Master leak part (cc/min)', nominalValue: 0.5, toleranceType: PCT_READ, toleranceValue: 10 },
        { sequence: 2, label: 'Zero / blank part', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.05 },
      ],
    },
    {
      code: 'GAUGE_BLOCK_SET',
      name: 'Gauge Block Set',
      kind: 'REFERENCE_STANDARD',
      description: 'Grade 0/1 — calibrated by an ISO/IEC 17025 accredited laboratory.',
      defaultIntervalDays: 1095,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: '1.005 mm block', nominalValue: 1.005, toleranceType: ABS, toleranceValue: 0.00012 },
        { sequence: 2, label: '25 mm block', nominalValue: 25, toleranceType: ABS, toleranceValue: 0.0003 },
        { sequence: 3, label: '100 mm block', nominalValue: 100, toleranceType: ABS, toleranceValue: 0.0006 },
      ],
    },
  ],
};

// ──────────────────────────────── FMCG ────────────────────────────────

const FMCG: IndustryPack = {
  key: 'FMCG',
  label: 'FMCG / Food & Beverage',
  standards: ['ISO 22000 §8.7', 'FSSC 22000', 'BRCGS Food §6.3', 'HACCP', 'Legal Metrology'],
  summary:
    'CCP monitoring devices with per-shift in-use verification; a failed check computes ' +
    'the product-hold window back to the last passing check, not to the last calibration.',
  suggestedFor: ['FMCG', 'Food & Beverage', 'Chemical'],
  config: {
    dueSoonWindowDays: 14,
    autoSpawnLeadDays: 7,
    graceDays: 0,
    allowEarlyCalibration: true,
    earlyWindowDays: 7,
    intervalResetBasis: 'PERFORMED_DATE',
    blockUseWhenOverdue: true,
    blockUseWhenFailed: true,
    requireCompetencyToPerform: false,
    requirePerformerSignature: true,
    requireReviewerSignature: false,
    requireApproverSignature: false,
    requireReasonForChange: false,
    ootImpactAssessmentRequired: true,
    // The FMCG difference: the hold window starts at the last PASSING shift
    // check, which is hours ago — not at the last calibration, months ago.
    ootImpactWindow: 'SINCE_LAST_PASSING_CHECK',
    ootAutoSpawn: ['DEVIATION'],
    ootRequiresCustomerNotification: false,
    ootRequiresProductHold: true,
    enableMsa: false,
    enableInUseChecks: true,
    enableLegalMetrology: true,
    enableAiqGroups: false,
    enableUsageIntervals: false,
  },
  categories: [
    {
      code: 'METAL_DETECTOR',
      name: 'Metal Detector',
      kind: 'MONITORING_DEVICE',
      description: 'CCP device — test pieces at leading and trailing edge, every shift.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'PER_SHIFT',
      checkItems: [
        { sequence: 1, label: 'Ferrous test piece detected', checkType: 'PASS_FAIL', guidance: 'Pass the Fe 2.0 mm test piece at the leading edge, then trailing edge.' },
        { sequence: 2, label: 'Non-ferrous test piece detected', checkType: 'PASS_FAIL', guidance: 'Non-Fe 2.5 mm test piece.' },
        { sequence: 3, label: 'Stainless steel test piece detected', checkType: 'PASS_FAIL', guidance: 'SS 3.0 mm test piece — the hardest to detect; run last.' },
        { sequence: 4, label: 'Reject mechanism operated', checkType: 'PASS_FAIL' },
        { sequence: 5, label: 'Belt-stop / alarm on failure to reject', checkType: 'PASS_FAIL' },
        { sequence: 6, label: 'Reject bin secure and locked', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Ferrous test piece (mm)', nominalValue: 2.0, toleranceType: ABS, toleranceValue: 0 },
        { sequence: 2, label: 'Non-ferrous test piece (mm)', nominalValue: 2.5, toleranceType: ABS, toleranceValue: 0 },
        { sequence: 3, label: 'Stainless steel test piece (mm)', nominalValue: 3.0, toleranceType: ABS, toleranceValue: 0 },
        { sequence: 4, label: 'Reject mechanism confirmation', nominalValue: 1, toleranceType: ABS, toleranceValue: 0 },
      ],
    },
    {
      code: 'CHECKWEIGHER',
      name: 'Checkweigher',
      kind: 'MONITORING_DEVICE',
      description: 'CCP device — min/target/max verification per shift.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'PER_SHIFT',
      checkItems: [
        { sequence: 1, label: 'Minimum weight sample', checkType: 'NUMERIC', toleranceValue: 0.5, unitCode: 'g', guidance: 'Use the certified low check weight for this pack format.' },
        { sequence: 2, label: 'Target weight sample', checkType: 'NUMERIC', toleranceValue: 0.5, unitCode: 'g' },
        { sequence: 3, label: 'Maximum weight sample', checkType: 'NUMERIC', toleranceValue: 0.5, unitCode: 'g' },
        { sequence: 4, label: 'Underweight pack rejected', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Minimum weight', nominalPercentOfSpan: 20, toleranceType: PCT_READ, toleranceValue: 0.5 },
        { sequence: 2, label: 'Target weight', nominalPercentOfSpan: 50, toleranceType: PCT_READ, toleranceValue: 0.5 },
        { sequence: 3, label: 'Maximum weight', nominalPercentOfSpan: 100, toleranceType: PCT_READ, toleranceValue: 0.5 },
      ],
    },
    {
      code: 'XRAY_INSPECTION',
      name: 'X-Ray Inspection System',
      kind: 'MONITORING_DEVICE',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'PER_SHIFT',
      checkItems: [
        { sequence: 1, label: 'Glass test card detected', checkType: 'PASS_FAIL', guidance: '2.0 mm glass sphere card.' },
        { sequence: 2, label: 'Stainless steel test card detected', checkType: 'PASS_FAIL', guidance: '1.5 mm SS card.' },
        { sequence: 3, label: 'Reject mechanism operated', checkType: 'PASS_FAIL' },
        { sequence: 4, label: 'Image quality acceptable, no lens fouling', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Test card — glass (mm)', nominalValue: 2.0, toleranceType: ABS, toleranceValue: 0 },
        { sequence: 2, label: 'Test card — stainless steel (mm)', nominalValue: 1.5, toleranceType: ABS, toleranceValue: 0 },
        { sequence: 3, label: 'Reject confirmation', nominalValue: 1, toleranceType: ABS, toleranceValue: 0 },
      ],
    },
    {
      code: 'PLATFORM_SCALE',
      name: 'Platform / Bench Scale',
      kind: 'MONITORING_DEVICE',
      description: 'Legal-metrology stamped; daily verification with certified test weights.',
      defaultIntervalDays: 365,
      defaultCriticality: 'CRITICAL',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'DAILY',
      checkItems: [
        { sequence: 1, label: 'Zero / tare reads 0', checkType: 'NUMERIC', nominalValue: 0, toleranceValue: 0.5, unitCode: 'g' },
        { sequence: 2, label: 'Certified test weight — mid range', checkType: 'NUMERIC', toleranceValue: 2, unitCode: 'g' },
        { sequence: 3, label: 'Certified test weight — near capacity', checkType: 'NUMERIC', toleranceValue: 5, unitCode: 'g' },
        { sequence: 4, label: 'Platform level and free of debris', checkType: 'PASS_FAIL' },
        { sequence: 5, label: 'Legal metrology stamp intact', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: '10% of capacity', nominalPercentOfSpan: 10, toleranceType: PCT_READ, toleranceValue: 0.1 },
        { sequence: 2, label: '50% of capacity', nominalPercentOfSpan: 50, toleranceType: PCT_READ, toleranceValue: 0.1 },
        { sequence: 3, label: '100% of capacity', nominalPercentOfSpan: 100, toleranceType: PCT_READ, toleranceValue: 0.1 },
      ],
    },
    {
      code: 'PROBE_THERMOMETER',
      name: 'Probe Thermometer',
      kind: 'MONITORING_DEVICE',
      description: 'CCP monitoring — ice point and boiling point verification.',
      defaultIntervalDays: 180,
      defaultCriticality: 'CRITICAL',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'DAILY',
      checkItems: [
        { sequence: 1, label: 'Ice point', checkType: 'NUMERIC', nominalValue: 0, toleranceValue: 0.5, unitCode: '°C', guidance: 'Crushed-ice slurry, stirred, probe not touching the vessel.' },
        { sequence: 2, label: 'Boiling point', checkType: 'NUMERIC', nominalValue: 100, toleranceValue: 1, unitCode: '°C', guidance: 'Adjust for altitude if applicable.' },
        { sequence: 3, label: 'Probe undamaged and sanitised', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Ice point 0 °C', nominalValue: 0, toleranceType: ABS, toleranceValue: 0.5 },
        { sequence: 2, label: 'Cook temperature 75 °C', nominalValue: 75, toleranceType: ABS, toleranceValue: 0.5 },
        { sequence: 3, label: 'Boiling point 100 °C', nominalValue: 100, toleranceType: ABS, toleranceValue: 1 },
      ],
    },
    {
      code: 'CHART_RECORDER',
      name: 'Chart Recorder / Data Logger',
      kind: 'MONITORING_DEVICE',
      defaultIntervalDays: 365,
      defaultCriticality: 'MAJOR',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'WEEKLY',
      checkItems: [
        { sequence: 1, label: 'Chill store reading', checkType: 'NUMERIC', nominalValue: 4, toleranceValue: 1, unitCode: '°C' },
        { sequence: 2, label: 'Frozen store reading', checkType: 'NUMERIC', nominalValue: -18, toleranceValue: 1, unitCode: '°C' },
        { sequence: 3, label: 'Chart / log advancing, no gaps', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Chill store 4 °C', nominalValue: 4, toleranceType: ABS, toleranceValue: 1 },
        { sequence: 2, label: 'Frozen store -18 °C', nominalValue: -18, toleranceType: ABS, toleranceValue: 1 },
        { sequence: 3, label: 'Process 75 °C', nominalValue: 75, toleranceType: ABS, toleranceValue: 1 },
      ],
    },
    {
      code: 'PH_BRIX_AW',
      name: 'pH / Brix / Water-Activity Meter',
      kind: 'LAB_INSTRUMENT',
      defaultIntervalDays: 90,
      defaultCriticality: 'MAJOR',
      requiresInUseCheck: true,
      inUseCheckFrequency: 'DAILY',
      checkItems: [
        { sequence: 1, label: 'Buffer pH 4.01', checkType: 'NUMERIC', nominalValue: 4.01, toleranceValue: 0.05, unitCode: 'pH' },
        { sequence: 2, label: 'Buffer pH 7.00', checkType: 'NUMERIC', nominalValue: 7.0, toleranceValue: 0.05, unitCode: 'pH' },
        { sequence: 3, label: 'Brix standard 20 °Bx', checkType: 'NUMERIC', nominalValue: 20, toleranceValue: 0.2, unitCode: '°Bx' },
        { sequence: 4, label: 'Prism / sensor clean', checkType: 'PASS_FAIL' },
      ],
      points: [
        { sequence: 1, label: 'Buffer pH 4.01', nominalValue: 4.01, toleranceType: ABS, toleranceValue: 0.05 },
        { sequence: 2, label: 'Buffer pH 7.00', nominalValue: 7.0, toleranceType: ABS, toleranceValue: 0.05 },
        { sequence: 3, label: 'Brix standard 20 °Bx', nominalValue: 20, toleranceType: ABS, toleranceValue: 0.2 },
      ],
    },
    {
      code: 'TEST_WEIGHTS',
      name: 'Certified Test Weights',
      kind: 'REFERENCE_STANDARD',
      description: 'OIML M1/F2 — traceable to the national standard.',
      defaultIntervalDays: 730,
      defaultCriticality: 'CRITICAL',
      points: [
        { sequence: 1, label: '500 g', nominalValue: 500, toleranceType: ABS, toleranceValue: 0.025 },
        { sequence: 2, label: '2 kg', nominalValue: 2000, toleranceType: ABS, toleranceValue: 0.1 },
        { sequence: 3, label: '20 kg', nominalValue: 20000, toleranceType: ABS, toleranceValue: 1 },
      ],
    },
  ],
};

export const INDUSTRY_PACKS: Record<PackKey, IndustryPack> = {
  PHARMA,
  AUTOMOTIVE,
  FMCG,
};

export const PACK_KEYS = Object.keys(INDUSTRY_PACKS) as PackKey[];

export const isPackKey = (k: string): k is PackKey => (PACK_KEYS as string[]).includes(k);

/** Pack suggested by the tenant's `Organization.industry`, or null. */
export const suggestPack = (industry?: string | null): PackKey | null => {
  if (!industry) return null;
  const hit = PACK_KEYS.find((k) =>
    INDUSTRY_PACKS[k].suggestedFor.some((i) => i.toLowerCase() === industry.toLowerCase()),
  );
  return hit ?? null;
};
