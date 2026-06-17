import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FMEAFailureMode {
  id: string;
  function: string;
  failureMode: string;
  effect: string;
  severity: number;
  cause: string;
  occurrence: number;
  preventionControl: string;
  detectionControl: string;
  detection: number;
  rpn: number;
  actionPriority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  responsible: string;
  targetDate: string;
  actionTaken: string;
  newSeverity: number | null;
  newOccurrence: number | null;
  newDetection: number | null;
  newRPN: number | null;
}

export interface FMEA {
  id: string;
  fmeaNumber: string;
  title: string;
  type: 'DFMEA' | 'PFMEA';
  productProcess: string;
  status: string;
  owner: string;
  ownerId: string;
  teamMembers: string[];
  scope: string;
  maxRPN: number;
  failureModes: FMEAFailureMode[];
  revisionHistory: { version: string; date: string; author: string; changes: string }[];
  createdAt: string;
  updatedAt: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const mockFailureModes1: FMEAFailureMode[] = [
  {
    id: 'fm1',
    function: 'Deliver accurate tablet weight within ±5% of target (600 mg)',
    failureMode: 'Tablet weight out of specification — low weight',
    effect: 'Sub-potent dose delivered to patient; therapeutic failure risk',
    severity: 9,
    cause: 'Punch tip wear reducing fill volume in die cavity',
    occurrence: 4,
    preventionControl: 'Punch inspection per PM schedule SOP-EQ-012 (every 5M tablets)',
    detectionControl: 'In-process weight check every 30 min (10-tablet sample)',
    detection: 3,
    rpn: 108,
    actionPriority: 'MEDIUM',
    recommendedAction: 'Install automated weight-rejection system with real-time feedback to force control',
    responsible: 'Vikram Patel',
    targetDate: '2026-04-15',
    actionTaken: 'Automated inline weight rejection unit installed on Compression Line 2',
    newSeverity: 9,
    newOccurrence: 2,
    newDetection: 2,
    newRPN: 36,
  },
  {
    id: 'fm2',
    function: 'Deliver accurate tablet weight within ±5% of target (600 mg)',
    failureMode: 'Tablet weight uniformity failure — high variability across turret positions',
    effect: 'Batch fails Ph. Eur. 2.9.5 uniformity test; batch rejection and patient risk',
    severity: 10,
    cause: 'Granule particle size segregation in feed hopper causing density variation by position',
    occurrence: 3,
    preventionControl: 'Granulation endpoint moisture control; flow agent optimisation in formulation',
    detectionControl: 'Weight uniformity test (20 tablets) at compression start and mid-batch',
    detection: 4,
    rpn: 120,
    actionPriority: 'HIGH',
    recommendedAction: 'Install anti-segregation baffle in compression hopper; validate with 3 process qualification batches',
    responsible: 'Dr. Priya Sharma',
    targetDate: '2026-04-20',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm3',
    function: 'Produce tablet with hardness 10–18 kP for adequate dissolution and friability',
    failureMode: 'Tablet hardness below specification (< 10 kP)',
    effect: 'Tablet friability failure; dissolution may be accelerated; packaging damage during handling',
    severity: 8,
    cause: 'Compression force set below validated range due to operator error during shift changeover',
    occurrence: 5,
    preventionControl: 'BMR pre-set compression force parameters; supervisor sign-off on machine setup',
    detectionControl: 'Hardness test (6 tablets) every 30 min during compression',
    detection: 2,
    rpn: 80,
    actionPriority: 'LOW',
    recommendedAction: 'Implement recipe-locked compression force via HMI with password-controlled override',
    responsible: 'Rajesh Kumar',
    targetDate: '2026-05-01',
    actionTaken: 'Recipe-lock feature enabled on Fette 2090 HMI; operator training completed',
    newSeverity: 8,
    newOccurrence: 2,
    newDetection: 2,
    newRPN: 32,
  },
  {
    id: 'fm4',
    function: 'Achieve dissolution Q ≥ 80% at 45 min in pH 6.8 phosphate buffer',
    failureMode: 'Dissolution failure — Q value below specification at 45-minute timepoint',
    effect: 'Batch fails release specification; potential sub-therapeutic bioavailability in patients',
    severity: 9,
    cause: 'Granulation moisture content above upper limit (> 2.0% LOD) resulting in over-dense granules',
    occurrence: 4,
    preventionControl: 'Fluid bed dryer endpoint LOD control per BMR; NIR moisture monitoring during drying',
    detectionControl: 'Stage 1 dissolution (6 vessels) at batch release; in-process hardness as surrogate indicator',
    detection: 5,
    rpn: 180,
    actionPriority: 'HIGH',
    recommendedAction: 'Install in-line NIR moisture sensor on fluid bed dryer; define automated stop at LOD 1.8%',
    responsible: 'Anita Desai',
    targetDate: '2026-05-15',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm5',
    function: 'Apply film coating uniformly to protect tablet and mask bitterness',
    failureMode: 'Film coating defect — logo bridging / tablet picking',
    effect: 'Cosmetic defect causing patient confusion; possible dose inaccuracy if coating contains API',
    severity: 6,
    cause: 'Inlet air temperature too high causing premature drying and sticking during pan coating',
    occurrence: 4,
    preventionControl: 'Validated coating parameters locked in recipe (inlet temp 55–65°C, spray rate 8–12 g/min)',
    detectionControl: 'Visual inspection of 50-tablet sample every 15 min; AQL final visual inspection',
    detection: 3,
    rpn: 72,
    actionPriority: 'LOW',
    recommendedAction: 'Add automated inlet temperature interlock to suspend spray if > 68°C; operator alert alarm',
    responsible: 'Deepak Nair',
    targetDate: '2026-05-10',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm6',
    function: 'Blend active (Paracetamol 500 mg) uniformly with excipients to achieve content uniformity',
    failureMode: 'Blend non-uniformity — content uniformity failure (RSD > 5%)',
    effect: 'Tablets with varying API content; patient over/under-dose; batch failure at release',
    severity: 10,
    cause: 'API agglomeration due to electrostatic charge; inadequate de-lumping prior to blending',
    occurrence: 2,
    preventionControl: 'API de-lumping through 0.5 mm screen prior to blending; earthing of blender vessel',
    detectionControl: 'Blend uniformity sampling (10 locations, USP <905>) before compression',
    detection: 3,
    rpn: 60,
    actionPriority: 'LOW',
    recommendedAction: 'Qualify humidity-controlled dispensing booth (RH 35–45%) to prevent API electrostatic agglomeration',
    responsible: 'Sunita Rao',
    targetDate: '2026-06-01',
    actionTaken: 'Humidity-controlled dispensing booth qualified; validation report approved',
    newSeverity: 10,
    newOccurrence: 1,
    newDetection: 2,
    newRPN: 20,
  },
];

export const mockFMEAs: FMEA[] = [
  {
    id: 'fmea1',
    fmeaNumber: 'FMEA-2026-001',
    title: 'Paracetamol 500mg Tablet Compression — Process FMEA',
    type: 'PFMEA',
    productProcess: 'Tablet Compression — Fette 2090, Line 2',
    status: 'IN_PROGRESS',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    teamMembers: ['Vikram Patel', 'Rajesh Kumar', 'Anita Desai'],
    scope: 'Full tablet compression process for Paracetamol 500mg from granule feed through compression, weight control, and tablet discharge; covering all 36 punch positions on Fette 2090 rotary press',
    maxRPN: 180,
    failureModes: mockFailureModes1,
    revisionHistory: [
      { version: '1.0', date: '2026-01-15', author: 'Dr. Priya Sharma', changes: 'Initial PFMEA creation for Paracetamol compression validation' },
      { version: '1.1', date: '2026-02-20', author: 'Vikram Patel', changes: 'Added FM4 (dissolution) and FM5 (coating defect) based on PQR 2025 trends' },
      { version: '1.2', date: '2026-03-10', author: 'Dr. Priya Sharma', changes: 'Updated RPN for FM1 after automated rejection unit installation' },
    ],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-03-25T14:30:00Z',
  },
  {
    id: 'fmea2',
    fmeaNumber: 'FMEA-2026-002',
    title: 'Ondansetron 4mg/2mL Injection — Aseptic Fill Design FMEA',
    type: 'DFMEA',
    productProcess: 'Aseptic Filling — Vial Fill-Finish Line 1',
    status: 'UNDER_REVIEW',
    owner: 'Deepak Nair',
    ownerId: 'u2',
    teamMembers: ['Sunita Rao', 'Anita Desai'],
    scope: 'Design FMEA for aseptic fill-finish of Ondansetron 4mg/2mL injection in 10mL Type I borosilicate glass vials; covering vial preparation, filling, stoppering, capping, and 100% visual inspection',
    maxRPN: 210,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2026-02-01', author: 'Deepak Nair', changes: 'Initial DFMEA aligned to EU GMP Annex 1 (2022 revision)' },
      { version: '2.0', date: '2026-03-15', author: 'Deepak Nair', changes: 'Major revision after aseptic process simulation (media fill) review' },
    ],
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-20T16:00:00Z',
  },
  {
    id: 'fmea3',
    fmeaNumber: 'FMEA-2026-003',
    title: 'Amoxicillin 250mg Capsule Encapsulation — Process FMEA',
    type: 'PFMEA',
    productProcess: 'Capsule Encapsulation — Bosch GKF 2500',
    status: 'APPROVED',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    teamMembers: ['Dr. Priya Sharma', 'Rajesh Kumar'],
    scope: 'Process FMEA for hard gelatin capsule filling of Amoxicillin 250mg on Bosch GKF 2500 encapsulator; covering powder feed, fill weight control, capsule lock, and in-process inspection',
    maxRPN: 168,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2025-11-10', author: 'Vikram Patel', changes: 'Initial PFMEA for new encapsulation line GKF 2500' },
      { version: '1.1', date: '2026-01-20', author: 'Vikram Patel', changes: 'Updated after annual process review; added fill weight variability failure mode' },
    ],
    createdAt: '2025-11-10T08:00:00Z',
    updatedAt: '2026-03-18T11:00:00Z',
  },
  {
    id: 'fmea4',
    fmeaNumber: 'FMEA-2026-004',
    title: 'Purified Water System — Distribution Loop Process FMEA',
    type: 'PFMEA',
    productProcess: 'Purified Water Generation & Distribution Loop',
    status: 'DRAFT',
    owner: 'Sunita Rao',
    ownerId: 'u5',
    teamMembers: ['Deepak Nair', 'Vikram Patel'],
    scope: 'Process FMEA for purified water generation (reverse osmosis + CEDI) and ambient distribution loop serving QC laboratory and manufacturing areas; covering 12 user points (UPs) per Schedule M requirements',
    maxRPN: 96,
    failureModes: [],
    revisionHistory: [
      { version: '0.1', date: '2026-03-20', author: 'Sunita Rao', changes: 'Draft creation following WU-04 microbial excursion (NC-2026-0015)' },
    ],
    createdAt: '2026-03-20T13:00:00Z',
    updatedAt: '2026-03-28T10:00:00Z',
  },
  {
    id: 'fmea5',
    fmeaNumber: 'FMEA-2026-005',
    title: 'Metformin 500mg Tablet — Granulation Process FMEA',
    type: 'PFMEA',
    productProcess: 'Wet Granulation — High-Shear Granulator HSG-600L',
    status: 'IN_PROGRESS',
    owner: 'Rajesh Kumar',
    ownerId: 'u6',
    teamMembers: ['Dr. Priya Sharma', 'Anita Desai', 'Deepak Nair'],
    scope: 'Process FMEA for wet granulation of Metformin 500mg covering dispensing, dry mixing, binder addition, wet massing, fluid bed drying, and milling; aligned to ICH Q8 design space and validated CPPs',
    maxRPN: 192,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2026-02-15', author: 'Rajesh Kumar', changes: 'Initial PFMEA creation following repeat dissolution failures (NC-2026-0039)' },
      { version: '1.1', date: '2026-03-22', author: 'Rajesh Kumar', changes: 'Added granulation moisture and LOD failure modes; updated detection controls' },
    ],
    createdAt: '2026-02-15T11:00:00Z',
    updatedAt: '2026-03-22T15:00:00Z',
  },
  // ── Additional records (20+ total for the demo) ──
  ...((): FMEA[] => {
    const extras: Array<[string, string, string, 'DFMEA' | 'PFMEA', string, string, string, string[], string, number]> = [
      ['fmea3',  'FMEA-2026-003',  'Aseptic Vial Filling — Insulin Glargine',      'PFMEA', 'Sterile filling line F-2',  'APPROVED', 'Kavita Menon',    ['Kavita Menon','Priya Sharma','Mohammed Iqbal'], 'Filling needle, stoppering, capping, EM points', 140],
      ['fmea4',  'FMEA-2026-004',  'Granulation — Metformin 500mg Wet Granulation','PFMEA', 'Fluid bed granulation',     'APPROVED', 'Sunita Rao',      ['Sunita Rao','Mohammed Iqbal'],                'Binder addition, drying endpoint, blend uniformity', 110],
      ['fmea5',  'FMEA-2026-005',  'Capsule Banding & Polishing',                  'PFMEA', 'Banding machine B-01',       'DRAFT',    'Sunita Rao',      ['Sunita Rao'],                                  'Omeprazole capsule banding and polishing', 90],
      ['fmea6',  'FMEA-2026-006',  'Terminal Sterilization — Autoclave TS-02',     'PFMEA', 'Autoclave TS-02',            'APPROVED', 'Mohammed Iqbal',  ['Mohammed Iqbal','Kavita Menon'],               'Temperature ramp, hold, cool-down', 100],
      ['fmea7',  'FMEA-2026-007',  'Raw-Material Dispensing Booth',                'PFMEA', 'Central dispensing',         'APPROVED', 'Sunita Rao',      ['Sunita Rao','Vikram Patel'],                   'Weighing accuracy, cross-contamination', 85],
      ['fmea8',  'FMEA-2026-008',  'WFI Generation & Distribution Loop',           'PFMEA', 'WFI generation',             'APPROVED', 'Mohammed Iqbal',  ['Mohammed Iqbal'],                              'Conductivity, TOC, bio-burden', 120],
      ['fmea9',  'FMEA-2026-009',  'HVAC — Grade A/B Air Management',              'PFMEA', 'Sterile block HVAC',         'APPROVED', 'Mohammed Iqbal',  ['Mohammed Iqbal','Kavita Menon'],               'HEPA integrity, pressure differentials', 105],
      ['fmea10', 'FMEA-2026-010',  'HPLC Assay Method — Paracetamol',              'DFMEA', 'HPLC method',                'APPROVED', 'Rajesh Kumar',    ['Rajesh Kumar'],                                'Method specificity, robustness, reproducibility', 75],
      ['fmea11', 'FMEA-2026-011',  'Batch Record Review (Electronic)',             'PFMEA', 'BRR workflow',               'APPROVED', 'Dr. Priya Sharma',['Dr. Priya Sharma','Anita Desai'],              '21 CFR Part 11 audit trail verification', 60],
      ['fmea12', 'FMEA-2026-012',  'Visual Inspection — Injection Vials',          'PFMEA', 'Brevetti AVI line',          'DRAFT',    'Kavita Menon',    ['Kavita Menon'],                                'Particle, crack, fill volume detection', 95],
      ['fmea13', 'FMEA-2026-013',  'Packaging Line — Bottle Fill & Capping',       'PFMEA', 'Bottle line PL-05',          'APPROVED', 'Vikram Patel',    ['Vikram Patel'],                                'Fill weight, cap torque, label placement', 80],
      ['fmea14', 'FMEA-2026-014',  'Quality Control LIMS Data Flow',               'PFMEA', 'LIMS v7.2',                  'APPROVED', 'Anita Desai',     ['Anita Desai','Rajesh Kumar'],                  'Sample login, result entry, approval chain', 55],
      ['fmea15', 'FMEA-2026-015',  'Cold-Chain Warehousing',                       'PFMEA', 'Finished goods 2–8°C',       'APPROVED', 'Sunita Rao',      ['Sunita Rao'],                                  'Temperature mapping, power outage response', 90],
      ['fmea16', 'FMEA-2026-016',  'Receipt & Quarantine of Incoming API',         'PFMEA', 'Goods-in / QA sampling',     'APPROVED', 'Dr. Priya Sharma',['Dr. Priya Sharma','Rajesh Kumar'],             'CoA verification, sampling plan, label transfer', 70],
      ['fmea17', 'FMEA-2026-017',  'Change Control Execution Workflow',            'PFMEA', 'QMS change control',         'APPROVED', 'Dr. Priya Sharma',['Dr. Priya Sharma'],                            'Impact assessment, approval path, closure', 45],
    ];
    return extras.map(([id, fmeaNumber, title, type, pp, status, owner, team, scope, rpn]) => ({
      id, fmeaNumber, title, type, productProcess: pp, status,
      owner, ownerId: 'u1', teamMembers: team, scope,
      maxRPN: rpn, failureModes: [], revisionHistory: [],
      createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z',
    }));
  })(),
];

