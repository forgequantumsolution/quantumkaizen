import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export type RiskCategory = 'OPERATIONAL' | 'SAFETY' | 'QUALITY' | 'ENVIRONMENTAL' | 'FINANCIAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ControlHierarchy = 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';

export interface ControlMeasure {
  id: string;
  hierarchy: ControlHierarchy;
  description: string;
  owner: string;
  status: 'PLANNED' | 'IMPLEMENTED' | 'VERIFIED';
}

export interface RiskHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface RiskRecord {
  id: string;
  riskNumber: string;
  title: string;
  description: string;
  category: RiskCategory;
  department: string;
  likelihood: number;
  consequence: number;
  riskScore: number;
  riskLevel: RiskLevel;
  controls: ControlMeasure[];
  residualLikelihood: number;
  residualConsequence: number;
  residualScore: number;
  residualLevel: RiskLevel;
  owner: string;
  ownerId: string;
  reviewDate: string;
  history: RiskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function calcRiskLevel(score: number): RiskLevel {
  if (score >= 15) return 'CRITICAL';
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-400';
    case 'LOW': return 'bg-emerald-500';
  }
}

export function riskLevelBadge(level: RiskLevel): 'danger' | 'warning' | 'success' | 'default' {
  switch (level) {
    case 'CRITICAL': return 'danger';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'default';
    case 'LOW': return 'success';
  }
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockRisks: RiskRecord[] = [
  // ── 2026 records ──
  {
    id: 'r1',
    riskNumber: 'RSK-2026-0018',
    title: 'Data integrity risk — computerised systems 21 CFR Part 11 compliance gap',
    description: 'Legacy HPLC data acquisition system (Empower 2) and two other analytical instruments lack audit trail review as part of the routine batch record review process. Risk of undetected data manipulation or transcription errors. USFDA inspection scheduled Q3 2026; non-compliance could result in warning letter or import alert.',
    category: 'QUALITY',
    department: 'Quality Assurance',
    likelihood: 3,
    consequence: 5,
    riskScore: 15,
    riskLevel: 'CRITICAL',
    controls: [
      { id: 'cm1', hierarchy: 'ADMINISTRATIVE', description: 'Update batch record review SOP to mandate audit trail review for all computerised analytical systems', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm2', hierarchy: 'ADMINISTRATIVE', description: 'Conduct retrospective audit trail review for 3-month data set on all affected instruments', owner: 'Rajesh Kumar', status: 'PLANNED' },
      { id: 'cm3', hierarchy: 'ENGINEERING', description: 'Upgrade Empower 2 to Empower 3 with enhanced audit trail and Part 11 compliance modules', owner: 'Deepak Nair', status: 'PLANNED' },
      { id: 'cm4', hierarchy: 'ADMINISTRATIVE', description: 'Conduct data integrity training for all QC analysts and supervisors', owner: 'Sunita Rao', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 4,
    residualScore: 8,
    residualLevel: 'MEDIUM',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    reviewDate: '2026-06-30',
    history: [
      { id: 'rh1', timestamp: '2026-01-15T10:00:00Z', user: 'Anita Desai', action: 'Risk Identified', details: 'Identified during pre-USFDA inspection readiness review; 21 CFR Part 11 compliance gap confirmed' },
      { id: 'rh2', timestamp: '2026-02-10T09:00:00Z', user: 'Dr. Priya Sharma', action: 'Controls Partially Implemented', details: 'SOP updated and training completed; system upgrade procurement in progress' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-10T09:00:00Z',
  },
  {
    id: 'r2',
    riskNumber: 'RSK-2026-0017',
    title: 'Cross-contamination risk in shared tablet manufacturing facility',
    description: 'Paracetamol 500mg, Metformin 500mg, and Omeprazole 20mg are manufactured on shared granulation and compression equipment. Risk of API cross-contamination between products, particularly penicillin-class or high-potency residuals. Current cleaning validation covers only highest-risk product pair combination.',
    category: 'QUALITY',
    department: 'Production',
    likelihood: 2,
    consequence: 5,
    riskScore: 10,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm5', hierarchy: 'ENGINEERING', description: 'Dedicated product-contact parts (punches, dies) for each product; colour-coded storage', owner: 'Vikram Patel', status: 'IMPLEMENTED' },
      { id: 'cm6', hierarchy: 'ENGINEERING', description: 'Validated cleaning procedure (swab and rinse) for all shared equipment; cleaning validation extended to all product pairs', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm7', hierarchy: 'ADMINISTRATIVE', description: 'Scheduling policy: high-risk product (Metformin) always scheduled last in campaign before full clean', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
      { id: 'cm8', hierarchy: 'ADMINISTRATIVE', description: 'Mandatory swab test on equipment surface before first batch of each product campaign', owner: 'Rajesh Kumar', status: 'VERIFIED' },
    ],
    residualLikelihood: 1,
    residualConsequence: 5,
    residualScore: 5,
    residualLevel: 'MEDIUM',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    reviewDate: '2026-07-01',
    history: [
      { id: 'rh3', timestamp: '2026-01-20T11:00:00Z', user: 'Dr. Priya Sharma', action: 'Risk Identified', details: 'Identified during annual quality risk management review per ICH Q10' },
      { id: 'rh4', timestamp: '2026-03-01T09:00:00Z', user: 'Rajesh Kumar', action: 'Controls Verified', details: 'Cleaning validation extended to all product pairs; swab protocol verified' },
    ],
    createdAt: '2026-01-20T11:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'r3',
    riskNumber: 'RSK-2026-0016',
    title: 'API supply chain disruption — single-source supplier for Ceftriaxone active pharmaceutical ingredient',
    description: 'Ceftriaxone sodium API is currently sourced exclusively from one approved supplier (Kopran Ltd). Any supply disruption — regulatory action at supplier site, quality issue, force majeure — would halt Ceftriaxone 1g injection production for an estimated 8–14 weeks. No alternate approved supplier exists.',
    category: 'OPERATIONAL',
    department: 'Quality Assurance',
    likelihood: 3,
    consequence: 4,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm9', hierarchy: 'ADMINISTRATIVE', description: 'Initiate qualification of second Ceftriaxone API supplier (Orchid Chemicals); target approval by Q4 2026', owner: 'Anita Desai', status: 'PLANNED' },
      { id: 'cm10', hierarchy: 'ADMINISTRATIVE', description: 'Maintain 6-month safety stock of Ceftriaxone API in temperature-controlled warehouse', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm11', hierarchy: 'ADMINISTRATIVE', description: 'Quarterly supplier performance review and site audit for Kopran Ltd including review of US FDA/WHO GMP status', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    owner: 'Anita Desai',
    ownerId: 'u3',
    reviewDate: '2026-09-30',
    history: [
      { id: 'rh5', timestamp: '2026-02-01T10:00:00Z', user: 'Anita Desai', action: 'Risk Identified', details: 'Identified during supplier base single-source review Q1 2026' },
      { id: 'rh6', timestamp: '2026-03-15T09:00:00Z', user: 'Rajesh Kumar', action: 'Controls Partially Implemented', details: '6-month safety stock achieved; second supplier qualification initiated' },
    ],
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-15T09:00:00Z',
  },
  {
    id: 'r4',
    riskNumber: 'RSK-2026-0015',
    title: 'Product recall risk due to stability failure — Ceftriaxone 1g injection shelf-life exceedance',
    description: 'Following the stability OOS at 18-month timepoint for Ceftriaxone 1g injection (see NC-2025-0022), there is a residual risk that marketed batches within their current approved expiry may be failing specification. Recall scope assessment is ongoing; 12 marketed batches with a combined value of approximately INR 2.8 crore are under review.',
    category: 'FINANCIAL',
    department: 'Quality Assurance',
    likelihood: 3,
    consequence: 5,
    riskScore: 15,
    riskLevel: 'CRITICAL',
    controls: [
      { id: 'cm12', hierarchy: 'ADMINISTRATIVE', description: 'Batch-by-batch stability data review for all Ceftriaxone 1g injection batches within expiry', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
      { id: 'cm13', hierarchy: 'ADMINISTRATIVE', description: 'Regulatory variation filed for shelf-life reduction; field alert issued to distribution chain', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm14', hierarchy: 'ADMINISTRATIVE', description: 'Proactive voluntary recall initiated for batches where degradation trend exceeds acceptable limits', owner: 'Dr. Priya Sharma', status: 'PLANNED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 4,
    residualScore: 8,
    residualLevel: 'MEDIUM',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    reviewDate: '2026-05-01',
    history: [
      { id: 'rh7', timestamp: '2026-01-10T14:00:00Z', user: 'Dr. Priya Sharma', action: 'Risk Identified', details: 'Risk escalated following confirmation of stability OOS — potential recall scope assessment initiated' },
      { id: 'rh8', timestamp: '2026-02-20T11:00:00Z', user: 'Anita Desai', action: 'Controls Partially Implemented', details: 'Regulatory variation filed; batch review underway; recall scope not yet finalised' },
    ],
    createdAt: '2026-01-10T14:00:00Z',
    updatedAt: '2026-02-20T11:00:00Z',
  },
  {
    id: 'r5',
    riskNumber: 'RSK-2026-0014',
    title: 'Environmental monitoring system failure risk — cleanroom particulate and microbial monitoring',
    description: 'The environmental monitoring (EM) system for Grade B/C cleanrooms relies on a single particle counter unit (Lighthouse SOLAIR) and manual microbial sampling. The particle counter has no redundancy; a unit failure during an aseptic fill campaign would require production halt or unmonitored fill, both unacceptable under WHO GMP Annex 1.',
    category: 'OPERATIONAL',
    department: 'Quality Control',
    likelihood: 2,
    consequence: 4,
    riskScore: 8,
    riskLevel: 'MEDIUM',
    controls: [
      { id: 'cm15', hierarchy: 'ENGINEERING', description: 'Procure backup particle counter unit and qualify as alternative monitoring tool', owner: 'Deepak Nair', status: 'PLANNED' },
      { id: 'cm16', hierarchy: 'ADMINISTRATIVE', description: 'Establish SOP for EM system failure — defined hold and contingency procedure for aseptic fills during monitoring system unavailability', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
      { id: 'cm17', hierarchy: 'ADMINISTRATIVE', description: 'Preventive maintenance and calibration of particle counter at 6-monthly intervals with manufacturer service contract', owner: 'Deepak Nair', status: 'VERIFIED' },
    ],
    residualLikelihood: 1,
    residualConsequence: 3,
    residualScore: 3,
    residualLevel: 'LOW',
    owner: 'Deepak Nair',
    ownerId: 'u6',
    reviewDate: '2026-08-01',
    history: [
      { id: 'rh9', timestamp: '2026-02-15T10:00:00Z', user: 'Rajesh Kumar', action: 'Risk Identified', details: 'Identified following 3-day particle counter outage in Jan 2026 that required campaign suspension' },
    ],
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-03-10T11:00:00Z',
  },
  {
    id: 'r6',
    riskNumber: 'RSK-2026-0013',
    title: 'Regulatory non-compliance risk — Schedule M (Revised) amendment implementation gap',
    description: 'The Drugs and Cosmetics Act Schedule M (Revised) amendments notified in December 2023 require updated GMP compliance by small and medium pharmaceutical manufacturers by December 2025. Internal gap assessment identified 7 areas of partial compliance: batch record completeness, equipment qualification documentation, stability study commitments, personnel qualification records, premises layout, water system validation, and quality agreement with contract manufacturers.',
    category: 'QUALITY',
    department: 'Quality Assurance',
    likelihood: 3,
    consequence: 4,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm18', hierarchy: 'ADMINISTRATIVE', description: 'Complete Schedule M gap assessment and prepare remediation plan with CDSCO-aligned timeline', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm19', hierarchy: 'ADMINISTRATIVE', description: 'Engage regulatory consultant for Schedule M mock inspection and gap closure support', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
      { id: 'cm20', hierarchy: 'ADMINISTRATIVE', description: 'Prioritise 7 identified gap areas for closure by September 2026; monthly tracking in management review', owner: 'Dr. Priya Sharma', status: 'PLANNED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    owner: 'Anita Desai',
    ownerId: 'u3',
    reviewDate: '2026-06-30',
    history: [
      { id: 'rh10', timestamp: '2026-01-25T09:00:00Z', user: 'Anita Desai', action: 'Risk Identified', details: 'Schedule M revised amendment gap assessment completed; 7 non-conformances identified' },
      { id: 'rh11', timestamp: '2026-03-01T14:00:00Z', user: 'Dr. Priya Sharma', action: 'Controls Partially Implemented', details: 'Regulatory consultant engaged; remediation plan under development' },
    ],
    createdAt: '2026-01-25T09:00:00Z',
    updatedAt: '2026-03-01T14:00:00Z',
  },
  {
    id: 'r7',
    riskNumber: 'RSK-2026-0012',
    title: 'Cold chain breach risk for temperature-sensitive injectable products',
    description: 'Ondansetron 4mg/2ml injection and Ceftriaxone 1g injection require storage at 2–8°C throughout the cold chain. Risk of temperature excursion during transport from manufacturer to distributor warehouses, particularly during summer months (April–June) when ambient temperatures exceed 40°C. Last 2 years show 3 cold chain breach incidents per year on average.',
    category: 'QUALITY',
    department: 'Warehouse',
    likelihood: 3,
    consequence: 4,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm21', hierarchy: 'ENGINEERING', description: 'Insulated cold-chain packaging with validated 48-hour temperature hold for all refrigerated injectable shipments', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm22', hierarchy: 'ENGINEERING', description: 'Electronic temperature data loggers in all refrigerated consignments; threshold alarm at >8°C', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm23', hierarchy: 'ADMINISTRATIVE', description: 'Qualified cold-chain logistics partners only; GDP-compliant vehicles with real-time temperature monitoring', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm24', hierarchy: 'ADMINISTRATIVE', description: 'Define and implement temperature excursion investigation and product impact assessment SOP', owner: 'Dr. Priya Sharma', status: 'VERIFIED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    owner: 'Rajesh Kumar',
    ownerId: 'u2',
    reviewDate: '2026-06-15',
    history: [
      { id: 'rh12', timestamp: '2026-01-05T11:00:00Z', user: 'Rajesh Kumar', action: 'Risk Identified', details: 'Risk elevated after post-monsoon review of 2025 cold chain breach incidents (3 events)' },
      { id: 'rh13', timestamp: '2026-02-28T16:00:00Z', user: 'Anita Desai', action: 'Controls Verified', details: 'GDP-compliant logistics partner contracts renewed; data logger protocol verified' },
    ],
    createdAt: '2026-01-05T11:00:00Z',
    updatedAt: '2026-02-28T16:00:00Z',
  },
  {
    id: 'r8',
    riskNumber: 'RSK-2026-0011',
    title: 'Counterfeit or adulterated API risk from unauthorised supplier procurement',
    description: 'During a period of Amoxicillin trihydrate shortage in Q1 2026, procurement was under pressure to source from non-approved vendors to maintain supply. Risk of procuring counterfeit or adulterated API if approved supplier list controls are bypassed. One near-miss event recorded where an unapproved vendor quotation was almost actioned without QA review.',
    category: 'QUALITY',
    department: 'Quality Assurance',
    likelihood: 2,
    consequence: 5,
    riskScore: 10,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm25', hierarchy: 'ADMINISTRATIVE', description: 'Enforce approved vendor list (AVL) policy — no procurement of API from non-AVL vendors without formal QA waiver and management approval', owner: 'Dr. Priya Sharma', status: 'VERIFIED' },
      { id: 'cm26', hierarchy: 'ADMINISTRATIVE', description: '100% identity testing (IR spectroscopy) for all incoming API consignments regardless of supplier status', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm27', hierarchy: 'ADMINISTRATIVE', description: 'Maintain 3-month safety stock for all APIs; escalation protocol to QA Director if stock drops below 6 weeks', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1,
    residualConsequence: 4,
    residualScore: 4,
    residualLevel: 'LOW',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    reviewDate: '2026-06-30',
    history: [
      { id: 'rh14', timestamp: '2026-01-18T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Risk Identified', details: 'Near-miss: unapproved vendor quotation for Amoxicillin trihydrate almost processed without QA review during shortage' },
      { id: 'rh15', timestamp: '2026-02-05T09:00:00Z', user: 'Rajesh Kumar', action: 'Controls Verified', details: 'AVL policy reinforced; safety stock protocol implemented' },
    ],
    createdAt: '2026-01-18T10:00:00Z',
    updatedAt: '2026-02-05T09:00:00Z',
  },
  // ── 2025 records ──
  {
    id: 'rsk-2025-001', riskNumber: 'RSK-2025-0024',
    title: 'Laboratory OOS investigation inadequacy risk — incomplete Phase II investigation closure',
    category: 'QUALITY', department: 'Quality Control',
    description: 'Review of OOS investigation records for 2024–2025 identified that 4 out of 11 Phase II OOS investigations were closed without a confirmed root cause, with results attributed to "laboratory error (unspecified)". This practice is non-compliant with 21 CFR 211.192 and ICH Q10. Risk of repeat OOS and regulatory citation if investigations are found insufficient during inspection.',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'cm28', hierarchy: 'ADMINISTRATIVE', description: 'Revise OOS investigation SOP to mandate a confirmed root cause or an inconclusive investigation report with scientific justification before closure', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm29', hierarchy: 'ADMINISTRATIVE', description: 'Retrospective review of 4 inadequately closed OOS investigations; re-open if root cause not confirmed', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
      { id: 'cm30', hierarchy: 'ADMINISTRATIVE', description: 'Conduct OOS investigation training (ICH Q10, 21 CFR 211.192) for all QC analysts and supervisors', owner: 'Sunita Rao', status: 'VERIFIED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Rajesh Kumar', ownerId: 'u2', reviewDate: '2025-12-31',
    history: [
      { id: 'rh16', timestamp: '2025-03-15T09:00:00Z', user: 'Dr. Priya Sharma', action: 'Risk Identified', details: 'Identified during internal QA audit of OOS investigation records Q1 2025' },
      { id: 'rh17', timestamp: '2025-06-30T11:00:00Z', user: 'Rajesh Kumar', action: 'Controls Implemented', details: 'SOP revised, training completed, retrospective review ongoing' },
    ],
    createdAt: '2025-03-15T09:00:00Z', updatedAt: '2025-06-30T11:00:00Z',
  },
  {
    id: 'rsk-2025-002', riskNumber: 'RSK-2025-0019',
    title: 'Personnel competency gap in sterile manufacturing — aseptic technique and gowning',
    category: 'QUALITY', department: 'Production',
    description: 'Following two gowning SOP deviations in aseptic process simulations (2024, 2025) and a Grade B contamination event, a broader personnel competency gap in aseptic technique was identified. 6 of 18 Grade B-qualified operators have qualification records older than 24 months. Risk of media fill failure, sterility test failure, and patient harm from non-sterile injectable product.',
    likelihood: 3, consequence: 5, riskScore: 15, riskLevel: 'CRITICAL',
    controls: [
      { id: 'cm31', hierarchy: 'ADMINISTRATIVE', description: 'Re-qualify all 6 operators with lapsed gowning qualification within 30 days', owner: 'Sunita Rao', status: 'IMPLEMENTED' },
      { id: 'cm32', hierarchy: 'ADMINISTRATIVE', description: 'Implement biannual gowning qualification for all Grade B personnel; triggered re-qualification after any EM excursion', owner: 'Dr. Priya Sharma', status: 'VERIFIED' },
      { id: 'cm33', hierarchy: 'ADMINISTRATIVE', description: 'Quarterly gowning observation programme with competency scoring; threshold score for Grade B re-admission', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm34', hierarchy: 'ADMINISTRATIVE', description: 'Mandatory aseptic technique refresher course for all sterile manufacturing personnel annually', owner: 'Sunita Rao', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 4, residualScore: 8, residualLevel: 'MEDIUM',
    owner: 'Vikram Patel', ownerId: 'u4', reviewDate: '2025-12-31',
    history: [
      { id: 'rh18', timestamp: '2025-01-20T10:00:00Z', user: 'Vikram Patel', action: 'Risk Identified', details: 'Identified following second gowning deviation in media fill; competency gap analysis conducted' },
      { id: 'rh19', timestamp: '2025-06-30T11:00:00Z', user: 'Sunita Rao', action: 'Controls Verified', details: 'All 6 operators re-qualified; biannual programme live; quarterly observations scheduled' },
    ],
    createdAt: '2025-01-20T10:00:00Z', updatedAt: '2025-06-30T11:00:00Z',
  },
  {
    id: 'rsk-2025-003', riskNumber: 'RSK-2025-0011',
    title: 'Purified water system microbiological contamination risk — distribution loop biofilm formation',
    category: 'QUALITY', department: 'Quality Control',
    description: 'The purified water (PW) distribution loop serving the tablet manufacturing and QC laboratory areas was installed in 2018 and uses ambient-temperature circulation. Risk of progressive biofilm formation in dead-legs and low-flow sections, leading to TVC action limit exceedances (>100 CFU/mL). One action limit breach was recorded in May 2025 (WU-04: 120 CFU/mL).',
    likelihood: 3, consequence: 3, riskScore: 9, riskLevel: 'MEDIUM',
    controls: [
      { id: 'cm35', hierarchy: 'ENGINEERING', description: 'Identify and eliminate all dead-legs in PW distribution loop during next planned shutdown (Q3 2025)', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm36', hierarchy: 'ENGINEERING', description: 'Increase sanitisation frequency to weekly hot sanitisation (80°C) of the entire loop', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm37', hierarchy: 'ADMINISTRATIVE', description: 'Increase TVC monitoring to 3× per week at all outlets; implement alert (50 CFU/mL) and action (100 CFU/mL) level response procedure', owner: 'Rajesh Kumar', status: 'VERIFIED' },
    ],
    residualLikelihood: 1, residualConsequence: 3, residualScore: 3, residualLevel: 'LOW',
    owner: 'Deepak Nair', ownerId: 'u6', reviewDate: '2025-12-31',
    history: [
      { id: 'rh20', timestamp: '2025-05-20T09:00:00Z', user: 'Deepak Nair', action: 'Risk Identified', details: 'Risk escalated following TVC action limit breach at outlet WU-04 (NC-2025-0015)' },
      { id: 'rh21', timestamp: '2025-08-30T10:00:00Z', user: 'Deepak Nair', action: 'Controls Verified', details: 'Dead-legs eliminated; weekly hot sanitisation in place; monitoring data clean for 3 months' },
    ],
    createdAt: '2025-05-20T09:00:00Z', updatedAt: '2025-08-30T10:00:00Z',
  },
  // ── 2024 records ──
  {
    id: 'rsk-2024-001', riskNumber: 'RSK-2024-0033',
    title: 'Tablet compression equipment wear risk — recurring hardness OOS on Metformin 500mg',
    category: 'QUALITY', department: 'Production',
    description: 'Compression machine CM-03 used for Metformin 500mg tablets has shown progressive punch and die wear over 3 consecutive batches, resulting in hardness trending toward the lower specification limit (10 kP). One in-process hardness OOS (8 kP) recorded in April 2024. Continued wear will increase OOS frequency and batch rejection rate.',
    likelihood: 4, consequence: 3, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'cm38', hierarchy: 'ENGINEERING', description: 'Replace complete punch set on CM-03 with B-type punches from validated tooling supplier', owner: 'Vikram Patel', status: 'IMPLEMENTED' },
      { id: 'cm39', hierarchy: 'ADMINISTRATIVE', description: 'Implement 5-batch punch wear inspection cycle with dimensional check; retire punches at >0.05mm dimensional deviation', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm40', hierarchy: 'ADMINISTRATIVE', description: 'Add mandatory tablet hardness in-process check at every 30 minutes of compression run in BMR', owner: 'Dr. Priya Sharma', status: 'VERIFIED' },
    ],
    residualLikelihood: 1, residualConsequence: 3, residualScore: 3, residualLevel: 'LOW',
    owner: 'Vikram Patel', ownerId: 'u4', reviewDate: '2025-04-30',
    history: [
      { id: 'rh22', timestamp: '2024-04-15T10:00:00Z', user: 'Vikram Patel', action: 'Risk Identified', details: 'Identified following in-process hardness OOS NC-2024-0014; punch wear trend confirmed' },
      { id: 'rh23', timestamp: '2024-06-20T09:00:00Z', user: 'Vikram Patel', action: 'Controls Implemented', details: 'Punch set replaced; 5-batch inspection cycle in CMMS; BMR updated' },
      { id: 'rh24', timestamp: '2025-01-15T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Risk resolved: 8 consecutive Metformin batches within hardness spec; no punch wear beyond retirement threshold' },
    ],
    createdAt: '2024-04-15T10:00:00Z', updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'rsk-2024-002', riskNumber: 'RSK-2024-0020',
    title: 'Risk of regulatory action due to inadequate CDSCO Annual Product Quality Review (APQR) submissions',
    category: 'QUALITY', department: 'Regulatory Affairs',
    description: 'Annual Product Quality Reviews (APQRs) for 3 of 6 marketed products were submitted to CDSCO 45–90 days beyond the statutory due date in 2023. APQR for Ceftriaxone 1g injection is pending for 2024. Repeated late submissions risk regulatory non-compliance notice, additional inspections, or product licence renewal delays.',
    likelihood: 3, consequence: 3, riskScore: 9, riskLevel: 'MEDIUM',
    controls: [
      { id: 'cm41', hierarchy: 'ADMINISTRATIVE', description: 'Establish APQR preparation calendar with 60-day lead time trigger; assign dedicated Regulatory Affairs owner for each product', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm42', hierarchy: 'ADMINISTRATIVE', description: 'Monthly APQR status tracking in management review agenda; escalation if any APQR at risk of late submission', owner: 'Dr. Priya Sharma', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 2, residualScore: 4, residualLevel: 'LOW',
    owner: 'Anita Desai', ownerId: 'u3', reviewDate: '2024-12-31',
    history: [
      { id: 'rh25', timestamp: '2024-02-10T09:00:00Z', user: 'Anita Desai', action: 'Risk Identified', details: 'Identified after 3rd consecutive late APQR submission in 2023; management review action' },
      { id: 'rh26', timestamp: '2024-04-30T10:00:00Z', user: 'Anita Desai', action: 'Controls Implemented', details: 'APQR calendar live; all 2024 APQRs on track for on-time submission' },
    ],
    createdAt: '2024-02-10T09:00:00Z', updatedAt: '2024-08-01T10:00:00Z',
  },
  {
    id: 'rsk-2024-003', riskNumber: 'RSK-2024-0008',
    title: 'Environmental compliance risk — pharmaceutical effluent exceeding CPCB discharge limits',
    category: 'ENVIRONMENTAL', department: 'Engineering',
    description: 'Effluent generated from Ceftriaxone injection manufacturing contains beta-lactam antibiotic residues. Treatment in the on-site ETP must achieve NMT 0.01 mg/L Ceftriaxone in treated effluent per CPCB pharmaceutical wastewater norms. ETP performance fluctuates during monsoon season when inflow volumes increase by 30–40%. One exceedance recorded in August 2024.',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'cm43', hierarchy: 'ENGINEERING', description: 'Upgrade ETP with dedicated pre-treatment step for beta-lactam inactivation (alkaline hydrolysis at pH 12) before biological treatment', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm44', hierarchy: 'ENGINEERING', description: 'Install holding tank (100KL) to buffer peak inflow during monsoon season and maintain stable ETP loading', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm45', hierarchy: 'ADMINISTRATIVE', description: 'Daily effluent monitoring during monsoon season (June–September); 4-hourly during Ceftriaxone production campaigns', owner: 'Sunita Rao', status: 'VERIFIED' },
    ],
    residualLikelihood: 1, residualConsequence: 3, residualScore: 3, residualLevel: 'LOW',
    owner: 'Deepak Nair', ownerId: 'u6', reviewDate: '2025-05-01',
    history: [
      { id: 'rh27', timestamp: '2024-08-20T14:00:00Z', user: 'Deepak Nair', action: 'Risk Identified', details: 'Risk escalated after CPCB effluent limit exceedance in August 2024 monsoon season' },
      { id: 'rh28', timestamp: '2024-10-15T09:00:00Z', user: 'Deepak Nair', action: 'Controls Implemented', details: 'ETP beta-lactam pre-treatment and holding tank commissioned; monitoring protocol in place' },
      { id: 'rh29', timestamp: '2025-01-10T10:00:00Z', user: 'Sunita Rao', action: 'Controls Verified', details: 'Effluent monitoring clean through Nov–Dec 2024 post-monsoon; residual risk reduced to LOW' },
    ],
    createdAt: '2024-08-20T14:00:00Z', updatedAt: '2025-01-10T10:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface RiskFilters {
  riskLevel?: string;
  department?: string;
  category?: string;
  owner?: string;
  search?: string;
}

export function useRisks(filters: RiskFilters = {}) {
  return useQuery<PaginatedResponse<RiskRecord>>({
    queryKey: ['risks', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/risks', { params: filters });
        if (!Array.isArray(data?.data)) throw new Error('unexpected response');
        return data;
      } catch {
        let filtered = [...mockRisks];
        if (filters.riskLevel) filtered = filtered.filter((r) => r.riskLevel === filters.riskLevel);
        if (filters.department) filtered = filtered.filter((r) => r.department === filters.department);
        if (filters.category) filtered = filtered.filter((r) => r.category === filters.category);
        if (filters.owner) filtered = filtered.filter((r) => r.owner === filters.owner);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (r) => r.title.toLowerCase().includes(q) || r.riskNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useRisk(id: string) {
  return useQuery<RiskRecord>({
    queryKey: ['risks', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/risks/${id}`);
        if (!data?.id) throw new Error('unexpected response');
        return data;
      } catch {
        const risk = mockRisks.find((r) => r.id === id);
        if (!risk) throw new Error('Risk not found');
        return risk;
      }
    },
    enabled: !!id,
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/risks', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      toast.success('Risk added successfully');
    },
    onError: () => {
      toast.error('Failed to add risk');
    },
  });
}
