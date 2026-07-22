/**
 * Risk Management demo / sample data.
 *
 * Fills the Risk module with content a QA professional would recognise: three
 * registers with genuinely different scopes, sixteen realistic pharma risks
 * (sterility assurance, cross-contamination, ALCOA+, cold chain, supplier
 * variability, calibration drift, software validation), the score snapshots
 * behind them, two assessments (one 5x5 matrix, one AIAG-VDA pFMEA worksheet),
 * risk controls, periodic reviews and a starter hazard / control library.
 *
 *   npm run db:seed:risk-data      (from the backend workspace)
 *
 * Prerequisite: the master seed (`npm run db:seed:risk`) must have run — this
 * script resolves frameworks and categories by code and refuses to run without
 * them.
 *
 * Idempotent: every row is found-or-updated by its human-readable number, code
 * or (register, title) pair, so re-running never duplicates. Score snapshots
 * are rewritten from scratch for each demo risk so the history stays exactly as
 * described here rather than growing on every run.
 *
 * Every score in this file is produced by `computeScore()` from the real
 * scoring engine against the framework as loaded from the database — no score
 * or level id is hard-coded, which is the same invariant the API enforces.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import type {
  RiskStatus,
  RiskTreatment,
  RiskControlType,
  RiskControlHierarchy,
  RiskControlStatus,
  RiskReviewOutcome,
  RiskRegisterScope,
} from '@prisma/client';
import { computeScore, nextReviewDateFor } from '../src/modules/risk/risk-scoring.service';
import type { FactorValues, ScoringFramework, ScoreResult } from '../src/modules/risk/risk-scoring.service';

const prisma = new PrismaClient();

const DAY = 86_400_000;

/** A date `n` months before now, so the trend chart spans ~18 months. */
const monthsAgo = (n: number, dayOfMonth = 12): Date => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(dayOfMonth);
  return d;
};

const daysFrom = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY);
const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY);

// ── Numbering ───────────────────────────────────────────────────────────────
// Copied verbatim from src/modules/risk/risk.service.ts (module-private there)
// so demo rows are numbered exactly the way the API numbers them.

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

// ── Counters ────────────────────────────────────────────────────────────────

const stats = {
  registers: { created: 0, updated: 0 },
  risks: { created: 0, updated: 0 },
  snapshots: { created: 0 },
  assessments: { created: 0, updated: 0 },
  lines: { created: 0, updated: 0 },
  controls: { created: 0, updated: 0 },
  reviews: { created: 0, updated: 0 },
  hazards: { created: 0, updated: 0 },
  controlLibrary: { created: 0, updated: 0 },
};

// ── Framework loading (mirrors risk-framework.service.toScoringFramework) ────

const frameworkInclude = {
  factors: { include: { levels: { orderBy: { rank: 'asc' } } }, orderBy: { order: 'asc' } },
  levels: { orderBy: { order: 'asc' } },
  matrixCells: true,
} satisfies Prisma.RiskFrameworkInclude;

type FrameworkRow = Prisma.RiskFrameworkGetPayload<{ include: typeof frameworkInclude }>;

interface LoadedFramework {
  row: FrameworkRow;
  scoring: ScoringFramework;
}

const toScoring = (f: FrameworkRow): ScoringFramework => ({
  id: f.id,
  name: f.name,
  formula: f.formula,
  factors: f.factors.map((factor) => ({
    key: factor.key,
    weight: factor.weight,
    levels: factor.levels.map((l) => ({ rank: l.rank })),
  })),
  levels: f.levels.map((l) => ({
    id: l.id,
    code: l.code,
    label: l.label,
    color: l.color,
    order: l.order,
    minScore: l.minScore,
    maxScore: l.maxScore,
    acceptance: l.acceptance,
    requiresCapa: l.requiresCapa,
    requiresApproval: l.requiresApproval,
    requiresControl: l.requiresControl,
    reviewMonths: l.reviewMonths,
  })),
  matrixCells: f.matrixCells.map((c) => ({
    rowFactorKey: c.rowFactorKey,
    rowRank: c.rowRank,
    colFactorKey: c.colFactorKey,
    colRank: c.colRank,
    score: c.score,
    levelId: c.levelId,
  })),
});

const loadFramework = async (code: string): Promise<LoadedFramework | null> => {
  const row = await prisma.riskFramework.findUnique({ where: { code }, include: frameworkInclude });
  if (!row) return null;
  return { row, scoring: toScoring(row) };
};

// ── Demo content ────────────────────────────────────────────────────────────

type RegisterKey = 'STERILE' | 'SUPPLIER' | 'FMEA';

interface RegisterSeed {
  key: RegisterKey;
  name: string;
  description: string;
  scope: RiskRegisterScope;
  frameworkCode: 'ICH_Q9_5X5' | 'AIAG_VDA_FMEA';
  scopeRef: Record<string, string>;
}

const REGISTERS: RegisterSeed[] = [
  {
    key: 'STERILE',
    name: 'Sterile Filling Line 3 - Process QRM',
    description:
      'Quality risk management file for the aseptic filling process on Line 3 (RABS, 2-8 °C liquid vials). ' +
      'Covers sterility assurance, container closure integrity, environmental control and operator intervention risk.',
    scope: 'PROCESS',
    frameworkCode: 'ICH_Q9_5X5',
    scopeRef: { entityType: 'Process', entityId: 'FILL-LINE-03', label: 'Aseptic Filling Line 3' },
  },
  {
    key: 'SUPPLIER',
    name: 'Contract Manufacturer - Supplier Risk',
    description:
      'Supplier and outsourced-activity risk register for the contract manufacturing organisation performing ' +
      'secondary packaging and EU distribution, maintained under the quality agreement and Chapter 7 of EU GMP.',
    scope: 'SUPPLIER',
    frameworkCode: 'ICH_Q9_5X5',
    scopeRef: { entityType: 'Supplier', entityId: 'CMO-NORDIC-01', label: 'Nordic Contract Manufacturing A/S' },
  },
  {
    key: 'FMEA',
    name: 'Filling Line pFMEA',
    description:
      'Process FMEA of the vial filling, stoppering and capping train scored on AIAG-VDA 10-point S/O/D scales, ' +
      'producing both an RPN for sorting and an Action Priority for deciding what to act on.',
    scope: 'PROCESS',
    frameworkCode: 'AIAG_VDA_FMEA',
    scopeRef: { entityType: 'Process', entityId: 'FILL-LINE-03-PFMEA', label: 'Filling / Stoppering / Capping Train' },
  },
];

interface RiskSeed {
  key: string;
  register: RegisterKey;
  categoryCode: string;
  title: string;
  description: string;
  cause: string;
  consequence: string;
  hazard: string;
  status: RiskStatus;
  treatment: RiskTreatment | null;
  monthsAgo: number;
  initial: FactorValues;
  residual?: FactorValues;
  residualAfterDays?: number;
  initialReason: string;
  residualReason?: string;
}