// Medical-device FMEAs — ISO 14971 / IEC 62366 aligned (DFMEA + PFMEA).
const mockMedicalDeviceFailureModes: FMEAFailureMode[] = [
  {
    id: 'md-fm1', function: 'Deliver intravenous fluid at prescribed flow rate ±5%',
    failureMode: 'Over-delivery >10% above setpoint',
    effect: 'Fluid overload, pulmonary oedema, cardiac stress — potential patient harm',
    severity: 9, cause: 'Software rounding error in dosage calculation (IEC 62304 Class B)',
    occurrence: 3,
    preventionControl: 'Code review checklist + unit tests covering rounding boundaries (IEC 62304 §5.5)',
    detectionControl: 'Hardware-independent flow sensor cross-check; alarm at ±7% deviation',
    detection: 3, rpn: 81, actionPriority: 'HIGH',
    recommendedAction: 'Replace floating-point math with fixed-point dosage calc; re-run full IEC 62304 V&V',
    responsible: 'Aditya Menon', targetDate: '2026-05-30',
    actionTaken: 'Fixed-point refactor merged; V&V suite passed (CAPA-MD-2026-0014)',
    newSeverity: 9, newOccurrence: 1, newDetection: 2, newRPN: 18,
  },
  {
    id: 'md-fm2', function: 'Maintain sterile barrier through declared shelf life (3 years)',
    failureMode: 'Sterile barrier failure (seal delamination)',
    effect: 'Loss of sterility — surgical site infection or sepsis risk',
    severity: 10, cause: 'Heat-seal temperature drift on tray sealer TS-04 (heater element wear)',
    occurrence: 3,
    preventionControl: 'Quarterly PM on heater elements; validated process window per ASTM F2096',
    detectionControl: 'Daily seal-strength burst test on retention samples; SPC on seal temperature',
    detection: 2, rpn: 60, actionPriority: 'HIGH',
    recommendedAction: 'SPC with auto-stop on ±3 °C drift; replace heater elements on shorter interval',
    responsible: 'Neha Bansal', targetDate: '2026-04-20',
    actionTaken: 'Auto-stop SPC live; heater PM moved from 12-month to 6-month interval',
    newSeverity: 10, newOccurrence: 1, newDetection: 2, newRPN: 20,
  },
  {
    id: 'md-fm3', function: 'Allow safe over-the-needle vascular access',
    failureMode: 'Catheter tip fracture during insertion',
    effect: 'Retained foreign body; risk of embolism — severe patient harm',
    severity: 10, cause: 'Polymer extrusion defect creating stress riser at hub-to-shaft transition',
    occurrence: 2,
    preventionControl: 'Extrusion process Cpk ≥ 1.67 monitored daily',
    detectionControl: '100% visual inspection + tensile test (ASTM F640) on 0.1% AQL sample',
    detection: 3, rpn: 60, actionPriority: 'HIGH',
    recommendedAction: 'Add in-line laser micrometer for continuous wall-thickness verification',
    responsible: 'Sneha Kapoor', targetDate: '2026-06-30',
    actionTaken: 'PO raised for laser micrometer; install Q3 2026',
    newSeverity: 10, newOccurrence: 1, newDetection: 2, newRPN: 20,
  },
];

