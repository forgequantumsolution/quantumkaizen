import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';
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
  // ── Additional records so every list page has 20+ entries in the demo ──
  ...((): CAPARecord[] => {
    const extras: Array<Omit<CAPARecord, 'fiveWhys' | 'fishbone' | 'actions' | 'history'>> = [
      { id: 'capa13', capaNumber: 'CAPA-2026-0005', title: 'Reduce calibration OTIF slip — instrument master schedule', description: 'Two calibrations overdue in Q1 2026 per 211.68 gap. Root-cause scheduling delay.', source: 'AUDIT', severity: 'MINOR', status: 'ACTION_DEFINITION', department: 'Quality Control', productProcess: 'Balance / HPLC calibration', linkedSourceRecord: 'AUD-2026-002', owner: 'Rajesh Kumar', ownerId: 'u2', dueDate: '2026-06-30', effectivenessCriteria: 'Zero overdue calibrations for 2 quarters', monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z', closedAt: null, createdBy: 'Dr. Priya Sharma' },
      { id: 'capa14', capaNumber: 'CAPA-2026-0006', title: 'Water system TOC trend — WFI loop sanitisation uplift', description: 'TOC trending upward on WFI distribution; investigation and loop sanitisation.', source: 'NC', severity: 'MAJOR', status: 'ROOT_CAUSE_ANALYSIS', department: 'Engineering', productProcess: 'WFI distribution loop', linkedSourceRecord: 'NC-2026-0014', owner: 'Mohammed Iqbal', ownerId: 'u7', dueDate: '2026-05-20', effectivenessCriteria: 'TOC < 500 ppb for 90 consecutive days', monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-03-18T10:00:00Z', updatedAt: '2026-03-25T14:00:00Z', closedAt: null, createdBy: 'Mohammed Iqbal' },
      { id: 'capa15', capaNumber: 'CAPA-2026-0007', title: 'Label mix-up prevention — vision system at packaging', description: 'Printed cartons with wrong batch number. Install vision inspection on packaging line PL-03.', source: 'NC', severity: 'MAJOR', status: 'CONTAINMENT', department: 'Packaging', productProcess: 'Metformin cartoning line PL-03', linkedSourceRecord: 'NC-2026-0040', owner: 'Vikram Patel', ownerId: 'u4', dueDate: '2026-05-15', effectivenessCriteria: '3 consecutive batches zero mix-up events', monitoringPeriodDays: 120, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-03-25T14:00:00Z', updatedAt: '2026-03-27T09:00:00Z', closedAt: null, createdBy: 'Vikram Patel' },
      { id: 'capa16', capaNumber: 'CAPA-2026-0008', title: 'Aseptic technique refresher — annual requalification programme', description: 'Gowning deviation trend; rollout of refresher training and media-fill re-qualification.', source: 'AUDIT', severity: 'MAJOR', status: 'IMPLEMENTATION', department: 'Sterile Manufacturing', productProcess: 'Aseptic fill operations', linkedSourceRecord: 'AUD-2025-014', owner: 'Kavita Menon', ownerId: 'u10', dueDate: '2026-06-01', effectivenessCriteria: '100% re-qualification complete; 2 media fills clean', monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-02-14T09:00:00Z', updatedAt: '2026-03-20T12:00:00Z', closedAt: null, createdBy: 'Kavita Menon' },
      { id: 'capa17', capaNumber: 'CAPA-2026-0009', title: 'Supplier scorecard framework — RAG dashboard rollout', description: 'Management directive to operationalise quarterly supplier scorecards across all CRITICAL suppliers.', source: 'MANAGEMENT', severity: 'MINOR', status: 'INITIATED', department: 'Quality Assurance', productProcess: 'Supplier quality management', linkedSourceRecord: null, owner: 'Dr. Priya Sharma', ownerId: 'u1', dueDate: '2026-07-31', effectivenessCriteria: 'Scorecards issued for all 18 critical suppliers', monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-03-28T10:00:00Z', closedAt: null, createdBy: 'Dr. Priya Sharma' },
      { id: 'capa18', capaNumber: 'CAPA-2026-0010', title: 'Ibuprofen 24-month stability failure — investigation & re-formulation study', description: 'Out-of-spec dissolution on 24M stability. Evaluate formulation robustness and primary pack changes.', source: 'NC', severity: 'MAJOR', status: 'EFFECTIVENESS_VERIFICATION', department: 'Quality Control', productProcess: 'Ibuprofen 400mg stability programme', linkedSourceRecord: 'NC-2026-0010', owner: 'Rajesh Kumar', ownerId: 'u2', dueDate: '2026-08-30', effectivenessCriteria: 'Three stability batches meet all specs at 24M', monitoringPeriodDays: 365, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-02-05T11:00:00Z', updatedAt: '2026-03-31T15:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar' },
      { id: 'capa19', capaNumber: 'CAPA-2026-0011', title: 'Cold-chain excursion SOP revision — distribution oversight', description: 'Distribution temperature excursion; update SOP and strengthen 3PL oversight.', source: 'COMPLAINT', severity: 'MAJOR', status: 'IMPLEMENTATION', department: 'Distribution', productProcess: 'Finished goods cold chain', linkedSourceRecord: 'CMP-2026-0009', owner: 'Sunita Rao', ownerId: 'u5', dueDate: '2026-06-15', effectivenessCriteria: 'Zero cold-chain excursions for 90 days post-implementation', monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-03-05T12:00:00Z', updatedAt: '2026-03-28T10:00:00Z', closedAt: null, createdBy: 'Sunita Rao' },
      { id: 'capa20', capaNumber: 'CAPA-2026-0012', title: 'Analyst re-qualification gate before release testing', description: 'Analyst performed release testing without current requalification. Implement system-level gate.', source: 'AUDIT', severity: 'MAJOR', status: 'ACTION_DEFINITION', department: 'Quality Control', productProcess: 'QC release testing workflow', linkedSourceRecord: 'NC-2026-0017', owner: 'Rajesh Kumar', ownerId: 'u2', dueDate: '2026-05-30', effectivenessCriteria: 'LIMS blocks any analyst with lapsed qualification', monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null, createdAt: '2026-03-21T09:30:00Z', updatedAt: '2026-03-28T11:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar' },
    ];
    return extras.map((c) => ({ ...c, fiveWhys: [], fishbone: { man: [], machine: [], material: [], method: [], measurement: [], environment: [] }, actions: [], history: [] }));
  })(),
];

// Medical-device CAPA records — ISO 13485 / 21 CFR 820 themed. Records
// cross-reference NCs, complaints, change requests, audits and compliance
// gap actions so the entire medical-device demo tells one coherent story.
export const mockMedicalDeviceCAPAs: CAPARecord[] = [
  {
    id: 'md-capa1', capaNumber: 'CAPA-MD-2026-0019',
    title: 'CAPA — EO sterilization residuals exceeding ISO 10993-7 on infusion sets',
    description: 'Aeration cycle on EO sterilizer EOS-02 found running short of validated time after PLC battery replacement reset cycle parameters. CAPA covers parameter recovery validation, IEC 62366 alarm strengthening and operator re-training across the sterilization team.',
    source: 'NC', severity: 'CRITICAL', status: 'IMPLEMENTATION',
    department: 'Sterilization', productProcess: 'EO Sterilization · Aeration',
    linkedSourceRecord: 'NC-MD-2026-0042', owner: 'Karthik Iyer', ownerId: 'u-md2', dueDate: '2026-05-10',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did EO residuals exceed ISO 10993-7?',                              answer: 'Aeration cycle ran for 8 hours instead of the validated 12 hours.' },
      { whyNumber: 2, question: 'Why was the aeration cycle shorter?',                                   answer: 'Validated recipe was not reloaded after PLC battery replacement reset stored parameters.' },
      { whyNumber: 3, question: 'Why was the recipe not reloaded after maintenance?',                    answer: 'Post-maintenance qualification step in WI-MD-EOS-04 was not enforced; alarm did not block start.' },
      { whyNumber: 4, question: 'Why did the start-up alarm not block the cycle?',                       answer: 'Alarm was downgraded to advisory in firmware v2.1 to reduce false alerts.' },
      { whyNumber: 5, question: 'Why was a safety-critical alarm downgraded without risk re-assessment?', answer: 'Change-control review missed the ISO 14971 risk control linkage; impact assessment skipped.' },
    ],
    fishbone: {
      man: [{ id: 'mf1', text: 'Operator did not verify recipe after maintenance' }],
      machine: [{ id: 'mf2', text: 'PLC battery replacement reset stored cycle parameters' }, { id: 'mf3', text: 'Critical alarm downgraded to advisory' }],
      material: [],
      method: [{ id: 'mf4', text: 'Post-maintenance qualification step in WI-MD-EOS-04 not enforced' }, { id: 'mf5', text: 'Change-control risk linkage to ISO 14971 missed' }],
      measurement: [{ id: 'mf6', text: 'EO residual results not trended in real time' }],
      environment: [],
    },
    actions: [
      { id: 'md-a1', description: 'Reload validated aeration recipe and reset sterilizer EOS-02 alarms to blocking',                                  type: 'CORRECTIVE', owner: 'Rohit Khanna',     dueDate: '2026-04-05', status: 'COMPLETED', completedDate: '2026-04-04' },
      { id: 'md-a2', description: 'Reprocess lot ISET-26-0118 through full 12-hour aeration cycle and re-test EO/ECH residuals',                     type: 'CORRECTIVE', owner: 'Karthik Iyer',     dueDate: '2026-04-12', status: 'IN_PROGRESS' },
      { id: 'md-a3', description: 'Update SOP-MD-EOS-01 — mandatory post-maintenance recipe verification with two-person sign-off',                    type: 'PREVENTIVE', owner: 'Dr. Anjali Verma', dueDate: '2026-04-25', status: 'IN_PROGRESS' },
      { id: 'md-a4', description: 'Re-perform ISO 14971 risk analysis for sterilizer alarm matrix; document linkage to risk controls',                  type: 'PREVENTIVE', owner: 'Sneha Kapoor',     dueDate: '2026-05-02', status: 'PENDING' },
      { id: 'md-a5', description: 'Training for all sterilization operators on revised SOP-MD-EOS-01 with competency assessment',                       type: 'PREVENTIVE', owner: 'Neha Bansal',      dueDate: '2026-05-08', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero EO/ECH residual OOS over 90-day monitoring period. 100% post-maintenance recipe verifications signed off. All sterilization operators competency-assessed on revised SOP.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'md-h1', timestamp: '2026-03-30T10:00:00Z', user: 'Karthik Iyer',     action: 'CAPA Initiated',          details: 'Triggered from NC-MD-2026-0042' },
      { id: 'md-h2', timestamp: '2026-04-04T15:30:00Z', user: 'Rohit Khanna',     action: 'Containment Closed',      details: 'Aeration recipe reloaded and alarm matrix restored' },
    ],
    createdAt: '2026-03-30T10:00:00Z', updatedAt: '2026-04-04T15:30:00Z', closedAt: null, createdBy: 'Karthik Iyer',
  },
  {
    id: 'md-capa2', capaNumber: 'CAPA-MD-2026-0018',
    title: 'CAPA — Sterility failure on surgical drape lot SDR-26-0094 (cleanroom HEPA breach)',
    description: 'Sterility excursion linked to compromised HEPA filter on AHU-MD-03 serving Class 7 cleanroom. CAPA covers HEPA replacement, integrity testing, and a quarterly leak-test schedule.',
    source: 'NC', severity: 'CRITICAL', status: 'ROOT_CAUSE_ANALYSIS',
    department: 'Cleanroom Assembly', productProcess: 'Class 7 Cleanroom HVAC',
    linkedSourceRecord: 'NC-MD-2026-0041', owner: 'Dr. Anjali Verma', ownerId: 'u-md1', dueDate: '2026-05-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was sterility failure observed?',                          answer: 'Bacillus circulans isolated, consistent with airborne ingress.' },
      { whyNumber: 2, question: 'Why was airborne ingress possible?',                            answer: 'HEPA filter on AHU-MD-03 found with integrity breach on PAO scan.' },
      { whyNumber: 3, question: 'Why was the HEPA breach not detected earlier?',                 answer: 'Filter integrity test schedule was annual; last test was 11 months prior.' },
      { whyNumber: 4, question: 'Why was the integrity test schedule only annual?',              answer: 'SOP-MD-HVAC-02 inherited from a non-sterile process; never updated for sterile use.' },
    ],
    fishbone: {
      man: [],
      machine: [{ id: 'mf7', text: 'HEPA filter failed PAO integrity test (0.04% leak)' }, { id: 'mf8', text: 'AHU-MD-03 differential pressure dropped 18% over 6 months' }],
      material: [{ id: 'mf9', text: 'HEPA filter batch from supplier showed earlier-than-expected service-life decline' }],
      method: [{ id: 'mf10', text: 'SOP-MD-HVAC-02 integrity test schedule only annual; inappropriate for sterile process' }],
      measurement: [{ id: 'mf11', text: 'AHU pressure trend not reviewed against alert/action limits' }],
      environment: [{ id: 'mf12', text: 'Monsoon humidity load accelerated filter loading' }],
    },
    actions: [
      { id: 'md-a6', description: 'Replace and PAO-certify all HEPA filters on AHU-MD-03 servicing Class 7 cleanroom', type: 'CORRECTIVE', owner: 'Rohit Khanna',     dueDate: '2026-04-12', status: 'COMPLETED', completedDate: '2026-04-11' },
      { id: 'md-a7', description: 'Implement quarterly HEPA integrity test schedule for all sterile-process AHUs',     type: 'PREVENTIVE', owner: 'Dr. Anjali Verma', dueDate: '2026-04-25', status: 'IN_PROGRESS' },
      { id: 'md-a8', description: 'Revise SOP-MD-HVAC-02 with risk-based integrity test frequency tied to room classification', type: 'PREVENTIVE', owner: 'Neha Bansal',      dueDate: '2026-05-05', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero sterility excursions over 180-day monitoring period. 100% HEPAs PAO-certified per quarterly schedule. AHU pressure trends reviewed weekly.',
    monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'md-h3', timestamp: '2026-03-28T11:00:00Z', user: 'Dr. Anjali Verma', action: 'CAPA Initiated', details: 'Triggered from NC-MD-2026-0041' },
    ],
    createdAt: '2026-03-28T11:00:00Z', updatedAt: '2026-04-11T17:00:00Z', closedAt: null, createdBy: 'Dr. Anjali Verma',
  },
  {
    id: 'md-capa3', capaNumber: 'CAPA-MD-2025-0058',
    title: 'CAPA — Heart-valve sterile barrier leak (sealing temperature drift on tray sealer TS-04)',
    description: 'Heat-seal temperature on tray sealer TS-04 drifted 6 °C low due to worn heater element. CAPA covers element replacement, PM frequency increase, and inclusion of seal-strength SPC into release process.',
    source: 'NC', severity: 'CRITICAL', status: 'CLOSED',
    department: 'Sterile Barrier Packaging', productProcess: 'Heat Seal · ASTM F2096',
    linkedSourceRecord: 'NC-MD-2025-0098', owner: 'Neha Bansal', ownerId: 'u-md3', dueDate: '2025-12-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did pouches fail bubble-emission test?',         answer: 'Seal strength was below specification.' },
      { whyNumber: 2, question: 'Why was the seal strength low?',                     answer: 'Heat-seal temperature drifted ~6 °C below setpoint.' },
      { whyNumber: 3, question: 'Why was the temperature drift not detected?',        answer: 'No real-time SPC monitoring on TS-04 — operator only checked at shift start.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'mf13', text: 'Heater element worn — resistance increased 14%' }], material: [], method: [{ id: 'mf14', text: 'No SPC on seal temperature' }], measurement: [], environment: [],
    },
    actions: [
      { id: 'md-a9',  description: 'Replace heater element on TS-04 and revalidate seal parameters',                  type: 'CORRECTIVE', owner: 'Rohit Khanna', dueDate: '2025-09-25', status: 'COMPLETED', completedDate: '2025-09-24' },
      { id: 'md-a10', description: 'Increase preventive maintenance frequency on TS-04 heater element to 6-monthly', type: 'PREVENTIVE', owner: 'Neha Bansal',  dueDate: '2025-10-10', status: 'COMPLETED', completedDate: '2025-10-08' },
      { id: 'md-a11', description: 'Add seal-temperature SPC monitoring to tray sealer SCADA — alert at ±3 °C',       type: 'PREVENTIVE', owner: 'Aditya Menon', dueDate: '2025-11-20', status: 'COMPLETED', completedDate: '2025-11-19' },
    ],
    effectivenessCriteria: 'Zero seal-strength failures over 90-day monitoring period. SPC alerts logged and reviewed daily.',
    monitoringPeriodDays: 90, effectivenessResult: 'PASS', effectivenessEvidence: 'No seal-strength failures Sep 2025 – Dec 2025. SPC dashboards reviewed daily by shift QA.',
    history: [],
    createdAt: '2025-09-15T09:00:00Z', updatedAt: '2025-12-15T14:00:00Z', closedAt: '2025-12-15T14:00:00Z', createdBy: 'Neha Bansal',
  },
  {
    id: 'md-capa4', capaNumber: 'CAPA-MD-2026-0011',
    title: 'CAPA — IOL injection-moulding cavity 03 silicone-particle defect',
    description: 'Worn injection-moulding cavity 03 produced silicone fragments inside intraocular-lens packaging (NC-MD-2026-0038 / CMP-MD-2025-0048). CAPA covers tooling replacement, revalidation, AOI deployment (CR-MD-2025-0033) and a tighter cavity rotation schedule.',
    source: 'NC', severity: 'CRITICAL', status: 'CLOSED',
    department: 'Cleanroom Assembly', productProcess: 'Injection Moulding · Visual Inspection',
    linkedSourceRecord: 'NC-MD-2026-0038', owner: 'Dr. Anjali Verma', ownerId: 'u-md1', dueDate: '2026-04-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were silicone particles found inside IOL packaging?',  answer: 'Cavity 03 produced fragments during injection moulding.' },
      { whyNumber: 2, question: 'Why did cavity 03 produce fragments?',                      answer: 'Tooling wear on the runner gate created stress risers and micro-shearing.' },
      { whyNumber: 3, question: 'Why was the wear not detected earlier?',                    answer: 'PM rotation schedule was based on cycle count of the press, not per-cavity hours.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'mf-c4a', text: 'Cavity 03 runner-gate wear' }],
      material: [], method: [{ id: 'mf-c4b', text: 'PM rotation tracked at press level, not per-cavity' }],
      measurement: [{ id: 'mf-c4c', text: 'Manual visual inspection missed sub-50 µm particles' }],
      environment: [],
    },
    actions: [
      { id: 'md-a12', description: 'Replace cavity 03 tooling and revalidate (3-lot OQ)',                       type: 'CORRECTIVE', owner: 'Rohit Khanna',     dueDate: '2026-03-20', status: 'COMPLETED', completedDate: '2026-03-20' },
      { id: 'md-a13', description: 'Deploy automated optical inspection (AOI) for IOL trays per CR-MD-2025-0033', type: 'PREVENTIVE', owner: 'Dr. Anjali Verma', dueDate: '2025-10-30', status: 'COMPLETED', completedDate: '2025-10-25' },
      { id: 'md-a14', description: 'Track PM rotation per-cavity hours instead of per-press cycles',             type: 'PREVENTIVE', owner: 'Rohit Khanna',     dueDate: '2026-02-15', status: 'COMPLETED', completedDate: '2026-02-14' },
    ],
    effectivenessCriteria: 'Zero particulate-related IOL NCs over 180-day monitoring period. AOI rejection rate trending stable.',
    monitoringPeriodDays: 180,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'No particulate-related IOL NCs Nov 2025 – Apr 2026. AOI rejection rate stable at 0.8%.',
    history: [
      { id: 'md-hc4a', timestamp: '2025-11-10T09:00:00Z', user: 'Dr. Anjali Verma', action: 'CAPA Initiated',           details: 'Triggered from CMP-MD-2025-0048 and NC-MD-2026-0038 trend' },
      { id: 'md-hc4b', timestamp: '2026-04-15T14:00:00Z', user: 'Dr. Anjali Verma', action: 'Effectiveness Verified',   details: 'PASS — 180-day monitoring complete; CAPA closed' },
    ],
    createdAt: '2025-11-10T09:00:00Z', updatedAt: '2026-04-15T14:00:00Z', closedAt: '2026-04-15T14:00:00Z', createdBy: 'Dr. Anjali Verma',
  },
  {
    id: 'md-capa5', capaNumber: 'CAPA-MD-2026-0014',
    title: 'CAPA — Smart infusion pump firmware over-delivery (rounding error)',
    description: 'Verification of firmware v3.4 (IEC 62304 Class B) detected over-delivery >4% above setpoint at 1 mL/hr (NC-MD-2025-0117). CAPA delivers fixed-point dosage refactor (CR-MD-2026-0014), full V&V re-run and Letter-to-File to USFDA.',
    source: 'NC', severity: 'MAJOR', status: 'IMPLEMENTATION',
    department: 'Design Controls', productProcess: 'Firmware V&V (IEC 62304)',
    linkedSourceRecord: 'NC-MD-2025-0117', owner: 'Aditya Menon', ownerId: 'u-md6', dueDate: '2026-05-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was delivery over setpoint?',                       answer: 'Floating-point rounding bias accumulated in the dosage calculation module.' },
      { whyNumber: 2, question: 'Why did the rounding bias exist?',                      answer: 'Implementation used IEEE-754 doubles without bounded fixed-point conversion at output.' },
      { whyNumber: 3, question: 'Why was this not caught in V&V?',                       answer: 'Unit tests did not include rate-boundary cases at the lowest flow setting.' },
      { whyNumber: 4, question: 'Why were boundary cases missing?',                      answer: 'IEC 62304 §5.5 code-review checklist treated rounding-tolerance tests as optional.' },
    ],
    fishbone: {
      man: [], machine: [],
      material: [], method: [{ id: 'mf-c5a', text: 'Floating-point math in safety-critical dosage path' }, { id: 'mf-c5b', text: 'V&V test plan missing rate-boundary cases' }],
      measurement: [], environment: [],
    },
    actions: [
      { id: 'md-a15', description: 'Refactor dosage calculation to fixed-point math (CR-MD-2026-0014)',                                                       type: 'CORRECTIVE', owner: 'Aditya Menon',  dueDate: '2026-04-25', status: 'COMPLETED', completedDate: '2026-04-22' },
      { id: 'md-a16', description: 'Re-run full IEC 62304 V&V suite including new rate-boundary tests',                                                       type: 'CORRECTIVE', owner: 'Aditya Menon',  dueDate: '2026-05-10', status: 'IN_PROGRESS' },
      { id: 'md-a17', description: 'Update IEC 62304 §5.5 code-review checklist to make rounding-tolerance tests mandatory for any numeric safety-critical code', type: 'PREVENTIVE', owner: 'Aditya Menon', dueDate: '2026-05-15', status: 'IN_PROGRESS' },
      { id: 'md-a18', description: 'Submit Letter-to-File to USFDA for firmware v3.5',                                                                         type: 'CORRECTIVE', owner: 'Sneha Kapoor',  dueDate: '2026-05-25', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero firmware-related dosage-accuracy deviations across 12-month post-deployment field surveillance.',
    monitoringPeriodDays: 365, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'md-hc5a', timestamp: '2025-10-28T11:00:00Z', user: 'Aditya Menon', action: 'CAPA Initiated',     details: 'Triggered from NC-MD-2025-0117 V&V failure' },
      { id: 'md-hc5b', timestamp: '2026-04-22T16:30:00Z', user: 'Aditya Menon', action: 'Corrective Closed',  details: 'Fixed-point refactor merged; V&V suite running' },
    ],
    createdAt: '2025-10-28T11:00:00Z', updatedAt: '2026-04-22T16:30:00Z', closedAt: null, createdBy: 'Aditya Menon',
  },
  {
    id: 'md-capa6', capaNumber: 'CAPA-MD-2026-0017',
    title: 'CAPA — UDI labelling system upgrade (vascular catheter scan failures)',
    description: 'NC-MD-2026-0040 identified 312 cartons of vascular catheters with unreadable UDI barcodes. CAPA covers printer/substrate upgrade (CR-MD-2026-0011), end-of-line scan revalidation and an SLA-based UDI dashboard.',
    source: 'NC', severity: 'MAJOR', status: 'IMPLEMENTATION',
    department: 'Packaging', productProcess: 'UDI Labelling · 21 CFR 830 / EU MDR Art. 27',
    linkedSourceRecord: 'NC-MD-2026-0040', owner: 'Rohit Khanna', ownerId: 'u-md4', dueDate: '2026-05-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did UDI codes fail end-of-line scans?',         answer: 'GS1-128 grade dropped below C on the affected cartons.' },
      { whyNumber: 2, question: 'Why did the print grade drop?',                     answer: 'Printer ribbon was past service life and label substrate not optimised for cleanroom conditions.' },
      { whyNumber: 3, question: 'Why was the substrate not optimised?',              answer: 'Material was carried over from a legacy non-sterile line during 2024 line consolidation.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'mf-c6a', text: 'Printer ribbon end-of-life not flagged' }, { id: 'mf-c6b', text: 'Inappropriate label substrate' }],
      material: [], method: [{ id: 'mf-c6c', text: 'PM schedule did not include ribbon wear inspection' }],
      measurement: [{ id: 'mf-c6d', text: 'No ISO/IEC 15415 grading on end-of-line scanner' }],
      environment: [],
    },
    actions: [
      { id: 'md-a19', description: '100% relabel of affected cartons (lot VCT-26-0071)',                                  type: 'CORRECTIVE', owner: 'Karthik Iyer',  dueDate: '2026-04-02', status: 'IN_PROGRESS' },
      { id: 'md-a20', description: 'Install Zebra ZE521 printers with cleanroom-grade substrate (CR-MD-2026-0011)',       type: 'CORRECTIVE', owner: 'Rohit Khanna',  dueDate: '2026-04-15', status: 'COMPLETED', completedDate: '2026-04-15' },
      { id: 'md-a21', description: 'Add ISO/IEC 15415 grading to end-of-line scanner with auto-reject',                   type: 'PREVENTIVE', owner: 'Aditya Menon',  dueDate: '2026-04-30', status: 'IN_PROGRESS' },
      { id: 'md-a22', description: 'Update PM checklist to mandate ribbon wear inspection at every changeover',           type: 'PREVENTIVE', owner: 'Rohit Khanna',  dueDate: '2026-05-10', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero UDI scan failures over 90-day monitoring period. 100% of cartons pass ISO/IEC 15415 grade C or better.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'md-hc6a', timestamp: '2026-03-22T10:00:00Z', user: 'Rohit Khanna', action: 'CAPA Initiated',         details: 'Triggered from NC-MD-2026-0040' },
      { id: 'md-hc6b', timestamp: '2026-04-15T18:00:00Z', user: 'Rohit Khanna', action: 'Printer Replacement OK', details: 'Zebra ZE521 install verified' },
    ],
    createdAt: '2026-03-22T10:00:00Z', updatedAt: '2026-04-15T18:00:00Z', closedAt: null, createdBy: 'Rohit Khanna',
  },
  // ── Disposables product family ──────────────────────────────────────────
  {
    id: 'md-capa7', capaNumber: 'CAPA-MD-2026-0020',
    title: 'CAPA — Hypodermic needle pin-bend rate exceeding 0.3% on NAM-04',
    description: 'NC-MD-2026-0036 traced excess pin-bend rate on 23G × 1" needles to a worn cam follower on Needle Assembly Machine NAM-04. CAPA covers cam-follower replacement, OQ revalidation, automated pin-bend AOI deployment and a per-component PM-hours tracking.',
    source: 'NC', severity: 'MAJOR', status: 'ACTION_DEFINITION',
    department: 'Needle Manufacturing', productProcess: 'Needle Hub Assembly · ASTM F1816',
    linkedSourceRecord: 'NC-MD-2026-0036', owner: 'Rohit Khanna', ownerId: 'u-md4', dueDate: '2026-05-25',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did pin-bend rate exceed 0.3%?',                       answer: 'Cam follower on NAM-04 carriage was worn beyond service spec.' },
      { whyNumber: 2, question: 'Why was the cam follower not replaced earlier?',            answer: 'PM schedule tracked total machine hours, not per-station load.' },
      { whyNumber: 3, question: 'Why was the wear not detected on a quality check?',         answer: 'Pin-bend AOI only ran statistical sampling; the cam wear caused drift below detection threshold.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'mf-c7a', text: 'Worn cam follower on NAM-04 carriage' }],
      material: [], method: [{ id: 'mf-c7b', text: 'PM tracked machine hours, not station load' }, { id: 'mf-c7c', text: 'AOI used statistical sampling, not 100% inspection' }],
      measurement: [], environment: [],
    },
    actions: [
      { id: 'md-a23', description: 'Replace cam follower on NAM-04; run 3 OQ lots verifying Cpk ≥ 1.67 on pin-bend rate', type: 'CORRECTIVE', owner: 'Rohit Khanna', dueDate: '2026-04-20', status: 'IN_PROGRESS' },
      { id: 'md-a24', description: 'Deploy 100% in-line pin-bend AOI vision system on all NAM lines',                     type: 'PREVENTIVE', owner: 'Aditya Menon', dueDate: '2026-05-30', status: 'PENDING' },
      { id: 'md-a25', description: 'Update PM schedule to track per-station hours with quarterly cam-follower replacement', type: 'PREVENTIVE', owner: 'Rohit Khanna', dueDate: '2026-05-10', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero NC for pin-bend rate >0.3% over 6 OQ lots and 90 days production. AOI false-reject rate <0.5%.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'md-hc7a', timestamp: '2026-04-02T11:00:00Z', user: 'Rohit Khanna', action: 'CAPA Initiated', details: 'Triggered from NC-MD-2026-0036' },
    ],
    createdAt: '2026-04-02T11:00:00Z', updatedAt: '2026-04-02T11:00:00Z', closedAt: null, createdBy: 'Rohit Khanna',
  },
  {
    id: 'md-capa8', capaNumber: 'CAPA-MD-2026-0021',
    title: 'CAPA — Disposable syringe particulate from over-lubrication on Line DSY-3',
    description: 'NC-MD-2026-0037 identified silicone-oil agglomerates inside 5 mL disposable-syringe barrels from over-lubrication. CAPA closes nozzle-spray calibration, weighs every 5 000th unit and locks operator override of spray volume.',
    source: 'NC', severity: 'MAJOR', status: 'IMPLEMENTATION',
    department: 'Cleanroom Assembly', productProcess: 'Plunger Lubrication · USP <788>',
    linkedSourceRecord: 'NC-MD-2026-0037', owner: 'Sneha Kapoor', ownerId: 'u-md5', dueDate: '2026-05-20',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were silicone-oil particles found in barrels?',  answer: 'Spray nozzle delivered 1.8 mg/barrel vs. validated 0.5–1.0 mg.' },
      { whyNumber: 2, question: 'Why was the dose 80% over?',                          answer: 'Nozzle drift since last PM; no in-line dose-weight verification.' },
      { whyNumber: 3, question: 'Why was nozzle drift not caught?',                    answer: 'Recipe was operator-editable on the HMI; an operator widened spray window manually to compensate for an earlier under-spray complaint.' },
    ],
    fishbone: {
      man: [{ id: 'mf-c8a', text: 'Operator widened spray window without change-control' }],
      machine: [{ id: 'mf-c8b', text: 'Drifted nozzle spray pattern' }],
      material: [], method: [{ id: 'mf-c8c', text: 'Recipe editable on HMI without lock' }, { id: 'mf-c8d', text: 'No in-line dose-weight verification' }],
      measurement: [], environment: [],
    },
    actions: [
      { id: 'md-a26', description: 'Recalibrate spray nozzle to validated 0.5–1.0 mg/barrel; verify on 3 runs',   type: 'CORRECTIVE', owner: 'Rohit Khanna',  dueDate: '2026-04-05', status: 'COMPLETED', completedDate: '2026-04-05' },
      { id: 'md-a27', description: 'Lock HMI recipe; require QA password to widen spray window',                   type: 'PREVENTIVE', owner: 'Aditya Menon',  dueDate: '2026-04-25', status: 'IN_PROGRESS' },
      { id: 'md-a28', description: 'Add load-cell dose-weight verification every 5 000th unit on Line DSY-3',     type: 'PREVENTIVE', owner: 'Rohit Khanna',  dueDate: '2026-05-15', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero particulate-related NCs on Line DSY-3 over 90-day monitoring period. Dose weight Cpk ≥ 1.67.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'md-hc8a', timestamp: '2026-04-05T16:00:00Z', user: 'Sneha Kapoor', action: 'CAPA Initiated', details: 'Triggered from NC-MD-2026-0037; nozzle already recalibrated under containment' },
    ],
    createdAt: '2026-04-05T16:00:00Z', updatedAt: '2026-04-05T16:00:00Z', closedAt: null, createdBy: 'Sneha Kapoor',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi). EU GMP Annex 1/2,