// Statuses are deliberately consistent with the scores: RESIDUAL_ASSESSED,
// ACCEPTED and MONITORED only ever appear on a risk that has a residual score.
const RISKS: RiskSeed[] = [
  // ── Sterile Filling Line 3 (ICH Q9 5x5: S x P) ────────────────────────────
  {
    key: 'STERILITY-AIRFLOW',
    register: 'STERILE',
    categoryCode: 'PATIENT_SAFETY',
    title: 'Loss of sterility assurance from unidirectional airflow disruption during open interventions',
    description:
      'Open-door and gloveport interventions at the filling nozzles disturb the Grade A unidirectional airflow over ' +
      'exposed product-contact surfaces and open vials, allowing viable particulate ingress from the operator or the ' +
      'surrounding Grade B environment.',
    hazard: 'Microbial contamination of the sterile product',
    cause:
      'Non-routine interventions (nozzle adjustment, stopper bowl clearance) performed with insufficient smoke-study ' +
      'justification and inconsistent operator positioning relative to first air.',
    consequence:
      'Non-sterile unit released to market; potential for serious patient harm and Class I recall of the affected lots.',
    status: 'MONITORED',
    treatment: 'REDUCE',
    monthsAgo: 17,
    initial: { S: 5, P: 3 },
    residual: { S: 5, P: 2 },
    residualAfterDays: 165,
    initialReason: 'Initial assessment at QRM kick-off — smoke study showed airflow disruption at two intervention points.',
    residualReason:
      'Rescored after nozzle-guard redesign, revised intervention SOP and requalified smoke studies for all routine interventions.',
  },
  {
    key: 'CROSS-CONTAM-TUBING',
    register: 'STERILE',
    categoryCode: 'PRODUCT_QUALITY',
    title: 'Cross-contamination from shared product-contact tubing between campaign changeovers',
    description:
      'Silicone product-contact tubing and the filling manifold are shared across two products on the same line. ' +
      'Residue carry-over is controlled only by a cleaning procedure whose worst-case soil has not been revalidated ' +
      'since the second product was introduced.',
    hazard: 'Carry-over of the previous product into the following batch',
    cause: 'Cleaning validation worst-case matrix not updated after product introduction; visual inspection used as the sole release criterion for tubing.',
    consequence: 'Adulterated batch, potential patient exposure to an unlabelled active, batch rejection and a regulatory observation.',
    status: 'RESIDUAL_ASSESSED',
    treatment: 'REDUCE',
    monthsAgo: 15,
    initial: { S: 4, P: 3 },
    residual: { S: 4, P: 2 },
    residualAfterDays: 150,
    initialReason: 'Initial scoring during changeover risk assessment — no swab data for the new product residue.',
    residualReason: 'Rescored after moving to single-use, product-dedicated tubing sets and adding a swab-based cleaning verification.',
  },
  {
    key: 'EM-EXCURSION',
    register: 'STERILE',
    categoryCode: 'REGULATORY',
    title: 'Environmental monitoring excursion in the Grade B corridor not investigated within the required interval',
    description:
      'Grade B settle-plate and active-air excursions are trended manually. Several excursions in the last 12 months ' +
      'were opened as deviations more than five working days after the plate read, so adverse trends were not acted on ' +
      'while the affected batches were still in process.',
    hazard: 'Delayed detection of an adverse environmental trend',
    cause: 'Manual transcription of plate counts into a spreadsheet; no automated alert when an action limit is exceeded.',
    consequence: 'Batches disposed before the trend is understood; inspection finding against EU GMP Annex 1 §9.',
    status: 'TREATMENT_IN_PROGRESS',
    treatment: 'REDUCE',
    monthsAgo: 11,
    initial: { S: 3, P: 4 },
    initialReason: 'Initial scoring from the Annex 1 gap assessment — four late investigations in the trailing 12 months.',
  },
  {
    key: 'ASEPTIC-TECHNIQUE',
    register: 'STERILE',
    categoryCode: 'PATIENT_SAFETY',
    title: 'Degradation of operator aseptic technique between annual requalification cycles',
    description:
      'Operators are qualified by media fill and gowning qualification annually. Between cycles the only control is ' +
      'supervisory observation, which is not documented against defined aseptic behaviours.',
    hazard: 'Operator-borne microbial contamination',
    cause: 'Twelve-month requalification interval with no interim, objective observation of aseptic behaviours.',
    consequence: 'Contaminated unit reaching the patient; media fill failure and line shutdown.',
    status: 'ACCEPTED',
    treatment: 'REDUCE',
    monthsAgo: 14,
    initial: { S: 4, P: 3 },
    residual: { S: 4, P: 2 },
    residualAfterDays: 140,
    initialReason: 'Initial scoring during the aseptic process simulation risk review.',
    residualReason:
      'Rescored after introducing quarterly documented aseptic behaviour observations and continuous viable monitoring at the critical zone.',
  },
  {
    key: 'CCI-STOPPER',
    register: 'STERILE',
    categoryCode: 'PRODUCT_QUALITY',
    title: 'Container closure integrity failure from partially seated stoppers after lyophilisation',
    description:
      'Stoppers partially seated at the end of the lyophilisation cycle are not reliably detected before capping. ' +
      'A partially seated stopper compromises the sterile barrier over shelf life.',
    hazard: 'Loss of container closure integrity',
    cause: 'Shelf-collapse force variability across the chamber and no in-line height check before the capping station.',
    consequence: 'Loss of sterility during shelf life, stability failure and market action on distributed lots.',
    status: 'MONITORED',
    treatment: 'REDUCE',
    monthsAgo: 13,
    initial: { S: 5, P: 2 },
    residual: { S: 5, P: 1 },
    residualAfterDays: 120,
    initialReason: 'Initial scoring following two partially seated stoppers detected at 100% visual inspection.',
    residualReason: 'Rescored after installing an in-line vision height check with automatic reject and adding helium leak testing to the CCI strategy.',
  },
  {
    key: 'FILTER-INTEGRITY',
    register: 'STERILE',
    categoryCode: 'PATIENT_SAFETY',
    title: 'Sterilising-grade filter failing post-use integrity test after the batch has been filled',
    description:
      'The 0.22 µm sterilising filter is integrity tested pre-use post-sterilisation and post-use. A post-use failure ' +
      'invalidates the sterility of an already-filled batch, and the current investigation path does not distinguish ' +
      'filter defect from test-equipment error quickly enough.',
    hazard: 'Non-sterile filtrate',
    cause: 'Filter compatibility with the formulation qualified at a single, non-worst-case process time and pressure.',
    consequence: 'Rejection of the entire filled batch; potential sterility failure if the batch had been released.',
    status: 'UNDER_ASSESSMENT',
    treatment: null,
    monthsAgo: 6,
    initial: { S: 5, P: 2 },
    initialReason: 'Initial scoring raised from a post-use integrity test failure investigation.',
  },
  {
    key: 'CALIBRATION-DRIFT',
    register: 'STERILE',
    categoryCode: 'EQUIPMENT',
    title: 'Calibration drift on filling-line load cells causing undetected fill-weight variability',
    description:
      'The check-weigher load cells are calibrated on a six-month interval. Trending of the as-found data shows drift ' +
      'approaching the tolerance limit before each calibration, meaning fill-weight rejects may be under-detected in ' +
      'the second half of the interval.',
    hazard: 'Out-of-specification fill volume released as conforming',
    cause: 'Calibration interval set by convention rather than by as-found drift data; no in-process verification with a certified check weight per shift.',
    consequence: 'Under-filled vials reaching the patient (sub-potent dose) and a data-driven inspection finding on calibration interval justification.',
    status: 'RESIDUAL_ASSESSED',
    treatment: 'REDUCE',
    monthsAgo: 9,
    initial: { S: 3, P: 3 },
    residual: { S: 3, P: 2 },
    residualAfterDays: 95,
    initialReason: 'Initial scoring from the calibration interval review of the trailing three years of as-found data.',
    residualReason: 'Rescored after shortening the interval to three months and adding a per-shift certified check-weight verification.',
  },
  {
    key: 'WFI-INGRESS',
    register: 'STERILE',
    categoryCode: 'EQUIPMENT',
    title: 'Microbial ingress at a Water for Injection user point during the sanitisation window',
    description:
      'Two WFI user points serving the compounding suite are isolated during the weekly thermal sanitisation cycle, ' +
      'leaving a dead leg that does not reach the sanitisation temperature.',
    hazard: 'Biofilm formation in the WFI distribution loop',
    cause: 'Valve arrangement creates a branch exceeding six pipe diameters that is excluded from the thermal cycle.',
    consequence: 'Bioburden and endotoxin excursion in WFI used for compounding; impact on all batches made since the last passing result.',
    status: 'IDENTIFIED',
    treatment: null,
    monthsAgo: 2,
    initial: { S: 4, P: 2 },
    initialReason: 'Initial scoring at risk identification following the utilities periodic review.',
  },

  // ── Contract Manufacturer supplier register (ICH Q9 5x5) ──────────────────
  {
    key: 'API-PSD-VARIABILITY',
    register: 'SUPPLIER',
    categoryCode: 'SUPPLY_CHAIN',
    title: 'Supplier material variability in API particle size distribution affecting content uniformity',
    description:
      'The API supplier controls particle size distribution to a wide specification. Lot-to-lot D90 variation observed ' +
      'over the last eight lots correlates with content-uniformity trend shifts in the finished product.',
    hazard: 'Incoming material attribute outside the range validated for the process',
    cause: 'Supplier specification wider than the process design space; no notification obligation for micronisation process changes.',
    consequence: 'Content uniformity failure, batch rejection and supply interruption.',
    status: 'ACCEPTED',
    treatment: 'REDUCE',
    monthsAgo: 16,
    initial: { S: 4, P: 3 },
    residual: { S: 4, P: 2 },
    residualAfterDays: 175,
    initialReason: 'Initial scoring during the supplier periodic quality review.',
    residualReason: 'Rescored after tightening the incoming D90 acceptance criterion and adding a change-notification clause to the quality agreement.',
  },
  {
    key: 'COLD-CHAIN',
    register: 'SUPPLIER',
    categoryCode: 'SUPPLY_CHAIN',
    title: 'Cold-chain temperature excursion on the 2-8 °C distribution lane to the EU depot',
    description:
      'Shipments routed through a transit hub with no active temperature control recorded four excursions above 8 °C ' +
      'in the last year. The lane was qualified on winter profiles only.',
    hazard: 'Product exposed outside its labelled storage condition',
    cause: 'Passive shipper qualified against a single seasonal profile; hub dwell time longer than the qualified duration during peak season.',
    consequence: 'Loss of potency and stability commitment; quarantine or destruction of the shipment and stock-out at the depot.',
    status: 'MONITORED',
    treatment: 'REDUCE',
    monthsAgo: 12,
    initial: { S: 4, P: 4 },
    residual: { S: 4, P: 2 },
    residualAfterDays: 130,
    initialReason: 'Initial scoring following the fourth excursion of the year on the EU lane.',
    residualReason: 'Rescored after moving to active temperature-controlled containers with real-time telemetry and requalifying the lane on summer profiles.',
  },
  {
    key: 'CMO-SUBCONTRACT',
    register: 'SUPPLIER',
    categoryCode: 'REGULATORY',
    title: 'Undisclosed subcontracting of secondary packaging by the contract manufacturer',
    description:
      'The quality agreement prohibits onward subcontracting without prior written approval. The last on-site audit ' +
      'found labelling operations performed at a second, unapproved site during a capacity peak.',
    hazard: 'GMP activity performed at a site outside the approved supply chain',
    cause: 'No routine verification of the CMO subcontractor list between audits; capacity pressure at peak demand.',
    consequence: 'Product manufactured at an unregistered site; regulatory non-compliance and potential market withdrawal.',
    status: 'UNDER_ASSESSMENT',
    treatment: null,
    monthsAgo: 4,
    initial: { S: 4, P: 2 },
    initialReason: 'Initial scoring raised from audit finding AUD-2026-014 at the contract manufacturer.',
  },
  {
    key: 'SINGLE-SOURCE-STOPPER',
    register: 'SUPPLIER',
    categoryCode: 'BUSINESS',
    title: 'Single-source supply of sterile ready-to-use elastomeric stoppers',
    description:
      'One qualified supplier provides the coated stoppers for all sterile presentations. There is no qualified ' +
      'alternate source and the current safety stock covers eight weeks of demand.',
    hazard: 'Interruption of a critical component supply',
    cause: 'Second-source qualification deferred for three consecutive planning cycles; supplier operates a single production site.',
    consequence: 'Line stoppage and drug shortage notification to the health authority.',
    status: 'TREATMENT_IN_PROGRESS',
    treatment: 'REDUCE',
    monthsAgo: 8,
    initial: { S: 3, P: 3 },
    initialReason: 'Initial scoring at the business continuity review of critical components.',
  },
  {
    key: 'CMO-DATA-INTEGRITY',
    register: 'SUPPLIER',
    categoryCode: 'DATA_INTEGRITY',
    title: 'Contract manufacturer batch data maintained in uncontrolled spreadsheets without an audit trail',
    description:
      'In-process check results at the CMO are recorded in shared spreadsheets before transcription into the batch ' +
      'record. The files have no audit trail, no access control and no backup verification, so the ALCOA+ attributes ' +
      'of the original data cannot be demonstrated.',
    hazard: 'GMP records that are not attributable, contemporaneous or enduring',
    cause: 'Legacy paper-on-glass practice never remediated after the CMO computerised system inventory was compiled.',
    consequence: 'Batch data not defensible at inspection; product release decisions based on unverifiable records; potential recall.',
    status: 'RESIDUAL_ASSESSED',
    treatment: 'REDUCE',
    monthsAgo: 10,
    initial: { S: 5, P: 3 },
    residual: { S: 5, P: 2 },
    residualAfterDays: 110,
    initialReason: 'Initial scoring from the data integrity assessment performed during the for-cause CMO audit.',
    residualReason: 'Rescored after the CMO migrated in-process checks to the validated MES with audit trail and role-based access.',
  },

  // ── Filling Line pFMEA (AIAG-VDA: S x O x D on 10-point scales) ───────────
  {
    key: 'FMEA-STOPPER-JAM',
    register: 'FMEA',
    categoryCode: 'PRODUCT_QUALITY',
    title: 'Stopper bowl jam leaves vials un-stoppered downstream of the filling station',
    description:
      'A jam in the stopper feed bowl starves the stoppering station. Vials continue through the capper, producing ' +
      'sealed units with no stopper, or an open vial exposed to the environment.',
    hazard: 'Missing stopper (failure mode)',
    cause: 'Stopper geometry variation combined with bowl track wear at the escapement.',
    consequence: 'Open, non-sterile unit; loss of container closure integrity.',
    status: 'MONITORED',
    treatment: 'REDUCE',
    monthsAgo: 7,
    initial: { S: 9, O: 4, D: 3 },
    residual: { S: 9, O: 2, D: 3 },
    residualAfterDays: 85,
    initialReason: 'Initial pFMEA scoring of the stoppering station.',
    residualReason: 'Rescored after the bowl track was replaced on a preventive interval and a no-stopper sensor with automatic reject was fitted.',
  },
  {
    key: 'FMEA-FILL-VOLUME',
    register: 'FMEA',
    categoryCode: 'PRODUCT_QUALITY',
    title: 'Rotary piston pump volumetric drift produces progressive under-fill across the run',
    description:
      'Piston and cylinder wear on the rotary filling pumps causes fill volume to drift downward over a long campaign. ' +
      'The current in-process weight check frequency may not detect the drift before a large number of vials is affected.',
    hazard: 'Under-fill (failure mode)',
    cause: 'Piston-to-cylinder clearance increase from cumulative running hours between overhauls.',
    consequence: 'Sub-potent dose delivered to the patient; batch rejection on fill-volume uniformity.',
    status: 'TREATMENT_IN_PROGRESS',
    treatment: 'REDUCE',
    monthsAgo: 5,
    initial: { S: 7, O: 5, D: 4 },
    initialReason: 'Initial pFMEA scoring of the filling station.',
  },
  {
    key: 'FMEA-AVI-RECIPE',
    register: 'FMEA',
    categoryCode: 'DATA_INTEGRITY',
    title: 'Automated visual inspection recipe not revalidated after the vision software upgrade',
    description:
      'The automated visual inspection machine received a vendor software upgrade. The defect recipes and the knapp ' +
      'test kit results were carried over without revalidation, so detection capability for particulate and cosmetic ' +
      'defects is unproven on the new version.',
    hazard: 'Undetected critical defect (failure mode)',
    cause: 'Software validation gap — vendor upgrade managed as maintenance rather than through the change control and CSV process.',
    consequence: 'Defective units released; inspection finding on computerised system validation and change control.',
    status: 'ACCEPTED',
    treatment: 'REDUCE',
    monthsAgo: 3,
    initial: { S: 8, O: 3, D: 6 },
    residual: { S: 8, O: 2, D: 3 },
    residualAfterDays: 45,
    initialReason: 'Initial pFMEA scoring after the vision system upgrade was identified in the CSV periodic review.',
    residualReason: 'Rescored after full recipe revalidation, a repeated knapp test with the qualified defect kit and retrospective change control.',
  },
];