export const mockMedicalDeviceFMEAs: FMEA[] = [
  {
    id: 'md-fmea1', fmeaNumber: 'FMEA-MD-2026-001',
    title: 'DFMEA — Smart Infusion Pump v3.x (firmware + flow control)',
    type: 'DFMEA', productProcess: 'Smart Infusion Pump — Class IIb',
    status: 'ACTIVE', owner: 'Aditya Menon', ownerId: 'u-md6',
    teamMembers: ['Dr. Anjali Verma', 'Sneha Kapoor', 'Karthik Iyer'],
    scope: 'Design failure modes for firmware-driven peristaltic infusion pump intended for adult ICU use; covers software, motor control, sensors, alarms and HMI per IEC 62366-1.',
    maxRPN: 81, failureModes: mockMedicalDeviceFailureModes,
    revisionHistory: [
      { version: '1.0', date: '2025-11-12', author: 'Aditya Menon', changes: 'Initial DFMEA release supporting 510(k) submission' },
      { version: '1.1', date: '2026-04-04', author: 'Aditya Menon', changes: 'Updated RPN for FM1 post-CAPA-MD-2026-0014 verification' },
    ],
    createdAt: '2025-11-12T09:00:00Z', updatedAt: '2026-04-04T15:00:00Z',
  },
  {
    id: 'md-fmea2', fmeaNumber: 'FMEA-MD-2026-002',
    title: 'PFMEA — EO Sterilization Process (infusion sets, surgical drapes)',
    type: 'PFMEA', productProcess: 'EO Sterilization · 12-hour aeration cycle',
    status: 'ACTIVE', owner: 'Karthik Iyer', ownerId: 'u-md2',
    teamMembers: ['Dr. Anjali Verma', 'Rohit Khanna', 'Neha Bansal'],
    scope: 'Sterilization process failure modes from product loading through bioburden challenge, EO exposure, aeration and release per ISO 11135.',
    maxRPN: 90,
    failureModes: [mockMedicalDeviceFailureModes[1]],
    revisionHistory: [
      { version: '2.0', date: '2026-04-08', author: 'Karthik Iyer', changes: 'Major revision post-NC-MD-2026-0042; added PLC alarm controls' },
    ],
    createdAt: '2024-06-01T09:00:00Z', updatedAt: '2026-04-08T11:00:00Z',
  },
  {
    id: 'md-fmea3', fmeaNumber: 'FMEA-MD-2025-007',
    title: 'DFMEA — Intraocular Lens Assembly (haptic-optic junction)',
    type: 'DFMEA', productProcess: 'Intraocular Lens — Class IIb',
    status: 'ACTIVE', owner: 'Sneha Kapoor', ownerId: 'u-md5',
    teamMembers: ['Dr. Anjali Verma', 'Aditya Menon'],
    scope: 'Design failure modes covering optic geometry, haptic angulation, biocompatibility of acrylic copolymer and edge-glistening risk over 10-year implant horizon.',
    maxRPN: 75,
    failureModes: [],
    revisionHistory: [{ version: '1.0', date: '2025-08-12', author: 'Sneha Kapoor', changes: 'Initial release supporting CE-mark technical documentation' }],
    createdAt: '2025-08-12T09:00:00Z', updatedAt: '2025-12-04T14:00:00Z',
  },
  {
    id: 'md-fmea4', fmeaNumber: 'FMEA-MD-2025-005',
    title: 'PFMEA — Cleanroom (Class 7) Aseptic Assembly Process',
    type: 'PFMEA', productProcess: 'Class 7 Aseptic Assembly · ISO 14644',
    status: 'ACTIVE', owner: 'Dr. Anjali Verma', ownerId: 'u-md1',
    teamMembers: ['Neha Bansal', 'Karthik Iyer'],
    scope: 'Process failure modes for cleanroom gowning, materials transfer, equipment cleaning, environmental monitoring and product handover to packaging.',
    maxRPN: 84,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2024-11-21', author: 'Dr. Anjali Verma', changes: 'Initial release' },
      { version: '1.1', date: '2026-04-10', author: 'Dr. Anjali Verma', changes: 'Added HEPA degradation failure mode post-NC-MD-2026-0041' },
    ],
    createdAt: '2024-11-21T09:00:00Z', updatedAt: '2026-04-10T11:00:00Z',
  },
  // ── Disposables product family ──────────────────────────────────────────
  {
    id: 'md-fmea5', fmeaNumber: 'FMEA-MD-2026-005',
    title: 'DFMEA — 5 mL Disposable Syringe (DSY-26 family)',
    type: 'DFMEA', productProcess: 'Disposable Syringe — Class IIa',
    status: 'ACTIVE', owner: 'Aditya Menon', ownerId: 'u-md6',
    teamMembers: ['Dr. Anjali Verma', 'Sneha Kapoor', 'Rohit Khanna'],
    scope: 'Design failure modes covering barrel material, plunger lubrication, needle-hub bond, graduation accuracy and primary packaging sterile-barrier integrity for the 5 mL DSY-26 series.',
    maxRPN: 72,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2025-01-12', author: 'Aditya Menon', changes: 'Initial DFMEA release supporting BIS / FDA 510(k) submission' },
      { version: '1.1', date: '2026-04-08', author: 'Aditya Menon', changes: 'Added silicone-oil over-lubrication failure mode (post-NC-MD-2026-0037)' },
    ],
    createdAt: '2025-01-12T09:00:00Z', updatedAt: '2026-04-08T15:00:00Z',
  },
  {
    id: 'md-fmea6', fmeaNumber: 'FMEA-MD-2026-006',
    title: 'PFMEA — Hypodermic Needle Hub Assembly (NAM-04 Line)',
    type: 'PFMEA', productProcess: 'Needle Hub Assembly · ASTM F1816',
    status: 'ACTIVE', owner: 'Rohit Khanna', ownerId: 'u-md4',
    teamMembers: ['Karthik Iyer', 'Aditya Menon'],
    scope: 'Process failure modes for hub-to-cannula UV bonding, pin-bend straightening, lubrication application and blister sealing on Needle Assembly Machine NAM-04.',
    maxRPN: 90,
    failureModes: [],
    revisionHistory: [{ version: '2.0', date: '2026-04-04', author: 'Rohit Khanna', changes: 'Major revision post-NC-MD-2026-0036; cam-follower wear pathway added' }],
    createdAt: '2024-03-10T09:00:00Z', updatedAt: '2026-04-04T11:00:00Z',
  },
  {
    id: 'md-fmea7', fmeaNumber: 'FMEA-MD-2026-007',
    title: 'PFMEA — Foley Catheter Silicone Dip Moulding (FCT-MC-02)',
    type: 'PFMEA', productProcess: 'Silicone Dip Moulding · ISO 20696',
    status: 'ACTIVE', owner: 'Karthik Iyer', ownerId: 'u-md2',
    teamMembers: ['Rohit Khanna', 'Sneha Kapoor'],
    scope: 'Process failure modes for silicone bath temperature, dwell time, dip-cycle count, balloon wall thickness and burst-volume QA for the FCT-26 series Foley catheter family.',
    maxRPN: 80,
    failureModes: [],
    revisionHistory: [{ version: '1.0', date: '2025-03-22', author: 'Karthik Iyer', changes: 'Initial release' }, { version: '1.1', date: '2026-04-12', author: 'Karthik Iyer', changes: 'Added thermocouple drift failure mode (post-NC-MD-2026-0033)' }],
    createdAt: '2025-03-22T09:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
];

