import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

const flattenRisk = (r: Record<string, unknown>) => {
  const base = flattenUsers(r, ['owner']) as any;
  return {
    ...base,
    // Backend stores control measures as a single text field; list page
    // expects an array of control objects. Default to [] when absent.
    controls: Array.isArray(base.controls) ? base.controls : [],
  };
};

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
  // ── Additional records (20+ total for the demo) ──
  ...((): RiskRecord[] => {
    const extras = [
      ['r15', 'RSK-2026-0019', 'Single-source supplier for HPMC — supply disruption risk', 'Paracetamol and Metformin coating rely on a single supplier for HPMC.', 'OPERATIONAL', 'Production', 3, 4, 'MEDIUM', 2, 3, 'LOW', 'Dr. Priya Sharma', 'u1', '2026-05-15'],
      ['r16', 'RSK-2026-0020', 'Tablet press spare-parts lead time > 12 weeks', 'Unplanned breakdown of TP-04 could halt Paracetamol production for 3 months.', 'OPERATIONAL', 'Engineering', 2, 4, 'MEDIUM', 1, 4, 'LOW', 'Mohammed Iqbal', 'u7', '2026-07-01'],
      ['r17', 'RSK-2026-0021', 'HVAC compressor redundancy gap — sterile block', 'Loss of sterile block HVAC compressor would fail EU GMP Annex 1 requirements.', 'SAFETY', 'Engineering', 2, 5, 'MEDIUM', 1, 5, 'MEDIUM', 'Kavita Menon', 'u10', '2026-08-01'],
      ['r18', 'RSK-2026-0022', 'Counterfeit risk for high-value oncology SKUs', 'Grey-market activity detected on adjacent SKUs; serialization coverage extending.', 'QUALITY', 'Regulatory Affairs', 3, 4, 'HIGH', 2, 3, 'MEDIUM', 'Anita Desai', 'u3', '2026-06-30'],
      ['r19', 'RSK-2026-0023', 'Stability chamber compressor redundancy gap', 'A single compressor failure would breach stability storage conditions.', 'QUALITY', 'Quality Control', 2, 4, 'MEDIUM', 1, 4, 'LOW', 'Rajesh Kumar', 'u2', '2026-05-20'],
      ['r20', 'RSK-2026-0024', 'Regulatory change — USFDA DSCSA full implementation', 'Final phase DSCSA compliance; vendor cutover risk.', 'QUALITY', 'Regulatory Affairs', 3, 4, 'HIGH', 2, 2, 'LOW', 'Anita Desai', 'u3', '2026-10-01'],
    ] as const;
    return extras.map(([id, num, title, desc, cat, dept, L, C, level, rL, rC, rLevel, owner, oid, rev]) => ({
      id, riskNumber: num, title, description: desc,
      category: cat as RiskCategory, department: dept,
      likelihood: L as number, consequence: C as number, riskScore: (L as number) * (C as number), riskLevel: level as RiskLevel,
      controls: [],
      residualLikelihood: rL as number, residualConsequence: rC as number, residualScore: (rL as number) * (rC as number), residualLevel: rLevel as RiskLevel,
      owner, ownerId: oid, reviewDate: rev,
      history: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
    }));
  })(),
];