interface ControlSeed {
  riskKey: string;
  title: string;
  description: string;
  type: RiskControlType;
  hierarchy: RiskControlHierarchy;
  status: RiskControlStatus;
  dueInDays: number; // negative = past due date
  implementedDaysAgo?: number;
  verifiedDaysAgo?: number;
  isEffective?: boolean;
  effectiveness?: string;
  libraryCode?: string;
}

const CONTROLS: ControlSeed[] = [
  {
    riskKey: 'STERILITY-AIRFLOW',
    title: 'Redesign nozzle guards and requalify all routine interventions by smoke study',
    description:
      'Fit shielded nozzle guards that maintain first air over the open vial during gloveport interventions, and repeat ' +
      'the airflow visualisation study for every intervention listed in the aseptic operations SOP.',
    type: 'PREVENTIVE',
    hierarchy: 'ENGINEERING',
    status: 'VERIFIED',
    dueInDays: -240,
    implementedDaysAgo: 220,
    verifiedDaysAgo: 150,
    isEffective: true,
    effectiveness:
      'Post-implementation smoke studies show unbroken first air at all intervention points; no viable recovery at the ' +
      'critical zone across the following three media fills.',
    libraryCode: 'CTL-AIRFLOW-GUARD',
  },
  {
    riskKey: 'CROSS-CONTAM-TUBING',
    title: 'Convert to product-dedicated single-use fluid path assemblies',
    description:
      'Replace the shared silicone tubing and manifold with gamma-irradiated single-use assemblies dedicated per product, ' +
      'eliminating the shared product-contact surface entirely.',
    type: 'PREVENTIVE',
    hierarchy: 'ELIMINATION',
    status: 'VERIFIED',
    dueInDays: -200,
    implementedDaysAgo: 185,
    verifiedDaysAgo: 140,
    isEffective: true,
    effectiveness: 'Twelve consecutive changeovers with no shared product-contact surface; swab verification not applicable.',
    libraryCode: 'CTL-SINGLE-USE-PATH',
  },
  {
    riskKey: 'EM-EXCURSION',
    title: 'Interface the EM plate reader to LIMS with automatic action-limit alerting',
    description:
      'Eliminate manual transcription of environmental monitoring counts by interfacing the colony counter to LIMS, and ' +
      'configure automatic notification to QA and the area owner when an action limit is exceeded.',
    type: 'DETECTIVE',
    hierarchy: 'ENGINEERING',
    status: 'IN_PROGRESS',
    dueInDays: -35,
    libraryCode: 'CTL-EM-ALERT',
  },
  {
    riskKey: 'ASEPTIC-TECHNIQUE',
    title: 'Quarterly documented aseptic behaviour observation programme',
    description:
      'Introduce a quarterly observation of each qualified aseptic operator against a defined behaviour checklist, with ' +
      'retraining triggered by any observed deviation and the record retained in the training file.',
    type: 'DETECTIVE',
    hierarchy: 'ADMINISTRATIVE',
    status: 'VERIFIED',
    dueInDays: -170,
    implementedDaysAgo: 160,
    verifiedDaysAgo: 100,
    isEffective: true,
    effectiveness: 'Four observation cycles completed; two behaviour deviations detected and retrained before the annual requalification.',
    libraryCode: 'CTL-ASEPTIC-OBS',
  },
  {
    riskKey: 'CCI-STOPPER',
    title: 'In-line stopper height vision check with automatic reject before capping',
    description:
      'Install a vision station between the lyophiliser unload and the capper that measures stopper seating height on ' +
      '100% of vials and rejects any unit outside the qualified range.',
    type: 'DETECTIVE',
    hierarchy: 'ENGINEERING',
    status: 'IMPLEMENTED',
    dueInDays: -110,
    implementedDaysAgo: 100,
    libraryCode: 'CTL-CCI-VISION',
  },
  {
    riskKey: 'CALIBRATION-DRIFT',
    title: 'Shorten load-cell calibration interval and add per-shift check-weight verification',
    description:
      'Reduce the load-cell calibration interval from six to three months based on as-found drift data, and verify the ' +
      'check-weigher with a certified class E2 weight at the start of every shift.',
    type: 'PREVENTIVE',
    hierarchy: 'ADMINISTRATIVE',
    status: 'VERIFIED',
    dueInDays: -90,
    implementedDaysAgo: 85,
    verifiedDaysAgo: 30,
    isEffective: true,
    effectiveness: 'As-found results within one third of tolerance at the first two shortened intervals; no shift verification failures.',
    libraryCode: 'CTL-CAL-INTERVAL',
  },
  {
    riskKey: 'COLD-CHAIN',
    title: 'Move the EU lane to active temperature-controlled containers with real-time telemetry',
    description:
      'Qualify active 2-8 °C containers for the EU depot lane on summer and winter profiles, with GSM temperature ' +
      'telemetry alerting the logistics desk before the excursion limit is reached.',
    type: 'MITIGATING',
    hierarchy: 'SUBSTITUTION',
    status: 'IMPLEMENTED',
    dueInDays: -120,
    implementedDaysAgo: 115,
    libraryCode: 'CTL-COLD-CHAIN-ACTIVE',
  },
  {
    riskKey: 'CMO-DATA-INTEGRITY',
    title: 'Migrate CMO in-process checks to the validated MES and retire the spreadsheets',
    description:
      'Require the contract manufacturer to record all in-process checks directly in the validated MES with audit trail, ' +
      'unique user accounts and role-based access; formally retire the shared spreadsheets under change control.',
    type: 'CORRECTIVE',
    hierarchy: 'ENGINEERING',
    status: 'VERIFIED',
    dueInDays: -95,
    implementedDaysAgo: 90,
    verifiedDaysAgo: 25,
    isEffective: true,
    effectiveness: 'Follow-up audit confirmed no spreadsheet records in use; audit trail review procedure in place at the CMO.',
    libraryCode: 'CTL-MES-AUDIT-TRAIL',
  },
  {
    riskKey: 'SINGLE-SOURCE-STOPPER',
    title: 'Qualify an alternate ready-to-use stopper supplier',
    description:
      'Run the second-source qualification programme: supplier audit, extractables and leachables assessment, three ' +
      'engineering batches and a stability commitment on the alternate stopper.',
    type: 'PREVENTIVE',
    hierarchy: 'ADMINISTRATIVE',
    status: 'IN_PROGRESS',
    dueInDays: 75,
  },
  {
    riskKey: 'FMEA-FILL-VOLUME',
    title: 'Preventive pump overhaul at qualified running hours plus 100% in-process check weighing',
    description:
      'Set a running-hour based overhaul trigger for the rotary piston pumps from the wear data, and run statistical ' +
      '100% in-process check weighing with automatic reject for the first and last 100 vials of each campaign.',
    type: 'PREVENTIVE',
    hierarchy: 'ENGINEERING',
    status: 'PLANNED',
    dueInDays: 45,
  },
];