// FDA 21 CFR 210/211 & 600s, ICH Q5A-E, 21 CFR Part 11 themed CAPAs for
// insulin / insulin-analogue / GLP-1 drug-substance and aseptic fill-finish.
export const mockBiologicsCAPAs: CAPARecord[] = [
  {
    id: 'bio-capa1', capaNumber: 'CAPA-BIO-2026-0019',
    title: 'CAPA — Media-fill failure on aseptic cartridge filler AFL-02 (Grade A line intervention)',
    description: 'Annual media-fill qualification on cartridge filler AFL-02 yielded 3 contaminated units, exceeding the EU GMP Annex 1 zero-growth acceptance criterion. Investigation linked growth to non-routine manual interventions at the Grade A filling needle during a stopper-bowl jam. CAPA covers intervention re-design, aseptic technique re-qualification and revised media-fill acceptance handling.',
    source: 'NC', severity: 'CRITICAL', status: 'IMPLEMENTATION',
    department: 'Aseptic Fill-Finish', productProcess: 'Aseptic Cartridge Fill · EU GMP Annex 1 Media Fill',
    linkedSourceRecord: 'NC-BIO-2026-0042', owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1', dueDate: '2026-05-10',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did the media fill fail?',                                     answer: '3 filled cartridge units showed microbial growth after 14-day incubation.' },
      { whyNumber: 2, question: 'Why was there microbial growth?',                                  answer: 'Non-routine manual interventions were made at the Grade A filling needle to clear a stopper-bowl jam.' },
      { whyNumber: 3, question: 'Why did the interventions cause contamination?',                   answer: 'Operators reached across the first-air path, disrupting unidirectional airflow over open cartridges.' },
      { whyNumber: 4, question: 'Why was the intervention performed that way?',                      answer: 'WI-BIO-AFL-07 did not define an aseptic intervention method for stopper-bowl jams.' },
      { whyNumber: 5, question: 'Why was the intervention not pre-defined and qualified?',          answer: 'Intervention risk assessment under Annex 1 §8 was not completed for this rarely-occurring jam scenario.' },
    ],
    fishbone: {
      man: [{ id: 'bio-mf1', text: 'Operators reached across first-air path during intervention' }, { id: 'bio-mf2', text: 'Aseptic intervention technique not re-qualified within 12 months' }],
      machine: [{ id: 'bio-mf3', text: 'Stopper-bowl jam triggered unplanned manual intervention' }],
      material: [],
      method: [{ id: 'bio-mf4', text: 'WI-BIO-AFL-07 lacked qualified intervention method for stopper-bowl jams' }, { id: 'bio-mf5', text: 'Annex 1 §8 intervention risk assessment incomplete' }],
      measurement: [{ id: 'bio-mf6', text: 'Interventions not logged against media-fill intervention matrix' }],
      environment: [{ id: 'bio-mf7', text: 'Grade A unidirectional airflow disrupted during reach-in' }],
    },
    actions: [
      { id: 'bio-a1', description: 'Quarantine AFL-02 line and re-run media fill after intervention re-design; require 3 consecutive passing runs', type: 'CORRECTIVE', owner: 'Dr. Layla Al-Mansoori', dueDate: '2026-04-25', status: 'IN_PROGRESS' },
      { id: 'bio-a2', description: 'Re-design stopper-bowl jam clearance as a qualified aseptic intervention using transfer tongs; update WI-BIO-AFL-07', type: 'PREVENTIVE', owner: 'Omar Al-Farsi',       dueDate: '2026-04-30', status: 'IN_PROGRESS' },
      { id: 'bio-a3', description: 'Re-qualify all AFL-02 fill operators on aseptic technique with smoke-study verified first-air practices',                  type: 'PREVENTIVE', owner: 'Fatima Al-Hashimi',   dueDate: '2026-05-05', status: 'PENDING' },
      { id: 'bio-a4', description: 'Complete Annex 1 §8 intervention risk assessment and incorporate all credible interventions into media-fill matrix',     type: 'PREVENTIVE', owner: 'Khalid Nasser',       dueDate: '2026-05-08', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Three consecutive passing media fills on AFL-02 with zero growth. 100% of credible interventions qualified and incorporated. All fill operators re-qualified on aseptic technique.',
    monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'bio-h1', timestamp: '2026-03-30T09:30:00Z', user: 'Dr. Layla Al-Mansoori', action: 'CAPA Initiated',     details: 'Triggered from NC-BIO-2026-0042 media-fill failure' },
      { id: 'bio-h2', timestamp: '2026-04-05T14:00:00Z', user: 'Omar Al-Farsi',         action: 'Containment Closed', details: 'AFL-02 line quarantined; affected lots held pending re-qualification' },
    ],
    createdAt: '2026-03-30T09:30:00Z', updatedAt: '2026-04-05T14:00:00Z', closedAt: null, createdBy: 'Dr. Layla Al-Mansoori',
  },
  {
    id: 'bio-capa2', capaNumber: 'CAPA-BIO-2026-0018',
    title: 'CAPA — Sterility excursion on insulin glargine cartridge lot GLA-26-0094 (EM excursion Grade A/B)',
    description: 'Sterility excursion on insulin glargine cartridge lot GLA-26-0094 correlated with an environmental-monitoring excursion at the Grade A/B interface of the fill line. Investigation identified a degraded RABS glove with a micro-pinhole. CAPA covers glove replacement, integrity-test frequency increase and EM trending strengthening.',
    source: 'NC', severity: 'CRITICAL', status: 'ROOT_CAUSE_ANALYSIS',
    department: 'Aseptic Fill-Finish', productProcess: 'RABS Grade A/B · Environmental Monitoring',
    linkedSourceRecord: 'NC-BIO-2026-0041', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3', dueDate: '2026-05-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was a sterility excursion observed?',                       answer: 'Micrococcus luteus recovered from a fingertip plate and a filled-unit sterility test.' },
      { whyNumber: 2, question: 'Why was contamination present at the Grade A interface?',       answer: 'A RABS glove port had a micro-pinhole allowing ingress during fill.' },
      { whyNumber: 3, question: 'Why was the glove breach not detected earlier?',                answer: 'Glove integrity testing was performed monthly; the pinhole developed mid-cycle.' },
      { whyNumber: 4, question: 'Why was glove testing only monthly?',                           answer: 'SOP-BIO-EM-03 inherited a frequency from a lower-risk Grade C application.' },
    ],
    fishbone: {
      man: [],
      machine: [{ id: 'bio-mf8', text: 'RABS glove micro-pinhole at fill-line glove port' }, { id: 'bio-mf9', text: 'RABS pressure differential margin to Grade B narrowed during glove flex' }],
      material: [{ id: 'bio-mf10', text: 'Glove batch showed earlier-than-expected service-life fatigue' }],
      method: [{ id: 'bio-mf11', text: 'SOP-BIO-EM-03 glove integrity test frequency only monthly' }],
      measurement: [{ id: 'bio-mf12', text: 'EM active-air counts not trended against Annex 1 alert/action limits in real time' }],
      environment: [],
    },
    actions: [
      { id: 'bio-a5', description: 'Replace all RABS gloves on the glargine fill line and physical/pressure-decay integrity test each port', type: 'CORRECTIVE', owner: 'Omar Al-Farsi',     dueDate: '2026-04-12', status: 'COMPLETED', completedDate: '2026-04-11' },
      { id: 'bio-a6', description: 'Increase RABS glove integrity testing to per-batch with pre/post-fill visual and pressure-decay checks', type: 'PREVENTIVE', owner: 'Fatima Al-Hashimi', dueDate: '2026-04-25', status: 'IN_PROGRESS' },
      { id: 'bio-a7', description: 'Revise SOP-BIO-EM-03 with risk-based glove test frequency tied to Grade A/B classification',           type: 'PREVENTIVE', owner: 'Khalid Nasser',     dueDate: '2026-05-05', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero sterility excursions over 180-day monitoring period. 100% RABS gloves integrity-tested per batch. EM trends reviewed against Annex 1 limits weekly.',
    monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'bio-h3', timestamp: '2026-03-28T10:00:00Z', user: 'Fatima Al-Hashimi', action: 'CAPA Initiated', details: 'Triggered from NC-BIO-2026-0041 sterility excursion' },
    ],
    createdAt: '2026-03-28T10:00:00Z', updatedAt: '2026-04-11T17:00:00Z', closedAt: null, createdBy: 'Fatima Al-Hashimi',
  },
  {
    id: 'bio-capa3', capaNumber: 'CAPA-BIO-2025-0058',
    title: 'CAPA — Endotoxin OOS on human-insulin drug substance batch HI-25-0211',
    description: 'Bacterial endotoxin (LAL) result exceeded the 21 CFR 211 / USP <85> limit on drug-substance batch HI-25-0211. Root cause traced to inadequate flushing of a single-use transfer line during fermentation harvest, leaving residual endotoxin. CAPA covered flush-cycle revalidation and a per-harvest endotoxin in-process control.',
    source: 'NC', severity: 'CRITICAL', status: 'CLOSED',
    department: 'Drug Substance', productProcess: 'Fermentation Harvest · LAL Endotoxin Control',
    linkedSourceRecord: 'NC-BIO-2025-0098', owner: 'Yusuf Rahman', ownerId: 'u-bio4', dueDate: '2025-12-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did the endotoxin result exceed the limit?',     answer: 'Residual endotoxin remained in the single-use harvest transfer line.' },
      { whyNumber: 2, question: 'Why was residual endotoxin present?',                answer: 'The line flush cycle was shorter than required to depyrogenate residual gram-negative load.' },
      { whyNumber: 3, question: 'Why was the flush cycle insufficient?',              answer: 'No in-process endotoxin check on the harvest stream allowed the gap to go unverified.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'bio-mf13', text: 'Single-use harvest line flush volume under-specified' }], material: [], method: [{ id: 'bio-mf14', text: 'No per-harvest endotoxin in-process control' }], measurement: [], environment: [],
    },
    actions: [
      { id: 'bio-a8',  description: 'Revalidate single-use harvest line flush cycle to demonstrate endotoxin clearance ≥3 log',      type: 'CORRECTIVE', owner: 'Yusuf Rahman',    dueDate: '2025-09-25', status: 'COMPLETED', completedDate: '2025-09-24' },
      { id: 'bio-a9',  description: 'Add per-harvest LAL endotoxin in-process control with action limit at 50% of release spec',     type: 'PREVENTIVE', owner: 'Aisha Khalid',    dueDate: '2025-10-10', status: 'COMPLETED', completedDate: '2025-10-08' },
      { id: 'bio-a10', description: 'Add endotoxin trend dashboard to drug-substance review with weekly QA sign-off',                type: 'PREVENTIVE', owner: 'Hassan Al-Balushi', dueDate: '2025-11-20', status: 'COMPLETED', completedDate: '2025-11-19' },
    ],
    effectivenessCriteria: 'Zero endotoxin OOS over 90-day monitoring period. Per-harvest endotoxin IPC logged and reviewed for every batch.',
    monitoringPeriodDays: 90, effectivenessResult: 'PASS', effectivenessEvidence: 'No endotoxin OOS Sep 2025 – Dec 2025. Per-harvest LAL IPC reviewed for every batch by QC.',
    history: [],
    createdAt: '2025-09-15T08:30:00Z', updatedAt: '2025-12-15T14:00:00Z', closedAt: '2025-12-15T14:00:00Z', createdBy: 'Yusuf Rahman',
  },
  {
    id: 'bio-capa4', capaNumber: 'CAPA-BIO-2026-0011',
    title: 'CAPA — Host cell protein above limit on insulin aspart batch ASP-26-0177 (clearance drift)',
    description: 'Host cell protein (HCP) by ELISA exceeded the ICH Q6B process-related impurity limit on insulin aspart batch ASP-26-0177. Investigation (NC-BIO-2026-0038) linked the drift to fouled Protein A capture resin past its validated cycle life. CAPA covered resin replacement, downstream revalidation and per-cycle HCP clearance trending.',
    source: 'NC', severity: 'CRITICAL', status: 'CLOSED',
    department: 'Downstream Purification', productProcess: 'Protein A Capture · HCP Clearance (ICH Q6B)',
    linkedSourceRecord: 'NC-BIO-2026-0038', owner: 'Yusuf Rahman', ownerId: 'u-bio4', dueDate: '2026-04-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was HCP above the limit?',                       answer: 'Capture-step HCP clearance dropped below validated performance.' },
      { whyNumber: 2, question: 'Why did clearance drop?',                            answer: 'The capture resin was fouled and past its validated cycle life.' },
      { whyNumber: 3, question: 'Why was the resin used past its cycle life?',         answer: 'Resin cycle count was tracked manually and the lifetime study limit was exceeded undetected.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'bio-mf-c4a', text: 'Capture resin fouled, exceeded validated cycle life' }],
      material: [], method: [{ id: 'bio-mf-c4b', text: 'Resin cycle count tracked manually, not enforced by MES' }],
      measurement: [{ id: 'bio-mf-c4c', text: 'No per-cycle HCP clearance trending against resin life' }],
      environment: [],
    },
    actions: [
      { id: 'bio-a11', description: 'Replace Protein A capture resin and revalidate downstream HCP clearance over 3 batches',  type: 'CORRECTIVE', owner: 'Yusuf Rahman',  dueDate: '2026-03-20', status: 'COMPLETED', completedDate: '2026-03-20' },
      { id: 'bio-a12', description: 'Enforce resin cycle-count limit in MES with automatic block at validated lifetime',        type: 'PREVENTIVE', owner: 'Khalid Nasser', dueDate: '2025-10-30', status: 'COMPLETED', completedDate: '2025-10-25' },
      { id: 'bio-a13', description: 'Add per-cycle HCP clearance trending tied to resin cycle number',                          type: 'PREVENTIVE', owner: 'Aisha Khalid',  dueDate: '2026-02-15', status: 'COMPLETED', completedDate: '2026-02-14' },
    ],
    effectivenessCriteria: 'Zero HCP-related NCs over 180-day monitoring period. Resin cycle limit enforced by MES on every campaign.',
    monitoringPeriodDays: 180,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'No HCP-related NCs Nov 2025 – Apr 2026. MES blocks resin use beyond validated cycle life; HCP clearance trended per cycle.',
    history: [
      { id: 'bio-hc4a', timestamp: '2025-11-10T09:00:00Z', user: 'Yusuf Rahman', action: 'CAPA Initiated',         details: 'Triggered from NC-BIO-2026-0038 HCP drift' },
      { id: 'bio-hc4b', timestamp: '2026-04-15T14:00:00Z', user: 'Yusuf Rahman', action: 'Effectiveness Verified', details: 'PASS — 180-day monitoring complete; CAPA closed' },
    ],
    createdAt: '2025-11-10T09:00:00Z', updatedAt: '2026-04-15T14:00:00Z', closedAt: '2026-04-15T14:00:00Z', createdBy: 'Yusuf Rahman',
  },
  {
    id: 'bio-capa5', capaNumber: 'CAPA-BIO-2026-0014',
    title: 'CAPA — Protein aggregation / HMW species above limit on semaglutide drug product (cold-chain excursion)',
    description: 'Size-exclusion HPLC detected high-molecular-weight (HMW) aggregate species above the ICH Q6B limit on a semaglutide GLP-1 cartridge lot. Investigation (NC-BIO-2025-0117) traced the aggregation to a 2–8 °C cold-chain excursion during inter-suite transfer of bulk drug product. CAPA delivers transfer-process redesign and continuous cold-chain monitoring.',
    source: 'NC', severity: 'MAJOR', status: 'IMPLEMENTATION',
    department: 'Drug Substance', productProcess: 'Bulk DP Hold · Cold-Chain 2–8 °C (ICH Q5C)',
    linkedSourceRecord: 'NC-BIO-2025-0117', owner: 'Aisha Khalid', ownerId: 'u-bio5', dueDate: '2026-05-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were HMW species above the limit?',           answer: 'Semaglutide protein aggregated during a thermal excursion.' },
      { whyNumber: 2, question: 'Why did aggregation occur?',                       answer: 'Bulk drug product was held above 8 °C for ~6 hours during inter-suite transfer.' },
      { whyNumber: 3, question: 'Why was the excursion not prevented?',             answer: 'The transfer cart had no active temperature control and no continuous logger.' },
      { whyNumber: 4, question: 'Why was an uncontrolled cart used?',               answer: 'The cold-chain risk of the transfer step was not assessed under ICH Q5C stability requirements.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'bio-mf-c5a', text: 'Transfer cart without active 2–8 °C control' }],
      material: [], method: [{ id: 'bio-mf-c5b', text: 'Inter-suite transfer step not assessed under ICH Q5C' }, { id: 'bio-mf-c5c', text: 'No continuous temperature logging during transfer' }],
      measurement: [], environment: [{ id: 'bio-mf-c5d', text: 'Ambient warehouse aisle temperature elevated during transfer window' }],
    },
    actions: [
      { id: 'bio-a14', description: 'Re-test retained samples by SEC-HPLC and quarantine affected semaglutide lot',                          type: 'CORRECTIVE', owner: 'Aisha Khalid',  dueDate: '2026-04-25', status: 'COMPLETED', completedDate: '2026-04-22' },
      { id: 'bio-a15', description: 'Replace transfer carts with validated active 2–8 °C controlled units with continuous loggers',           type: 'CORRECTIVE', owner: 'Mariam Saeed',  dueDate: '2026-05-10', status: 'IN_PROGRESS' },
      { id: 'bio-a16', description: 'Add ICH Q5C cold-chain risk assessment to all bulk-DP hold and transfer steps; define max excursion time', type: 'PREVENTIVE', owner: 'Khalid Nasser', dueDate: '2026-05-15', status: 'IN_PROGRESS' },
      { id: 'bio-a17', description: 'Deploy continuous cold-chain monitoring with alarm-to-QA on any 2–8 °C breach',                          type: 'PREVENTIVE', owner: 'Mariam Saeed',  dueDate: '2026-05-25', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero HMW-aggregate OOS over 12-month monitoring period. 100% of bulk-DP transfers within validated 2–8 °C range with continuous logging.',
    monitoringPeriodDays: 365, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'bio-hc5a', timestamp: '2025-10-28T11:00:00Z', user: 'Aisha Khalid', action: 'CAPA Initiated',    details: 'Triggered from NC-BIO-2025-0117 HMW species OOS' },
      { id: 'bio-hc5b', timestamp: '2026-04-22T16:30:00Z', user: 'Aisha Khalid', action: 'Corrective Closed', details: 'Affected lot quarantined; controlled transfer carts being deployed' },
    ],
    createdAt: '2025-10-28T11:00:00Z', updatedAt: '2026-04-22T16:30:00Z', closedAt: null, createdBy: 'Aisha Khalid',
  },
  {
    id: 'bio-capa6', capaNumber: 'CAPA-BIO-2026-0017',
    title: 'CAPA — Cartridge container-closure integrity failures on degludec lot DEG-26-0071',
    description: 'NC-BIO-2026-0040 identified container-closure integrity (CCI) failures by high-voltage leak detection on insulin degludec cartridges. Root cause traced to a worn crimping cam producing inconsistent cap-seal force. CAPA covers crimper overhaul, CCI revalidation and 100% in-line headspace CCI deployment.',
    source: 'NC', severity: 'MAJOR', status: 'IMPLEMENTATION',
    department: 'Aseptic Fill-Finish', productProcess: 'Cartridge Crimp-Seal · CCI (USP <1207>)',
    linkedSourceRecord: 'NC-BIO-2026-0040', owner: 'Omar Al-Farsi', ownerId: 'u-bio2', dueDate: '2026-05-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did cartridges fail CCI?',                      answer: 'Cap-seal force was inconsistent, leaving micro-leak paths at the crimp.' },
      { whyNumber: 2, question: 'Why was the cap-seal force inconsistent?',          answer: 'The crimping cam on the capper was worn beyond service spec.' },
      { whyNumber: 3, question: 'Why was the worn cam not detected?',                answer: 'Residual seal-force monitoring was sample-based, not 100% in-line.' },
    ],
    fishbone: {
      man: [], machine: [{ id: 'bio-mf-c6a', text: 'Worn crimping cam on capper' }, { id: 'bio-mf-c6b', text: 'Cap-seal force drift outside validated window' }],
      material: [], method: [{ id: 'bio-mf-c6c', text: 'Seal-force monitoring sample-based, not 100% in-line' }],
      measurement: [{ id: 'bio-mf-c6d', text: 'No in-line headspace CCI on the cartridge line' }],
      environment: [],
    },
    actions: [
      { id: 'bio-a18', description: 'Quarantine and 100% re-inspect degludec lot DEG-26-0071 by high-voltage leak detection',  type: 'CORRECTIVE', owner: 'Omar Al-Farsi',  dueDate: '2026-04-02', status: 'IN_PROGRESS' },
      { id: 'bio-a19', description: 'Overhaul capper crimping cam and revalidate residual seal-force (3 OQ lots)',             type: 'CORRECTIVE', owner: 'Mariam Saeed',  dueDate: '2026-04-15', status: 'COMPLETED', completedDate: '2026-04-15' },
      { id: 'bio-a20', description: 'Deploy 100% in-line headspace CCI (laser gas-headspace) on the cartridge line',           type: 'PREVENTIVE', owner: 'Khalid Nasser', dueDate: '2026-04-30', status: 'IN_PROGRESS' },
      { id: 'bio-a21', description: 'Add residual seal-force trending and per-batch crimper PM-hours tracking',                 type: 'PREVENTIVE', owner: 'Omar Al-Farsi',  dueDate: '2026-05-10', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero CCI failures over 90-day monitoring period. 100% of cartridges pass in-line headspace CCI. Residual seal-force Cpk ≥ 1.33.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [
      { id: 'bio-hc6a', timestamp: '2026-03-22T10:00:00Z', user: 'Omar Al-Farsi', action: 'CAPA Initiated',        details: 'Triggered from NC-BIO-2026-0040 CCI failures' },
      { id: 'bio-hc6b', timestamp: '2026-04-15T18:00:00Z', user: 'Omar Al-Farsi', action: 'Crimper Overhaul OK',    details: 'Capper cam overhaul verified; residual seal-force revalidated' },
    ],
    createdAt: '2026-03-22T10:00:00Z', updatedAt: '2026-04-15T18:00:00Z', closedAt: null, createdBy: 'Omar Al-Farsi',
  },
];