// Dairy tenant — HACCP-aligned PFMEAs across raw-milk receiving, pasteurization,
// curd / paneer / ghee processes and packaging.
export const mockDairyFMEAs: FMEA[] = [
  {
    id: 'dy-fmea1', fmeaNumber: 'FMEA-DY-2026-001',
    title: 'PFMEA — HTST Pasteurization (PHE-01 / PHE-02)',
    type: 'PFMEA', productProcess: 'HTST Pasteurization · 72 °C / 15 s',
    status: 'ACTIVE', owner: 'Ravi Deshmukh', ownerId: 'u-dy4',
    teamMembers: ['Sandeep Joshi', 'Anita Kulkarni'],
    scope: 'Failure modes for raw-milk reception into PHE feed tank, temperature control on PHE-01 / PHE-02, holding-tube residence-time, flow-diversion valve actuation and CIP recovery between batches.',
    maxRPN: 90,
    failureModes: [],
    revisionHistory: [{ version: '2.0', date: '2026-04-25', author: 'Ravi Deshmukh', changes: 'Major revision post-NC-DY-2026-0038; thermometer-drift mode added' }],
    createdAt: '2024-03-12T09:00:00Z', updatedAt: '2026-04-25T11:00:00Z',
  },
  {
    id: 'dy-fmea2', fmeaNumber: 'FMEA-DY-2026-002',
    title: 'PFMEA — Curd Fermentation & Cup Filling',
    type: 'PFMEA', productProcess: 'Curd Fermentation · 42 °C / 6 h',
    status: 'ACTIVE', owner: 'Anita Kulkarni', ownerId: 'u-dy3',
    teamMembers: ['Ravi Deshmukh', 'Priya Khanna'],
    scope: 'Failure modes for starter-culture inoculation, fermentation tank temperature uniformity, pH end-point, CIP between batches and cup-filling sealing integrity.',
    maxRPN: 84,
    failureModes: [],
    revisionHistory: [{ version: '1.1', date: '2026-04-12', author: 'Anita Kulkarni', changes: 'Added CIP-shortcut failure mode (post NC-DY-2026-0034)' }],
    createdAt: '2024-11-10T09:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  {
    id: 'dy-fmea3', fmeaNumber: 'FMEA-DY-2026-003',
    title: 'PFMEA — Ghee Boiling & Clarification',
    type: 'PFMEA', productProcess: 'Ghee Clarification · BIS IS 3508',
    status: 'ACTIVE', owner: 'Ravi Deshmukh', ownerId: 'u-dy4',
    teamMembers: ['Anita Kulkarni'],
    scope: 'Failure modes for butter ageing, boiling-kettle temperature profile, sediment removal, FFA monitoring and 1L tin filling on the ghee line.',
    maxRPN: 72,
    failureModes: [],
    revisionHistory: [{ version: '1.2', date: '2026-03-28', author: 'Ravi Deshmukh', changes: 'Tightened butter-to-ghee turnaround to 48 h post NC-DY-2026-0029' }],
    createdAt: '2025-02-19T09:00:00Z', updatedAt: '2026-03-28T11:00:00Z',
  },
  {
    id: 'dy-fmea4', fmeaNumber: 'FMEA-DY-2026-004',
    title: 'PFMEA — Form-Fill-Seal Milk Pouch Lines',
    type: 'PFMEA', productProcess: 'FFS Milk-Pouch Filling',
    status: 'ACTIVE', owner: 'Priya Khanna', ownerId: 'u-dy5',
    teamMembers: ['Sandeep Joshi', 'Ravi Deshmukh'],
    scope: 'Failure modes for product feed temperature, fill-volume accuracy, heat-seal jaw temperature, dwell time, date/MRP printing and drop-test reject rate across FFS-01 to FFS-04.',
    maxRPN: 80,
    failureModes: [],
    revisionHistory: [
      { version: '2.0', date: '2026-03-15', author: 'Priya Khanna', changes: 'Heat-seal jaw wear failure mode added post NC-DY-2026-0024' },
      { version: '2.1', date: '2026-04-28', author: 'Priya Khanna', changes: 'Best-before / MRP misprint failure mode added post NC-DY-2025-0118' },
    ],
    createdAt: '2024-08-05T09:00:00Z', updatedAt: '2026-04-28T11:00:00Z',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE). Drug-substance
// (fermentation/upstream, chromatography purification) plus aseptic cartridge
// fill-finish, lyophilization and cold-chain for insulin, analogues and GLP-1.
const mockBiologicsFailureModes: FMEAFailureMode[] = [
  {
    id: 'bio-fm1', function: 'Seat chlorobutyl stopper to maintain container-closure integrity on insulin cartridge',
    failureMode: 'Incomplete stopper seating — CCIT failure',
    effect: 'Loss of sterility and sterile-barrier breach; non-sterile parenteral reaches patient',
    severity: 10, cause: 'Stopper-insertion vacuum drift on fill-finish line FF-01 (pump seal wear)',
    occurrence: 3,
    preventionControl: 'Validated vacuum-stoppering window per EU GMP Annex 1 (2022); PM on insertion pump seals',
    detectionControl: '100% in-line headspace CCIT (laser-based); residual-seal-force trending',
    detection: 2, rpn: 60, actionPriority: 'HIGH',
    recommendedAction: 'Add closed-loop vacuum control with auto-reject on ±5% drift; revalidate CCIT challenge set',
    responsible: 'Dr. Layla Al-Mansoori', targetDate: '2026-05-30',
    actionTaken: 'Closed-loop vacuum control live on FF-01; CCIT challenge revalidated (CAPA-BIO-2026-0011)',
    newSeverity: 10, newOccurrence: 1, newDetection: 2, newRPN: 20,
  },
  {
    id: 'bio-fm2', function: 'Deliver target fill weight 3.0 mL ±2% into 3 mL insulin cartridge',
    failureMode: 'Fill-weight under-delivery below lower limit',
    effect: 'Sub-therapeutic dose units; under-fill drives patient under-dosing of insulin analogue',
    severity: 8, cause: 'Time-pressure dosing pump cavitation from product foaming at filling needle',
    occurrence: 4,
    preventionControl: 'Validated fill parameters with anti-foam de-aeration; nitrogen overlay on bulk hold',
    detectionControl: '100% in-line check-weigh with statistical reject; AQL gravimetric fill verification',
    detection: 3, rpn: 96, actionPriority: 'HIGH',
    recommendedAction: 'Switch to peristaltic single-use dosing with feedback check-weigher; requalify fill accuracy',
    responsible: 'Omar Al-Farsi', targetDate: '2026-06-15',
    actionTaken: '',
    newSeverity: null, newOccurrence: null, newDetection: null, newRPN: null,
  },
  {
    id: 'bio-fm3', function: 'Maintain product sterility through 0.22 µm sterilizing-grade filtration of bulk drug product',
    failureMode: 'Sterilizing filter integrity failure (post-use bubble-point fail)',
    effect: 'Potential non-sterile batch; bioburden / endotoxin breakthrough into final product',
    severity: 10, cause: 'Filter membrane stress from over-pressure transient during filtration startup',
    occurrence: 2,
    preventionControl: 'Pre- and post-use integrity testing (bubble point); validated max differential pressure',
    detectionControl: 'Automated integrity-test instrument with pass/fail interlock to release; redundant filtration',
    detection: 2, rpn: 40, actionPriority: 'HIGH',
    recommendedAction: 'Install soft-start pressure ramp on filtration skid; add redundant in-series sterilizing filter',
    responsible: 'Fatima Al-Hashimi', targetDate: '2026-04-28',
    actionTaken: 'Soft-start ramp commissioned; redundant filter housing qualified (CAPA-BIO-2026-0008)',
    newSeverity: 10, newOccurrence: 1, newDetection: 2, newRPN: 20,
  },
];

export const mockBiologicsFMEAs: FMEA[] = [
  {
    id: 'bio-fmea1', fmeaNumber: 'FMEA-BIO-2026-0001',
    title: 'PFMEA — Aseptic Cartridge Fill-Finish Line (FF-01, insulin analogues)',
    type: 'PFMEA', productProcess: 'Aseptic Cartridge Fill-Finish · EU GMP Annex 1',
    status: 'ACTIVE', owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1',
    teamMembers: ['Omar Al-Farsi', 'Fatima Al-Hashimi', 'Yusuf Rahman'],
    scope: 'Process failure modes for aseptic fill-finish of 3 mL insulin / analogue cartridges from sterile filtration through filling, stoppering, capping and 100% CCIT on line FF-01 in Grade A isolator.',
    maxRPN: 96, failureModes: mockBiologicsFailureModes,
    revisionHistory: [
      { version: '1.0', date: '2025-12-02', author: 'Dr. Layla Al-Mansoori', changes: 'Initial PFMEA release aligned to EU GMP Annex 1 (2022) contamination control strategy' },
      { version: '1.1', date: '2026-04-18', author: 'Dr. Layla Al-Mansoori', changes: 'Updated RPN for CCIT failure mode post-CAPA-BIO-2026-0011 verification' },
    ],
    createdAt: '2025-12-02T09:00:00Z', updatedAt: '2026-04-18T15:00:00Z',
  },
  {
    id: 'bio-fmea2', fmeaNumber: 'FMEA-BIO-2026-0002',
    title: 'Process FMEA — Fermentation / Upstream (insulin precursor)',
    type: 'PFMEA', productProcess: 'Microbial Fermentation · 15,000 L bioreactor train',
    status: 'ACTIVE', owner: 'Omar Al-Farsi', ownerId: 'u-bio2',
    teamMembers: ['Dr. Layla Al-Mansoori', 'Yusuf Rahman'],
    scope: 'Upstream failure modes for media preparation, inoculum scale-up, bioreactor sterilization, foam control and harvest, covering bioreactor foam-out and microbial contamination risk for the insulin-precursor fermentation.',
    maxRPN: 90,
    failureModes: [],
    revisionHistory: [
      { version: '2.0', date: '2026-04-08', author: 'Omar Al-Farsi', changes: 'Major revision post-NC-BIO-2026-0031; foam-out and antifoam-dosing modes added' },
    ],
    createdAt: '2024-09-14T09:00:00Z', updatedAt: '2026-04-08T11:00:00Z',
  },
  {
    id: 'bio-fmea3', fmeaNumber: 'FMEA-BIO-2026-0003',
    title: 'Process FMEA — Chromatography Purification (capture & polishing)',
    type: 'PFMEA', productProcess: 'Chromatography Purification · AEX / HIC columns',
    status: 'ACTIVE', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3',
    teamMembers: ['Omar Al-Farsi', 'Yusuf Rahman'],
    scope: 'Downstream failure modes for column packing quality, buffer composition, load challenge, elution gradient and column channeling / endotoxin breakthrough across the AEX capture and HIC polishing steps.',
    maxRPN: 100,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2025-06-20', author: 'Fatima Al-Hashimi', changes: 'Initial release' },
      { version: '1.1', date: '2026-04-15', author: 'Fatima Al-Hashimi', changes: 'Added column-channeling HETP failure mode post-NC-BIO-2026-0028' },
    ],
    createdAt: '2025-06-20T09:00:00Z', updatedAt: '2026-04-15T11:00:00Z',
  },
  {
    id: 'bio-fmea4', fmeaNumber: 'FMEA-BIO-2026-0004',
    title: 'Process FMEA — Lyophilization (GLP-1 drug product)',
    type: 'PFMEA', productProcess: 'Lyophilization · freeze-dryer LYO-02',
    status: 'ACTIVE', owner: 'Yusuf Rahman', ownerId: 'u-bio4',
    teamMembers: ['Dr. Layla Al-Mansoori', 'Fatima Al-Hashimi'],
    scope: 'Process failure modes for loading, freezing ramp, primary and secondary drying, shelf-temperature uniformity and stoppering under vacuum for the lyophilized GLP-1 drug product on LYO-02.',
    maxRPN: 84,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2025-03-11', author: 'Yusuf Rahman', changes: 'Initial release' },
      { version: '1.1', date: '2026-04-12', author: 'Yusuf Rahman', changes: 'Added cake-collapse / shelf-temperature drift failure mode post-NC-BIO-2026-0024' },
    ],
    createdAt: '2025-03-11T09:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  {
    id: 'bio-fmea5', fmeaNumber: 'FMEA-BIO-2026-0005',
    title: 'Process FMEA — Cold-Chain Storage & Distribution (2–8 °C)',
    type: 'PFMEA', productProcess: 'Cold-Chain · GDP qualified 2–8 °C',
    status: 'ACTIVE', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3',
    teamMembers: ['Yusuf Rahman', 'Omar Al-Farsi'],
    scope: 'Distribution failure modes for finished-goods cold-room mapping, power-outage response, shipper qualification, temperature monitoring and analogue label mix-up risk for 2–8 °C insulin / GLP-1 product.',
    maxRPN: 80,
    failureModes: [],
    revisionHistory: [
      { version: '2.0', date: '2026-03-20', author: 'Fatima Al-Hashimi', changes: 'Major revision post-NC-BIO-2026-0019; 2–8 °C excursion and shipper-failure modes added' },
      { version: '2.1', date: '2026-04-26', author: 'Fatima Al-Hashimi', changes: 'Added analogue label mix-up failure mode post-NC-BIO-2025-0102' },
    ],
    createdAt: '2024-10-08T09:00:00Z', updatedAt: '2026-04-26T11:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface FMEAFilters {
  type?: string;
  status?: string;
  search?: string;
}