interface ReviewSeed {
  riskKey: string;
  dueInDays: number;
  reviewedDaysAgo?: number;
  outcome?: RiskReviewOutcome;
  findings?: string;
  nextReviewInDays?: number;
}

const REVIEWS: ReviewSeed[] = [
  {
    riskKey: 'STERILITY-AIRFLOW',
    dueInDays: -120,
    reviewedDaysAgo: 118,
    outcome: 'RESCORED',
    findings:
      'Nozzle guard redesign verified effective by smoke study and three consecutive media fills. Probability reduced ' +
      'from Possible to Unlikely; risk moved to monitoring with a six-month cadence.',
    nextReviewInDays: 60,
  },
  {
    riskKey: 'CROSS-CONTAM-TUBING',
    dueInDays: -45,
    reviewedDaysAgo: 40,
    outcome: 'NO_CHANGE',
    findings:
      'Single-use fluid path in routine use across twelve changeovers; no carry-over indications in cleaning verification. ' +
      'Residual risk confirmed unchanged.',
    nextReviewInDays: 135,
  },
  {
    // Deliberately overdue and unreviewed so the review queue and overdue
    // analytics have live data.
    riskKey: 'EM-EXCURSION',
    dueInDays: -28,
  },
  {
    riskKey: 'CMO-DATA-INTEGRITY',
    dueInDays: -14,
  },
  {
    riskKey: 'COLD-CHAIN',
    dueInDays: 30,
  },
  {
    riskKey: 'FMEA-STOPPER-JAM',
    dueInDays: 75,
  },
];

interface HazardSeed {
  code: string;
  name: string;
  type: 'HAZARD' | 'CAUSE' | 'CONSEQUENCE' | 'FAILURE_MODE' | 'THREAT';
  description: string;
  categoryCode: string;
  defaultSeverityRank?: number;
  tags: string[];
}

const HAZARDS: HazardSeed[] = [
  {
    code: 'HZ-MICROBIAL',
    name: 'Microbial contamination of sterile product',
    type: 'HAZARD',
    description: 'Ingress of viable organisms into a product that is required to be sterile at the point of administration.',
    categoryCode: 'PATIENT_SAFETY',
    defaultSeverityRank: 5,
    tags: ['aseptic', 'annex-1', 'sterility'],
  },
  {
    code: 'HZ-CROSS-CONTAM',
    name: 'Cross-contamination between products',
    type: 'HAZARD',
    description: 'Carry-over of an active, excipient or cleaning agent from one product or batch into another.',
    categoryCode: 'PRODUCT_QUALITY',
    defaultSeverityRank: 4,
    tags: ['cleaning-validation', 'changeover'],
  },
  {
    code: 'HZ-ENDOTOXIN',
    name: 'Endotoxin / pyrogen contamination',
    type: 'HAZARD',
    description: 'Bacterial endotoxin above the patient-dose limit arising from water systems, components or biofilm.',
    categoryCode: 'PATIENT_SAFETY',
    defaultSeverityRank: 5,
    tags: ['wfi', 'utilities', 'bet'],
  },
  {
    code: 'HZ-ALCOA',
    name: 'GMP record not attributable or contemporaneous',
    type: 'HAZARD',
    description: 'Record that cannot be shown to satisfy the ALCOA+ attributes, undermining the release decision it supports.',
    categoryCode: 'DATA_INTEGRITY',
    defaultSeverityRank: 5,
    tags: ['alcoa+', 'part-11', 'audit-trail'],
  },
  {
    code: 'HZ-COLD-CHAIN',
    name: 'Storage or transport outside the labelled condition',
    type: 'HAZARD',
    description: 'Product exposed above or below its registered storage range during warehousing or distribution.',
    categoryCode: 'SUPPLY_CHAIN',
    defaultSeverityRank: 4,
    tags: ['gdp', 'cold-chain', 'excursion'],
  },
  {
    code: 'FM-MISSING-STOPPER',
    name: 'Missing or partially seated stopper',
    type: 'FAILURE_MODE',
    description: 'Vial leaves the stoppering station without a stopper, or with a stopper not seated to the qualified height.',
    categoryCode: 'PRODUCT_QUALITY',
    defaultSeverityRank: 5,
    tags: ['cci', 'stoppering', 'pfmea'],
  },
  {
    code: 'FM-UNDER-FILL',
    name: 'Under-fill / over-fill of the container',
    type: 'FAILURE_MODE',
    description: 'Delivered volume outside the fill-volume specification, giving a sub-potent or over-potent dose.',
    categoryCode: 'PRODUCT_QUALITY',
    defaultSeverityRank: 4,
    tags: ['filling', 'pfmea', 'fill-weight'],
  },
  {
    code: 'CS-CALIBRATION-DRIFT',
    name: 'Measurement instrument calibration drift',
    type: 'CAUSE',
    description: 'Instrument response moves outside tolerance between calibrations, so measurements are no longer trustworthy.',
    categoryCode: 'EQUIPMENT',
    defaultSeverityRank: 3,
    tags: ['calibration', 'metrology'],
  },
  {
    code: 'CS-CSV-GAP',
    name: 'Computerised system change made outside validation',
    type: 'CAUSE',
    description: 'Software upgrade, recipe or configuration change applied without change control or revalidation.',
    categoryCode: 'DATA_INTEGRITY',
    defaultSeverityRank: 4,
    tags: ['csv', 'change-control', 'gamp5'],
  },
  {
    code: 'CQ-RECALL',
    name: 'Market action / product recall',
    type: 'CONSEQUENCE',
    description: 'Distributed product withdrawn from the market, with health-authority notification and patient impact assessment.',
    categoryCode: 'REGULATORY',
    defaultSeverityRank: 5,
    tags: ['recall', 'regulatory'],
  },
];