// Medical-device risk register — ISO 14971 / 21 CFR 820.30 themed.
export const mockMedicalDeviceRisks: RiskRecord[] = [
  {
    id: 'md-r1', riskNumber: 'RSK-MD-2026-0021',
    title: 'EO sterilization residuals exceeding ISO 10993-7 limits — patient toxicity hazard',
    description: 'Insufficient aeration on EO sterilizer EOS-02 can leave EO/ECH residuals above ISO 10993-7 limits in finished devices. Adverse-event risk includes mucosal irritation and sensitization. Repeat occurrence after PLC maintenance (see NC-MD-2026-0042 / CAPA-MD-2026-0019).',
    category: 'SAFETY', department: 'Sterilization',
    likelihood: 3, consequence: 5, riskScore: 15, riskLevel: 'CRITICAL',
    controls: [
      { id: 'md-rc1', hierarchy: 'ENGINEERING',    description: 'Blocking PLC alarm if recipe not loaded post-maintenance', owner: 'Rohit Khanna',     status: 'IMPLEMENTED' },
      { id: 'md-rc2', hierarchy: 'ADMINISTRATIVE', description: 'Two-person sign-off on post-maintenance qualification step', owner: 'Karthik Iyer',     status: 'PLANNED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Karthik Iyer', ownerId: 'u-md2', reviewDate: '2026-07-01', history: [],
    createdAt: '2026-04-01T09:00:00Z', updatedAt: '2026-04-01T09:00:00Z',
  },
  {
    id: 'md-r2', riskNumber: 'RSK-MD-2026-0020',
    title: 'Sterile-barrier failure (Class III implantables) — sepsis risk',
    description: 'Compromised Tyvek-foil seals on heart-valve or vascular implant pouches can result in non-sterile delivery to OT. Patient-safety hazard: surgical-site infection or sepsis. ISO 11607-2 seal integrity controls required.',
    category: 'SAFETY', department: 'Sterile Barrier Packaging',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc3', hierarchy: 'ENGINEERING',    description: 'SPC on heat-seal temperature with ±3 °C alert', owner: 'Aditya Menon', status: 'IMPLEMENTED' },
      { id: 'md-rc4', hierarchy: 'ADMINISTRATIVE', description: 'Daily release-time seal-strength burst tests',  owner: 'Neha Bansal',  status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Neha Bansal', ownerId: 'u-md3', reviewDate: '2026-06-15', history: [],
    createdAt: '2026-04-02T10:00:00Z', updatedAt: '2026-04-02T10:00:00Z',
  },
  {
    id: 'md-r3', riskNumber: 'RSK-MD-2026-0019',
    title: 'UDI non-compliance for EU MDR / US FDA submissions',
    description: 'Failure to maintain accurate UDI-DI records and submit to GUDID / EUDAMED on schedule risks distribution suspension under EU MDR Article 27 and 21 CFR Part 830. Recent NC-MD-2026-0040 highlighted printer issues; broader process gaps remain.',
    category: 'OPERATIONAL', department: 'Regulatory Affairs',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc5', hierarchy: 'ENGINEERING',    description: 'End-of-line vision system UDI verification with auto-reject', owner: 'Aditya Menon', status: 'IMPLEMENTED' },
      { id: 'md-rc6', hierarchy: 'ADMINISTRATIVE', description: 'Quarterly GUDID/EUDAMED reconciliation against ERP master', owner: 'Sneha Kapoor', status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Sneha Kapoor', ownerId: 'u-md5', reviewDate: '2026-09-01', history: [],
    createdAt: '2026-04-03T11:00:00Z', updatedAt: '2026-04-03T11:00:00Z',
  },
  {
    id: 'md-r4', riskNumber: 'RSK-MD-2026-0018',
    title: 'Cybersecurity / SBOM gaps in connected infusion pump firmware',
    description: 'Connected infusion pumps (Bluetooth + Wi-Fi) lack a documented SBOM and threat model per FDA September 2023 cybersecurity guidance. Unaddressed vulnerabilities could lead to unauthorised parameter changes and patient harm.',
    category: 'SAFETY', department: 'Design Controls',
    likelihood: 3, consequence: 5, riskScore: 15, riskLevel: 'CRITICAL',
    controls: [
      { id: 'md-rc7', hierarchy: 'ENGINEERING', description: 'Signed firmware updates with hardware-root-of-trust verification', owner: 'Aditya Menon', status: 'IMPLEMENTED' },
      { id: 'md-rc8', hierarchy: 'ENGINEERING', description: 'SBOM (SPDX 2.3) maintained per IEC 81001-5-1; submission with 510(k)', owner: 'Aditya Menon', status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 4, residualScore: 8, residualLevel: 'MEDIUM',
    owner: 'Aditya Menon', ownerId: 'u-md6', reviewDate: '2026-08-01', history: [],
    createdAt: '2026-04-04T09:00:00Z', updatedAt: '2026-04-04T09:00:00Z',
  },
  {
    id: 'md-r5', riskNumber: 'RSK-MD-2026-0017',
    title: 'Biocompatibility regression from coating supplier change',
    description: 'Coating-resin supplier consolidation may introduce undisclosed material changes affecting ISO 10993-5/-10/-11 results. Patient harm risk: cytotoxicity, sensitization, systemic toxicity. Recent NC-MD-2026-0039 confirmed sensitivity to this hazard.',
    category: 'QUALITY', department: 'Procurement',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc9',  hierarchy: 'ADMINISTRATIVE', description: 'Quality agreement clause: 90-day advance change notification',     owner: 'Neha Bansal',  status: 'IMPLEMENTED' },
      { id: 'md-rc10', hierarchy: 'ADMINISTRATIVE', description: 'Pre-shipment CoA review with biocompatibility-relevant fields',     owner: 'Sneha Kapoor', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Sneha Kapoor', ownerId: 'u-md5', reviewDate: '2026-07-15', history: [],
    createdAt: '2026-04-05T08:30:00Z', updatedAt: '2026-04-05T08:30:00Z',
  },
  {
    id: 'md-r6', riskNumber: 'RSK-MD-2026-0016',
    title: 'Particulate ingress during cleanroom Class 7 packaging — IOL contamination',
    description: 'HEPA filter degradation or pressure-cascade loss in Class 7 cleanrooms can result in particulate contamination of intraocular lenses (NC-MD-2026-0038 reference). Patient harm: post-operative endophthalmitis, vision impairment.',
    category: 'SAFETY', department: 'Cleanroom Assembly',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc11', hierarchy: 'ENGINEERING',    description: 'Quarterly HEPA integrity testing (PAO) per ISO 14644',           owner: 'Dr. Anjali Verma', status: 'IMPLEMENTED' },
      { id: 'md-rc12', hierarchy: 'ENGINEERING',    description: 'Continuous differential-pressure monitoring with audible alarm', owner: 'Rohit Khanna',     status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Dr. Anjali Verma', ownerId: 'u-md1', reviewDate: '2026-06-30', history: [],
    createdAt: '2026-04-06T09:00:00Z', updatedAt: '2026-04-06T09:00:00Z',
  },
  {
    id: 'md-r7', riskNumber: 'RSK-MD-2026-0015',
    title: 'PMS / vigilance reporting delay — EU MDR Article 87 non-compliance',
    description: 'Failure to report serious incidents within 15 days (10 days for serious public-health threats) under EU MDR Article 87 exposes the company to administrative fines and CE-mark suspension. Q3 2025 vigilance trend report missed PRRC sign-off (audit finding MD-F4).',
    category: 'OPERATIONAL', department: 'Post-Market Surveillance',
    likelihood: 2, consequence: 4, riskScore: 8, riskLevel: 'MEDIUM',
    controls: [
      { id: 'md-rc13', hierarchy: 'ENGINEERING',    description: 'Auto-escalation rule in vigilance tool: serious event → PRRC notification within 24h', owner: 'Aditya Menon', status: 'IMPLEMENTED' },
      { id: 'md-rc14', hierarchy: 'ADMINISTRATIVE', description: 'PRRC backup designated; monthly delegation review',                                       owner: 'Dr. Anjali Verma', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 4, residualScore: 4, residualLevel: 'LOW',
    owner: 'Dr. Anjali Verma', ownerId: 'u-md1', reviewDate: '2026-08-30', history: [],
    createdAt: '2026-04-07T10:00:00Z', updatedAt: '2026-04-07T10:00:00Z',
  },
  {
    id: 'md-r8', riskNumber: 'RSK-MD-2026-0014',
    title: 'Single-source supplier dependency for titanium alloy implants',
    description: 'Orthopaedic implants (titanium screws, plates) sourced from a single vendor with no qualified backup. Supply disruption risk could halt Class III production for 8-12 weeks.',
    category: 'OPERATIONAL', department: 'Procurement',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc15', hierarchy: 'ADMINISTRATIVE', description: 'Initiate qualification of secondary titanium alloy vendor (CRO Pune)', owner: 'Neha Bansal', status: 'PLANNED' },
      { id: 'md-rc16', hierarchy: 'ADMINISTRATIVE', description: '12-week safety stock buffer at FQ MedTech warehouse',                   owner: 'Karthik Iyer', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Neha Bansal', ownerId: 'u-md3', reviewDate: '2026-10-01', history: [],
    createdAt: '2026-04-08T11:00:00Z', updatedAt: '2026-04-08T11:00:00Z',
  },
  // ── Disposables product family ──────────────────────────────────────────
  {
    id: 'md-r9', riskNumber: 'RSK-MD-2026-0013',
    title: 'Needle-stick injury risk from non-safety hypodermic needles',
    description: 'Standard hypodermic needles (HYP series) without an integrated safety mechanism expose healthcare workers to needle-stick injuries during disposal. Risk regulated under the EU Sharps Directive 2010/32/EU and the US Needlestick Safety and Prevention Act.',
    category: 'SAFETY', department: 'Design Controls',
    likelihood: 4, consequence: 4, riskScore: 16, riskLevel: 'CRITICAL',
    controls: [
      { id: 'md-rc17', hierarchy: 'ENGINEERING',    description: 'Transition all hypodermic SKUs to integrated safety-shield design by 2027 Q1',     owner: 'Aditya Menon', status: 'PLANNED' },
      { id: 'md-rc18', hierarchy: 'ADMINISTRATIVE', description: 'IFU emphasises safe disposal in puncture-resistant sharps container',                owner: 'Sneha Kapoor', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 4, residualScore: 8, residualLevel: 'MEDIUM',
    owner: 'Aditya Menon', ownerId: 'u-md6', reviewDate: '2026-09-01', history: [],
    createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-10T09:00:00Z',
  },
  {
    id: 'md-r10', riskNumber: 'RSK-MD-2026-0012',
    title: 'Plunger leakage / loss of dose accuracy on Disposable Syringes',
    description: 'Silicone-oil over-lubrication or plunger-piston dimensional drift can cause leakage and inaccurate dose delivery on the DSY series. Particulate hazard already realised under NC-MD-2026-0037; further drift could lead to under- or over-delivery for vaccines and antibiotics.',
    category: 'QUALITY', department: 'Cleanroom Assembly',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc19', hierarchy: 'ENGINEERING',    description: 'Lock HMI recipe on plunger-spray station; QA-only override (CAPA-MD-2026-0021)', owner: 'Aditya Menon', status: 'IMPLEMENTED' },
      { id: 'md-rc20', hierarchy: 'ENGINEERING',    description: 'In-line dose-weight verification every 5 000th unit',                              owner: 'Rohit Khanna', status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Sneha Kapoor', ownerId: 'u-md5', reviewDate: '2026-08-01', history: [],
    createdAt: '2026-04-11T10:00:00Z', updatedAt: '2026-04-11T10:00:00Z',
  },
  {
    id: 'md-r11', riskNumber: 'RSK-MD-2026-0011',
    title: 'Latex allergic-reaction hazard on legacy IV cannula hub material',
    description: 'Legacy 20G IV cannula SKUs still use a natural-rubber-latex (NRL) backflow valve. Latex sensitivity affects ~1–6% of healthcare workers and ~17% of spina bifida patients; EU MDR and FDA expect a latex-free transition for new submissions.',
    category: 'SAFETY', department: 'Design Controls',
    likelihood: 2, consequence: 4, riskScore: 8, riskLevel: 'MEDIUM',
    controls: [
      { id: 'md-rc21', hierarchy: 'SUBSTITUTION',   description: 'Replace NRL backflow valve with thermoplastic elastomer (TPE) across all IVC SKUs', owner: 'Aditya Menon', status: 'PLANNED' },
      { id: 'md-rc22', hierarchy: 'ADMINISTRATIVE', description: 'IFU clearly labels NRL content per ISO 15223-1 symbol 5.4.5',                        owner: 'Sneha Kapoor', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 4, residualScore: 4, residualLevel: 'LOW',
    owner: 'Aditya Menon', ownerId: 'u-md6', reviewDate: '2026-11-01', history: [],
    createdAt: '2026-04-12T09:30:00Z', updatedAt: '2026-04-12T09:30:00Z',
  },
  {
    id: 'md-r12', riskNumber: 'RSK-MD-2026-0010',
    title: 'AD-syringe single-use lock bypass — counterfeit / re-use hazard',
    description: 'Auto-disable (AD) syringes for WHO immunization programs must lock after a single use (WHO PQS E13/IM01.3). Lock failure (see NC-MD-2026-0034) could enable re-use in low-resource settings and HIV/HBV cross-infection.',
    category: 'SAFETY', department: 'Cleanroom Assembly',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'md-rc23', hierarchy: 'ENGINEERING', description: '100% AD-function verification per WHO PQS E13/IM01.3 on every lot prior to release', owner: 'Karthik Iyer', status: 'IMPLEMENTED' },
      { id: 'md-rc24', hierarchy: 'ENGINEERING', description: 'Dimensional Cpk ≥ 1.67 monitoring on plunger lock-tab on Line ADS-2',                  owner: 'Rohit Khanna', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Karthik Iyer', ownerId: 'u-md2', reviewDate: '2026-07-15', history: [],
    createdAt: '2026-04-13T10:00:00Z', updatedAt: '2026-04-13T10:00:00Z',
  },
  {
    id: 'md-r13', riskNumber: 'RSK-MD-2026-0009',
    title: 'Foley catheter balloon over-inflation — bladder trauma',
    description: 'Dip-moulded silicone balloons on Foley catheters can over-inflate beyond the declared volume if wall thickness drifts during manufacture. Realised under NC-MD-2026-0033 / CMP-MD-2026-0016. Patient harm: bladder trauma, urethral injury.',
    category: 'SAFETY', department: 'Quality Control',
    likelihood: 2, consequence: 4, riskScore: 8, riskLevel: 'MEDIUM',
    controls: [
      { id: 'md-rc25', hierarchy: 'ENGINEERING',    description: 'Tighten dip-tank thermocouple calibration to 3-monthly across FCT-MC lines', owner: 'Rohit Khanna', status: 'PLANNED' },
      { id: 'md-rc26', hierarchy: 'ADMINISTRATIVE', description: '100% burst-volume sampling per ISO 20696 release plan',                        owner: 'Karthik Iyer', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 4, residualScore: 4, residualLevel: 'LOW',
    owner: 'Karthik Iyer', ownerId: 'u-md2', reviewDate: '2026-10-01', history: [],
    createdAt: '2026-04-14T09:30:00Z', updatedAt: '2026-04-14T09:30:00Z',
  },
];

// Dairy tenant — FSSAI / ISO 22000 / HACCP themed risk register.
export const mockDairyRisks: RiskRecord[] = [
  {
    id: 'dy-r1', riskNumber: 'RSK-DY-2026-0012',
    title: 'Aflatoxin M1 in raw milk above FSSAI limit — monsoon spike',
    description: 'Indian monsoon humidity (Jun–Sep) accelerates fungal growth on cottonseed cake and groundnut cake at village storage. Resultant Aflatoxin M1 carry-over in milk poses chronic carcinogen risk for consumers and FSSAI non-compliance.',
    category: 'SAFETY', department: 'Procurement',
    likelihood: 4, consequence: 5, riskScore: 20, riskLevel: 'CRITICAL',
    controls: [
      { id: 'dy-rc1', hierarchy: 'ADMINISTRATIVE', description: 'Pre-monsoon enhanced AfM1 sampling (twice-weekly Apr–Sep) per CAPA-DY-2026-0019', owner: 'Anita Kulkarni', status: 'IMPLEMENTED' },
      { id: 'dy-rc2', hierarchy: 'ADMINISTRATIVE', description: 'Mandatory dry-feed storage protocols at all 18 village collection centres',         owner: 'Meera Pillai',  status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 5, residualScore: 10, residualLevel: 'HIGH',
    owner: 'Meera Pillai', ownerId: 'u-dy2', reviewDate: '2026-08-15', history: [],
    createdAt: '2026-05-16T09:00:00Z', updatedAt: '2026-05-16T09:00:00Z',
  },
  {
    id: 'dy-r2', riskNumber: 'RSK-DY-2026-0011',
    title: 'Antibiotic residue carry-over into pooled milk',
    description: 'Sick cattle under antibiotic treatment milked before withdrawal period results in residues (beta-lactam, tetracycline, sulfonamide) in pooled raw milk. Regulatory red flag under FSSAI 2.3.4; risk of supplier de-listing and brand damage.',
    category: 'SAFETY', department: 'Procurement',
    likelihood: 3, consequence: 5, riskScore: 15, riskLevel: 'CRITICAL',
    controls: [
      { id: 'dy-rc3', hierarchy: 'ENGINEERING',    description: 'Charm SL beta-lactam dipstick at all 18 village collection centres', owner: 'Sandeep Joshi', status: 'IMPLEMENTED' },
      { id: 'dy-rc4', hierarchy: 'ADMINISTRATIVE', description: 'Farmer training on antibiotic withdrawal — 240 farmers per CAPA-DY-2026-0017', owner: 'Priya Khanna', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Meera Pillai', ownerId: 'u-dy2', reviewDate: '2026-08-30', history: [],
    createdAt: '2026-05-12T10:00:00Z', updatedAt: '2026-05-12T10:00:00Z',
  },
  {
    id: 'dy-r3', riskNumber: 'RSK-DY-2026-0010',
    title: 'Cold-chain temperature excursion in distribution fleet',
    description: 'Refrigerated tanker / van breakdowns or traffic stops can lead to ≥4 °C cargo-area temperature for >30 min, accelerating microbial growth in pasteurized milk / curd / paneer. Consumer-safety hazard; FSSAI 2.1.1 non-conformance.',
    category: 'QUALITY', department: 'Cold Chain',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'dy-rc5', hierarchy: 'ENGINEERING',    description: 'IoT temperature loggers with GSM alert on all 14 refrigerated vans',  owner: 'Priya Khanna', status: 'IMPLEMENTED' },
      { id: 'dy-rc6', hierarchy: 'ADMINISTRATIVE', description: 'PM frequency on van refrigeration units tightened to 3-monthly',       owner: 'Priya Khanna', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Priya Khanna', ownerId: 'u-dy5', reviewDate: '2026-09-01', history: [],
    createdAt: '2026-05-08T09:00:00Z', updatedAt: '2026-05-08T09:00:00Z',
  },
  {
    id: 'dy-r4', riskNumber: 'RSK-DY-2026-0009',
    title: 'Post-pasteurization recontamination at filling lines',
    description: 'Biofilm build-up on filling-machine product-contact surfaces leads to microbial recontamination (TPC, coliform, Pseudomonas) after thermal kill. Recurrence already observed under NC-DY-2026-0041.',
    category: 'QUALITY', department: 'Pasteurization',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'dy-rc7', hierarchy: 'ENGINEERING',    description: 'Lock CIP recipe on HMI — QA-only password override (CAPA-DY-2026-0018)', owner: 'Sandeep Joshi', status: 'IMPLEMENTED' },
      { id: 'dy-rc8', hierarchy: 'ADMINISTRATIVE', description: 'Pre-shift ATP-swab verification at all 4 filler heads',                    owner: 'Anita Kulkarni', status: 'PLANNED' },
    ],
    residualLikelihood: 1, residualConsequence: 4, residualScore: 4, residualLevel: 'LOW',
    owner: 'Anita Kulkarni', ownerId: 'u-dy3', reviewDate: '2026-08-15', history: [],
    createdAt: '2026-05-14T10:00:00Z', updatedAt: '2026-05-14T10:00:00Z',
  },
  {
    id: 'dy-r5', riskNumber: 'RSK-DY-2026-0008',
    title: 'Adulteration of raw milk at village collection (water, urea, detergent)',
    description: 'Economic adulteration with water, urea, detergent or maltodextrin to inflate volume / SNF is a known industry risk in pooled raw-milk supply chains. Consumer-safety hazard; FSSAI 2.3.1 violation.',
    category: 'QUALITY', department: 'Receiving Dock',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'dy-rc9',  hierarchy: 'ENGINEERING',    description: 'Lactoscan auto-analyser at receiving dock — Freezing Point Depression flag', owner: 'Sandeep Joshi', status: 'IMPLEMENTED' },
      { id: 'dy-rc10', hierarchy: 'ADMINISTRATIVE', description: 'Random urea / detergent dipstick tests on 1 in 10 tankers, daily',           owner: 'Anita Kulkarni', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Sandeep Joshi', ownerId: 'u-dy1', reviewDate: '2026-09-01', history: [],
    createdAt: '2026-05-06T09:30:00Z', updatedAt: '2026-05-06T09:30:00Z',
  },
  {
    id: 'dy-r6', riskNumber: 'RSK-DY-2026-0007',
    title: 'Foreign matter contamination in pouches / cups',
    description: 'Plant debris, plastic shards from packaging film slitter or filler-head wear can contaminate finished product. Consumer-safety hazard plus brand damage.',
    category: 'QUALITY', department: 'Packaging',
    likelihood: 2, consequence: 4, riskScore: 8, riskLevel: 'MEDIUM',
    controls: [
      { id: 'dy-rc11', hierarchy: 'ENGINEERING',    description: 'In-line metal detector + X-ray inspection on every FFS line',  owner: 'Priya Khanna', status: 'IMPLEMENTED' },
      { id: 'dy-rc12', hierarchy: 'ENGINEERING',    description: 'Magnetic strainers in pre-filler product loop',                  owner: 'Ravi Deshmukh', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 4, residualScore: 4, residualLevel: 'LOW',
    owner: 'Priya Khanna', ownerId: 'u-dy5', reviewDate: '2026-10-01', history: [],
    createdAt: '2026-05-04T10:00:00Z', updatedAt: '2026-05-04T10:00:00Z',
  },
  {
    id: 'dy-r7', riskNumber: 'RSK-DY-2026-0006',
    title: 'Allergen cross-contact between milk-based and nut-based dairy sweets',
    description: 'Shared kettles and packaging line between plain peda and badam peda creates potential undeclared tree-nut allergen exposure for plain-peda consumers. FSSAI labelling violation + ISO 22000 §8.5.2 risk.',
    category: 'SAFETY', department: 'Production',
    likelihood: 2, consequence: 4, riskScore: 8, riskLevel: 'MEDIUM',
    controls: [
      { id: 'dy-rc13', hierarchy: 'SUBSTITUTION', description: 'Dedicated kettle DK-04 for nut-based products; full CIP between SKUs', owner: 'Ravi Deshmukh', status: 'IMPLEMENTED' },
      { id: 'dy-rc14', hierarchy: 'ADMINISTRATIVE', description: 'Allergen-cleaning verification record + visual line clearance per SOP', owner: 'Priya Khanna', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 4, residualScore: 4, residualLevel: 'LOW',
    owner: 'Ravi Deshmukh', ownerId: 'u-dy4', reviewDate: '2026-09-15', history: [],
    createdAt: '2026-05-09T09:30:00Z', updatedAt: '2026-05-09T09:30:00Z',
  },
  {
    id: 'dy-r8', riskNumber: 'RSK-DY-2026-0005',
    title: 'Best-before / MRP label print errors',
    description: 'Operator entry error or date-setting drift on FFS lines can cause incorrect best-before / MRP on retail pouches. FSSAI labelling non-compliance; consumer-safety hazard for stale-stock risk.',
    category: 'OPERATIONAL', department: 'Packaging',
    likelihood: 3, consequence: 3, riskScore: 9, riskLevel: 'MEDIUM',
    controls: [
      { id: 'dy-rc15', hierarchy: 'ENGINEERING',    description: 'Vision-system best-before / MRP verification at end-of-line with auto-reject', owner: 'Sandeep Joshi', status: 'PLANNED' },
      { id: 'dy-rc16', hierarchy: 'ADMINISTRATIVE', description: 'Two-person sign-off on date-change at FFS-02 / 03 / 04 every shift',           owner: 'Priya Khanna', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Priya Khanna', ownerId: 'u-dy5', reviewDate: '2026-09-30', history: [],
    createdAt: '2026-05-11T11:00:00Z', updatedAt: '2026-05-11T11:00:00Z',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE).
// ICH Q9 quality-risk-management themed register: aseptic/sterility assurance,
// bioreactor & viral/microbial safety, downstream clearance, cold-chain, CCI.
export const mockBiologicsRisks: RiskRecord[] = [
  {
    id: 'bio-r1', riskNumber: 'RISK-BIO-2026-0012',
    title: 'Aseptic process contamination — sterility assurance failure on cartridge fill-finish',
    description: 'Loss of aseptic conditions on the cartridge fill-finish line (insulin / analogue / GLP-1 cartridges) can compromise sterility assurance and result in non-sterile parenteral product reaching patients. Grade A/B environmental excursions and operator interventions are the primary contamination routes under ICH Q9 / Annex 1.',
    category: 'SAFETY', department: 'Aseptic Fill-Finish',
    likelihood: 3, consequence: 5, riskScore: 15, riskLevel: 'CRITICAL',
    controls: [
      { id: 'bio-rc1', hierarchy: 'ENGINEERING',    description: 'Restricted Access Barrier System (RABS) with first-air protection over Grade A fill zone', owner: 'Dr. Layla Al-Mansoori', status: 'IMPLEMENTED' },
      { id: 'bio-rc2', hierarchy: 'ADMINISTRATIVE', description: 'Continuous viable/non-viable environmental monitoring with shift-level trend review',         owner: 'Fatima Al-Hashimi',    status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1', reviewDate: '2026-07-01', history: [],
    createdAt: '2026-04-01T09:00:00Z', updatedAt: '2026-04-01T09:00:00Z',
  },
  {
    id: 'bio-r2', riskNumber: 'RISK-BIO-2026-0011',
    title: 'Media fill (aseptic process simulation) failure — line qualification loss',
    description: 'A failed media fill on the cartridge filling line invalidates the aseptic process simulation, halting commercial release until requalification. Root causes include operator technique drift, gowning breaches and inadequate intervention design under Annex 1 / USP <1116>.',
    category: 'QUALITY', department: 'Aseptic Fill-Finish',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc3', hierarchy: 'ADMINISTRATIVE', description: 'Semi-annual media fill per operator with worst-case intervention matrix and full incubation read', owner: 'Fatima Al-Hashimi',    status: 'IMPLEMENTED' },
      { id: 'bio-rc4', hierarchy: 'ADMINISTRATIVE', description: 'Annual aseptic gowning re-qualification and aseptic technique re-training programme',              owner: 'Dr. Layla Al-Mansoori', status: 'PLANNED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3', reviewDate: '2026-06-15', history: [],
    createdAt: '2026-04-02T10:00:00Z', updatedAt: '2026-04-02T10:00:00Z',
  },
  {
    id: 'bio-r3', riskNumber: 'RISK-BIO-2026-0010',
    title: 'Bioreactor contamination on 10,000 L production fermentation',
    description: 'Microbial or phage contamination of the 10,000 L drug-substance fermentation results in loss of an entire production batch and potential facility-wide cross-contamination. Failure modes include compromised sterile filtration on inlet gas, seal failures and feed-line breaches.',
    category: 'OPERATIONAL', department: 'Drug Substance',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc5', hierarchy: 'ENGINEERING',    description: 'Redundant sterilising-grade gas inlet filters with integrity test pre/post each batch', owner: 'Omar Al-Farsi',  status: 'IMPLEMENTED' },
      { id: 'bio-rc6', hierarchy: 'ENGINEERING',    description: 'Automated SIP cycle verification with thermocouple mapping and F0 logging on SCADA',     owner: 'Khalid Nasser',  status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Omar Al-Farsi', ownerId: 'u-bio2', reviewDate: '2026-07-01', history: [],
    createdAt: '2026-04-03T11:00:00Z', updatedAt: '2026-04-03T11:00:00Z',
  },
  {
    id: 'bio-r4', riskNumber: 'RISK-BIO-2026-0009',
    title: 'Inadequate host cell protein / residual DNA clearance in downstream purification',
    description: 'Insufficient clearance of host cell proteins (HCP) and residual host-cell DNA through the chromatography train can lead to immunogenicity and patient harm. Process-validated clearance margins must hold across resin lifetime and load variability.',
    category: 'SAFETY', department: 'Downstream Purification',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc7', hierarchy: 'ENGINEERING',    description: 'Validated 3-column polishing train with orthogonal HCP/DNA clearance and in-process limits', owner: 'Khalid Nasser', status: 'IMPLEMENTED' },
      { id: 'bio-rc8', hierarchy: 'ADMINISTRATIVE', description: 'Per-batch HCP ELISA and qPCR residual-DNA release testing against validated acceptance limits', owner: 'Fatima Al-Hashimi', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Khalid Nasser', ownerId: 'u-bio4', reviewDate: '2026-08-01', history: [],
    createdAt: '2026-04-04T09:00:00Z', updatedAt: '2026-04-04T09:00:00Z',
  },
  {
    id: 'bio-r5', riskNumber: 'RISK-BIO-2026-0008',
    title: 'Viral / adventitious agent safety breach in cell-culture process',
    description: 'Introduction of an adventitious viral agent via raw materials or cell bank, combined with insufficient viral clearance capacity, presents a serious patient-safety hazard for the biologic drug substance per ICH Q5A.',
    category: 'SAFETY', department: 'Drug Substance',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc9',  hierarchy: 'ENGINEERING',    description: 'Dedicated low-pH viral inactivation step plus 20 nm nanofiltration with validated LRV',     owner: 'Khalid Nasser',     status: 'IMPLEMENTED' },
      { id: 'bio-rc10', hierarchy: 'ADMINISTRATIVE', description: 'Adventitious-agent testing of master/working cell banks and bulk harvest per ICH Q5A',       owner: 'Dr. Sami Haddad',   status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Dr. Sami Haddad', ownerId: 'u-bio5', reviewDate: '2026-07-15', history: [],
    createdAt: '2026-04-05T08:30:00Z', updatedAt: '2026-04-05T08:30:00Z',
  },
  {
    id: 'bio-r6', riskNumber: 'RISK-BIO-2026-0007',
    title: 'Protein aggregation and loss of stability in insulin / GLP-1 drug product',
    description: 'Thermal, mechanical or interfacial stress during fill-finish and storage can drive protein aggregation in insulin analogues and GLP-1 products, reducing potency and increasing immunogenicity risk. Stability must be maintained across declared shelf life.',
    category: 'QUALITY', department: 'Aseptic Fill-Finish',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc11', hierarchy: 'ENGINEERING',    description: 'Low-shear filling pumps and validated formulation surfactant to suppress interfacial aggregation', owner: 'Dr. Layla Al-Mansoori', status: 'IMPLEMENTED' },
      { id: 'bio-rc12', hierarchy: 'ADMINISTRATIVE', description: 'ICH Q1A stability programme with SEC-HPLC aggregate monitoring at each station',                   owner: 'Dr. Sami Haddad',      status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Dr. Sami Haddad', ownerId: 'u-bio5', reviewDate: '2026-08-15', history: [],
    createdAt: '2026-04-06T09:00:00Z', updatedAt: '2026-04-06T09:00:00Z',
  },
  {
    id: 'bio-r7', riskNumber: 'RISK-BIO-2026-0006',
    title: 'Cold-chain 2–8 °C excursion during distribution of finished cartridges',
    description: 'Temperature excursions outside the validated 2–8 °C range during storage and distribution can degrade insulin and GLP-1 cartridges, causing loss of potency. Excursions risk product recall and patient under-dosing.',
    category: 'QUALITY', department: 'QA',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc13', hierarchy: 'ENGINEERING',    description: 'Validated qualified shippers with continuous GPS temperature dataloggers per shipment',  owner: 'Khalid Nasser',     status: 'IMPLEMENTED' },
      { id: 'bio-rc14', hierarchy: 'ADMINISTRATIVE', description: 'Excursion-management SOP with stability-budget assessment and quarantine on breach',     owner: 'Fatima Al-Hashimi', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3', reviewDate: '2026-09-01', history: [],
    createdAt: '2026-04-07T10:00:00Z', updatedAt: '2026-04-07T10:00:00Z',
  },
  {
    id: 'bio-r8', riskNumber: 'RISK-BIO-2026-0005',
    title: 'Container-closure integrity failure on insulin cartridges',
    description: 'Loss of container-closure integrity (CCI) on glass cartridges — via crimp-seal defects or plunger seating drift — compromises sterility over shelf life and risks microbial ingress into the parenteral product.',
    category: 'SAFETY', department: 'Aseptic Fill-Finish',
    likelihood: 2, consequence: 5, riskScore: 10, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc15', hierarchy: 'ENGINEERING',    description: '100% in-line headspace-gas CCI inspection (laser-based) with auto-reject on every cartridge', owner: 'Dr. Layla Al-Mansoori', status: 'IMPLEMENTED' },
      { id: 'bio-rc16', hierarchy: 'ADMINISTRATIVE', description: 'Periodic dye-ingress / helium-leak CCI study per USP <1207> on each cartridge format',          owner: 'Fatima Al-Hashimi',    status: 'PLANNED' },
    ],
    residualLikelihood: 1, residualConsequence: 5, residualScore: 5, residualLevel: 'MEDIUM',
    owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1', reviewDate: '2026-07-30', history: [],
    createdAt: '2026-04-08T11:00:00Z', updatedAt: '2026-04-08T11:00:00Z',
  },
  {
    id: 'bio-r9', riskNumber: 'RISK-BIO-2026-0004',
    title: 'Cross-contamination between analogue campaigns on shared fill line',
    description: 'Carry-over between insulin analogue and GLP-1 campaigns on shared filling equipment can introduce cross-product contamination, a patient-safety and identity hazard. Cleaning validation and changeover controls are critical under ICH Q9.',
    category: 'QUALITY', department: 'Aseptic Fill-Finish',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc17', hierarchy: 'ENGINEERING',    description: 'Single-use product-contact flow path replaced at each campaign changeover',           owner: 'Omar Al-Farsi',     status: 'IMPLEMENTED' },
      { id: 'bio-rc18', hierarchy: 'ADMINISTRATIVE', description: 'Validated cleaning with swab/rinse TOC and product-specific residue limits on changeover', owner: 'Fatima Al-Hashimi', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Omar Al-Farsi', ownerId: 'u-bio2', reviewDate: '2026-08-01', history: [],
    createdAt: '2026-04-09T09:30:00Z', updatedAt: '2026-04-09T09:30:00Z',
  },
  {
    id: 'bio-r10', riskNumber: 'RISK-BIO-2026-0003',
    title: 'Single-use system integrity failure in upstream / downstream operations',
    description: 'Pinhole leaks or weld failures in single-use bioprocess bags and assemblies can breach sterile boundaries, causing batch loss and contamination. Risk is elevated by handling damage and supplier weld-quality variability.',
    category: 'OPERATIONAL', department: 'Validation',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc19', hierarchy: 'ENGINEERING',    description: 'Pre-use post-sterilisation integrity testing (PUPSIT) on single-use sterilising filters', owner: 'Khalid Nasser', status: 'IMPLEMENTED' },
      { id: 'bio-rc20', hierarchy: 'ADMINISTRATIVE', description: 'Incoming AQL inspection and supplier weld-integrity qualification for single-use assemblies', owner: 'Omar Al-Farsi',  status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Khalid Nasser', ownerId: 'u-bio4', reviewDate: '2026-09-15', history: [],
    createdAt: '2026-04-10T10:00:00Z', updatedAt: '2026-04-10T10:00:00Z',
  },
  {
    id: 'bio-r11', riskNumber: 'RISK-BIO-2026-0002',
    title: 'Chromatography resin lifetime exceedance — carryover and capacity loss',
    description: 'Use of chromatography resin beyond validated lifetime risks reduced binding capacity, impurity breakthrough and product carryover between cycles. Resin-reuse must be controlled against the validated cycle limit in downstream purification.',
    category: 'QUALITY', department: 'Downstream Purification',
    likelihood: 3, consequence: 3, riskScore: 9, riskLevel: 'MEDIUM',
    controls: [
      { id: 'bio-rc21', hierarchy: 'ENGINEERING',    description: 'Automated cycle-count interlock on chromatography skid blocking loads beyond validated lifetime', owner: 'Khalid Nasser',   status: 'IMPLEMENTED' },
      { id: 'bio-rc22', hierarchy: 'ADMINISTRATIVE', description: 'Periodic small-scale resin-lifetime study with HCP/impurity breakthrough monitoring',             owner: 'Dr. Sami Haddad', status: 'PLANNED' },
    ],
    residualLikelihood: 2, residualConsequence: 2, residualScore: 4, residualLevel: 'LOW',
    owner: 'Khalid Nasser', ownerId: 'u-bio4', reviewDate: '2026-10-01', history: [],
    createdAt: '2026-04-11T11:00:00Z', updatedAt: '2026-04-11T11:00:00Z',
  },
  {
    id: 'bio-r12', riskNumber: 'RISK-BIO-2026-0001',
    title: 'Single-source dependency for culture media and chromatography resin',
    description: 'Critical cell-culture media and Protein-A chromatography resin are sourced from single suppliers with no qualified alternate. A supply disruption could halt 10,000 L drug-substance production for multiple campaigns, impacting insulin supply continuity.',
    category: 'OPERATIONAL', department: 'Drug Substance',
    likelihood: 3, consequence: 4, riskScore: 12, riskLevel: 'HIGH',
    controls: [
      { id: 'bio-rc23', hierarchy: 'ADMINISTRATIVE', description: 'Qualify secondary media and Protein-A resin supplier with comparability protocol', owner: 'Omar Al-Farsi',  status: 'PLANNED' },
      { id: 'bio-rc24', hierarchy: 'ADMINISTRATIVE', description: 'Maintain 6-month strategic safety stock of media and resin at controlled storage', owner: 'Khalid Nasser', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2, residualConsequence: 3, residualScore: 6, residualLevel: 'MEDIUM',
    owner: 'Omar Al-Farsi', ownerId: 'u-bio2', reviewDate: '2026-11-01', history: [],
    createdAt: '2026-04-12T09:00:00Z', updatedAt: '2026-04-12T09:00:00Z',
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
  const industry = useUserIndustry();
  return useQuery<PaginatedResponse<RiskRecord>>({
    queryKey: ['risks', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/risks', { params: filters });
        return unwrapList<RiskRecord>(data, flattenRisk as any);
      } catch {
        const baseList = pickByIndustry(industry, mockRisks, { medical_device: mockMedicalDeviceRisks, dairy: mockDairyRisks, biologics: mockBiologicsRisks });
        let filtered = [...baseList];
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
  const industry = useUserIndustry();
  return useQuery<RiskRecord>({
    queryKey: ['risks', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/risks/${id}`);
        return unwrapItem<RiskRecord>(data, flattenRisk as any);
      } catch {
        const baseList = pickByIndustry(industry, mockRisks, { medical_device: mockMedicalDeviceRisks, dairy: mockDairyRisks, biologics: mockBiologicsRisks });
        const risk = baseList.find((r) => r.id === id);
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
