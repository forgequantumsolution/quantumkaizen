import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

const flattenCAPA = (c: Record<string, unknown>) => flattenUsers(c, ['owner']);

// ── Types ───────────────────────────────────────────────────────────────────

export type CAPASource = 'NC' | 'AUDIT' | 'COMPLAINT' | 'PROACTIVE' | 'MANAGEMENT' | 'CUSTOMER';
export type CAPASeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type CAPALifecycle =
  | 'INITIATED'
  | 'CONTAINMENT'
  | 'ROOT_CAUSE_ANALYSIS'
  | 'ACTION_DEFINITION'
  | 'IMPLEMENTATION'
  | 'EFFECTIVENESS_VERIFICATION'
  | 'CLOSED';

export interface FiveWhyEntry {
  whyNumber: number;
  question: string;
  answer: string;
}

export interface FishboneCause {
  id: string;
  text: string;
}

export interface FishboneData {
  man: FishboneCause[];
  machine: FishboneCause[];
  material: FishboneCause[];
  method: FishboneCause[];
  measurement: FishboneCause[];
  environment: FishboneCause[];
}

export interface CAPAAction {
  id: string;
  description: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  completedDate?: string | null;
  evidence?: string | null;
}

export interface CAPAHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface CAPARecord {
  id: string;
  capaNumber: string;
  title: string;
  description: string;
  source: CAPASource;
  severity: CAPASeverity;
  status: CAPALifecycle;
  department: string;
  productProcess: string | null;
  linkedSourceRecord: string | null;
  owner: string;
  ownerId: string;
  dueDate: string;
  fiveWhys: FiveWhyEntry[];
  fishbone: FishboneData;
  actions: CAPAAction[];
  effectivenessCriteria: string | null;
  monitoringPeriodDays: number;
  effectivenessResult: 'PASS' | 'FAIL' | null;
  effectivenessEvidence: string | null;
  history: CAPAHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockCAPAs: CAPARecord[] = [
  // ── 2026 records ──
  {
    id: 'capa1',
    capaNumber: 'CAPA-2026-0012',
    title: 'CAPA for repeat HPLC assay OOS on Paracetamol 500mg batches — reference standard degradation',
    description: 'Two consecutive Paracetamol 500mg batches (B26-PA-0112, B24-PA-0088) reported HPLC assay OOS results. Phase II OOS investigation confirmed root cause as degradation of reference standard lot RS-2026-004 due to storage at ambient temperature instead of cold-chain conditions (2–8°C). All affected test data requires invalidation and retesting.',
    source: 'NC',
    severity: 'CRITICAL',
    status: 'ROOT_CAUSE_ANALYSIS',
    department: 'Quality Control',
    productProcess: 'HPLC Assay — Reference Standard Management',
    linkedSourceRecord: 'NC-2026-0042',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    dueDate: '2026-04-20',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did the HPLC assay return an OOS result?', answer: 'Reference standard solution prepared from a degraded reference standard gave a lower response than expected.' },
      { whyNumber: 2, question: 'Why was the reference standard degraded?', answer: 'Lot RS-2026-004 was stored at ambient temperature (25°C) rather than the required 2–8°C cold storage.' },
      { whyNumber: 3, question: 'Why was it stored at the wrong temperature?', answer: 'The storage requirement was not clearly stated on the reference standard label; analyst followed previous analyst\'s practice.' },
      { whyNumber: 4, question: 'Why was the storage requirement not on the label?', answer: 'The reference standard logbook entry did not capture cold-chain storage requirement from the CoA.' },
      { whyNumber: 5, question: 'Why was this gap in the reference standard management SOP not identified earlier?', answer: 'Last SOP review was 3 years ago; cold-chain section was not updated to reflect new supplier CoA requirements.' },
    ],
    fishbone: {
      man: [{ id: 'f1', text: 'Analyst followed previous practice without verifying CoA storage conditions' }, { id: 'f2', text: 'No training record for updated storage requirements' }],
      machine: [{ id: 'f3', text: 'Reference standard refrigerator capacity insufficient — some standards stored outside fridge' }],
      material: [{ id: 'f4', text: 'Reference standard lot RS-2026-004 received without cold-chain packaging from supplier' }],
      method: [{ id: 'f5', text: 'Reference standard management SOP outdated — storage requirements not specified per CoA' }, { id: 'f6', text: 'No mandatory CoA review step at receipt in SOP' }],
      measurement: [{ id: 'f7', text: 'No stability monitoring for reference standard storage conditions' }],
      environment: [{ id: 'f8', text: 'QC lab ambient temperature reaches 28°C in summer months' }],
    },
    actions: [
      { id: 'a1', description: 'Discard lot RS-2026-004 and procure replacement reference standard with verified cold-chain delivery', type: 'CORRECTIVE', owner: 'Rajesh Kumar', dueDate: '2026-04-08', status: 'COMPLETED', completedDate: '2026-04-07' },
      { id: 'a2', description: 'Retest all batches whose assay was performed using RS-2026-004 with fresh standard', type: 'CORRECTIVE', owner: 'Rajesh Kumar', dueDate: '2026-04-15', status: 'IN_PROGRESS' },
      { id: 'a3', description: 'Revise SOP-QC-022 (Reference Standard Management) to mandate CoA review at receipt and cold-chain storage logging', type: 'PREVENTIVE', owner: 'Dr. Priya Sharma', dueDate: '2026-04-10', status: 'IN_PROGRESS' },
      { id: 'a4', description: 'Install additional reference standard refrigerator (4°C, alarmed) in QC laboratory', type: 'PREVENTIVE', owner: 'Deepak Nair', dueDate: '2026-04-20', status: 'PENDING' },
      { id: 'a5', description: 'Conduct training for all QC analysts on updated reference standard management SOP', type: 'PREVENTIVE', owner: 'Sunita Rao', dueDate: '2026-04-22', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero HPLC OOS attributable to reference standard issues over 90-day monitoring period. All reference standard storage conditions logged and within specification at each weekly check.',
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h1', timestamp: '2026-03-30T09:30:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Initiated', details: 'CAPA created following second consecutive OOS from NC-2026-0042' },
      { id: 'h2', timestamp: '2026-03-31T10:00:00Z', user: 'Rajesh Kumar', action: 'Containment Applied', details: 'RS-2026-004 quarantined; all in-progress assays using this lot suspended' },
      { id: 'h3', timestamp: '2026-04-01T14:00:00Z', user: 'Dr. Priya Sharma', action: 'Root Cause Analysis Started', details: '5-Why and fishbone analysis initiated; storage records under review' },
    ],
    createdAt: '2026-03-30T09:30:00Z',
    updatedAt: '2026-04-01T14:00:00Z',
    closedAt: null,
    createdBy: 'Dr. Priya Sharma',
  },
  {
    id: 'capa2',
    capaNumber: 'CAPA-2026-0011',
    title: 'CAPA for microbial contamination in Grade B cleanroom — gowning procedure gap',
    description: 'Active air sampling excursion (5 CFU/m³ vs. NMT 1 CFU/m³) in Grade B aseptic fill area during Ondansetron injection batch B26-ON-0088. CCTV review and gowning observation identified that the hand sanitisation step was not consistently performed between glove layers. Staphylococcus epidermidis isolated — commensal skin flora, consistent with gowning breach.',
    source: 'NC',
    severity: 'CRITICAL',
    status: 'IMPLEMENTATION',
    department: 'Production',
    productProcess: 'Aseptic Gowning / Grade B Cleanroom',
    linkedSourceRecord: 'NC-2026-0041',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    dueDate: '2026-04-25',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was microbial contamination detected in Grade B area?', answer: 'Skin-flora organism isolated, indicating a breach in aseptic gowning technique.' },
      { whyNumber: 2, question: 'Why was gowning technique inadequate?', answer: 'Hand sanitisation between inner and outer gloves was omitted by the operator during observed session.' },
      { whyNumber: 3, question: 'Why was this step omitted?', answer: 'Gowning observation programme showed only annual frequency; no recent competency re-assessment for this operator.' },
      { whyNumber: 4, question: 'Why were gowning observations annual only?', answer: 'SOP-MA-012 specified minimum annual gowning qualification with no provision for triggered re-assessment after contamination events.' },
    ],
    fishbone: {
      man: [{ id: 'f9', text: 'Operator did not complete hand sanitisation between glove layers' }, { id: 'f10', text: 'Gowning qualification not refreshed post-contamination event' }],
      machine: [],
      material: [{ id: 'f11', text: 'Hand sanitiser dispenser at gowning station found empty on day of event' }],
      method: [{ id: 'f12', text: 'SOP-MA-012 specifies annual gowning qualification only — no triggered re-qualification after EM excursion' }, { id: 'f13', text: 'No independent gowning verification step before Grade B entry' }],
      measurement: [{ id: 'f14', text: 'EM data reviewed monthly — excursion not acted on in real time' }],
      environment: [{ id: 'f15', text: 'High fill campaign workload increased throughput pressure' }],
    },
    actions: [
      { id: 'a6', description: 'Re-qualify all Grade B aseptic area operators with gowning competency assessment within 5 days', type: 'CORRECTIVE', owner: 'Sunita Rao', dueDate: '2026-04-05', status: 'COMPLETED', completedDate: '2026-04-04' },
      { id: 'a7', description: 'Install hand sanitiser dispenser check into gowning room entry checklist with sign-off', type: 'CORRECTIVE', owner: 'Vikram Patel', dueDate: '2026-04-08', status: 'COMPLETED', completedDate: '2026-04-07' },
      { id: 'a8', description: 'Revise SOP-MA-012 to require triggered gowning re-qualification after any Grade B EM excursion', type: 'PREVENTIVE', owner: 'Dr. Priya Sharma', dueDate: '2026-04-15', status: 'IN_PROGRESS' },
      { id: 'a9', description: 'Increase gowning observation frequency to quarterly for all Grade B personnel', type: 'PREVENTIVE', owner: 'Rajesh Kumar', dueDate: '2026-04-18', status: 'PENDING' },
    ],
    effectivenessCriteria: 'No Grade B EM excursions attributable to gowning over 90-day monitoring period. 100% of operators re-qualified. Gowning observations conducted quarterly per revised schedule.',
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h4', timestamp: '2026-03-28T14:00:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Initiated', details: 'Raised from NC-2026-0041 — Grade B contamination event' },
      { id: 'h5', timestamp: '2026-03-30T11:00:00Z', user: 'Rajesh Kumar', action: 'Root Cause Completed', details: '5-Why analysis confirmed gowning technique gap and inadequate re-qualification frequency' },
      { id: 'h6', timestamp: '2026-04-01T09:00:00Z', user: 'Vikram Patel', action: 'Actions Defined', details: '4 corrective and preventive actions assigned' },
      { id: 'h7', timestamp: '2026-04-07T16:00:00Z', user: 'Sunita Rao', action: 'Actions Partially Completed', details: 'Operator re-qualification complete; sanitiser checklist implemented' },
    ],
    createdAt: '2026-03-28T14:00:00Z',
    updatedAt: '2026-04-07T16:00:00Z',
    closedAt: null,
    createdBy: 'Rajesh Kumar',
  },
  {
    id: 'capa3',
    capaNumber: 'CAPA-2026-0010',
    title: 'CAPA for label mix-up during packaging — inadequate line clearance SOP',
    description: 'Wrong batch number printed on Metformin 500mg cartons (NC-2026-0040). Investigation established that line clearance SOP-PK-007 did not require a printed label reconciliation and verification step between successive batch runs. Previous batch label rolls were not fully removed before new batch labels were loaded.',
    source: 'NC',
    severity: 'CRITICAL',
    status: 'ACTION_DEFINITION',
    department: 'Quality Assurance',
    productProcess: 'Secondary Packaging / Line Clearance',
    linkedSourceRecord: 'NC-2026-0040',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    dueDate: '2026-04-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were wrong batch number labels used?', answer: 'Residual label rolls from batch B26-MF-0069 were not removed before B26-MF-0074 labels were loaded.' },
      { whyNumber: 2, question: 'Why were residual labels not removed?', answer: 'Line clearance checklist did not include a step to physically reconcile and return/destroy all printed labels from the previous batch.' },
      { whyNumber: 3, question: 'Why was label reconciliation not in the checklist?', answer: 'SOP-PK-007 was last revised in 2021 before label-on-demand printing was introduced; the SOP was not updated to address partial-roll management.' },
    ],
    fishbone: {
      man: [{ id: 'f16', text: 'Operator assumed previous batch labels had been cleared by prior shift' }],
      machine: [{ id: 'f17', text: 'Label printer lacks batch-specific roll-ID tracking' }],
      material: [{ id: 'f18', text: 'Partial label rolls indistinguishable once removed from printer' }],
      method: [{ id: 'f19', text: 'SOP-PK-007 did not mandate label reconciliation before batch changeover' }, { id: 'f20', text: 'No QA line clearance sign-off required for label materials specifically' }],
      measurement: [],
      environment: [],
    },
    actions: [],
    effectivenessCriteria: null,
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h8', timestamp: '2026-03-26T10:00:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Initiated', details: 'Created from NC-2026-0040 — label mix-up GMP critical finding' },
      { id: 'h9', timestamp: '2026-03-28T14:00:00Z', user: 'Anita Desai', action: 'Root Cause Analysis Completed', details: 'SOP gap in line clearance label reconciliation step confirmed' },
    ],
    createdAt: '2026-03-26T10:00:00Z',
    updatedAt: '2026-03-28T14:00:00Z',
    closedAt: null,
    createdBy: 'Rajesh Kumar',
  },
  {
    id: 'capa4',
    capaNumber: 'CAPA-2026-0009',
    title: 'CAPA for dissolution failure — Metformin granulation process parameter drift',
    description: 'Dissolution failure (68% at 45 min, spec NLT 80%) on Metformin 500mg batch B26-MF-0071. Investigation linked to granulation endpoint moisture content drifting to 2.8% w/w (spec: 1.5–2.5% w/w) due to inconsistent granulator bowl temperature control. High moisture content led to over-densified granules with reduced dissolution.',
    source: 'NC',
    severity: 'MAJOR',
    status: 'EFFECTIVENESS_VERIFICATION',
    department: 'Quality Control',
    productProcess: 'Granulation / Dissolution',
    linkedSourceRecord: 'NC-2026-0039',
    owner: 'Rajesh Kumar',
    ownerId: 'u2',
    dueDate: '2026-04-08',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did dissolution fail?', answer: 'Granule particle size distribution was skewed to larger particles, reducing dissolution rate.' },
      { whyNumber: 2, question: 'Why was particle size distribution affected?', answer: 'Granulation endpoint moisture was higher than specified (2.8% vs. NMT 2.5%), leading to over-wetting.' },
      { whyNumber: 3, question: 'Why was moisture higher than specified?', answer: 'Granulator bowl jacket temperature fluctuated ±4°C during wet massing due to a faulty temperature controller.' },
      { whyNumber: 4, question: 'Why was the faulty controller not detected?', answer: 'Granulator temperature controller calibration had been performed but the stability of control over time was not verified in PM procedure.' },
    ],
    fishbone: {
      man: [],
      machine: [{ id: 'f21', text: 'Granulator bowl jacket temperature controller malfunction — ±4°C variation' }, { id: 'f22', text: 'PM procedure did not include dynamic temperature stability check' }],
      material: [],
      method: [{ id: 'f23', text: 'Granulation endpoint determined by time only — no LOD (loss on drying) check at endpoint' }],
      measurement: [{ id: 'f24', text: 'In-process moisture monitoring done once per batch, not continuously' }],
      environment: [],
    },
    actions: [
      { id: 'a10', description: 'Replace faulty temperature controller on granulator GRN-02', type: 'CORRECTIVE', owner: 'Deepak Nair', dueDate: '2026-03-28', status: 'COMPLETED', completedDate: '2026-03-27' },
      { id: 'a11', description: 'Update granulation SOP to include mandatory LOD check at endpoint before discharge', type: 'CORRECTIVE', owner: 'Dr. Priya Sharma', dueDate: '2026-04-02', status: 'COMPLETED', completedDate: '2026-04-01' },
      { id: 'a12', description: 'Add temperature controller dynamic stability test to granulator PM checklist', type: 'PREVENTIVE', owner: 'Deepak Nair', dueDate: '2026-04-05', status: 'COMPLETED', completedDate: '2026-04-04' },
    ],
    effectivenessCriteria: 'Next 3 consecutive Metformin 500mg batches pass dissolution Q80% at 45 minutes. Granulation endpoint LOD within 1.5–2.5% w/w for all batches.',
    monitoringPeriodDays: 60,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h10', timestamp: '2026-03-23T09:00:00Z', user: 'Rajesh Kumar', action: 'CAPA Initiated', details: 'Raised from dissolution failure NC-2026-0039' },
      { id: 'h11', timestamp: '2026-03-25T14:00:00Z', user: 'Dr. Priya Sharma', action: 'Root Cause Completed', details: 'Granulator temperature controller identified as root cause' },
      { id: 'h12', timestamp: '2026-04-04T16:00:00Z', user: 'Deepak Nair', action: 'All Actions Completed', details: 'Controller replaced, SOP updated, PM checklist revised. Monitoring period started.' },
    ],
    createdAt: '2026-03-23T09:00:00Z',
    updatedAt: '2026-04-04T16:00:00Z',
    closedAt: null,
    createdBy: 'Dr. Priya Sharma',
  },
  {
    id: 'capa5',
    capaNumber: 'CAPA-2026-0008',
    title: 'CAPA for foreign particle in Ondansetron injection — vial washing equipment maintenance lapse',
    description: 'Glass particles found in Ondansetron 4mg/2ml injection vials (NC-2026-0038). Root cause: vial washer WM-02 nozzle had worn stainless steel tips generating fine metal/glass debris transferred into vials during washing. PM schedule for nozzle inspection was 6-monthly; actual interval was 14 months.',
    source: 'NC',
    severity: 'CRITICAL',
    status: 'CLOSED',
    department: 'Engineering',
    productProcess: 'Vial Washing / Aseptic Fill',
    linkedSourceRecord: 'NC-2026-0038',
    owner: 'Deepak Nair',
    ownerId: 'u6',
    dueDate: '2026-03-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were glass/metal particles found in vials?', answer: 'Worn nozzle tips on vial washer WM-02 shed debris during vial washing cycle.' },
      { whyNumber: 2, question: 'Why were nozzle tips worn?', answer: 'Nozzle tips had not been inspected or replaced in 14 months; scheduled PM interval is 6 months.' },
      { whyNumber: 3, question: 'Why was PM overdue by 8 months?', answer: 'PM work order for WM-02 nozzle inspection was inadvertently closed in CMMS without physical inspection being performed.' },
      { whyNumber: 4, question: 'Why was the work order closed without completion?', answer: 'CMMS work order closure did not require photographic evidence or sign-off from Engineering supervisor.' },
    ],
    fishbone: {
      man: [{ id: 'f25', text: 'Maintenance technician closed CMMS work order without completing physical inspection' }],
      machine: [{ id: 'f26', text: 'Vial washer WM-02 nozzle tips worn and shedding debris' }],
      material: [],
      method: [{ id: 'f27', text: 'CMMS work order closure did not require supervisor sign-off or evidence of completion' }],
      measurement: [{ id: 'f28', text: 'No post-maintenance vial rinse water particle test before restart' }],
      environment: [],
    },
    actions: [
      { id: 'a13', description: 'Replace all nozzle tips on WM-02 with new stainless steel tips and perform qualification rinse', type: 'CORRECTIVE', owner: 'Deepak Nair', dueDate: '2026-03-18', status: 'VERIFIED', completedDate: '2026-03-17' },
      { id: 'a14', description: 'Update CMMS to require supervisor approval and photographic evidence for all vial washing PM closures', type: 'CORRECTIVE', owner: 'Deepak Nair', dueDate: '2026-03-22', status: 'VERIFIED', completedDate: '2026-03-21' },
      { id: 'a15', description: 'Add post-maintenance particle rinse test (NMT 1 visible particle/100 mL) as mandatory restart condition for vial washers', type: 'PREVENTIVE', owner: 'Dr. Priya Sharma', dueDate: '2026-03-25', status: 'VERIFIED', completedDate: '2026-03-24' },
    ],
    effectivenessCriteria: 'Zero particulate rejections attributable to vial washing over next 6 batches of injectable products. All PM work orders for vial washers closed with supervisor sign-off and photographic evidence.',
    monitoringPeriodDays: 90,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'Batches B26-ON-0090 through B26-ON-0095: zero particulate rejections from vial washing. PM audit confirmed supervisor sign-off compliance at 100% for 60-day period.',
    history: [
      { id: 'h13', timestamp: '2026-03-11T09:00:00Z', user: 'Deepak Nair', action: 'CAPA Initiated', details: 'Created from NC-2026-0038 — glass particles in injectable vials' },
      { id: 'h14', timestamp: '2026-03-14T10:00:00Z', user: 'Deepak Nair', action: 'Root Cause Completed', details: 'Worn nozzle tips and CMMS closure gap confirmed as root causes' },
      { id: 'h15', timestamp: '2026-03-24T16:00:00Z', user: 'Deepak Nair', action: 'All Actions Completed', details: 'Nozzle replaced, CMMS updated, restart test protocol implemented' },
      { id: 'h16', timestamp: '2026-03-30T11:00:00Z', user: 'Dr. Priya Sharma', action: 'Effectiveness Verified', details: '6 batches with zero particulate rejections; PM compliance 100%' },
      { id: 'h17', timestamp: '2026-03-30T11:30:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Closed', details: 'Effectiveness criteria met. CAPA closed.' },
    ],
    createdAt: '2026-03-11T09:00:00Z',
    updatedAt: '2026-03-30T11:30:00Z',
    closedAt: '2026-03-30T11:30:00Z',
    createdBy: 'Deepak Nair',
  },
  {
    id: 'capa6',
    capaNumber: 'CAPA-2026-0007',
    title: 'Preventive CAPA — 21 CFR Part 11 compliance gap for computerised QMS systems',
    description: 'Proactive compliance review ahead of USFDA inspection identified that the legacy HPLC data acquisition system (Empower 2) lacks audit trail review as part of the routine batch record review. 21 CFR Part 11 requires review of audit trails for data integrity assurance. Gap identified across 3 analytical instruments.',
    source: 'PROACTIVE',
    severity: 'MAJOR',
    status: 'IMPLEMENTATION',
    department: 'Quality Assurance',
    productProcess: 'Computerised System Compliance / Data Integrity',
    linkedSourceRecord: null,
    owner: 'Anita Desai',
    ownerId: 'u3',
    dueDate: '2026-05-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why are audit trails not being reviewed?', answer: 'Batch record review SOP does not include an audit trail review step for Empower 2 system.' },
      { whyNumber: 2, question: 'Why is the SOP missing this step?', answer: 'SOP was written before Empower 2 was upgraded to version with full audit trail capability.' },
      { whyNumber: 3, question: 'Why was SOP not updated at time of system upgrade?', answer: 'Computerised system validation report was completed but SOP impact assessment was not conducted as part of the change control.' },
    ],
    fishbone: {
      man: [],
      machine: [{ id: 'f29', text: 'Empower 2 audit trail feature enabled but not configured for automated alerts' }],
      material: [],
      method: [{ id: 'f30', text: 'Batch record review SOP lacks audit trail review requirement' }, { id: 'f31', text: 'Change control for Empower 2 upgrade did not trigger SOP impact assessment' }],
      measurement: [{ id: 'f32', text: 'No periodic audit trail review schedule defined' }],
      environment: [],
    },
    actions: [
      { id: 'a16', description: 'Update SOP-QA-035 (Batch Record Review) to include mandatory Empower 2 audit trail review before batch certification', type: 'CORRECTIVE', owner: 'Anita Desai', dueDate: '2026-04-30', status: 'IN_PROGRESS' },
      { id: 'a17', description: 'Conduct retrospective audit trail review for last 3 months of HPLC data on all 3 instruments', type: 'CORRECTIVE', owner: 'Rajesh Kumar', dueDate: '2026-05-15', status: 'PENDING' },
      { id: 'a18', description: 'Update change control SOP to mandate SOP impact assessment for all computerised system upgrades', type: 'PREVENTIVE', owner: 'Dr. Priya Sharma', dueDate: '2026-05-20', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Audit trail reviews completed for 100% of HPLC batch records for 3 consecutive months with no data integrity anomalies. Change control SOP updated and trained.',
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h18', timestamp: '2026-03-20T09:00:00Z', user: 'Anita Desai', action: 'CAPA Initiated', details: 'Proactive compliance gap identified in pre-USFDA inspection readiness review' },
      { id: 'h19', timestamp: '2026-03-22T14:00:00Z', user: 'Anita Desai', action: 'Root Cause Completed', details: 'SOP and change control gaps confirmed' },
    ],
    createdAt: '2026-03-20T09:00:00Z',
    updatedAt: '2026-03-22T14:00:00Z',
    closedAt: null,
    createdBy: 'Anita Desai',
  },
  {
    id: 'capa7',
    capaNumber: 'CAPA-2026-0006',
    title: 'CAPA for calibration deviation — analytical balance AB-07 used out of calibration period',
    description: 'Balance AB-07 used for 8 days past calibration due date (NC-2026-0036). Eight batches of QC assay data require assessment. Root cause: no automated calibration due-date alert in laboratory; calibration status checked manually via paper register only.',
    source: 'NC',
    severity: 'MAJOR',
    status: 'CONTAINMENT',
    department: 'Quality Control',
    productProcess: 'Analytical Equipment Calibration',
    linkedSourceRecord: 'NC-2026-0036',
    owner: 'Rajesh Kumar',
    ownerId: 'u2',
    dueDate: '2026-04-20',
    fiveWhys: [],
    fishbone: { man: [], machine: [], material: [], method: [], measurement: [], environment: [] },
    actions: [],
    effectivenessCriteria: null,
    monitoringPeriodDays: 60,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h20', timestamp: '2026-03-09T14:00:00Z', user: 'Rajesh Kumar', action: 'CAPA Initiated', details: 'Created from calibration deviation NC-2026-0036' },
      { id: 'h21', timestamp: '2026-03-10T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Containment Started', details: 'Reviewing all 8 affected batches; instrument dispatched for recalibration' },
    ],
    createdAt: '2026-03-09T14:00:00Z',
    updatedAt: '2026-03-10T10:00:00Z',
    closedAt: null,
    createdBy: 'Dr. Priya Sharma',
  },
  {
    id: 'capa8',
    capaNumber: 'CAPA-2026-0005',
    title: 'Preventive CAPA — strengthening environmental monitoring data review and trending',
    description: 'Management review identified that environmental monitoring (EM) data is currently reviewed monthly. Two consecutive Grade B excursions (Q4 2025, Q1 2026) were not identified as a trend before a third event occurred. Proactive upgrade to weekly EM trend review and automated alert system required.',
    source: 'MANAGEMENT',
    severity: 'MINOR',
    status: 'INITIATED',
    department: 'Quality Assurance',
    productProcess: 'Environmental Monitoring',
    linkedSourceRecord: 'MR-2026-Q1',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    dueDate: '2026-05-15',
    fiveWhys: [],
    fishbone: { man: [], machine: [], material: [], method: [], measurement: [], environment: [] },
    actions: [],
    effectivenessCriteria: null,
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h22', timestamp: '2026-03-30T08:00:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Initiated', details: 'Raised from management review finding MR-2026-Q1' },
    ],
    createdAt: '2026-03-30T08:00:00Z',
    updatedAt: '2026-03-30T08:00:00Z',
    closedAt: null,
    createdBy: 'Dr. Priya Sharma',
  },
  // ── 2025 records ──
  {
    id: 'capa-2025-003', capaNumber: 'CAPA-2025-0031',
    title: 'CAPA for stability OOS — Ceftriaxone 1g injection shelf-life reduction assessment',
    description: 'Stability OOS result at 18-month timepoint for Ceftriaxone 1g injection batch B24-CE-0011 (assay 89.5%, spec NLT 90%). Investigation concluded the OOS was not a laboratory error. Stability data trend indicated marginal degradation accelerating beyond model prediction. Shelf life to be re-evaluated; marketed batches within expiry reviewed.',
    source: 'NC', status: 'CLOSED', severity: 'CRITICAL',
    department: 'Quality Assurance', productProcess: 'Stability Programme / Regulatory',
    linkedSourceRecord: 'NC-2025-0022',
    owner: 'Anita Desai', ownerId: 'u3', dueDate: '2025-12-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did the stability OOS occur at 18 months?', answer: 'Degradation rate was higher than predicted by the initial stability model based on 12-month data.' },
      { whyNumber: 2, question: 'Why was the model inaccurate?', answer: 'Stability model was built on only 2 pilot batches; commercial batch formulation used a different excipient grade.' },
      { whyNumber: 3, question: 'Why was the excipient grade difference not identified?', answer: 'Excipient grade change was approved via minor change control without reassessing impact on stability.' },
    ],
    fishbone: {
      man: [],
      machine: [],
      material: [{ id: 'fb1', text: 'Commercial-scale excipient grade differed from pilot-scale stability batches' }],
      method: [{ id: 'fb2', text: 'Minor change control for excipient grade did not include stability impact assessment' }, { id: 'fb3', text: 'Stability model not updated when commercial-scale batches showed early trend deviation' }],
      measurement: [{ id: 'fb4', text: 'Stability trending alert thresholds not set to flag early deviations' }],
      environment: [],
    },
    actions: [
      { id: 'a19', description: 'Conduct shelf-life re-evaluation for Ceftriaxone 1g injection; file regulatory variation for shelf-life reduction if required', type: 'CORRECTIVE', owner: 'Anita Desai', dueDate: '2025-10-30', status: 'COMPLETED', completedDate: '2025-10-28' },
      { id: 'a20', description: 'Review all marketed batches within expiry; issue market notification if product recall warranted', type: 'CORRECTIVE', owner: 'Dr. Priya Sharma', dueDate: '2025-11-10', status: 'COMPLETED', completedDate: '2025-11-08' },
      { id: 'a21', description: 'Update change control SOP to mandate stability impact assessment for all excipient grade changes', type: 'PREVENTIVE', owner: 'Anita Desai', dueDate: '2025-11-30', status: 'COMPLETED', completedDate: '2025-11-28' },
      { id: 'a22', description: 'Set automated stability trending alert at 95% of specification limit for all stability studies', type: 'PREVENTIVE', owner: 'Rajesh Kumar', dueDate: '2025-12-10', status: 'COMPLETED', completedDate: '2025-12-08' },
    ],
    effectivenessCriteria: 'Regulatory variation filed and approved. Next 3 commercial batches of Ceftriaxone 1g injection show stability within revised shelf-life model. No further stability OOS events.',
    monitoringPeriodDays: 180,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'Regulatory variation approved Jan 2026. Batches B25-CE-0041, B25-CE-0047, B25-CE-0053: all within revised stability specification at 6-month timepoint.',
    history: [
      { id: 'h30', timestamp: '2025-07-05T10:00:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Initiated', details: 'Created from stability OOS NC-2025-0022' },
      { id: 'h31', timestamp: '2025-11-28T16:00:00Z', user: 'Anita Desai', action: 'Actions Completed', details: 'All corrective and preventive actions completed' },
      { id: 'h32', timestamp: '2026-02-15T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Effectiveness verified — regulatory approval received, 3 batches stable' },
    ],
    createdAt: '2025-07-05T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z', closedAt: '2026-02-15T10:00:00Z', createdBy: 'Dr. Priya Sharma',
  },
  {
    id: 'capa-2025-001', capaNumber: 'CAPA-2025-0015',
    title: 'CAPA for Omeprazole wrong-strength label mix-up — label roll management and line clearance',
    description: 'Wrong strength (40mg) labelled on Omeprazole 20mg cartons (NC-2025-0008). Voluntary recall initiated. Root cause: 40mg label roll was stored in 20mg label cabinet due to misfiling; packaging operator did not verify label identity against the batch packaging order before loading.',
    source: 'COMPLAINT', status: 'CLOSED', severity: 'CRITICAL',
    department: 'Production', productProcess: 'Secondary Packaging / Label Control',
    linkedSourceRecord: 'NC-2025-0008',
    owner: 'Dr. Priya Sharma', ownerId: 'u1', dueDate: '2025-06-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were 40mg labels used for a 20mg batch?', answer: 'A 40mg label roll was physically stored in the 20mg label cabinet and loaded without strength verification.' },
      { whyNumber: 2, question: 'Why was a 40mg roll in the 20mg cabinet?', answer: 'Label store is organised by product name only; strength segregation is not enforced in the storage layout.' },
      { whyNumber: 3, question: 'Why was strength not verified at loading?', answer: 'Packaging order states label code but operators verify only product name on label, not strength, before loading.' },
    ],
    fishbone: {
      man: [{ id: 'fb5', text: 'Operator verified product name only, not full label identity including strength' }],
      machine: [],
      material: [{ id: 'fb6', text: '40mg and 20mg label rolls similar in appearance and stored adjacently' }],
      method: [{ id: 'fb7', text: 'Label loading procedure required name-only verification, not full label identity check' }, { id: 'fb8', text: 'Label storage layout not strength-segregated' }],
      measurement: [],
      environment: [],
    },
    actions: [
      { id: 'a23', description: 'Redesign label store with mandatory strength-segregated bays and colour-coded signage', type: 'CORRECTIVE', owner: 'Vikram Patel', dueDate: '2025-04-15', status: 'COMPLETED', completedDate: '2025-04-13' },
      { id: 'a24', description: 'Update label loading SOP to require full label identity verification (product, strength, batch number) before loading', type: 'CORRECTIVE', owner: 'Dr. Priya Sharma', dueDate: '2025-04-20', status: 'COMPLETED', completedDate: '2025-04-18' },
      { id: 'a25', description: 'Implement barcode scan-verify system for label identity at point of loading on all packaging lines', type: 'PREVENTIVE', owner: 'Deepak Nair', dueDate: '2025-05-31', status: 'COMPLETED', completedDate: '2025-05-29' },
      { id: 'a26', description: 'Conduct label control training for all packaging operators and supervisors', type: 'PREVENTIVE', owner: 'Sunita Rao', dueDate: '2025-04-30', status: 'COMPLETED', completedDate: '2025-04-28' },
    ],
    effectivenessCriteria: 'Zero label identity non-conformances over 6 months post-implementation. Barcode scan system recording 100% label verification at loading for all packaging batches.',
    monitoringPeriodDays: 180,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'Label control audit Nov 2025: barcode scan compliance 100% across all 4 packaging lines. Zero label identity NCs reported in 6-month window.',
    history: [
      { id: 'h33', timestamp: '2025-03-02T10:00:00Z', user: 'Dr. Priya Sharma', action: 'CAPA Initiated', details: 'Created from NC-2025-0008 — wrong strength label recall' },
      { id: 'h34', timestamp: '2025-05-29T11:00:00Z', user: 'Dr. Priya Sharma', action: 'Actions Completed', details: 'All actions completed including barcode scan system' },
      { id: 'h35', timestamp: '2025-11-20T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Effectiveness verified — zero label NCs in 6-month period' },
    ],
    createdAt: '2025-03-02T10:00:00Z', updatedAt: '2025-11-20T10:00:00Z', closedAt: '2025-11-20T10:00:00Z', createdBy: 'Rajesh Kumar',
  },
  // ── 2024 records ──
  {
    id: 'capa-2024-002', capaNumber: 'CAPA-2024-0042',
    title: 'CAPA for Ceftriaxone particulate contamination — vial stopper punching tooling maintenance',
    description: 'Glass/rubber particles in Ceftriaxone 1g injection vials (NC-2024-0045). Batch B24-CE-0022 fully rejected. Worn stopper punching tooling generated particulates during the stopper insertion operation. Tooling PM was overdue by 4 months and no pre-use inspection was mandated.',
    source: 'NC', status: 'CLOSED', severity: 'CRITICAL',
    department: 'Production', productProcess: 'Vial Stoppering / Aseptic Fill',
    linkedSourceRecord: 'NC-2024-0045',
    owner: 'Deepak Nair', ownerId: 'u6', dueDate: '2024-12-31',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were particulates found in vials?', answer: 'Worn stopper punching tooling generated rubber and metal fragments during stoppering.' },
      { whyNumber: 2, question: 'Why was tooling worn?', answer: 'PM for stoppering tooling was overdue by 4 months; no pre-campaign inspection performed.' },
      { whyNumber: 3, question: 'Why was PM overdue?', answer: 'Production schedule pressure led to deferral of PM; no system to block equipment use when PM is overdue.' },
    ],
    fishbone: {
      man: [{ id: 'fb9', text: 'Production team deferred PM under schedule pressure without raising change control' }],
      machine: [{ id: 'fb10', text: 'Stoppering tooling worn beyond service limit — no visual wear indicator' }],
      material: [],
      method: [{ id: 'fb11', text: 'No equipment lock-out procedure for PM-overdue status' }, { id: 'fb12', text: 'No pre-campaign tooling inspection in batch manufacturing record' }],
      measurement: [{ id: 'fb13', text: 'Post-wash vial particle check not performed before fill' }],
      environment: [],
    },
    actions: [
      { id: 'a27', description: 'Replace all stoppering tooling on aseptic fill line; qualify and validate before next campaign', type: 'CORRECTIVE', owner: 'Deepak Nair', dueDate: '2024-12-01', status: 'COMPLETED', completedDate: '2024-11-28' },
      { id: 'a28', description: 'Implement CMMS lock-out: equipment flagged as PM-overdue cannot be released to production without QA waiver', type: 'PREVENTIVE', owner: 'Deepak Nair', dueDate: '2024-12-15', status: 'COMPLETED', completedDate: '2024-12-12' },
      { id: 'a29', description: 'Add mandatory pre-campaign stoppering tooling visual inspection to batch manufacturing record', type: 'PREVENTIVE', owner: 'Dr. Priya Sharma', dueDate: '2024-12-20', status: 'COMPLETED', completedDate: '2024-12-18' },
    ],
    effectivenessCriteria: 'Zero particulate rejections attributable to stoppering in next 10 injectable batches. All stoppering PM completed within scheduled interval (zero overdue instances).',
    monitoringPeriodDays: 120,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'Batches B25-CE-0001 through B25-ON-0010: zero particulate rejections from stoppering. PM audit Q1 2025: zero overdue stoppering PM events.',
    history: [
      { id: 'h36', timestamp: '2024-11-06T09:00:00Z', user: 'Deepak Nair', action: 'CAPA Initiated', details: 'Created from NC-2024-0045 — particulate contamination in injectables' },
      { id: 'h37', timestamp: '2024-12-18T16:00:00Z', user: 'Deepak Nair', action: 'Actions Completed', details: 'All actions completed — tooling replaced, CMMS lockout live, BMR updated' },
      { id: 'h38', timestamp: '2025-04-10T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Effectiveness verified — 10 injectable batches with zero particulate rejections' },
    ],
    createdAt: '2024-11-06T09:00:00Z', updatedAt: '2025-04-10T10:00:00Z', closedAt: '2025-04-10T10:00:00Z', createdBy: 'Deepak Nair',
  },
  {
    id: 'capa-2024-001', capaNumber: 'CAPA-2024-0027',
    title: 'CAPA for gowning SOP deviation during aseptic process simulation — media fill failure risk',
    description: 'Aseptic process simulation (media fill) MF-2024-003 had an operator enter Grade B area with incomplete gowning (NC-2024-0027). Media fill ultimately passed (14-day incubation negative). Root cause: gowning qualification programme frequency was insufficient and training records were outdated for 3 operators.',
    source: 'NC', status: 'CLOSED', severity: 'MAJOR',
    department: 'Production', productProcess: 'Aseptic Gowning / Media Fill',
    linkedSourceRecord: 'NC-2024-0027',
    owner: 'Sunita Rao', ownerId: 'u5', dueDate: '2024-08-31',
    fiveWhys: [],
    fishbone: {
      man: [{ id: 'fb14', text: 'Operator gowning qualification lapsed — last assessment 18 months prior' }],
      machine: [],
      material: [],
      method: [{ id: 'fb15', text: 'Gowning SOP-MA-012 allowed annual qualification only; no interim refresher requirement' }],
      measurement: [{ id: 'fb16', text: 'Training matrix not reviewed quarterly — lapses not flagged to supervisors' }],
      environment: [],
    },
    actions: [
      { id: 'a30', description: 'Re-qualify all 18 aseptic area operators with full gowning practical assessment within 10 days', type: 'CORRECTIVE', owner: 'Sunita Rao', dueDate: '2024-07-20', status: 'COMPLETED', completedDate: '2024-07-18' },
      { id: 'a31', description: 'Revise gowning qualification frequency to biannual with triggered re-qualification after any media fill investigation or EM excursion', type: 'PREVENTIVE', owner: 'Dr. Priya Sharma', dueDate: '2024-08-05', status: 'COMPLETED', completedDate: '2024-08-04' },
      { id: 'a32', description: 'Implement quarterly training matrix review by QA to flag lapses before expiry', type: 'PREVENTIVE', owner: 'Sunita Rao', dueDate: '2024-08-20', status: 'COMPLETED', completedDate: '2024-08-19' },
    ],
    effectivenessCriteria: 'Zero gowning SOP deviations in next 3 aseptic process simulations. Training matrix review completed quarterly with zero lapses beyond 30 days.',
    monitoringPeriodDays: 120,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'Media fills MF-2024-004, MF-2024-005, MF-2025-001: zero gowning deviations observed. Training matrix reviews Oct, Jan: zero lapses identified.',
    history: [
      { id: 'h39', timestamp: '2024-07-05T08:00:00Z', user: 'Rajesh Kumar', action: 'CAPA Initiated', details: 'Created from NC-2024-0027 — gowning deviation in media fill' },
      { id: 'h40', timestamp: '2024-08-19T15:00:00Z', user: 'Sunita Rao', action: 'Actions Completed', details: 'All actions completed' },
      { id: 'h41', timestamp: '2025-02-10T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Effectiveness verified — 3 clean media fills, zero training lapses in two reviews' },
    ],
    createdAt: '2024-07-05T08:00:00Z', updatedAt: '2025-02-10T10:00:00Z', closedAt: '2025-02-10T10:00:00Z', createdBy: 'Rajesh Kumar',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CAPAFilters {
  status?: string;
  severity?: string;
  source?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useCAPAs(filters: CAPAFilters = {}) {
  return useQuery<PaginatedResponse<CAPARecord>>({
    queryKey: ['capas', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/capas', { params: filters });
        return unwrapList<CAPARecord>(data, flattenCAPA as any);
      } catch {
        let filtered = [...mockCAPAs];
        if (filters.status) filtered = filtered.filter((c) => c.status === filters.status);
        if (filters.severity) filtered = filtered.filter((c) => c.severity === filters.severity);
        if (filters.source) filtered = filtered.filter((c) => c.source === filters.source);
        if (filters.department) filtered = filtered.filter((c) => c.department === filters.department);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.capaNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useCAPA(id: string) {
  return useQuery<CAPARecord>({
    queryKey: ['capas', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/capas/${id}`);
        return unwrapItem<CAPARecord>(data, flattenCAPA as any);
      } catch {
        const capa = mockCAPAs.find((c) => c.id === id);
        if (!capa) throw new Error('CAPA not found');
        return capa;
      }
    },
    enabled: !!id,
  });
}

export function useCreateCAPA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/capas', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      toast.success('CAPA initiated successfully');
    },
    onError: () => {
      toast.error('Failed to initiate CAPA');
    },
  });
}