interface ControlLibrarySeed {
  code: string;
  name: string;
  type: RiskControlType;
  hierarchy: RiskControlHierarchy;
  description: string;
  effectivenessRank: number;
}

const CONTROL_LIBRARY: ControlLibrarySeed[] = [
  {
    code: 'CTL-AIRFLOW-GUARD',
    name: 'Shielded nozzle guard maintaining first air over the open container',
    type: 'PREVENTIVE',
    hierarchy: 'ENGINEERING',
    description: 'Physical barrier that preserves unidirectional airflow over the critical zone during gloveport interventions.',
    effectivenessRank: 2,
  },
  {
    code: 'CTL-SINGLE-USE-PATH',
    name: 'Product-dedicated single-use fluid path assembly',
    type: 'PREVENTIVE',
    hierarchy: 'ELIMINATION',
    description: 'Gamma-irradiated disposable tubing and manifold that removes the shared product-contact surface entirely.',
    effectivenessRank: 1,
  },
  {
    code: 'CTL-EM-ALERT',
    name: 'Automated environmental monitoring action-limit alerting',
    type: 'DETECTIVE',
    hierarchy: 'ENGINEERING',
    description: 'Instrument-to-LIMS interface that removes manual transcription and notifies QA the moment a limit is exceeded.',
    effectivenessRank: 2,
  },
  {
    code: 'CTL-ASEPTIC-OBS',
    name: 'Periodic documented aseptic behaviour observation',
    type: 'DETECTIVE',
    hierarchy: 'ADMINISTRATIVE',
    description: 'Structured observation of qualified operators against a defined behaviour checklist between requalifications.',
    effectivenessRank: 3,
  },
  {
    code: 'CTL-CCI-VISION',
    name: '100% in-line vision check with automatic reject',
    type: 'DETECTIVE',
    hierarchy: 'ENGINEERING',
    description: 'Machine-vision inspection of every unit for a critical attribute, with automatic rejection of failing units.',
    effectivenessRank: 2,
  },
  {
    code: 'CTL-CAL-INTERVAL',
    name: 'Data-driven calibration interval with in-use verification',
    type: 'PREVENTIVE',
    hierarchy: 'ADMINISTRATIVE',
    description: 'Calibration interval justified by as-found drift data, supplemented by a per-shift check using a certified standard.',
    effectivenessRank: 3,
  },
  {
    code: 'CTL-COLD-CHAIN-ACTIVE',
    name: 'Active temperature-controlled shipper with real-time telemetry',
    type: 'MITIGATING',
    hierarchy: 'SUBSTITUTION',
    description: 'Actively controlled container with GSM temperature telemetry and pre-excursion alerting to the logistics desk.',
    effectivenessRank: 2,
  },
  {
    code: 'CTL-MES-AUDIT-TRAIL',
    name: 'Record capture in a validated system with audit trail',
    type: 'CORRECTIVE',
    hierarchy: 'ENGINEERING',
    description: 'GMP data captured directly in a validated system with unique accounts, role-based access and audit trail review.',
    effectivenessRank: 1,
  },
];

// ── Assessment worksheets ───────────────────────────────────────────────────

interface MatrixLineSeed {
  hazard: string;
  consequence: string;
  cause: string;
  currentControls: string;
  initial: FactorValues;
  residual?: FactorValues;
  recommendedAction: string;
  dueInDays: number;
  isCritical: boolean;
  notes: string;
}

const MATRIX_LINES: MatrixLineSeed[] = [
  {
    hazard: 'Viable contamination during open gloveport intervention',
    consequence: 'Non-sterile unit released; potential serious patient harm',
    cause: 'Intervention performed without maintaining first air over the open vial',
    currentControls: 'Qualified intervention list, smoke studies, continuous viable and non-viable monitoring at the critical zone',
    initial: { S: 5, P: 3 },
    residual: { S: 5, P: 2 },
    recommendedAction: 'Retain shielded nozzle guards; repeat the smoke study for any newly introduced intervention before first use.',
    dueInDays: -60,
    isCritical: true,
    notes: 'Covered by the media fill acceptance criteria; three consecutive successful media fills since implementation.',
  },
  {
    hazard: 'Personnel-borne contamination from gowning failure',
    consequence: 'Grade B excursion and potential product contamination',
    cause: 'Gown integrity compromised during entry; gowning qualification interval of twelve months',
    currentControls: 'Gowning qualification, glove-print monitoring at the end of every session, entry airlock differential pressure alarms',
    initial: { S: 4, P: 3 },
    residual: { S: 4, P: 2 },
    recommendedAction: 'Add quarterly documented gowning observation and increase glove-print sampling during long campaigns.',
    dueInDays: -30,
    isCritical: true,
    notes: 'Glove-print excursions trended monthly; no adverse trend in the last two quarters.',
  },
  {
    hazard: 'Sterilised component hold time exceeded before use',
    consequence: 'Component no longer within its validated sterile hold; batch on hold pending assessment',
    cause: 'Line stoppage extends the interval between depyrogenation and filling beyond the qualified hold time',
    currentControls: 'Hold-time study, batch record hold-time entry with QA verification at line clearance',
    initial: { S: 4, P: 2 },
    recommendedAction: 'Add an automatic hold-time countdown in the MES that blocks the filling step once the qualified limit is passed.',
    dueInDays: 40,
    isCritical: false,
    notes: 'Two near-misses in the trailing year, both detected at line clearance.',
  },
  {
    hazard: 'Grade A/B pressure cascade lost during a HVAC event',
    consequence: 'Loss of the environmental control that protects the exposed product',
    cause: 'AHU trip or filter loading causing differential pressure to fall below the alarm limit',
    currentControls: 'Continuous differential pressure monitoring with alarm, filter loading trend, standby AHU capacity',
    initial: { S: 4, P: 2 },
    residual: { S: 4, P: 1 },
    recommendedAction: 'Confirm the standby AHU changeover time by challenge test annually and keep the result in the qualification file.',
    dueInDays: -15,
    isCritical: true,
    notes: 'Challenge test completed; cascade recovered within the qualified time.',
  },
];

interface FmeaLineSeed {
  itemFunction: string;
  failureMode: string;
  effect: string;
  cause: string;
  currentControls: string;
  initial: FactorValues;
  residual?: FactorValues;
  recommendedAction: string;
  dueInDays: number;
  isCritical: boolean;
  notes: string;
}

