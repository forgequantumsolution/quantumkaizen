import { useMemo } from 'react';
import type { AuditLogEntry } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRIES
// ─────────────────────────────────────────────────────────────────────────────
export type IndustryKey = 'pharma' | 'food' | 'chemical' | 'automotive' | 'vehicle' | 'machinery';

export const INDUSTRIES: { key: IndustryKey; label: string; plant: string; city: string; products: string; color: string }[] = [
  { key: 'pharma',     label: 'Pharma & Life Sciences', plant: 'FQS Pharma Pvt. Ltd.',         city: 'Pune',          products: 'Solid Oral Dosage',         color: '#0a1628' },
  { key: 'food',       label: 'Food & Beverage',        plant: 'FQS FoodTech Pvt. Ltd.',        city: 'Hyderabad',     products: 'Packaged Snacks & Beverages', color: '#10b981' },
  { key: 'chemical',   label: 'Chemical Manufacturing', plant: 'FQS ChemWorks Pvt. Ltd.',       city: 'Dahej, Gujarat', products: 'Specialty Chemicals',        color: '#f59e0b' },
  { key: 'automotive', label: 'Automotive Components',  plant: 'FQS AutoParts Pvt. Ltd.',       city: 'Chakan, Pune',  products: 'Machined Components',        color: '#0ea5e9' },
  { key: 'vehicle',    label: 'Vehicle Assembly',        plant: 'FQS VehicleWorks Pvt. Ltd.',    city: 'Chennai',       products: 'LCV Assembly',               color: '#8b5cf6' },
  { key: 'machinery',  label: 'Heavy Machinery',         plant: 'FQS HeavyTech Pvt. Ltd.',       city: 'Coimbatore',    products: 'Hydraulic Presses',          color: '#ef4444' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 36-MONTH NC DATA  Jan 2022 → Dec 2024
// Labels: Q1-22 … Q4-24 for quarterly view, month names for monthly
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS_36 = [
  'Jan-22','Feb-22','Mar-22','Apr-22','May-22','Jun-22',
  'Jul-22','Aug-22','Sep-22','Oct-22','Nov-22','Dec-22',
  'Jan-23','Feb-23','Mar-23','Apr-23','May-23','Jun-23',
  'Jul-23','Aug-23','Sep-23','Oct-23','Nov-23','Dec-23',
  'Jan-24','Feb-24','Mar-24','Apr-24','May-24','Jun-24',
  'Jul-24','Aug-24','Sep-24','Oct-24','Nov-24','Dec-24',
];

// Monthly NC counts per industry (36 values)
const NC_COUNT: Record<IndustryKey, number[]> = {
  // Pharma: high 2022 (FDA inspection aftermath), steady improvement
  pharma:     [24,22,20,19,21,18,17,16,18,15,16,13, 14,13,12,13,11,12,10,11,9,10,12,9, 9,8,7,9,7,8,9,7,8,6,7,8],
  // Food: seasonal spikes (summer allergen risk, monsoon contamination)
  food:       [8,7,9,11,14,16,13,10,12,9,8,7,  9,8,10,12,15,17,14,11,10,8,7,8,  7,6,8,10,13,15,11,9,8,7,6,7],
  // Chemical: PSM-related incidents high in 2022, MOC implementation fixes issues
  chemical:   [19,17,20,16,18,15,17,14,16,13,15,12, 13,11,10,12,9,10,8,9,8,7,9,7, 7,6,6,7,5,6,5,6,4,5,6,5],
  // Automotive: PPAP/warranty-driven, supplier-related peaks
  automotive: [13,12,15,11,13,10,12,9,11,10,12,9, 10,9,11,8,10,7,9,8,10,7,9,8, 8,7,9,6,8,6,8,7,9,6,7,8],
  // Vehicle Assembly: volume-driven, improves after 5S rollout mid-2023
  vehicle:    [16,15,18,14,16,13,15,12,14,13,15,11, 12,11,13,10,12,9,11,10,12,9,11,10, 9,8,10,7,9,7,9,8,10,7,8,9],
  // Heavy Machinery: CE/welding quality, improves with NDT investment in 2023
  machinery:  [11,10,12,9,11,8,10,8,9,8,10,7, 8,7,9,6,8,6,8,6,7,6,8,6, 5,5,6,4,6,4,5,4,5,4,5,6],
};

// Severity split per industry (Critical%, Major%, Minor% — rest is Minor)
const SEV_SPLIT: Record<IndustryKey, { crit: number; major: number }> = {
  pharma:     { crit: 0.18, major: 0.47 },
  food:       { crit: 0.14, major: 0.42 },
  chemical:   { crit: 0.22, major: 0.51 },
  automotive: { crit: 0.10, major: 0.45 },
  vehicle:    { crit: 0.08, major: 0.44 },
  machinery:  { crit: 0.12, major: 0.48 },
};

function buildNCSeverity(industry: IndustryKey, indices: number[]) {
  const counts = NC_COUNT[industry];
  const { crit, major } = SEV_SPLIT[industry];
  return indices.map((i) => ({
    month: MONTHS_36[i],
    Critical: Math.max(0, Math.round(counts[i] * crit)),
    Major:    Math.max(0, Math.round(counts[i] * major)),
    Minor:    Math.max(0, Math.round(counts[i] * (1 - crit - major))),
  }));
}

function buildNCTrend(industry: IndustryKey, indices: number[]) {
  const counts = NC_COUNT[industry];
  return indices.map((i) => ({ month: MONTHS_36[i], count: counts[i] }));
}

// Quarterly aggregation for 3Y view (12 quarters)
const QUARTERS_12 = ['Q1-22','Q2-22','Q3-22','Q4-22','Q1-23','Q2-23','Q3-23','Q4-23','Q1-24','Q2-24','Q3-24','Q4-24'];
function buildNC3Y(industry: IndustryKey) {
  const counts = NC_COUNT[industry];
  return QUARTERS_12.map((q, qi) => {
    const base = qi * 3;
    const total = counts[base] + counts[base + 1] + counts[base + 2];
    const { crit, major } = SEV_SPLIT[industry];
    return {
      month: q,
      count:    total,
      Critical: Math.round(total * crit),
      Major:    Math.round(total * major),
      Minor:    Math.round(total * (1 - crit - major)),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINT TREND  (monthly, 36 months)
// ─────────────────────────────────────────────────────────────────────────────
const COMPLAINT_DATA: Record<IndustryKey, { received: number; resolved: number }[]> = {
  pharma:     [
    {received:8,resolved:6},{received:7,resolved:7},{received:9,resolved:7},{received:8,resolved:8},{received:10,resolved:8},{received:7,resolved:9},
    {received:9,resolved:8},{received:6,resolved:8},{received:8,resolved:7},{received:7,resolved:8},{received:9,resolved:8},{received:6,resolved:8},
    {received:7,resolved:7},{received:6,resolved:7},{received:8,resolved:7},{received:7,resolved:8},{received:9,resolved:8},{received:7,resolved:9},
    {received:8,resolved:8},{received:6,resolved:8},{received:7,resolved:7},{received:6,resolved:7},{received:8,resolved:8},{received:5,resolved:7},
    {received:6,resolved:6},{received:5,resolved:6},{received:7,resolved:6},{received:6,resolved:7},{received:8,resolved:7},{received:6,resolved:8},
    {received:7,resolved:7},{received:5,resolved:7},{received:6,resolved:6},{received:5,resolved:6},{received:7,resolved:7},{received:5,resolved:6},
  ],
  food:       [
    {received:5,resolved:4},{received:4,resolved:4},{received:6,resolved:5},{received:8,resolved:6},{received:11,resolved:8},{received:13,resolved:10},
    {received:10,resolved:10},{received:7,resolved:9},{received:9,resolved:8},{received:6,resolved:8},{received:5,resolved:6},{received:4,resolved:5},
    {received:6,resolved:5},{received:5,resolved:6},{received:7,resolved:6},{received:9,resolved:7},{received:12,resolved:10},{received:14,resolved:11},
    {received:11,resolved:12},{received:8,resolved:10},{received:8,resolved:8},{received:6,resolved:7},{received:5,resolved:6},{received:5,resolved:5},
    {received:5,resolved:5},{received:4,resolved:5},{received:6,resolved:5},{received:8,resolved:7},{received:11,resolved:9},{received:13,resolved:11},
    {received:10,resolved:11},{received:7,resolved:10},{received:7,resolved:8},{received:5,resolved:7},{received:4,resolved:5},{received:4,resolved:4},
  ],
  chemical:   [
    {received:4,resolved:3},{received:5,resolved:4},{received:6,resolved:5},{received:4,resolved:5},{received:5,resolved:4},{received:4,resolved:5},
    {received:5,resolved:4},{received:4,resolved:5},{received:5,resolved:4},{received:3,resolved:4},{received:4,resolved:4},{received:3,resolved:4},
    {received:4,resolved:4},{received:3,resolved:4},{received:4,resolved:4},{received:3,resolved:4},{received:4,resolved:3},{received:3,resolved:4},
    {received:3,resolved:3},{received:3,resolved:3},{received:3,resolved:3},{received:2,resolved:3},{received:3,resolved:3},{received:2,resolved:3},
    {received:3,resolved:3},{received:2,resolved:3},{received:3,resolved:3},{received:2,resolved:3},{received:3,resolved:2},{received:2,resolved:3},
    {received:2,resolved:2},{received:2,resolved:2},{received:2,resolved:2},{received:2,resolved:2},{received:3,resolved:2},{received:2,resolved:2},
  ],
  automotive: [
    {received:9,resolved:7},{received:8,resolved:8},{received:11,resolved:9},{received:7,resolved:9},{received:9,resolved:8},{received:7,resolved:8},
    {received:8,resolved:8},{received:6,resolved:8},{received:8,resolved:7},{received:7,resolved:7},{received:9,resolved:8},{received:6,resolved:8},
    {received:7,resolved:7},{received:6,resolved:7},{received:8,resolved:7},{received:5,resolved:7},{received:7,resolved:6},{received:5,resolved:6},
    {received:6,resolved:6},{received:5,resolved:6},{received:7,resolved:6},{received:5,resolved:6},{received:6,resolved:6},{received:5,resolved:6},
    {received:5,resolved:5},{received:4,resolved:5},{received:6,resolved:5},{received:4,resolved:5},{received:6,resolved:5},{received:4,resolved:6},
    {received:5,resolved:5},{received:4,resolved:5},{received:6,resolved:5},{received:4,resolved:5},{received:5,resolved:5},{received:4,resolved:5},
  ],
  vehicle:    [
    {received:7,resolved:5},{received:6,resolved:6},{received:8,resolved:6},{received:6,resolved:7},{received:8,resolved:7},{received:6,resolved:7},
    {received:7,resolved:7},{received:5,resolved:7},{received:7,resolved:6},{received:6,resolved:6},{received:7,resolved:7},{received:5,resolved:6},
    {received:6,resolved:6},{received:5,resolved:6},{received:7,resolved:6},{received:5,resolved:6},{received:6,resolved:5},{received:5,resolved:6},
    {received:6,resolved:5},{received:4,resolved:5},{received:5,resolved:5},{received:4,resolved:5},{received:6,resolved:5},{received:4,resolved:5},
    {received:4,resolved:4},{received:4,resolved:4},{received:5,resolved:4},{received:3,resolved:4},{received:5,resolved:4},{received:3,resolved:5},
    {received:4,resolved:4},{received:3,resolved:4},{received:5,resolved:4},{received:3,resolved:4},{received:4,resolved:4},{received:3,resolved:4},
  ],
  machinery:  [
    {received:3,resolved:2},{received:3,resolved:3},{received:4,resolved:3},{received:3,resolved:3},{received:4,resolved:3},{received:3,resolved:4},
    {received:4,resolved:3},{received:3,resolved:4},{received:3,resolved:3},{received:2,resolved:3},{received:3,resolved:3},{received:2,resolved:3},
    {received:3,resolved:3},{received:2,resolved:3},{received:3,resolved:2},{received:2,resolved:3},{received:3,resolved:2},{received:2,resolved:3},
    {received:2,resolved:2},{received:2,resolved:2},{received:2,resolved:2},{received:2,resolved:2},{received:2,resolved:2},{received:2,resolved:2},
    {received:2,resolved:2},{received:1,resolved:2},{received:2,resolved:2},{received:1,resolved:2},{received:2,resolved:1},{received:1,resolved:2},
    {received:2,resolved:2},{received:1,resolved:2},{received:2,resolved:2},{received:1,resolved:2},{received:2,resolved:2},{received:1,resolved:2},
  ],
};

function buildComplaint(industry: IndustryKey, indices: number[]) {
  return indices.map((i) => ({
    month:    MONTHS_36[i],
    received: COMPLAINT_DATA[industry][i].received,
    resolved: COMPLAINT_DATA[industry][i].resolved,
    pending:  Math.max(0, COMPLAINT_DATA[industry][i].received - COMPLAINT_DATA[industry][i].resolved),
  }));
}

function buildComplaint3Y(industry: IndustryKey) {
  return QUARTERS_12.map((q, qi) => {
    const base = qi * 3;
    const data = COMPLAINT_DATA[industry];
    const received = data[base].received + data[base+1].received + data[base+2].received;
    const resolved = data[base].resolved + data[base+1].resolved + data[base+2].resolved;
    return { month: q, received, resolved, pending: Math.max(0, received - resolved) };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-INDUSTRY STATIC CHARTS  (CAPA, Audit, Docs, Training, Supplier, Risk)
// Values vary by industry and scale with date range
// ─────────────────────────────────────────────────────────────────────────────

// Scale factors per range (base = 90d)
const SCALE: Record<string, number> = { '7d': 0.08, '30d': 0.33, '90d': 1, '1y': 3.9, '3y': 12 };

type CAPAStage = { stage: string; count: number };
const CAPA_BASE: Record<IndustryKey, CAPAStage[]> = {
  pharma:     [{stage:'Initiated',count:4},{stage:'Containment',count:3},{stage:'Root Cause',count:7},{stage:'Action Defn',count:5},{stage:'Implementation',count:11},{stage:'Effectiveness',count:4},{stage:'Closed',count:28}],
  food:       [{stage:'Initiated',count:3},{stage:'Containment',count:2},{stage:'Root Cause',count:5},{stage:'Action Defn',count:4},{stage:'Implementation',count:9},{stage:'Effectiveness',count:3},{stage:'Closed',count:20}],
  chemical:   [{stage:'Initiated',count:5},{stage:'Containment',count:4},{stage:'Root Cause',count:8},{stage:'Action Defn',count:6},{stage:'Implementation',count:13},{stage:'Effectiveness',count:5},{stage:'Closed',count:32}],
  automotive: [{stage:'Initiated',count:3},{stage:'Containment',count:2},{stage:'Root Cause',count:6},{stage:'Action Defn',count:4},{stage:'Implementation',count:9},{stage:'Effectiveness',count:3},{stage:'Closed',count:22}],
  vehicle:    [{stage:'Initiated',count:4},{stage:'Containment',count:3},{stage:'Root Cause',count:6},{stage:'Action Defn',count:5},{stage:'Implementation',count:10},{stage:'Effectiveness',count:3},{stage:'Closed',count:25}],
  machinery:  [{stage:'Initiated',count:2},{stage:'Containment',count:2},{stage:'Root Cause',count:4},{stage:'Action Defn',count:3},{stage:'Implementation',count:7},{stage:'Effectiveness',count:2},{stage:'Closed',count:16}],
};

function scaleCapa(industry: IndustryKey, range: string): CAPAStage[] {
  const s = SCALE[range] ?? 1;
  return CAPA_BASE[industry].map((e) => ({ stage: e.stage, count: Math.max(1, Math.round(e.count * s)) }));
}

type AuditFinding = { dept: string; Major: number; Minor: number; OFI: number };
const AUDIT_BASE: Record<IndustryKey, AuditFinding[]> = {
  pharma:     [{dept:'QC Lab',Major:4,Minor:7,OFI:3},{dept:'Production',Major:3,Minor:6,OFI:4},{dept:'QA',Major:2,Minor:4,OFI:5},{dept:'Warehouse',Major:1,Minor:3,OFI:2},{dept:'Engineering',Major:1,Minor:2,OFI:3}],
  food:       [{dept:'Production',Major:3,Minor:5,OFI:4},{dept:'Sanitation',Major:2,Minor:4,OFI:3},{dept:'Warehouse',Major:2,Minor:3,OFI:2},{dept:'QA',Major:1,Minor:3,OFI:4},{dept:'R&D',Major:0,Minor:2,OFI:2}],
  chemical:   [{dept:'Process',Major:5,Minor:8,OFI:2},{dept:'HSE',Major:4,Minor:6,OFI:3},{dept:'Maintenance',Major:3,Minor:5,OFI:2},{dept:'QC',Major:2,Minor:4,OFI:3},{dept:'Logistics',Major:1,Minor:3,OFI:1}],
  automotive: [{dept:'Machining',Major:3,Minor:6,OFI:3},{dept:'Assembly',Major:2,Minor:5,OFI:4},{dept:'QC',Major:2,Minor:4,OFI:5},{dept:'Supplier QA',Major:3,Minor:4,OFI:2},{dept:'Engineering',Major:1,Minor:3,OFI:3}],
  vehicle:    [{dept:'Body Shop',Major:4,Minor:7,OFI:3},{dept:'Paint',Major:3,Minor:5,OFI:4},{dept:'Assembly',Major:3,Minor:6,OFI:3},{dept:'QC',Major:2,Minor:4,OFI:4},{dept:'Logistics',Major:1,Minor:3,OFI:2}],
  machinery:  [{dept:'Fabrication',Major:3,Minor:5,OFI:2},{dept:'Welding',Major:4,Minor:6,OFI:2},{dept:'Machining',Major:2,Minor:4,OFI:3},{dept:'Assembly',Major:2,Minor:3,OFI:2},{dept:'QC',Major:1,Minor:3,OFI:3}],
};

function scaleAudit(industry: IndustryKey, range: string): AuditFinding[] {
  const s = Math.min(SCALE[range] ?? 1, 4); // cap audit scale
  return AUDIT_BASE[industry].map((e) => ({
    dept:  e.dept,
    Major: Math.max(0, Math.round(e.Major * s)),
    Minor: Math.max(0, Math.round(e.Minor * s)),
    OFI:   Math.max(0, Math.round(e.OFI * s)),
  }));
}

type DocEntry = { status: string; count: number; fill: string };
const DOC_BASE: Record<IndustryKey, DocEntry[]> = {
  pharma:     [{status:'Draft',count:9,fill:'#94a3b8'},{status:'Under Review',count:6,fill:'#f59e0b'},{status:'Pending Approval',count:4,fill:'#0ea5e9'},{status:'Approved',count:14,fill:'#10b981'},{status:'Published',count:52,fill:'#0a1628'},{status:'Obsolete',count:8,fill:'#e2e8f0'}],
  food:       [{status:'Draft',count:7,fill:'#94a3b8'},{status:'Under Review',count:4,fill:'#f59e0b'},{status:'Pending Approval',count:3,fill:'#0ea5e9'},{status:'Approved',count:10,fill:'#10b981'},{status:'Published',count:38,fill:'#0a1628'},{status:'Obsolete',count:5,fill:'#e2e8f0'}],
  chemical:   [{status:'Draft',count:11,fill:'#94a3b8'},{status:'Under Review',count:7,fill:'#f59e0b'},{status:'Pending Approval',count:5,fill:'#0ea5e9'},{status:'Approved',count:18,fill:'#10b981'},{status:'Published',count:61,fill:'#0a1628'},{status:'Obsolete',count:11,fill:'#e2e8f0'}],
  automotive: [{status:'Draft',count:8,fill:'#94a3b8'},{status:'Under Review',count:5,fill:'#f59e0b'},{status:'Pending Approval',count:3,fill:'#0ea5e9'},{status:'Approved',count:12,fill:'#10b981'},{status:'Published',count:44,fill:'#0a1628'},{status:'Obsolete',count:7,fill:'#e2e8f0'}],
  vehicle:    [{status:'Draft',count:6,fill:'#94a3b8'},{status:'Under Review',count:4,fill:'#f59e0b'},{status:'Pending Approval',count:2,fill:'#0ea5e9'},{status:'Approved',count:9,fill:'#10b981'},{status:'Published',count:33,fill:'#0a1628'},{status:'Obsolete',count:5,fill:'#e2e8f0'}],
  machinery:  [{status:'Draft',count:5,fill:'#94a3b8'},{status:'Under Review',count:3,fill:'#f59e0b'},{status:'Pending Approval',count:2,fill:'#0ea5e9'},{status:'Approved',count:8,fill:'#10b981'},{status:'Published',count:29,fill:'#0a1628'},{status:'Obsolete',count:4,fill:'#e2e8f0'}],
};

function scaleDoc(industry: IndustryKey, range: string): DocEntry[] {
  // Published stays fixed; Draft/Review/Approval scale with range
  const s = Math.min(SCALE[range] ?? 1, 3);
  return DOC_BASE[industry].map((e) =>
    e.status === 'Published' ? e : { ...e, count: Math.max(1, Math.round(e.count * s)) }
  );
}

type TrainingEntry = { dept: string; compliance: number };
// Compliance degrades as range lengthens (historical average worse than recent)
const TRAINING_BASE: Record<IndustryKey, TrainingEntry[]> = {
  pharma:     [{dept:'QA',compliance:98},{dept:'Regulatory',compliance:95},{dept:'Production',compliance:93},{dept:'QC',compliance:96},{dept:'Engineering',compliance:90},{dept:'Warehouse',compliance:85}],
  food:       [{dept:'Production',compliance:94},{dept:'QC',compliance:96},{dept:'Sanitation',compliance:91},{dept:'R&D',compliance:88},{dept:'Procurement',compliance:82},{dept:'Logistics',compliance:79}],
  chemical:   [{dept:'Process Ops',compliance:88},{dept:'HSE',compliance:95},{dept:'Maintenance',compliance:84},{dept:'QC',compliance:91},{dept:'Logistics',compliance:78},{dept:'Engineering',compliance:86}],
  automotive: [{dept:'Quality',compliance:97},{dept:'Machining',compliance:92},{dept:'Engineering',compliance:94},{dept:'Assembly',compliance:89},{dept:'Supplier QA',compliance:85},{dept:'Warehouse',compliance:81}],
  vehicle:    [{dept:'Quality',compliance:95},{dept:'Body Shop',compliance:90},{dept:'Paint Shop',compliance:88},{dept:'Assembly',compliance:92},{dept:'Logistics',compliance:84},{dept:'Maintenance',compliance:80}],
  machinery:  [{dept:'Design',compliance:93},{dept:'Fabrication',compliance:86},{dept:'Welding',compliance:88},{dept:'Assembly',compliance:90},{dept:'QC',compliance:91},{dept:'Service',compliance:82}],
};

function scaleTraining(industry: IndustryKey, range: string): TrainingEntry[] {
  const penalty = range === '7d' ? 2 : range === '30d' ? 0 : range === '90d' ? -3 : range === '1y' ? -6 : -10;
  return TRAINING_BASE[industry].map((e) => ({
    dept:       e.dept,
    compliance: Math.min(100, Math.max(50, e.compliance + penalty)),
  }));
}

type RadarEntry = { metric: string; score: number };
const SUPPLIER_BASE: Record<IndustryKey, RadarEntry[]> = {
  pharma:     [{metric:'Quality',score:91},{metric:'Delivery',score:85},{metric:'Cost',score:78},{metric:'Responsive',score:88},{metric:'Innovation',score:72},{metric:'Compliance',score:96}],
  food:       [{metric:'Quality',score:88},{metric:'Delivery',score:90},{metric:'Cost',score:82},{metric:'Responsive',score:86},{metric:'Innovation',score:69},{metric:'Compliance',score:93}],
  chemical:   [{metric:'Quality',score:85},{metric:'Delivery',score:80},{metric:'Cost',score:76},{metric:'Responsive',score:83},{metric:'Innovation',score:74},{metric:'Compliance',score:89}],
  automotive: [{metric:'Quality',score:94},{metric:'Delivery',score:91},{metric:'Cost',score:80},{metric:'Responsive',score:89},{metric:'Innovation',score:78},{metric:'Compliance',score:97}],
  vehicle:    [{metric:'Quality',score:89},{metric:'Delivery',score:93},{metric:'Cost',score:83},{metric:'Responsive',score:87},{metric:'Innovation',score:71},{metric:'Compliance',score:91}],
  machinery:  [{metric:'Quality',score:87},{metric:'Delivery',score:84},{metric:'Cost',score:79},{metric:'Responsive',score:82},{metric:'Innovation',score:76},{metric:'Compliance',score:88}],
};

function scaleSupplier(industry: IndustryKey, range: string): RadarEntry[] {
  const penalty = range === '7d' ? 2 : range === '30d' ? 0 : range === '90d' ? -3 : range === '1y' ? -5 : -8;
  return SUPPLIER_BASE[industry].map((e) => ({
    metric: e.metric,
    score:  Math.min(100, Math.max(40, e.score + penalty)),
  }));
}

type RiskPoint = { x: number; y: number; z: number; label: string };
const RISK_BASE: Record<IndustryKey, RiskPoint[]> = {
  pharma:     [{x:2,y:2,z:4,label:'Low'},{x:3,y:2,z:3,label:'Medium'},{x:2,y:3,z:3,label:'Medium'},{x:3,y:3,z:2,label:'Medium'},{x:4,y:3,z:2,label:'High'},{x:3,y:4,z:2,label:'High'},{x:4,y:4,z:1,label:'Critical'},{x:5,y:3,z:1,label:'Critical'}],
  food:       [{x:2,y:2,z:3,label:'Low'},{x:3,y:2,z:2,label:'Medium'},{x:2,y:3,z:3,label:'Medium'},{x:4,y:2,z:2,label:'Medium'},{x:3,y:3,z:2,label:'Medium'},{x:4,y:3,z:1,label:'High'},{x:5,y:4,z:1,label:'Critical'}],
  chemical:   [{x:2,y:1,z:3,label:'Low'},{x:3,y:2,z:4,label:'Medium'},{x:2,y:3,z:3,label:'Medium'},{x:4,y:3,z:3,label:'High'},{x:3,y:4,z:2,label:'High'},{x:5,y:3,z:2,label:'High'},{x:4,y:4,z:2,label:'Critical'},{x:5,y:5,z:1,label:'Critical'},{x:5,y:4,z:1,label:'Critical'}],
  automotive: [{x:1,y:2,z:3,label:'Low'},{x:2,y:2,z:5,label:'Low'},{x:3,y:2,z:3,label:'Medium'},{x:2,y:3,z:4,label:'Medium'},{x:4,y:3,z:2,label:'High'},{x:3,y:4,z:1,label:'High'},{x:4,y:4,z:1,label:'Critical'}],
  vehicle:    [{x:1,y:1,z:2,label:'Low'},{x:2,y:2,z:4,label:'Low'},{x:3,y:2,z:3,label:'Medium'},{x:2,y:3,z:3,label:'Medium'},{x:4,y:3,z:2,label:'High'},{x:3,y:4,z:1,label:'High'},{x:4,y:4,z:1,label:'Critical'}],
  machinery:  [{x:1,y:2,z:2,label:'Low'},{x:2,y:2,z:3,label:'Low'},{x:3,y:3,z:2,label:'Medium'},{x:4,y:2,z:2,label:'Medium'},{x:4,y:3,z:2,label:'High'},{x:3,y:4,z:1,label:'High'},{x:5,y:4,z:1,label:'Critical'}],
};

function scaleRisk(industry: IndustryKey, range: string): RiskPoint[] {
  const extra = range === '1y' ? 1 : range === '3y' ? 2 : 0;
  const base = RISK_BASE[industry];
  if (extra === 0) return base;
  // For longer ranges, add more historical risk points
  const additions: RiskPoint[] = extra >= 1
    ? [{ x: 2, y: 1, z: 3, label: 'Low' }, { x: 3, y: 3, z: 1, label: 'Medium' }]
    : [];
  const additions3y: RiskPoint[] = extra >= 2
    ? [{ x: 4, y: 3, z: 2, label: 'High' }, { x: 5, y: 4, z: 1, label: 'Critical' }]
    : [];
  return [...base, ...additions, ...additions3y];
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI STATS per industry × range
// ─────────────────────────────────────────────────────────────────────────────
type Stats = {
  openNCs: number; openCAPAs: number; pendingApprovals: number;
  expiringDocuments: number; overdueActions: number; trainingCompliance: number;
  supplierScore: number; auditCompliance: number;
};

const STATS_90D: Record<IndustryKey, Stats> = {
  pharma:     { openNCs:33, openCAPAs:18, pendingApprovals:12, expiringDocuments:8,  overdueActions:6,  trainingCompliance:93, supplierScore:86, auditCompliance:91 },
  food:       { openNCs:28, openCAPAs:14, pendingApprovals:9,  expiringDocuments:5,  overdueActions:4,  trainingCompliance:88, supplierScore:83, auditCompliance:87 },
  chemical:   { openNCs:38, openCAPAs:22, pendingApprovals:14, expiringDocuments:11, overdueActions:9,  trainingCompliance:86, supplierScore:80, auditCompliance:84 },
  automotive: { openNCs:30, openCAPAs:16, pendingApprovals:10, expiringDocuments:7,  overdueActions:5,  trainingCompliance:91, supplierScore:88, auditCompliance:94 },
  vehicle:    { openNCs:32, openCAPAs:17, pendingApprovals:11, expiringDocuments:6,  overdueActions:5,  trainingCompliance:89, supplierScore:85, auditCompliance:90 },
  machinery:  { openNCs:22, openCAPAs:11, pendingApprovals:7,  expiringDocuments:4,  overdueActions:3,  trainingCompliance:87, supplierScore:82, auditCompliance:88 },
};

const RANGE_SCALE_STATS: Record<string, { nc: number; capa: number; approvals: number; docs: number; actions: number; training: number; supplier: number; audit: number }> = {
  '7d':  { nc:0.08, capa:0.08, approvals:0.10, docs:0.05, actions:0.06, training: 2, supplier: 2, audit: 2 },
  '30d': { nc:0.33, capa:0.33, approvals:0.35, docs:0.28, actions:0.30, training: 0, supplier: 0, audit: 0 },
  '90d': { nc:1,    capa:1,    approvals:1,    docs:1,    actions:1,    training: 0, supplier: 0, audit: 0 },
  '1y':  { nc:3.9,  capa:3.7,  approvals:3.8,  docs:3.5,  actions:3.6,  training:-5, supplier:-4, audit:-3 },
  '3y':  { nc:12,   capa:11,   approvals:11,   docs:10,   actions:11,   training:-9, supplier:-7, audit:-6 },
};

function computeStats(industry: IndustryKey, range: string): Stats {
  const base = STATS_90D[industry];
  const sc = RANGE_SCALE_STATS[range] ?? RANGE_SCALE_STATS['90d'];
  return {
    openNCs:            Math.max(1, Math.round(base.openNCs * sc.nc)),
    openCAPAs:          Math.max(1, Math.round(base.openCAPAs * sc.capa)),
    pendingApprovals:   Math.max(0, Math.round(base.pendingApprovals * sc.approvals)),
    expiringDocuments:  Math.max(0, Math.round(base.expiringDocuments * sc.docs)),
    overdueActions:     Math.max(0, Math.round(base.overdueActions * sc.actions)),
    trainingCompliance: Math.min(100, Math.max(50, base.trainingCompliance + sc.training)),
    supplierScore:      Math.min(100, Math.max(50, base.supplierScore + sc.supplier)),
    auditCompliance:    Math.min(100, Math.max(50, base.auditCompliance + sc.audit)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT ACTIVITY per industry
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY: Record<IndustryKey, AuditLogEntry[]> = {
  pharma: [
    {id:'p1', timestamp:'2024-12-28T09:00:00Z', userId:'u1', userName:'Priya Sharma',    action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0312', changedFields:null, ipAddress:'10.1.1.12'},
    {id:'p2', timestamp:'2024-12-26T14:30:00Z', userId:'u2', userName:'Rajesh Kumar',    action:'APPROVE',         entityType:'DOCUMENT',        entityId:'SOP-QC-088',   changedFields:null, ipAddress:'10.1.1.15'},
    {id:'p3', timestamp:'2024-12-24T11:00:00Z', userId:'u3', userName:'Anita Desai',     action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2024-0201',changedFields:null, ipAddress:'10.1.1.20'},
    {id:'p4', timestamp:'2024-12-20T09:15:00Z', userId:'u4', userName:'Vikram Patel',    action:'UPDATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0308', changedFields:{status:{before:'OPEN',after:'INVESTIGATION'}}, ipAddress:'10.1.1.8'},
    {id:'p5', timestamp:'2024-12-15T16:00:00Z', userId:'u5', userName:'Sunita Rao',      action:'PUBLISH',         entityType:'DOCUMENT',        entityId:'BMR-2024-112', changedFields:null, ipAddress:'10.1.1.22'},
    {id:'p6', timestamp:'2024-11-30T10:30:00Z', userId:'u1', userName:'Priya Sharma',    action:'CREATE',          entityType:'AUDIT',           entityId:'AUD-2024-Q4',  changedFields:null, ipAddress:'10.1.1.12'},
    {id:'p7', timestamp:'2024-11-15T08:45:00Z', userId:'u3', userName:'Anita Desai',     action:'SUBMIT_FOR_REVIEW',entityType:'DOCUMENT',        entityId:'SOP-PRD-034',  changedFields:null, ipAddress:'10.1.1.20'},
    {id:'p8', timestamp:'2024-10-28T14:00:00Z', userId:'u6', userName:'Deepak Nair',     action:'CREATE',          entityType:'CAPA',            entityId:'CAPA-2024-0195',changedFields:null, ipAddress:'10.1.1.30'},
    {id:'p9', timestamp:'2024-09-15T11:00:00Z', userId:'u2', userName:'Rajesh Kumar',    action:'APPROVE',         entityType:'CHANGE_REQUEST',  entityId:'CR-2024-0041', changedFields:null, ipAddress:'10.1.1.15'},
    {id:'p10',timestamp:'2024-06-10T09:30:00Z', userId:'u4', userName:'Vikram Patel',    action:'CLOSE',           entityType:'NON_CONFORMANCE', entityId:'NC-2024-0188', changedFields:null, ipAddress:'10.1.1.8'},
    {id:'p11',timestamp:'2023-12-20T10:00:00Z', userId:'u1', userName:'Priya Sharma',    action:'APPROVE',         entityType:'DOCUMENT',        entityId:'VMP-2023-001', changedFields:null, ipAddress:'10.1.1.12'},
    {id:'p12',timestamp:'2022-03-15T09:00:00Z', userId:'u5', userName:'Sunita Rao',      action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2022-0034', changedFields:null, ipAddress:'10.1.1.22'},
  ],
  food: [
    {id:'f1', timestamp:'2024-12-27T08:30:00Z', userId:'u1', userName:'Meera Pillai',    action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0156', changedFields:null, ipAddress:'10.2.1.11'},
    {id:'f2', timestamp:'2024-12-24T13:00:00Z', userId:'u2', userName:'Suresh Iyer',     action:'APPROVE',         entityType:'DOCUMENT',        entityId:'HACCP-2024-v3',changedFields:null, ipAddress:'10.2.1.14'},
    {id:'f3', timestamp:'2024-12-20T10:30:00Z', userId:'u3', userName:'Kavitha Nair',    action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2024-0098',changedFields:null, ipAddress:'10.2.1.19'},
    {id:'f4', timestamp:'2024-12-15T15:00:00Z', userId:'u1', userName:'Meera Pillai',    action:'UPDATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0149', changedFields:{severity:{before:'MINOR',after:'MAJOR'}}, ipAddress:'10.2.1.11'},
    {id:'f5', timestamp:'2024-11-28T09:00:00Z', userId:'u4', userName:'Arun Krishnan',   action:'PUBLISH',         entityType:'DOCUMENT',        entityId:'AMP-PRG-v4',   changedFields:null, ipAddress:'10.2.1.8'},
    {id:'f6', timestamp:'2024-11-15T14:30:00Z', userId:'u2', userName:'Suresh Iyer',     action:'CREATE',          entityType:'AUDIT',           entityId:'AUD-FSSC-2024',changedFields:null, ipAddress:'10.2.1.14'},
    {id:'f7', timestamp:'2024-09-10T11:00:00Z', userId:'u3', userName:'Kavitha Nair',    action:'APPROVE',         entityType:'CHANGE_REQUEST',  entityId:'CR-2024-0028', changedFields:null, ipAddress:'10.2.1.19'},
    {id:'f8', timestamp:'2024-06-05T08:30:00Z', userId:'u1', userName:'Meera Pillai',    action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0087', changedFields:null, ipAddress:'10.2.1.11'},
    {id:'f9', timestamp:'2023-11-20T10:00:00Z', userId:'u4', userName:'Arun Krishnan',   action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2023-0067',changedFields:null, ipAddress:'10.2.1.8'},
    {id:'f10',timestamp:'2022-07-15T09:00:00Z', userId:'u2', userName:'Suresh Iyer',     action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2022-0089', changedFields:null, ipAddress:'10.2.1.14'},
  ],
  chemical: [
    {id:'c1', timestamp:'2024-12-28T07:30:00Z', userId:'u1', userName:'Ravi Shankar',    action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0228', changedFields:null, ipAddress:'10.3.1.10'},
    {id:'c2', timestamp:'2024-12-25T11:00:00Z', userId:'u2', userName:'Leela Krishnamurthy',action:'APPROVE',      entityType:'DOCUMENT',        entityId:'SDS-REV-2024', changedFields:null, ipAddress:'10.3.1.13'},
    {id:'c3', timestamp:'2024-12-20T09:00:00Z', userId:'u3', userName:'Prasad Rao',      action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2024-0142',changedFields:null, ipAddress:'10.3.1.18'},
    {id:'c4', timestamp:'2024-12-15T14:00:00Z', userId:'u4', userName:'Vidya Murthy',    action:'UPDATE',          entityType:'CHANGE_REQUEST',  entityId:'MOC-2024-0031',changedFields:{status:{before:'DRAFT',after:'SUBMITTED'}}, ipAddress:'10.3.1.7'},
    {id:'c5', timestamp:'2024-11-30T08:30:00Z', userId:'u1', userName:'Ravi Shankar',    action:'CREATE',          entityType:'AUDIT',           entityId:'PSM-AUD-2024', changedFields:null, ipAddress:'10.3.1.10'},
    {id:'c6', timestamp:'2024-11-10T15:00:00Z', userId:'u2', userName:'Leela Krishnamurthy',action:'PUBLISH',      entityType:'DOCUMENT',        entityId:'PHA-RPT-2024', changedFields:null, ipAddress:'10.3.1.13'},
    {id:'c7', timestamp:'2024-09-05T10:00:00Z', userId:'u5', userName:'Mohan Pillai',    action:'APPROVE',         entityType:'DOCUMENT',        entityId:'PSSR-2024-003',changedFields:null, ipAddress:'10.3.1.25'},
    {id:'c8', timestamp:'2023-08-20T09:30:00Z', userId:'u1', userName:'Ravi Shankar',    action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2023-0178', changedFields:null, ipAddress:'10.3.1.10'},
    {id:'c9', timestamp:'2022-04-10T08:00:00Z', userId:'u3', userName:'Prasad Rao',      action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2022-0056', changedFields:null, ipAddress:'10.3.1.18'},
  ],
  automotive: [
    {id:'a1', timestamp:'2024-12-27T08:00:00Z', userId:'u1', userName:'Karan Mehta',     action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0189', changedFields:null, ipAddress:'10.4.1.9'},
    {id:'a2', timestamp:'2024-12-24T12:30:00Z', userId:'u2', userName:'Divya Nair',      action:'APPROVE',         entityType:'DOCUMENT',        entityId:'PFMEA-2024-v5',changedFields:null, ipAddress:'10.4.1.12'},
    {id:'a3', timestamp:'2024-12-20T10:00:00Z', userId:'u3', userName:'Sanjay Gupta',    action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2024-0118',changedFields:null, ipAddress:'10.4.1.17'},
    {id:'a4', timestamp:'2024-12-15T14:30:00Z', userId:'u4', userName:'Preethi Kumar',   action:'UPDATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0183', changedFields:{status:{before:'OPEN',after:'CAPA_PLANNING'}}, ipAddress:'10.4.1.6'},
    {id:'a5', timestamp:'2024-11-28T09:30:00Z', userId:'u1', userName:'Karan Mehta',     action:'PUBLISH',         entityType:'DOCUMENT',        entityId:'PPAP-2024-035',changedFields:null, ipAddress:'10.4.1.9'},
    {id:'a6', timestamp:'2024-11-15T15:00:00Z', userId:'u5', userName:'Rohan Singh',     action:'CREATE',          entityType:'AUDIT',           entityId:'VDA63-AUD-2024',changedFields:null, ipAddress:'10.4.1.24'},
    {id:'a7', timestamp:'2024-09-12T10:30:00Z', userId:'u2', userName:'Divya Nair',      action:'APPROVE',         entityType:'CHANGE_REQUEST',  entityId:'CR-2024-0052', changedFields:null, ipAddress:'10.4.1.12'},
    {id:'a8', timestamp:'2023-12-10T09:00:00Z', userId:'u3', userName:'Sanjay Gupta',    action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2023-0091',changedFields:null, ipAddress:'10.4.1.17'},
    {id:'a9', timestamp:'2022-06-20T08:30:00Z', userId:'u1', userName:'Karan Mehta',     action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2022-0078', changedFields:null, ipAddress:'10.4.1.9'},
  ],
  vehicle: [
    {id:'v1', timestamp:'2024-12-28T07:45:00Z', userId:'u1', userName:'Arjun Rajendran', action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0214', changedFields:null, ipAddress:'10.5.1.8'},
    {id:'v2', timestamp:'2024-12-25T13:30:00Z', userId:'u2', userName:'Nithya Subramaniam',action:'APPROVE',       entityType:'DOCUMENT',        entityId:'CP-ASSY-2024', changedFields:null, ipAddress:'10.5.1.11'},
    {id:'v3', timestamp:'2024-12-20T10:00:00Z', userId:'u3', userName:'Balaji Narayanan', action:'CLOSE',          entityType:'CAPA',            entityId:'CAPA-2024-0131',changedFields:null, ipAddress:'10.5.1.16'},
    {id:'v4', timestamp:'2024-12-15T15:00:00Z', userId:'u4', userName:'Saranya Devi',    action:'UPDATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0208', changedFields:{severity:{before:'MINOR',after:'MAJOR'}}, ipAddress:'10.5.1.5'},
    {id:'v5', timestamp:'2024-11-30T09:00:00Z', userId:'u1', userName:'Arjun Rajendran', action:'PUBLISH',         entityType:'DOCUMENT',        entityId:'WI-PAINT-019', changedFields:null, ipAddress:'10.5.1.8'},
    {id:'v6', timestamp:'2024-11-15T14:00:00Z', userId:'u5', userName:'Muthu Selvam',    action:'CREATE',          entityType:'AUDIT',           entityId:'IATF-AUD-Q4-2024',changedFields:null, ipAddress:'10.5.1.23'},
    {id:'v7', timestamp:'2023-11-10T10:00:00Z', userId:'u2', userName:'Nithya Subramaniam',action:'APPROVE',       entityType:'CHANGE_REQUEST',  entityId:'CR-2023-0047', changedFields:null, ipAddress:'10.5.1.11'},
    {id:'v8', timestamp:'2022-09-15T09:00:00Z', userId:'u3', userName:'Balaji Narayanan', action:'CREATE',         entityType:'NON_CONFORMANCE', entityId:'NC-2022-0112', changedFields:null, ipAddress:'10.5.1.16'},
  ],
  machinery: [
    {id:'m1', timestamp:'2024-12-26T08:00:00Z', userId:'u1', userName:'Murugan Pillai',  action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0098', changedFields:null, ipAddress:'10.6.1.7'},
    {id:'m2', timestamp:'2024-12-23T14:00:00Z', userId:'u2', userName:'Selvi Rajan',     action:'APPROVE',         entityType:'DOCUMENT',        entityId:'CE-TF-2024-007',changedFields:null, ipAddress:'10.6.1.10'},
    {id:'m3', timestamp:'2024-12-18T11:00:00Z', userId:'u3', userName:'Anbazhagan K',    action:'CLOSE',           entityType:'CAPA',            entityId:'CAPA-2024-0061',changedFields:null, ipAddress:'10.6.1.15'},
    {id:'m4', timestamp:'2024-12-12T15:30:00Z', userId:'u4', userName:'Thilagam S',      action:'UPDATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2024-0092', changedFields:{status:{before:'OPEN',after:'ROOT_CAUSE'}}, ipAddress:'10.6.1.4'},
    {id:'m5', timestamp:'2024-11-28T09:00:00Z', userId:'u1', userName:'Murugan Pillai',  action:'PUBLISH',         entityType:'DOCUMENT',        entityId:'WPS-WLD-2024', changedFields:null, ipAddress:'10.6.1.7'},
    {id:'m6', timestamp:'2024-11-12T14:00:00Z', userId:'u5', userName:'Chandran R',      action:'CREATE',          entityType:'AUDIT',           entityId:'CE-AUDIT-2024',changedFields:null, ipAddress:'10.6.1.22'},
    {id:'m7', timestamp:'2023-10-05T10:30:00Z', userId:'u2', userName:'Selvi Rajan',     action:'APPROVE',         entityType:'CHANGE_REQUEST',  entityId:'CR-2023-0031', changedFields:null, ipAddress:'10.6.1.10'},
    {id:'m8', timestamp:'2022-05-20T08:30:00Z', userId:'u3', userName:'Anbazhagan K',    action:'CREATE',          entityType:'NON_CONFORMANCE', entityId:'NC-2022-0045', changedFields:null, ipAddress:'10.6.1.15'},
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CHART TITLE LABELS
// ─────────────────────────────────────────────────────────────────────────────
export const RANGE_LABELS: Record<string, string> = {
  '7d':  'NC Trend — Last 7 Days',
  '30d': 'NC Trend — Last 30 Days',
  '90d': 'NC Trend — Last 3 Months',
  '1y':  'NC Trend — Last 12 Months',
  '3y':  'NC Trend — 3 Years (Jan 2022 – Dec 2024)',
};

// Indices into MONTHS_36 for each range
const RANGE_INDICES: Record<string, number[]> = {
  '7d':  [35],          // just Dec-24 (single point for 7d; use daily mock)
  '30d': [33,34,35],    // Oct–Dec 2024
  '90d': [33,34,35],    // same 3 months (quarterly)
  '1y':  [24,25,26,27,28,29,30,31,32,33,34,35], // all 2024
  '3y':  [],            // special — use quarterly
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useDashboardData(dateRange: string, industryKey: IndustryKey = 'pharma') {
  return useMemo(() => {
    const range    = ['7d','30d','90d','1y','3y'].includes(dateRange) ? dateRange : '30d';
    const industry = industryKey;

    // ── NC Trend & Severity ──
    let ncTrends: { month: string; count: number }[];
    let severityTrend: { month: string; Critical: number; Major: number; Minor: number }[];

    if (range === '3y') {
      const q = buildNC3Y(industry);
      ncTrends      = q.map(({ month, count }) => ({ month, count }));
      severityTrend = q.map(({ month, Critical, Major, Minor }) => ({ month, Critical, Major, Minor }));
    } else if (range === '7d') {
      // 7-day: last 7 days of Dec-24 simulated daily
      const dayLabels = ['Mon 23','Tue 24','Wed 25','Thu 26','Fri 27','Sat 28','Sun 29'];
      const basePerDay = Math.round(NC_COUNT[industry][35] / 25);
      const { crit, major } = SEV_SPLIT[industry];
      const daily = dayLabels.map((d, i) => {
        const noise = [0,1,-1,1,2,0,1][i];
        const cnt   = Math.max(0, basePerDay + noise);
        return {
          month: d,
          count: cnt,
          Critical: Math.max(0, Math.round(cnt * crit)),
          Major:    Math.max(0, Math.round(cnt * major)),
          Minor:    Math.max(0, Math.round(cnt * (1 - crit - major))),
        };
      });
      ncTrends      = daily.map(({ month, count }) => ({ month, count }));
      severityTrend = daily.map(({ month, Critical, Major, Minor }) => ({ month, Critical, Major, Minor }));
    } else {
      // 30d / 90d → last 3 months; 1y → all 12 months of 2024
      const indices = range === '1y' ? RANGE_INDICES['1y'] : [33,34,35];
      ncTrends      = buildNCTrend(industry, indices);
      severityTrend = buildNCSeverity(industry, indices);
    }

    // ── Complaint Trend ──
    let complaintTrend: { month: string; received: number; resolved: number; pending: number }[];
    if (range === '3y') {
      complaintTrend = buildComplaint3Y(industry);
    } else if (range === '7d') {
      complaintTrend = [{ month: 'This week', received: 2, resolved: 1, pending: 1 }];
    } else {
      const indices = range === '1y' ? RANGE_INDICES['1y'] : [33,34,35];
      complaintTrend = buildComplaint(industry, indices);
    }

    // ── NC by Type ──
    const totalNC = ncTrends.reduce((s, t) => s + t.count, 0);
    const typeRatios: Record<IndustryKey, number[]> = {
      pharma:     [0.30, 0.12, 0.24, 0.22, 0.12],
      food:       [0.18, 0.22, 0.28, 0.08, 0.24],
      chemical:   [0.20, 0.18, 0.35, 0.14, 0.13],
      automotive: [0.15, 0.30, 0.28, 0.06, 0.21],
      vehicle:    [0.12, 0.32, 0.31, 0.05, 0.20],
      machinery:  [0.22, 0.28, 0.30, 0.08, 0.12],
    };
    const ncTypes = ['Deviation','Product NC','Process NC','OOS','Complaint'];
    const ncByType = ncTypes.map((type, i) => ({
      type,
      count: Math.max(0, Math.round(totalNC * typeRatios[industry][i])),
    })).filter((t) => t.count > 0);

    return {
      stats:          computeStats(industry, range),
      ncTrends,
      ncByType,
      severityTrend,
      complaintTrend,
      capaByStage:    scaleCapa(industry, range),
      auditFindings:  scaleAudit(industry, range),
      docPipeline:    scaleDoc(industry, range),
      trainingByDept: scaleTraining(industry, range),
      supplierRadar:  scaleSupplier(industry, range),
      riskMatrix:     scaleRisk(industry, range),
      recentActivity: ACTIVITY[industry].slice(
        0,
        range === '7d' ? 3 : range === '30d' ? 5 : range === '90d' ? 7 : range === '1y' ? 9 : 12
      ),
      rangeLabel: RANGE_LABELS[range] ?? RANGE_LABELS['30d'],
    };
  }, [dateRange, industryKey]);
}