// Dairy tenant — FSSAI / ISO 22000 / HACCP themed CAPAs.
export const mockDairyCAPAs: CAPARecord[] = [
  {
    id: 'dy-capa1', capaNumber: 'CAPA-DY-2026-0019',
    title: 'CAPA — Aflatoxin M1 in raw milk above FSSAI limit (Tanker T-2026-0512)',
    description: 'Aflatoxin M1 detection above 0.5 µg/kg traced to mycotoxin contamination in cattle feed at 4 source villages. CAPA covers supplier-farm feed audits, mandatory pre-monsoon AfM1 screening for all routes and a feed-quality awareness program for farmers.',
    source: 'NC', severity: 'CRITICAL', status: 'IMPLEMENTATION',
    department: 'Procurement', productProcess: 'Raw-milk Acceptance · Mycotoxin Control',
    linkedSourceRecord: 'NC-DY-2026-0042', owner: 'Meera Pillai', ownerId: 'u-dy2', dueDate: '2026-06-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was Aflatoxin M1 above the FSSAI limit?',                            answer: 'Cows at source villages ingested mycotoxin-contaminated feed.' },
      { whyNumber: 2, question: 'Why was the feed contaminated?',                                        answer: 'High humidity in storage at village collection centres caused fungal growth on cottonseed cake.' },
      { whyNumber: 3, question: 'Why was the contamination not detected at the farm?',                    answer: 'Routine AfM1 screening was annual; pre-monsoon spike was missed.' },
      { whyNumber: 4, question: 'Why was AfM1 screening only annual?',                                    answer: 'SOP-DY-PROC-04 inherited from a non-monsoon facility and never updated for Indian seasonal mycotoxin spikes.' },
    ],
    fishbone: {
      man: [{ id: 'dy-mf1', text: 'Farmer awareness of mycotoxin risk in monsoon cottonseed cake low' }],
      machine: [], material: [{ id: 'dy-mf2', text: 'Cottonseed cake feed with high humidity supplied by feed merchant' }],
      method: [{ id: 'dy-mf3', text: 'AfM1 screening frequency only annual' }, { id: 'dy-mf4', text: 'No pre-monsoon enhanced sampling' }],
      measurement: [], environment: [{ id: 'dy-mf5', text: 'Monsoon humidity at collection centres accelerates fungal growth' }],
    },
    actions: [
      { id: 'dy-a1', description: 'Reject tanker T-2026-0512 and audit feed at 4 source villages',                              type: 'CORRECTIVE', owner: 'Meera Pillai',  dueDate: '2026-05-25', status: 'COMPLETED', completedDate: '2026-05-24' },
      { id: 'dy-a2', description: 'Implement pre-monsoon AfM1 screening (twice-weekly Apr–Sep) for all procurement routes',     type: 'PREVENTIVE', owner: 'Anita Kulkarni', dueDate: '2026-06-10', status: 'IN_PROGRESS' },
      { id: 'dy-a3', description: 'Roll out feed-quality awareness program for 240 farmer-suppliers in the Pune cluster',       type: 'PREVENTIVE', owner: 'Meera Pillai',  dueDate: '2026-06-20', status: 'IN_PROGRESS' },
      { id: 'dy-a4', description: 'Update SOP-DY-PROC-04 with risk-based AfM1 sampling tied to season + recent test history',   type: 'PREVENTIVE', owner: 'Sandeep Joshi', dueDate: '2026-06-25', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero AfM1 OOS over 6-month monsoon monitoring period (Jun–Nov 2026). 100% of pre-monsoon screening completed per revised schedule.',
    monitoringPeriodDays: 180, effectivenessResult: null, effectivenessEvidence: null,
    history: [{ id: 'dy-hc1', timestamp: '2026-05-16T15:00:00Z', user: 'Meera Pillai', action: 'CAPA Initiated', details: 'Triggered from NC-DY-2026-0042' }],
    createdAt: '2026-05-16T15:00:00Z', updatedAt: '2026-05-16T15:00:00Z', closedAt: null, createdBy: 'Meera Pillai',
  },
  {
    id: 'dy-capa2', capaNumber: 'CAPA-DY-2026-0018',
    title: 'CAPA — Pasteurized toned-milk TPC above 30 000 cfu/ml (recontamination at FM-02)',
    description: 'High TPC on PTM-26-0431 with negative phosphatase points to post-pasteurization recontamination at filling machine FM-02. CAPA covers CIP cycle revision, weekly ATP-swab verification at filler heads, and dedicated PM on FM-02 transfer pipe.',
    source: 'NC', severity: 'CRITICAL', status: 'ROOT_CAUSE_ANALYSIS',
    department: 'Microbiology Lab', productProcess: 'Pouch Filling · Post-Pasteurization',
    linkedSourceRecord: 'NC-DY-2026-0041', owner: 'Anita Kulkarni', ownerId: 'u-dy3', dueDate: '2026-06-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was the TPC above 30 000 cfu/ml?',                                       answer: 'Recontamination after pasteurization.' },
      { whyNumber: 2, question: 'Why did recontamination occur?',                                              answer: 'Biofilm build-up at the FM-02 filler-head feed line.' },
      { whyNumber: 3, question: 'Why did biofilm form?',                                                       answer: 'CIP cycle time on FM-02 was 12 min vs. the validated 18 min.' },
      { whyNumber: 4, question: 'Why was CIP cycle short?',                                                    answer: 'Operator-edited recipe to keep up with peak shift throughput.' },
      { whyNumber: 5, question: 'Why could the operator edit CIP recipe?',                                     answer: 'HMI did not lock the CIP parameters; no change-control on recipe.' },
    ],
    fishbone: {
      man: [{ id: 'dy-mf6', text: 'Operator shortened CIP cycle for throughput' }],
      machine: [{ id: 'dy-mf7', text: 'Biofilm at FM-02 filler-head feed line' }, { id: 'dy-mf8', text: 'HMI recipe editable without password' }],
      material: [], method: [{ id: 'dy-mf9', text: 'No QA password lock on CIP recipe' }],
      measurement: [{ id: 'dy-mf10', text: 'ATP-swab verification only post-CIP, not pre-shift' }],
      environment: [],
    },
    actions: [
      { id: 'dy-a5', description: 'Run extended CIP cycle (90 °C / 30 min) on FM-02; verify via ATP swab',                  type: 'CORRECTIVE', owner: 'Ravi Deshmukh',  dueDate: '2026-05-15', status: 'COMPLETED', completedDate: '2026-05-14' },
      { id: 'dy-a6', description: 'Lock HMI CIP recipe — QA password required to edit; full audit trail enabled',           type: 'PREVENTIVE', owner: 'Sandeep Joshi',  dueDate: '2026-06-05', status: 'IN_PROGRESS' },
      { id: 'dy-a7', description: 'Pre-shift ATP-swab verification at all 4 filler heads per SOP-DY-CIP-02',                 type: 'PREVENTIVE', owner: 'Anita Kulkarni', dueDate: '2026-06-10', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero post-pasteurization microbio OOS over 90-day monitoring period. 100% ATP-swab pre-shift compliance.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [{ id: 'dy-hc2', timestamp: '2026-05-14T16:00:00Z', user: 'Anita Kulkarni', action: 'CAPA Initiated', details: 'Triggered from NC-DY-2026-0041' }],
    createdAt: '2026-05-14T16:00:00Z', updatedAt: '2026-05-14T16:00:00Z', closedAt: null, createdBy: 'Anita Kulkarni',
  },
  {
    id: 'dy-capa3', capaNumber: 'CAPA-DY-2026-0017',
    title: 'CAPA — Antibiotic residue (beta-lactam) at farm; supplier de-listing + farmer training',
    description: 'Beta-lactam positive on tanker T-2026-0498 traced to a single farm where withdrawal period was not observed. CAPA suspends and re-qualifies the farm, deploys mandatory beta-lactam dipstick at every collection centre and runs a farmer-education refresh.',
    source: 'NC', severity: 'CRITICAL', status: 'IMPLEMENTATION',
    department: 'Procurement', productProcess: 'Raw-milk Antibiotic Screening',
    linkedSourceRecord: 'NC-DY-2026-0040', owner: 'Meera Pillai', ownerId: 'u-dy2', dueDate: '2026-05-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was beta-lactam detected in raw milk?',          answer: 'Cow under amoxicillin treatment was milked into pooled supply.' },
      { whyNumber: 2, question: 'Why was she milked during the withdrawal period?',    answer: 'Farmer did not segregate her from the herd during the 96-hour withdrawal.' },
      { whyNumber: 3, question: 'Why was segregation not enforced?',                   answer: 'Farmer was unaware of full withdrawal period; veterinary advice was verbal, not in writing.' },
    ],
    fishbone: {
      man: [{ id: 'dy-mf11', text: 'Farmer unaware of full withdrawal period' }],
      machine: [], material: [], method: [{ id: 'dy-mf12', text: 'Veterinary advice not formalised in writing' }, { id: 'dy-mf13', text: 'No beta-lactam dipstick at village level' }],
      measurement: [], environment: [],
    },
    actions: [
      { id: 'dy-a8',  description: 'Suspend procurement from source farm for 14 days; re-qualify via training + 5 clean tests', type: 'CORRECTIVE', owner: 'Meera Pillai', dueDate: '2026-05-12', status: 'COMPLETED', completedDate: '2026-05-10' },
      { id: 'dy-a9',  description: 'Deploy Charm SL beta-lactam dipsticks at all 18 village collection centres',                 type: 'PREVENTIVE', owner: 'Sandeep Joshi', dueDate: '2026-05-20', status: 'IN_PROGRESS' },
      { id: 'dy-a10', description: 'Run farmer-education refresh on antibiotic withdrawal periods — 240 farmers across 3 sessions', type: 'PREVENTIVE', owner: 'Priya Khanna', dueDate: '2026-05-28', status: 'IN_PROGRESS' },
    ],
    effectivenessCriteria: 'Zero antibiotic residue positives over 90-day monitoring period across all routes.',
    monitoringPeriodDays: 90, effectivenessResult: null, effectivenessEvidence: null,
    history: [{ id: 'dy-hc3', timestamp: '2026-05-10T11:00:00Z', user: 'Meera Pillai', action: 'CAPA Initiated', details: 'Triggered from NC-DY-2026-0040; source farm suspended' }],
    createdAt: '2026-05-10T11:00:00Z', updatedAt: '2026-05-10T11:00:00Z', closedAt: null, createdBy: 'Meera Pillai',
  },
  {
    id: 'dy-capa4', capaNumber: 'CAPA-DY-2025-0044',
    title: 'CAPA — Pouch leakage 0.8% on 500ml pouches (FFS-04 heat-seal jaw wear)',
    description: 'Heat-seal jaw wear on FFS-04 caused weak seals and pouch leakage above 0.3% spec. CAPA replaced the jaw, tightened PM frequency from 12 to 6 months and added seal-strength SPC monitoring to the line SCADA.',
    source: 'NC', severity: 'MAJOR', status: 'CLOSED',
    department: 'Packaging', productProcess: 'Form-Fill-Seal · Heat Seal',
    linkedSourceRecord: 'NC-DY-2026-0024', owner: 'Priya Khanna', ownerId: 'u-dy5', dueDate: '2026-03-30',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did pouches leak?',                  answer: 'Heat seal was below spec strength.' },
      { whyNumber: 2, question: 'Why was seal strength low?',              answer: 'Worn heat-seal jaw on FFS-04.' },
      { whyNumber: 3, question: 'Why was the jaw worn beyond service?',    answer: 'PM frequency was 12-monthly; jaw life is ~8 months under daily 3-shift operation.' },
    ],
    fishbone: { man: [], machine: [{ id: 'dy-mf14', text: 'Worn heat-seal jaw' }], material: [], method: [{ id: 'dy-mf15', text: 'PM frequency mismatched to actual jaw life' }], measurement: [{ id: 'dy-mf16', text: 'No SPC on seal strength' }], environment: [] },
    actions: [
      { id: 'dy-a11', description: 'Replace heat-seal jaw on FFS-04 and revalidate seal strength',                  type: 'CORRECTIVE', owner: 'Priya Khanna', dueDate: '2026-02-20', status: 'COMPLETED', completedDate: '2026-02-18' },
      { id: 'dy-a12', description: 'Tighten PM frequency on heat-seal jaws from 12 to 6 months across FFS lines',  type: 'PREVENTIVE', owner: 'Priya Khanna', dueDate: '2026-03-10', status: 'COMPLETED', completedDate: '2026-03-08' },
      { id: 'dy-a13', description: 'Add seal-strength SPC monitoring to FFS line SCADA with auto-stop at -3σ',     type: 'PREVENTIVE', owner: 'Sandeep Joshi', dueDate: '2026-03-25', status: 'COMPLETED', completedDate: '2026-03-22' },
    ],
    effectivenessCriteria: 'Pouch leakage rate ≤ 0.3% over 90-day monitoring period. SPC out-of-control events reviewed daily.',
    monitoringPeriodDays: 90, effectivenessResult: 'PASS', effectivenessEvidence: 'Pouch leakage rate 0.18% (Mar–May 2026). Zero SPC auto-stops on FFS-04 after jaw replacement.',
    history: [],
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-05-05T16:00:00Z', closedAt: '2026-05-05T16:00:00Z', createdBy: 'Priya Khanna',
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
  const industry = useUserIndustry();
  return useQuery<PaginatedResponse<CAPARecord>>({
    queryKey: ['capas', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/capas', { params: filters });
        return unwrapList<CAPARecord>(data, flattenCAPA as any);
      } catch {
        const baseList = pickByIndustry(industry, mockCAPAs, { medical_device: mockMedicalDeviceCAPAs, dairy: mockDairyCAPAs, biologics: mockBiologicsCAPAs });
        let filtered = [...baseList];
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
  const industry = useUserIndustry();
  return useQuery<CAPARecord>({
    queryKey: ['capas', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/capas/${id}`);
        return unwrapItem<CAPARecord>(data, flattenCAPA as any);
      } catch {
        const baseList = pickByIndustry(industry, mockCAPAs, { medical_device: mockMedicalDeviceCAPAs, dairy: mockDairyCAPAs, biologics: mockBiologicsCAPAs });
        const capa = baseList.find((c) => c.id === id);
        if (!capa) throw new Error('CAPA not found');
        return capa;
      }
    },
    enabled: !!id,
  });
}

// A single corrective/preventive action, flattened out of its parent CAPA and
// tagged with that CAPA's identity so it can be listed and linked back.
export interface CAPAActionItem extends CAPAAction {
  capaId: string;
  capaNumber: string;
  capaTitle: string;
}

// Aggregate every action defined across all CAPAs into one flat list. Powers
// the "Action Items" page; each item links back to its parent CAPA.
export function useAllActionItems(filters: CAPAFilters = {}) {
  const query = useCAPAs(filters);
  const items: CAPAActionItem[] = (query.data?.data ?? []).flatMap((capa) =>
    (capa.actions ?? []).map((a) => ({
      ...a,
      capaId: capa.id,
      capaNumber: capa.capaNumber,
      capaTitle: capa.title,
    })),
  );
  return { ...query, items };
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