const FMEA_LINES: FmeaLineSeed[] = [
  {
    itemFunction: 'Vial washing station — remove particulate and endotoxin from incoming vials',
    failureMode: 'Wash nozzle partially blocked, one vial track under-washed',
    effect: 'Particulate and endotoxin carried into the filled unit',
    cause: 'Scale build-up in the WFI rinse nozzle between preventive maintenance intervals',
    currentControls: 'Rinse water pressure alarm; endotoxin testing on the depyrogenation load; visual inspection of washed vials',
    initial: { S: 8, O: 4, D: 5 },
    residual: { S: 8, O: 2, D: 4 },
    recommendedAction: 'Add nozzle flow verification to the daily start-up check and shorten the descaling interval to monthly.',
    dueInDays: -70,
    isCritical: true,
    notes: 'Effectiveness confirmed by three consecutive endotoxin results well below the limit.',
  },
  {
    itemFunction: 'Depyrogenation tunnel — deliver ≥3 log reduction of endotoxin',
    failureMode: 'Belt speed drift shortens the residence time at temperature',
    effect: 'Endotoxin not reduced to the validated level; pyrogenic reaction risk in the patient',
    cause: 'Drive belt wear and encoder drift between qualifications',
    currentControls: 'Continuous belt-speed and temperature recording with alarm; annual heat penetration requalification',
    initial: { S: 9, O: 3, D: 3 },
    residual: { S: 9, O: 2, D: 2 },
    recommendedAction: 'Interlock the tunnel to divert to reject if belt speed deviates beyond the qualified band for more than 30 seconds.',
    dueInDays: -50,
    isCritical: true,
    notes: 'Interlock installed and challenge tested during the last requalification.',
  },
  {
    itemFunction: 'Sterile filtration — remove bioburden from the bulk solution',
    failureMode: 'Filter fails the post-use integrity test',
    effect: 'Sterility of the filled batch cannot be assured; entire batch rejected',
    cause: 'Filter incompatibility with the formulation at the maximum qualified process time and pressure',
    currentControls: 'Pre-use post-sterilisation and post-use integrity testing; bioburden testing before filtration',
    initial: { S: 10, O: 2, D: 2 },
    recommendedAction: 'Extend filter validation to the worst-case process time and pressure, and qualify a redundant second filter in series.',
    dueInDays: 60,
    isCritical: true,
    notes: 'Open — redundant filtration proposal in engineering review.',
  },
  {
    itemFunction: 'Filling station — deliver the target fill volume into each vial',
    failureMode: 'Progressive under-fill across a long campaign',
    effect: 'Sub-potent dose; batch rejection on fill-volume uniformity',
    cause: 'Piston-to-cylinder wear increasing clearance with running hours',
    currentControls: 'In-process check weighing at defined intervals; statistical fill-weight trend on the batch record',
    initial: { S: 7, O: 5, D: 4 },
    recommendedAction: 'Introduce a running-hour based pump overhaul trigger and 100% check weighing with automatic reject.',
    dueInDays: 45,
    isCritical: true,
    notes: 'Open — pump wear data being collected to set the overhaul trigger.',
  },
  {
    itemFunction: 'Stoppering station — seat a sterile stopper in every filled vial',
    failureMode: 'Stopper bowl jam leaves vials un-stoppered',
    effect: 'Open, non-sterile unit continues to the capper',
    cause: 'Stopper geometry variation combined with bowl track wear at the escapement',
    currentControls: 'Operator line-clearance checks; 100% automated visual inspection downstream',
    initial: { S: 9, O: 4, D: 3 },
    residual: { S: 9, O: 2, D: 3 },
    recommendedAction: 'Fit a no-stopper presence sensor with automatic reject and replace the bowl track on a preventive interval.',
    dueInDays: -80,
    isCritical: true,
    notes: 'Sensor installed and challenge tested with deliberately un-stoppered vials.',
  },
  {
    itemFunction: 'Capping station — crimp the aluminium seal to the qualified force',
    failureMode: 'Crimp force below the qualified range, loose seal',
    effect: 'Container closure integrity loss over shelf life',
    cause: 'Crimp head spring fatigue and inconsistent vial height from the lyophiliser trays',
    currentControls: 'Residual seal force testing on a sampling plan; end-of-run crimp height measurement',
    initial: { S: 8, O: 4, D: 5 },
    residual: { S: 8, O: 3, D: 3 },
    recommendedAction: 'Move to in-line residual seal force monitoring and add crimp head spring replacement to the preventive schedule.',
    dueInDays: -20,
    isCritical: true,
    notes: 'In-line monitoring commissioned; sampling plan retained as a cross-check for one year.',
  },
  {
    itemFunction: 'Automated visual inspection — reject units with critical defects',
    failureMode: 'Defect recipe not revalidated after a vision software upgrade',
    effect: 'Critical particulate or cosmetic defects released to the market',
    cause: 'Vendor upgrade managed as maintenance rather than through change control and CSV',
    currentControls: 'Knapp test on the qualified defect kit at qualification; daily machine set-up challenge with defect standards',
    initial: { S: 8, O: 3, D: 6 },
    residual: { S: 8, O: 2, D: 3 },
    recommendedAction: 'Revalidate all defect recipes on the upgraded software and route vendor upgrades through change control by procedure.',
    dueInDays: -10,
    isCritical: true,
    notes: 'Revalidation complete; procedure updated to require change control for vendor software upgrades.',
  },
];

// ── Seed ────────────────────────────────────────────────────────────────────