export function useFMEAs(filters: FMEAFilters = {}) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['fmeas', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        // Backend mount is /qms/fmea (singular)
        const { data } = await api.get('/qms/fmea', { params: filters });
        return unwrapList<FMEA>(data);
      } catch {
        const baseList = pickByIndustry(industry, mockFMEAs, { medical_device: mockMedicalDeviceFMEAs, dairy: mockDairyFMEAs, biologics: mockBiologicsFMEAs });
        let filtered = [...baseList];
        if (filters.type) filtered = filtered.filter((f) => f.type === filters.type);
        if (filters.status) filtered = filtered.filter((f) => f.status === filters.status);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (f) =>
              f.title.toLowerCase().includes(q) ||
              f.fmeaNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useFMEA(id: string) {
  const industry = useUserIndustry();
  return useQuery<FMEA>({
    queryKey: ['fmeas', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/fmea/${id}`);
        return unwrapItem<FMEA>(data);
      } catch {
        const baseList = pickByIndustry(industry, mockFMEAs, { medical_device: mockMedicalDeviceFMEAs, dairy: mockDairyFMEAs, biologics: mockBiologicsFMEAs });
        const fmea = baseList.find((f) => f.id === id);
        if (!fmea) throw new Error('FMEA not found');
        // For records with no failure modes, lazily attach a representative
        // sample so the detail page has data to render.
        if (fmea.failureModes && fmea.failureModes.length > 0) return fmea;
        const fallbackModes = industry === 'medical_device'
          ? mockMedicalDeviceFailureModes
          : mockFailureModes1.slice(0, 3);
        return { ...fmea, failureModes: fallbackModes };
      }
    },
    enabled: !!id,
  });
}

export function useCreateFMEA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/fmeas', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fmeas'] });
      toast.success('FMEA created successfully');
    },
    onError: () => {
      toast.error('Failed to create FMEA');
    },
  });
}
