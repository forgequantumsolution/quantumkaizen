import React from 'react';
import {
  AlertTriangle, CheckCircle2, Shield, ClipboardCheck,
  FileText, GraduationCap, GitBranch, Activity, Truck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type Industry = 'pharma' | 'chemical' | 'food';
export type IndustryFilter = 'all' | Industry;
export type ModuleType = 'nc' | 'capa' | 'risk' | 'audit' | 'document' | 'training' | 'change' | 'system' | 'supplier';
export type Complexity = 'Low' | 'Medium' | 'High';
export type InstanceStatus = 'On Track' | 'At Risk' | 'Overdue';

export interface WorkflowStep { label: string; module: ModuleType; desc: string }
export interface Workflow {
  id: string; name: string; industry: Industry; regulation: string;
  description: string; avgCycleTime: string; complexity: Complexity; steps: WorkflowStep[];
}
export interface ActiveInstance {
  id: string; workflowId: string; name: string; industry: Industry;
  entityRef: string; currentStep: number; totalSteps: number; currentStepLabel: string;
  assignee: string; dueDate: string; status: InstanceStatus;
}

// ─── Module config ────────────────────────────────────────────────────────────
export const MODULE_CONFIG: Record<ModuleType, {
  icon: React.ElementType; color: string; dot: string; label: string;
  owner: string; link: string | null;
  inputs: string[]; outputs: string[];
}> = {
  nc: {
    icon: AlertTriangle, color: '#ef4444', dot: 'bg-red-400', label: 'Non-Conformance',
    owner: 'Quality Analyst',
    link: '/qms/non-conformances',
    inputs: ['Test result / observation', 'Relevant SOP reference', 'Sample / batch details'],
    outputs: ['NC report', 'Initial containment record', 'Affected product / batch list'],
  },
  capa: {
    icon: CheckCircle2, color: '#f59e0b', dot: 'bg-amber-400', label: 'CAPA',
    owner: 'QA Manager / CAPA Owner',
    link: '/qms/capa',
    inputs: ['NC report or deviation finding', 'Root cause analysis data'],
    outputs: ['CAPA plan', 'Action item list with owners and due dates'],
  },
  risk: {
    icon: Shield, color: '#0ea5e9', dot: 'bg-sky-400', label: 'Risk',
    owner: 'Risk Management Lead',
    link: '/qms/risks',
    inputs: ['Process / product data', 'Historical incident data', 'FMEA worksheet'],
    outputs: ['Risk score (Likelihood × Consequence)', 'Control strategy recommendation'],
  },
  audit: {
    icon: ClipboardCheck, color: '#6366f1', dot: 'bg-indigo-400', label: 'Audit',
    owner: 'Lead Auditor',
    link: '/qms/audits',
    inputs: ['Audit checklist', 'Previous audit findings', 'Applicable standard / regulation'],
    outputs: ['Audit report', 'Finding log (Major / Minor / OFI)', 'Sign-off record'],
  },
  document: {
    icon: FileText, color: '#64748b', dot: 'bg-slate-400', label: 'Document',
    owner: 'Document Controller',
    link: '/dms/documents',
    inputs: ['Current approved document version', 'Redline / markup from subject-matter expert'],
    outputs: ['Updated document (new revision)', 'Change record / version history'],
  },
  training: {
    icon: GraduationCap, color: '#10b981', dot: 'bg-emerald-400', label: 'Training',
    owner: 'Training Coordinator',
    link: '/lms/training',
    inputs: ['Updated SOP / procedure', 'Affected personnel list'],
    outputs: ['Training record', 'Signed attendance sheet', 'Competency assessment (if required)'],
  },
  change: {
    icon: GitBranch, color: '#8b5cf6', dot: 'bg-violet-400', label: 'Change Control',
    owner: 'Change Owner / QA Representative',
    link: '/qms/change-control',
    inputs: ['Change proposal', 'Technical justification', 'Impact assessment form'],
    outputs: ['Approved change record', 'Implementation plan', 'Post-change review schedule'],
  },
  system: {
    icon: Activity, color: '#94a3b8', dot: 'bg-gray-300', label: 'Regulatory / System',
    owner: 'Quality Director / RA Manager',
    link: null,
    inputs: ['Internal assessment results', 'Applicable regulatory thresholds'],
    outputs: ['Regulatory notification / filing', 'Confirmation receipt from authority'],
  },
  supplier: {
    icon: Truck, color: '#0891b2', dot: 'bg-cyan-400', label: 'Supplier',
    owner: 'Supplier Quality Engineer',
    link: '/qms/suppliers',
    inputs: ['Supplier application', 'Certificates of compliance / analysis'],
    outputs: ['Supplier audit report', 'Approved Supplier List (ASL) entry', 'Quality agreement'],
  },
};

// ─── Industry config ──────────────────────────────────────────────────────────
export const INDUSTRY_CONFIG: Record<Industry, { label: string; color: string; pill: string }> = {
  pharma:   { label: 'Pharma & Life Sciences', color: '#0a1628', pill: 'bg-blue-50 text-blue-900 border-blue-200' },
  chemical: { label: 'Chemical',               color: '#d97706', pill: 'bg-amber-100 text-amber-800 border-amber-200' },
  food:     { label: 'Food & Beverage',         color: '#059669', pill: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export const COMPLEXITY_CONFIG: Record<Complexity, string> = {
  Low:    'bg-green-50 text-green-700 border-green-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High:   'bg-red-50 text-red-700 border-red-200',
};

export const STATUS_CONFIG: Record<InstanceStatus, { bar: string; text: string; bg: string }> = {
  'On Track': { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  'At Risk':  { bar: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50'   },
  'Overdue':  { bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'     },
};

// ─── Workflows ────────────────────────────────────────────────────────────────
export const WORKFLOWS: Workflow[] = [
  {
    id: 'ph-01', name: 'OOS/Deviation Investigation & CAPA', industry: 'pharma',
    regulation: '21 CFR Part 211.192 · ICH Q10 · Schedule M',
    description: 'Full deviation lifecycle from lab OOS detection through Phase I/II investigation, batch disposition, CAPA implementation, and 90-day effectiveness check.',
    avgCycleTime: '30–45 days', complexity: 'High',
    steps: [
      { label: 'OOS Detection',           module: 'nc',       desc: 'Analyst flags out-of-spec result; initial deviation log raised within 1 hour of detection' },
      { label: 'Phase I Investigation',   module: 'nc',       desc: 'Lab error check: analyst technique, instrument calibration, standard integrity, sample preparation' },
      { label: 'Phase II Investigation',  module: 'nc',       desc: 'Full process investigation: batch genealogy, environmental monitoring review, similar batch assessment' },
      { label: 'Root Cause (RCA)',         module: 'capa',     desc: 'Fishbone / 5-Why RCA documented with supporting evidence; probable root cause formally assigned by QA' },
      { label: 'CAPA Raised',             module: 'capa',     desc: 'Corrective & preventive action plan drafted, peer-reviewed, and approved by QA Manager within 5 business days' },
      { label: 'Regulatory Review',       module: 'system',   desc: 'Assess whether deviation requires FDA/EMA/CDSCO notification per 21 CFR §314.81 or Schedule M requirements' },
      { label: 'Risk Assessment',         module: 'risk',     desc: 'Batch risk scored using impact × probability matrix; disposition decision (release / rework / reject) made' },
      { label: 'Batch Disposition',       module: 'document', desc: 'Qualified Person reviews complete batch record; disposition formally documented and signed' },
      { label: 'Document Update',         module: 'document', desc: 'Affected SOP / specification revised; change control raised if update impacts registered process' },
      { label: 'Training',                module: 'training', desc: 'Affected personnel complete revised procedure training; training records signed and archived in LMS' },
      { label: 'CAPA Effectiveness',      module: 'capa',     desc: '90-day post-implementation effectiveness check; no recurrence confirmed; CAPA formally closed' },
    ],
  },
  {
    id: 'ph-02', name: 'Regulatory Change Control (Level 2)', industry: 'pharma',
    regulation: 'ICH Q10 · 21 CFR Part 314 · SUPAC Guidelines',
    description: 'Structured change control for process, formula, or equipment changes requiring prior-approval submission to a regulatory authority before implementation.',
    avgCycleTime: '60–180 days', complexity: 'High',
    steps: [
      { label: 'Change Request',          module: 'change',   desc: 'Initiator submits CR with full technical rationale, scope definition, and preliminary risk assessment' },
      { label: 'Impact Assessment',       module: 'change',   desc: 'Quality & regulatory impact classified as Level 1 (Annual Report) / Level 2 (CBE-30) / Level 3 (PAS)' },
      { label: 'Risk Assessment',         module: 'risk',     desc: 'FMEA conducted on the changed element; control strategy reviewed and updated accordingly' },
      { label: 'Regulatory Filing',       module: 'document', desc: 'Supplement / CBE / Annual Report compiled and submitted to FDA/EMA/CDSCO with full dossier' },
      { label: 'QA Approval Gate',        module: 'audit',    desc: 'QA sign-off gate — no physical implementation permitted without written approval on CR form' },
      { label: 'Implementation',          module: 'change',   desc: 'Change physically executed in production environment per approved implementation plan' },
      { label: 'Validation / Qual.',      module: 'audit',    desc: 'IQ/OQ/PQ completed; process validation batches run if required under SUPAC guidance' },
      { label: 'Document Update',         module: 'document', desc: 'Master Batch Record, SOPs, and specifications updated under version control; old versions archived' },
      { label: 'Training',                module: 'training', desc: 'Operators, QC analysts trained on revised process; competency assessed for critical steps' },
      { label: 'Effectiveness Review',    module: 'capa',     desc: '6-month post-implementation review confirms no adverse impact on quality or regulatory status' },
    ],
  },
  {
    id: 'ph-03', name: 'GMP Supplier Qualification (API / Critical Excipient)', industry: 'pharma',
    regulation: 'ICH Q7 · FDA Drug Supply Chain Security Act · WHO TRS 986',
    description: 'End-to-end qualification of a new API or critical excipient supplier including document review, GMP audit, lab qualification, and Approved Supplier List entry.',
    avgCycleTime: '90–120 days', complexity: 'High',
    steps: [
      { label: 'Supplier Request',        module: 'supplier', desc: 'Business raises new supplier request with material specification, justification, and proposed use' },
      { label: 'Document Review',         module: 'document', desc: 'CEP/DMF, CoA, GMP certificate, and Site Master File reviewed and gap-assessed by QA' },
      { label: 'Risk Classification',     module: 'risk',     desc: 'Supplier risk scored as Critical / Major / Minor based on material type and process criticality' },
      { label: 'Quality Agreement',       module: 'document', desc: 'Quality Technical Agreement executed — covers change notification, audit rights, data integrity requirements' },
      { label: 'On-site GMP Audit',       module: 'audit',    desc: 'Full GMP audit conducted against WHO/EU GMP; observation report issued within 10 business days' },
      { label: 'Lab Qualification',       module: 'nc',       desc: 'Method transfer completed; 3 consecutive commercial lots tested and compared against registered specification' },
      { label: 'Conditional Approval',    module: 'supplier', desc: 'Supplier conditionally added to ASL pending satisfactory first 3 commercial lots in production' },
      { label: 'Monitoring Setup',        module: 'supplier', desc: 'Annual re-qualification frequency, scorecard KPIs, and CoA review cadence configured in system' },
      { label: 'Full ASL Approval',       module: 'supplier', desc: 'Full approval status granted and documented after all conditions have been satisfactorily met' },
    ],
  },
  {
    id: 'ch-01', name: 'Management of Change (MOC — PSM)', industry: 'chemical',
    regulation: 'OSHA PSM 29 CFR 1910.119(l) · ISO 45001 · CCPS Guidelines',
    description: 'Structured MOC for any change to process chemistry, equipment, operating limits, or raw materials at PSM-covered facilities — from PHA to PSSR and closure.',
    avgCycleTime: '14–60 days', complexity: 'High',
    steps: [
      { label: 'Change Request',          module: 'change',   desc: 'MOC form raised with full description, technical scope, and basis for the proposed change' },
      { label: 'Technical Review',        module: 'audit',    desc: 'Process engineer reviews P&ID impact, equipment specifications, utility requirements, and interfaces' },
      { label: 'PHA / HAZOP',             module: 'risk',     desc: 'What-if / HAZOP study conducted on all affected process nodes; hazard scenarios and safeguards evaluated' },
      { label: 'Safety Review',           module: 'risk',     desc: 'Safety team sign-off with SIL review if safety instrumented system is involved; EHS approval documented' },
      { label: 'Permit to Work',          module: 'document', desc: 'PTW issued; isolations, blindings, and site access controls confirmed before any physical work begins' },
      { label: 'Implementation',          module: 'change',   desc: 'Physical change executed by qualified contractor / maintenance; field verification by process engineer' },
      { label: 'PSSR',                    module: 'audit',    desc: 'Pre-Startup Safety Review: all open action items closed; safety inspection passed before process restart' },
      { label: 'Documentation',           module: 'document', desc: 'P&IDs, operating SOPs, Emergency Response Plan, and PSI dossier updated and formally re-issued' },
      { label: 'Training',                module: 'training', desc: 'Operations, maintenance, and emergency response teams retrained on changed process / equipment' },
      { label: 'MOC Closure',             module: 'change',   desc: 'MOC formally closed by process safety lead; filed and indexed in Process Safety Information (PSI)' },
    ],
  },
  {
    id: 'ch-02', name: 'Process Safety Incident Investigation', industry: 'chemical',
    regulation: 'OSHA PSM 29 CFR 1910.119(m) · CCPS Incident Cause Tree',
    description: 'Systematic investigation for near-miss, unplanned release, or loss-of-containment events using CCPS Bow-Tie analysis — from first response through lessons-learned dissemination.',
    avgCycleTime: '7–30 days', complexity: 'High',
    steps: [
      { label: 'Incident Report',         module: 'nc',       desc: 'First report filed within 1 hour; site secured; injured personnel provided with care and assistance' },
      { label: 'Immediate Control',       module: 'nc',       desc: 'Emergency response activated; evacuation if warranted; release contained; hazmat team deployed' },
      { label: 'Classification',          module: 'risk',     desc: 'Incident classified: near-miss / recordable / LOPC / Process Safety Event Tier 1, 2, or 3' },
      { label: 'Regulatory Notification', module: 'system',   desc: 'OSHA / CPCB / SPCB notified per reportable threshold within 24 hours of classification' },
      { label: 'Root Cause (RCA)',         module: 'capa',     desc: 'CCPS Incident Cause Tree / Bow-Tie analysis; initiating events and failed safeguards mapped in detail' },
      { label: 'CAPA',                    module: 'capa',     desc: 'Corrective actions with specific owners and due dates; safety-critical items assigned highest priority' },
      { label: 'PSI Update',              module: 'document', desc: 'Process Safety Information updated to reflect investigation findings and engineering changes made' },
      { label: 'CAPA Verification',       module: 'capa',     desc: 'Independent verification that all actions are complete; re-HAZOP conducted if process was modified' },
      { label: 'Lessons Learned',         module: 'training', desc: 'Lessons learned brief circulated to all sites; included in next scheduled safety stand-down meeting' },
    ],
  },
  {
    id: 'ch-03', name: 'Environmental Compliance Exceedance', industry: 'chemical',
    regulation: 'Environment Protection Act 1986 · ISO 14001:2015 · CPCB Consent Conditions',
    description: 'Workflow for managing exceedances of air emission, effluent discharge, or hazardous waste limits — from CEMS alert through regulatory notification, CAPA, and compliance verification.',
    avgCycleTime: '15–45 days', complexity: 'Medium',
    steps: [
      { label: 'Exceedance Detected',     module: 'nc',       desc: 'CEMS / effluent sample flags limit breach; stack monitor or ETP alarm triggers immediate alert' },
      { label: 'Immediate Control',       module: 'nc',       desc: 'Process rate reduced; effluent diverted to holding pit; EHS Manager notified immediately' },
      { label: 'Regulatory Report',       module: 'system',   desc: 'SPCB / CPCB notified as required by consent conditions — within 48 hours of confirmed exceedance' },
      { label: 'Root Cause',              module: 'capa',     desc: 'Equipment failure, process upset, or operational deviation identified with supporting evidence' },
      { label: 'CAPA',                    module: 'capa',     desc: 'Engineering control, SOP revision, or equipment repair implemented with documented evidence' },
      { label: 'Verification Audit',      module: 'audit',    desc: 'Compliance monitoring conducted at 3× normal frequency for 30 days after correction confirmed' },
      { label: 'Aspects Update',          module: 'document', desc: 'Environmental aspects register and operational control procedures updated; reviewed by EHS head' },
      { label: 'Training',                module: 'training', desc: 'Environmental awareness refresher completed by operations and EHS team; records signed' },
    ],
  },
  {
    id: 'fb-01', name: 'HACCP CCP Deviation & Product Disposition', industry: 'food',
    regulation: 'FSMA §117 · Codex Alimentarius CAC/RCP 1-1969 · FSSAI',
    description: 'CCP deviation handling from monitor alert through product hold, accelerated microbiological testing, regulatory assessment, disposition decision, and HACCP plan review.',
    avgCycleTime: '1–10 days', complexity: 'High',
    steps: [
      { label: 'CCP Deviation Alert',     module: 'nc',       desc: 'CCP monitor triggers alert — temperature breach, pH drift, failed metal detection, or pasteurisation shortfall' },
      { label: 'Line Hold',               module: 'nc',       desc: 'All affected product immediately quarantined with red hold tags; production line halted' },
      { label: 'Food Safety Review',      module: 'risk',     desc: 'Food safety team assesses hazard severity, consumer exposure potential, and full batch scope' },
      { label: 'Investigation',           module: 'capa',     desc: 'Equipment calibration check, process parameter log review, environmental monitoring swabs collected' },
      { label: 'Lab Testing',             module: 'audit',    desc: 'Accelerated microbiological and chemical testing of retained samples at accredited laboratory' },
      { label: 'Recall Assessment',       module: 'risk',     desc: 'Formal assessment of whether FDA / FSSAI voluntary recall or market withdrawal is required' },
      { label: 'Product Disposition',     module: 'document', desc: 'Product released, reworked, donated, or destroyed; decision documented and signed by QA Manager' },
      { label: 'CAPA',                    module: 'capa',     desc: 'Process parameter correction, equipment repair, or supplier corrective action raised with due dates' },
      { label: 'HACCP Plan Review',       module: 'document', desc: 'Hazard analysis and HACCP plan formally reviewed and updated if CCP monitoring was found inadequate' },
      { label: 'Training',                module: 'training', desc: 'Line operators retrained on CCP monitoring procedure and corrective action response protocol' },
    ],
  },
  {
    id: 'fb-02', name: 'Allergen Cross-Contact Non-Conformance', industry: 'food',
    regulation: 'FSMA Preventive Controls · FALCPA · EU Regulation 1169/2011 · FSSAI',
    description: 'End-to-end allergen NC response from ELISA detection through recall decision, deep-clean verification, corrective action, label re-validation, and effectiveness confirmation.',
    avgCycleTime: '3–21 days', complexity: 'High',
    steps: [
      { label: 'Detection',               module: 'nc',       desc: 'Allergen detected via ELISA / lateral flow test, customer complaint, or visual inspection during production' },
      { label: 'Immediate Segregation',   module: 'nc',       desc: 'All potentially affected product quarantined with hold tags; production immediately stopped' },
      { label: 'Risk Assessment',         module: 'risk',     desc: 'Allergen severity (peanut vs. soy), threshold concentration, and full distribution scope formally assessed' },
      { label: 'Recall Assessment',       module: 'risk',     desc: 'Voluntary recall / market withdrawal decision reached per FSSAI and FDA 21 CFR §7 guidance' },
      { label: 'Regulatory Notification', module: 'system',   desc: 'FSSAI / local authority formally notified; customer and retailer alerts issued with product codes' },
      { label: 'CAPA',                    module: 'capa',     desc: 'Production scheduling change, deep-clean protocol, equipment redesign, or supplier corrective action' },
      { label: 'Sanitation Verification', module: 'audit',    desc: 'ATP bioluminescence and allergen-specific swab testing confirm line clearance before restart' },
      { label: 'Label Review',            module: 'document', desc: 'All labels, artworks, and ingredient declarations verified for correct and compliant allergen statements' },
      { label: 'Training',                module: 'training', desc: 'Allergen awareness and production scheduling procedure training completed; records signed' },
      { label: 'Effectiveness Check',     module: 'capa',     desc: '30-day allergen monitoring with zero detections confirmed; CAPA formally closed by QA' },
    ],
  },
  {
    id: 'fb-03', name: 'Food Safety Supplier Qualification', industry: 'food',
    regulation: 'FSMA §117.136 · SQF / BRCGS / ISO 22000 · FSSAI Licensing',
    description: 'Qualification of a new food ingredient or packaging material supplier — from GFSI certification verification through on-site audit, trial batch, and Approved Supplier List entry.',
    avgCycleTime: '30–60 days', complexity: 'Medium',
    steps: [
      { label: 'Supplier Request',        module: 'supplier', desc: 'Procurement submits new supplier request with material specification, intended use, and business justification' },
      { label: 'Questionnaire',           module: 'document', desc: 'Supplier completes food safety questionnaire; GFSI / SQF / BRC certification status verified' },
      { label: 'Risk Classification',     module: 'risk',     desc: 'Material risk assessed: direct food contact, allergen potential, microbiological risk level scored' },
      { label: 'Document Review',         module: 'document', desc: 'CoA, specification sheets, allergen declaration, and third-party audit certificates reviewed' },
      { label: 'On-site Audit',           module: 'audit',    desc: 'Food safety audit conducted vs. GFSI scheme or internal checklist; report issued within 10 days' },
      { label: 'Trial Batch',             module: 'nc',       desc: 'Trial production run with new supplier material; finished product tested against full specification' },
      { label: 'Supplier Agreement',      module: 'document', desc: 'Supplier quality agreement executed covering change notification obligations and spec-hold requirements' },
      { label: 'ASL Approval',            module: 'supplier', desc: 'Supplier formally added to Approved Supplier List; periodic audit and CoA review frequency set' },
    ],
  },
];

// ─── Active instances ─────────────────────────────────────────────────────────
export const ACTIVE_INSTANCES: ActiveInstance[] = [
  { id:'WF-2024-001', workflowId:'ph-01', name:'OOS/Deviation Investigation & CAPA',
    industry:'pharma', entityRef:'NC-2024-089', currentStep:4, totalSteps:11,
    currentStepLabel:'Root Cause (RCA)', assignee:'Priya Sharma',
    dueDate:'29 Apr 2024', status:'On Track' },
  { id:'WF-2024-002', workflowId:'ch-01', name:'Management of Change (MOC)',
    industry:'chemical', entityRef:'CC-2024-031', currentStep:6, totalSteps:10,
    currentStepLabel:'Implementation', assignee:'Ravi Desai',
    dueDate:'05 Apr 2024', status:'At Risk' },
  { id:'WF-2024-003', workflowId:'fb-01', name:'HACCP CCP Deviation & Disposition',
    industry:'food', entityRef:'NC-2024-112', currentStep:7, totalSteps:10,
    currentStepLabel:'Product Disposition', assignee:'Meera Nair',
    dueDate:'07 Apr 2024', status:'On Track' },
  { id:'WF-2024-004', workflowId:'ph-02', name:'Regulatory Change Control (Level 2)',
    industry:'pharma', entityRef:'CC-2024-018', currentStep:4, totalSteps:10,
    currentStepLabel:'Regulatory Filing', assignee:'Rajesh Kumar',
    dueDate:'30 Apr 2024', status:'Overdue' },
  { id:'WF-2024-005', workflowId:'ch-02', name:'Process Safety Incident Investigation',
    industry:'chemical', entityRef:'NC-2024-077', currentStep:5, totalSteps:9,
    currentStepLabel:'Root Cause (RCA)', assignee:'Leela Krishnan',
    dueDate:'12 Apr 2024', status:'On Track' },
  { id:'WF-2024-006', workflowId:'fb-02', name:'Allergen Cross-Contact NC',
    industry:'food', entityRef:'NC-2024-098', currentStep:8, totalSteps:10,
    currentStepLabel:'Label Review', assignee:'Suresh Babu',
    dueDate:'15 Apr 2024', status:'At Risk' },
  { id:'WF-2024-007', workflowId:'ch-03', name:'Environmental Compliance Exceedance',
    industry:'chemical', entityRef:'NC-2024-065', currentStep:3, totalSteps:8,
    currentStepLabel:'Root Cause', assignee:'Ravi Desai',
    dueDate:'18 Apr 2024', status:'On Track' },
  { id:'WF-2024-008', workflowId:'ph-03', name:'GMP Supplier Qualification',
    industry:'pharma', entityRef:'SUP-2024-004', currentStep:5, totalSteps:9,
    currentStepLabel:'On-site GMP Audit', assignee:'Ananya Joshi',
    dueDate:'25 Apr 2024', status:'On Track' },
];