const main = async () => {
  console.log('Seeding Risk Management demo data...');

  // 1. Master data must exist.
  const ich = await loadFramework('ICH_Q9_5X5');
  const fmea = await loadFramework('AIAG_VDA_FMEA');
  const iso = await loadFramework('ISO_14971');
  if (!ich || !fmea || !iso) {
    console.error(
      '\n  Risk master data not found (frameworks ICH_Q9_5X5 / ISO_14971 / AIAG_VDA_FMEA).\n' +
        "  Run 'npm run db:seed:risk' first, then re-run this seed.\n",
    );
    process.exitCode = 1;
    return;
  }

  const categoryRows = await prisma.riskCategory.findMany({ where: { code: { not: null } } });
  const categories = new Map(categoryRows.map((c) => [c.code as string, c.id]));
  if (categories.size === 0) {
    console.error("\n  No risk categories found. Run 'npm run db:seed:risk' first.\n");
    process.exitCode = 1;
    return;
  }

  const frameworks: Record<'ICH_Q9_5X5' | 'AIAG_VDA_FMEA', LoadedFramework> = {
    ICH_Q9_5X5: ich,
    AIAG_VDA_FMEA: fmea,
  };

  // 2. Resolve people / places by lookup — degrade to null when the tenant is empty.
  const people = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    take: 6,
    select: { id: true, name: true },
  });
  const owner = (i: number) => (people.length ? people[i % people.length] : null);
  const ownerId = (i: number) => owner(i)?.id ?? null;
  const ownerName = (i: number) => owner(i)?.name ?? 'system';

  const site = await prisma.site.findFirst({ where: { isActive: true }, orderBy: { code: 'asc' } });
  const qaDept =
    (await prisma.department.findFirst({ where: { isActive: true, name: { contains: 'Quality', mode: 'insensitive' } } })) ??
    (await prisma.department.findFirst({ where: { isActive: true }, orderBy: { code: 'asc' } }));

  console.log(
    `  context: ${people.length} user(s), site=${site?.code ?? 'none'}, department=${qaDept?.name ?? 'none'}`,
  );

  // 3. Registers.
  const registerIds = new Map<RegisterKey, string>();
  for (const [i, seed] of REGISTERS.entries()) {
    const fw = frameworks[seed.frameworkCode];
    const existing = await prisma.riskRegister.findFirst({ where: { name: seed.name } });
    const data = {
      name: seed.name,
      description: seed.description,
      scope: seed.scope,
      scopeRef: seed.scopeRef as Prisma.InputJsonValue,
      frameworkId: fw.row.id,
      siteId: site?.id ?? null,
      departmentId: qaDept?.id ?? null,
      ownerId: ownerId(i),
      isActive: true,
    };
    if (existing) {
      await prisma.riskRegister.update({ where: { id: existing.id }, data });
      registerIds.set(seed.key, existing.id);
      stats.registers.updated += 1;
      console.log(`  updated register ${existing.registerNumber} — ${seed.name}`);
    } else {
      const created = await withUniqueRetry(async () => {
        const registerNumber = await nextNumber(
          prisma.riskRegister,
          'registerNumber',
          'RR',
          new Date().getFullYear(),
        );
        return prisma.riskRegister.create({
          data: { registerNumber, createdById: ownerId(i), ...data },
        });
      });
      registerIds.set(seed.key, created.id);
      stats.registers.created += 1;
      console.log(`  created register ${created.registerNumber} — ${seed.name}`);
    }
  }

  // 4. Risks + score snapshots.
  const riskIds = new Map<string, string>();

  const snapshot = async (
    riskId: string,
    stage: 'INITIAL' | 'RESIDUAL',
    result: ScoreResult,
    frameworkId: string,
    formula: string,
    reason: string,
    at: Date,
    userIndex: number,
  ) => {
    await prisma.riskScoreSnapshot.create({
      data: {
        riskId,
        stage,
        factors: result.factors as Prisma.InputJsonValue,
        score: result.score,
        levelCode: result.level.code,
        levelLabel: result.level.label,
        formula: formula as Prisma.RiskScoreSnapshotCreateInput['formula'],
        frameworkId,
        reason,
        userId: ownerId(userIndex),
        userName: ownerName(userIndex),
        createdAt: at,
      },
    });
    stats.snapshots.created += 1;
  };

  for (const [i, seed] of RISKS.entries()) {
    const registerId = registerIds.get(seed.register);
    if (!registerId) continue;
    const registerSeed = REGISTERS.find((r) => r.key === seed.register)!;
    const fw = frameworks[registerSeed.frameworkCode];

    const initial = computeScore(fw.scoring, seed.initial);
    const residual = seed.residual ? computeScore(fw.scoring, seed.residual) : null;
    if (residual && residual.score > initial.score) {
      throw new Error(`Demo data defect: residual score exceeds initial for "${seed.title}"`);
    }

    const identifiedAt = monthsAgo(seed.monthsAgo, 8 + (i % 18));
    const residualAt = residual ? daysFrom(identifiedAt, seed.residualAfterDays ?? 90) : null;
    const effective = residual ?? initial;
    const reviewFrom = residualAt ?? identifiedAt;
    const nextReviewAt = nextReviewDateFor(effective.level, reviewFrom);

    const accepted = seed.status === 'ACCEPTED';

    const data = {
      title: seed.title,
      description: seed.description,
      registerId,
      frameworkId: fw.row.id,
      categoryId: categories.get(seed.categoryCode) ?? null,
      hazard: seed.hazard,
      hazardousSituation: null,
      harm: null,
      cause: seed.cause,
      consequence: seed.consequence,
      status: seed.status,
      treatment: seed.treatment,
      initialFactors: initial.factors as Prisma.InputJsonValue,
      initialScore: initial.score,
      initialLevelId: initial.level.id,
      residualFactors: (residual ? residual.factors : Prisma.JsonNull) as Prisma.InputJsonValue,
      residualScore: residual?.score ?? null,
      residualLevelId: residual?.level.id ?? null,
      ownerId: ownerId(i),
      departmentId: qaDept?.id ?? null,
      siteId: site?.id ?? null,
      identifiedAt,
      acceptedAt: accepted && residualAt ? daysFrom(residualAt, 7) : null,
      closedAt: null,
      nextReviewAt,
    };

    const existing = await prisma.risk.findFirst({ where: { registerId, title: seed.title } });
    let riskId: string;
    if (existing) {
      await prisma.risk.update({ where: { id: existing.id }, data });
      riskId = existing.id;
      stats.risks.updated += 1;
    } else {
      const created = await withUniqueRetry(async () => {
        const riskNumber = await nextNumber(prisma.risk, 'riskNumber', 'RISK', identifiedAt.getFullYear());
        return prisma.risk.create({ data: { riskNumber, createdById: ownerId(i), ...data } });
      });
      riskId = created.id;
      stats.risks.created += 1;
    }
    riskIds.set(seed.key, riskId);

    // Rewrite the history so re-running keeps exactly the intended chart shape.
    await prisma.riskScoreSnapshot.deleteMany({ where: { riskId } });
    await snapshot(riskId, 'INITIAL', initial, fw.row.id, fw.row.formula, seed.initialReason, identifiedAt, i);
    if (residual && residualAt) {
      await snapshot(
        riskId,
        'RESIDUAL',
        residual,
        fw.row.id,
        fw.row.formula,
        seed.residualReason ?? 'Residual score after risk control implementation.',
        residualAt,
        i + 1,
      );
    }
  }
  console.log(
    `  risks: ${stats.risks.created} created, ${stats.risks.updated} updated, ${stats.snapshots.created} score snapshot(s) written`,
  );

  // 5. Control library (referenced by the risk controls below).
  const controlLibraryIds = new Map<string, string>();
  for (const item of CONTROL_LIBRARY) {
    const data = {
      name: item.name,
      type: item.type,
      hierarchy: item.hierarchy,
      description: item.description,
      effectivenessRank: item.effectivenessRank,
      isActive: true,
    };
    const existing = await prisma.controlLibraryItem.findUnique({ where: { code: item.code } });
    if (existing) {
      await prisma.controlLibraryItem.update({ where: { id: existing.id }, data });
      controlLibraryIds.set(item.code, existing.id);
      stats.controlLibrary.updated += 1;
    } else {
      const created = await prisma.controlLibraryItem.create({ data: { code: item.code, ...data } });
      controlLibraryIds.set(item.code, created.id);
      stats.controlLibrary.created += 1;
    }
  }

  // 6. Hazard library.
  for (const item of HAZARDS) {
    const data = {
      name: item.name,
      type: item.type,
      description: item.description,
      categoryId: categories.get(item.categoryCode) ?? null,
      defaultSeverityRank: item.defaultSeverityRank ?? null,
      tags: item.tags as Prisma.InputJsonValue,
      isActive: true,
    };
    const existing = await prisma.hazardLibraryItem.findUnique({ where: { code: item.code } });
    if (existing) {
      await prisma.hazardLibraryItem.update({ where: { id: existing.id }, data });
      stats.hazards.updated += 1;
    } else {
      await prisma.hazardLibraryItem.create({ data: { code: item.code, ...data } });
      stats.hazards.created += 1;
    }
  }
  console.log(
    `  libraries: ${stats.hazards.created + stats.hazards.updated} hazard item(s), ` +
      `${stats.controlLibrary.created + stats.controlLibrary.updated} control item(s)`,
  );

  // 7. Risk controls.
  for (const [i, seed] of CONTROLS.entries()) {
    const riskId = riskIds.get(seed.riskKey);
    if (!riskId) continue;
    const data = {
      riskId,
      title: seed.title,
      description: seed.description,
      type: seed.type,
      hierarchy: seed.hierarchy,
      status: seed.status,
      ownerId: ownerId(i),
      dueDate: daysAgo(-seed.dueInDays),
      implementedAt: seed.implementedDaysAgo ? daysAgo(seed.implementedDaysAgo) : null,
      verifiedById: seed.verifiedDaysAgo ? ownerId(i + 2) : null,
      verifiedAt: seed.verifiedDaysAgo ? daysAgo(seed.verifiedDaysAgo) : null,
      effectiveness: seed.effectiveness ?? null,
      isEffective: seed.isEffective ?? null,
      libraryItemId: seed.libraryCode ? controlLibraryIds.get(seed.libraryCode) ?? null : null,
    };
    const existing = await prisma.riskControl.findFirst({ where: { riskId, title: seed.title } });
    if (existing) {
      await prisma.riskControl.update({ where: { id: existing.id }, data });
      stats.controls.updated += 1;
    } else {
      await withUniqueRetry(async () => {
        const controlNumber = await nextNumber(
          prisma.riskControl,
          'controlNumber',
          'RC',
          new Date().getFullYear(),
        );
        return prisma.riskControl.create({ data: { controlNumber, createdById: ownerId(i), ...data } });
      });
      stats.controls.created += 1;
    }
  }
  console.log(`  controls: ${stats.controls.created} created, ${stats.controls.updated} updated`);

  // 8. Periodic reviews — at least one deliberately overdue and unreviewed.
  for (const [i, seed] of REVIEWS.entries()) {
    const riskId = riskIds.get(seed.riskKey);
    if (!riskId) continue;
    const dueAt = daysAgo(-seed.dueInDays);
    const isOverdue = !seed.reviewedDaysAgo && dueAt.getTime() < Date.now();
    const data = {
      riskId,
      dueAt,
      reviewedAt: seed.reviewedDaysAgo ? daysAgo(seed.reviewedDaysAgo) : null,
      reviewedById: seed.reviewedDaysAgo ? ownerId(i) : null,
      outcome: seed.outcome ?? null,
      findings: seed.findings ?? null,
      nextReviewAt: seed.nextReviewInDays ? daysAgo(-seed.nextReviewInDays) : null,
      overdueAt: isOverdue ? dueAt : null,
    };
    const existing = await prisma.riskReview.findFirst({ where: { riskId, dueAt } });
    if (existing) {
      await prisma.riskReview.update({ where: { id: existing.id }, data });
      stats.reviews.updated += 1;
    } else {
      await prisma.riskReview.create({ data: { createdById: ownerId(i), ...data } });
      stats.reviews.created += 1;
    }
  }
  console.log(`  reviews: ${stats.reviews.created} created, ${stats.reviews.updated} updated`);

  // 9. Assessments — one 5x5 matrix, one AIAG-VDA pFMEA worksheet.
  const teamSnapshot = (roles: string[]) =>
    roles.map((role, idx) => ({
      id: ownerId(idx) ?? `unassigned-${idx}`,
      name: ownerName(idx),
      role,
    }));

  const upsertAssessment = async (args: {
    title: string;
    objective: string;
    scopeText: string;
    methodology: 'MATRIX' | 'FMEA';
    status: 'APPROVED' | 'IN_ASSESSMENT';
    registerKey: RegisterKey;
    framework: LoadedFramework;
    startedAt: Date;
    completedAt: Date | null;
    approvedAt: Date | null;
    conclusion: string;
    nextReviewAt: Date;
    triggerType: string;
    team: string[];
  }) => {
    const registerId = registerIds.get(args.registerKey) ?? null;
    const data = {
      title: args.title,
      objective: args.objective,
      scopeText: args.scopeText,
      methodology: args.methodology,
      status: args.status,
      registerId,
      frameworkId: args.framework.row.id,
      // Approved assessments freeze the framework so the analysis stays
      // reproducible; drafts leave it null and re-render from live config.
      frameworkSnapshot: (args.status === 'APPROVED'
        ? (args.framework.scoring as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull) as Prisma.InputJsonValue,
      teamMembers: teamSnapshot(args.team) as Prisma.InputJsonValue,
      leadId: ownerId(0),
      siteId: site?.id ?? null,
      departmentId: qaDept?.id ?? null,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      approvedAt: args.approvedAt,
      approvedById: args.approvedAt ? ownerId(1) : null,
      conclusion: args.conclusion,
      nextReviewAt: args.nextReviewAt,
      triggerType: args.triggerType,
    };
    const existing = await prisma.riskAssessment.findFirst({ where: { title: args.title } });
    if (existing) {
      await prisma.riskAssessment.update({ where: { id: existing.id }, data });
      stats.assessments.updated += 1;
      return existing.id;
    }
    const created = await withUniqueRetry(async () => {
      const assessmentNumber = await nextNumber(
        prisma.riskAssessment,
        'assessmentNumber',
        'RA',
        args.startedAt.getFullYear(),
      );
      return prisma.riskAssessment.create({ data: { assessmentNumber, createdById: ownerId(0), ...data } });
    });
    stats.assessments.created += 1;
    return created.id;
  };

  const upsertLine = async (
    assessmentId: string,
    lineNumber: number,
    payload: Prisma.RiskAssessmentLineUncheckedCreateInput,
  ) => {
    const existing = await prisma.riskAssessmentLine.findUnique({
      where: { assessmentId_lineNumber: { assessmentId, lineNumber } },
    });
    if (existing) {
      const { assessmentId: _a, lineNumber: _l, ...update } = payload;
      await prisma.riskAssessmentLine.update({ where: { id: existing.id }, data: update });
      stats.lines.updated += 1;
    } else {
      await prisma.riskAssessmentLine.create({ data: payload });
      stats.lines.created += 1;
    }
  };

  // 9a. MATRIX assessment on the sterile filling register.
  const matrixStarted = monthsAgo(13, 4);
  const matrixAssessmentId = await upsertAssessment({
    title: 'Aseptic Process Risk Assessment — Sterile Filling Line 3',
    objective:
      'Assess the residual risk to sterility assurance of the aseptic filling process on Line 3 and confirm that the ' +
      'control strategy meets the contamination control strategy required by EU GMP Annex 1.',
    scopeText:
      'From sterile filtration of the bulk through filling, stoppering and capping, including personnel interventions, ' +
      'environmental control and component hold times. Excludes upstream compounding and downstream visual inspection.',
    methodology: 'MATRIX',
    status: 'APPROVED',
    registerKey: 'STERILE',
    framework: ich,
    startedAt: matrixStarted,
    completedAt: daysFrom(matrixStarted, 35),
    approvedAt: daysFrom(matrixStarted, 48),
    conclusion:
      'All hazards assessed are Medium or below after the agreed risk controls, with the exception of airflow disruption ' +
      'during open interventions which remains High and is accepted as ALARP under continuous monitoring. The control ' +
      'strategy is judged adequate; reassessment is required on any change to the intervention list.',
    nextReviewAt: daysFrom(matrixStarted, 420),
    triggerType: 'PERIODIC',
    team: ['Assessment Lead (QA)', 'Production — Aseptic Operations', 'Microbiology', 'Engineering', 'Qualified Person'],
  });

  for (const [idx, line] of MATRIX_LINES.entries()) {
    const initial = computeScore(ich.scoring, line.initial);
    const residual = line.residual ? computeScore(ich.scoring, line.residual) : null;
    await upsertLine(matrixAssessmentId, idx + 1, {
      assessmentId: matrixAssessmentId,
      lineNumber: idx + 1,
      hazard: line.hazard,
      consequence: line.consequence,
      cause: line.cause,
      currentControls: line.currentControls,
      initialFactors: initial.factors as Prisma.InputJsonValue,
      initialScore: initial.score,
      initialLevelId: initial.level.id,
      actionPriority: initial.actionPriority,
      recommendedAction: line.recommendedAction,
      ownerId: ownerId(idx),
      dueDate: daysAgo(-line.dueInDays),
      residualFactors: (residual ? residual.factors : Prisma.JsonNull) as Prisma.InputJsonValue,
      residualScore: residual?.score ?? null,
      residualLevelId: residual?.level.id ?? null,
      isCritical: line.isCritical,
      notes: line.notes,
      createdById: ownerId(0),
    });
  }

  // 9b. FMEA assessment on the pFMEA register.
  const fmeaStarted = monthsAgo(7, 6);
  const fmeaAssessmentId = await upsertAssessment({
    title: 'Process FMEA — Vial Filling, Stoppering and Capping Train (Line 3)',
    objective:
      'Identify the failure modes of each station in the filling train, evaluate them on the AIAG-VDA severity, ' +
      'occurrence and detection scales, and agree the optimisation actions for every High Action Priority item.',
    scopeText:
      'Vial washing, depyrogenation tunnel, sterile filtration, filling, stoppering, capping and automated visual ' +
      'inspection on Line 3. Machine and control-system failure modes only; personnel behaviours are covered by the ' +
      'aseptic process risk assessment.',
    methodology: 'FMEA',
    status: 'IN_ASSESSMENT',
    registerKey: 'FMEA',
    framework: fmea,
    startedAt: fmeaStarted,
    completedAt: null,
    approvedAt: null,
    conclusion:
      'Seven failure modes evaluated. Sterile filtration and the depyrogenation tunnel carry the highest severity and ' +
      'remain under optimisation; the stoppering and capping actions are implemented and awaiting effectiveness data.',
    nextReviewAt: daysFrom(fmeaStarted, 365),
    triggerType: 'CHANGE_CONTROL',
    team: ['Assessment Lead (QA)', 'Process Engineering', 'Maintenance', 'Production — Filling', 'Validation'],
  });

  for (const [idx, line] of FMEA_LINES.entries()) {
    const initial = computeScore(fmea.scoring, line.initial);
    const residual = line.residual ? computeScore(fmea.scoring, line.residual) : null;
    await upsertLine(fmeaAssessmentId, idx + 1, {
      assessmentId: fmeaAssessmentId,
      lineNumber: idx + 1,
      itemFunction: line.itemFunction,
      failureMode: line.failureMode,
      effect: line.effect,
      cause: line.cause,
      currentControls: line.currentControls,
      initialFactors: initial.factors as Prisma.InputJsonValue,
      initialScore: initial.score,
      initialLevelId: initial.level.id,
      actionPriority: initial.actionPriority,
      recommendedAction: line.recommendedAction,
      ownerId: ownerId(idx),
      dueDate: daysAgo(-line.dueInDays),
      residualFactors: (residual ? residual.factors : Prisma.JsonNull) as Prisma.InputJsonValue,
      residualScore: residual?.score ?? null,
      residualLevelId: residual?.level.id ?? null,
      riskId: riskIds.get('FMEA-STOPPER-JAM') && line.failureMode.startsWith('Stopper bowl jam')
        ? riskIds.get('FMEA-STOPPER-JAM')
        : null,
      isCritical: line.isCritical,
      notes: line.notes,
      createdById: ownerId(0),
    });
  }

  console.log(
    `  assessments: ${stats.assessments.created} created, ${stats.assessments.updated} updated ` +
      `(${stats.lines.created} line(s) created, ${stats.lines.updated} updated)`,
  );

  console.log('\nRisk demo data seed complete.');
  console.log(
    `  registers ${stats.registers.created}/${stats.registers.updated} (created/updated), ` +
      `risks ${stats.risks.created}/${stats.risks.updated}, ` +
      `controls ${stats.controls.created}/${stats.controls.updated}, ` +
      `reviews ${stats.reviews.created}/${stats.reviews.updated}, ` +
      `assessments ${stats.assessments.created}/${stats.assessments.updated}, ` +
      `hazard library ${stats.hazards.created}/${stats.hazards.updated}, ` +
      `control library ${stats.controlLibrary.created}/${stats.controlLibrary.updated}, ` +
      `snapshots ${stats.snapshots.created}`,
  );
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
