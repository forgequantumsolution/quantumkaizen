import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_ASSESSED';

export interface ComplianceRequirement {
  id: string;
  standard: string;
  clauseNumber: string;
  clauseTitle: string;
  clauseText: string;
  status: ComplianceStatus;
  linkedProcedures: string[];
  linkedDocuments: string[];
  linkedCAPAs: string[];
  lastAssessed: string;
  nextReview: string;
  assessor: string;
  findings: string;
  gapActions: { id: string; action: string; owner: string; dueDate: string; status: string }[];
  assessmentHistory: { date: string; assessor: string; status: ComplianceStatus; notes: string }[];
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockRequirements: ComplianceRequirement[] = [
  {
    id: 'cr1',
    standard: 'ISO 9001',
    clauseNumber: '4.1',
    clauseTitle: 'Understanding the organization and its context',
    clauseText: 'The organization shall determine external and internal issues that are relevant to its purpose and its strategic direction and that affect its ability to achieve the intended result(s) of its quality management system.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-001 Context Analysis Procedure', 'QP-002 Strategic Planning'],
    linkedDocuments: ['Context Analysis Report 2026', 'SWOT Analysis'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-15',
    nextReview: '2026-08-15',
    assessor: 'Priya Sharma',
    findings: 'Context analysis is well documented and reviewed during management review. Internal and external issues are identified and monitored.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-02-15', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'Fully compliant. Context reviewed in MRM.' },
      { date: '2025-08-10', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'No gaps identified.' },
    ],
  },
  {
    id: 'cr2',
    standard: 'ISO 9001',
    clauseNumber: '4.2',
    clauseTitle: 'Understanding the needs and expectations of interested parties',
    clauseText: 'The organization shall determine the interested parties that are relevant to the quality management system and the requirements of these interested parties.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-001 Context Analysis Procedure'],
    linkedDocuments: ['Interested Parties Register'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-15',
    nextReview: '2026-08-15',
    assessor: 'Priya Sharma',
    findings: 'Interested parties register maintained and updated quarterly.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-02-15', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'Register is current.' },
    ],
  },
  {
    id: 'cr3',
    standard: 'ISO 9001',
    clauseNumber: '5.1',
    clauseTitle: 'Leadership and commitment',
    clauseText: 'Top management shall demonstrate leadership and commitment with respect to the quality management system.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-010 Management Review Procedure'],
    linkedDocuments: ['Quality Policy', 'Management Review Minutes Q1-2026'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-01',
    nextReview: '2026-09-01',
    assessor: 'Deepak Nair',
    findings: 'Top management actively participates in MRM and quality initiatives. Quality policy is communicated.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-01', assessor: 'Deepak Nair', status: 'COMPLIANT', notes: 'Active leadership demonstrated.' },
    ],
  },
  {
    id: 'cr4',
    standard: 'ISO 9001',
    clauseNumber: '6.1',
    clauseTitle: 'Actions to address risks and opportunities',
    clauseText: 'When planning for the quality management system, the organization shall consider the issues referred to in 4.1 and the requirements referred to in 4.2 and determine the risks and opportunities that need to be addressed.',
    status: 'PARTIAL',
    linkedProcedures: ['QP-015 Risk Management Procedure'],
    linkedDocuments: ['Risk Register 2026', 'Opportunities Log'],
    linkedCAPAs: ['CAPA-2026-008'],
    lastAssessed: '2026-03-01',
    nextReview: '2026-06-01',
    assessor: 'Deepak Nair',
    findings: 'Risk register exists but not all processes have documented risk assessments. Opportunity identification needs improvement.',
    gapActions: [
      { id: 'ga1', action: 'Complete risk assessment for welding and surface treatment processes', owner: 'Vikram Patel', dueDate: '2026-04-15', status: 'IN_PROGRESS' },
      { id: 'ga2', action: 'Develop formal opportunity evaluation criteria', owner: 'Sunita Rao', dueDate: '2026-05-01', status: 'PENDING' },
    ],
    assessmentHistory: [
      { date: '2026-03-01', assessor: 'Deepak Nair', status: 'PARTIAL', notes: 'Gaps in risk assessment coverage.' },
      { date: '2025-09-15', assessor: 'Deepak Nair', status: 'PARTIAL', notes: 'Same gaps noted; action plan created.' },
    ],
  },
  {
    id: 'cr5',
    standard: 'ISO 9001',
    clauseNumber: '7.1',
    clauseTitle: 'Resources',
    clauseText: 'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the quality management system.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-020 Resource Management', 'QP-021 Infrastructure Management'],
    linkedDocuments: ['Annual Budget Plan', 'Resource Allocation Matrix'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-20',
    nextReview: '2026-08-20',
    assessor: 'Anita Desai',
    findings: 'Resources are adequately provided. New CMM machine procured for quality lab expansion.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-02-20', assessor: 'Anita Desai', status: 'COMPLIANT', notes: 'Adequate resources available.' },
    ],
  },
  {
    id: 'cr6',
    standard: 'ISO 9001',
    clauseNumber: '8.1',
    clauseTitle: 'Operational planning and control',
    clauseText: 'The organization shall plan, implement and control the processes needed to meet the requirements for the provision of products and services.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-030 Production Planning', 'QP-031 Process Control'],
    linkedDocuments: ['Control Plans', 'Work Instructions Register'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-10',
    nextReview: '2026-09-10',
    assessor: 'Vikram Patel',
    findings: 'Control plans in place for all production processes. Work instructions are current.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-10', assessor: 'Vikram Patel', status: 'COMPLIANT', notes: 'All control plans current.' },
    ],
  },
  {
    id: 'cr7',
    standard: 'ISO 9001',
    clauseNumber: '9.1',
    clauseTitle: 'Monitoring, measurement, analysis and evaluation',
    clauseText: 'The organization shall determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation needed to ensure valid results.',
    status: 'NON_COMPLIANT',
    linkedProcedures: ['QP-040 Monitoring and Measurement'],
    linkedDocuments: ['KPI Dashboard', 'Customer Satisfaction Survey'],
    linkedCAPAs: ['CAPA-2026-012', 'CAPA-2026-014'],
    lastAssessed: '2026-03-15',
    nextReview: '2026-04-15',
    assessor: 'Priya Sharma',
    findings: 'Customer satisfaction survey not conducted in Q4-2025. Process performance data for heat treatment not being analyzed systematically. Calibration records for 3 instruments are missing.',
    gapActions: [
      { id: 'ga3', action: 'Conduct overdue customer satisfaction survey', owner: 'Rajesh Kumar', dueDate: '2026-04-01', status: 'IN_PROGRESS' },
      { id: 'ga4', action: 'Implement SPC for heat treatment process', owner: 'Vikram Patel', dueDate: '2026-04-20', status: 'PENDING' },
      { id: 'ga5', action: 'Locate or recreate missing calibration records', owner: 'Anita Desai', dueDate: '2026-04-05', status: 'IN_PROGRESS' },
    ],
    assessmentHistory: [
      { date: '2026-03-15', assessor: 'Priya Sharma', status: 'NON_COMPLIANT', notes: 'Multiple gaps found during internal audit.' },
      { date: '2025-09-20', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'No issues at last assessment.' },
    ],
  },
  {
    id: 'cr8',
    standard: 'ISO 9001',
    clauseNumber: '9.2',
    clauseTitle: 'Internal audit',
    clauseText: 'The organization shall conduct internal audits at planned intervals to provide information on whether the quality management system conforms to the organization\'s own requirements and the requirements of this International Standard.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-041 Internal Audit Procedure'],
    linkedDocuments: ['Internal Audit Schedule 2026', 'Audit Reports'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-10',
    nextReview: '2026-09-10',
    assessor: 'Deepak Nair',
    findings: 'Internal audit program is on schedule. All planned audits for Q1-2026 completed.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-10', assessor: 'Deepak Nair', status: 'COMPLIANT', notes: 'Audit schedule on track.' },
    ],
  },
  {
    id: 'cr9',
    standard: 'ISO 9001',
    clauseNumber: '9.3',
    clauseTitle: 'Management review',
    clauseText: 'Top management shall review the organization\'s quality management system, at planned intervals, to ensure its continuing suitability, adequacy, effectiveness and alignment with the strategic direction of the organization.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-010 Management Review Procedure'],
    linkedDocuments: ['MRM Minutes Q1-2026', 'MRM Action Items Tracker'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-20',
    nextReview: '2026-09-20',
    assessor: 'Priya Sharma',
    findings: 'Q1-2026 management review conducted on schedule with all required inputs addressed.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-20', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'MRM conducted as planned.' },
    ],
  },
  {
    id: 'cr10',
    standard: 'ISO 9001',
    clauseNumber: '10.1',
    clauseTitle: 'Improvement - General',
    clauseText: 'The organization shall determine and select opportunities for improvement and implement any necessary actions to meet customer requirements and enhance customer satisfaction.',
    status: 'PARTIAL',
    linkedProcedures: ['QP-050 Continual Improvement', 'QP-051 CAPA Procedure'],
    linkedDocuments: ['Improvement Project Register', 'Kaizen Event Reports'],
    linkedCAPAs: ['CAPA-2026-010'],
    lastAssessed: '2026-03-05',
    nextReview: '2026-06-05',
    assessor: 'Sunita Rao',
    findings: 'CAPA process is effective. However, proactive improvement initiatives need to be better documented and tracked.',
    gapActions: [
      { id: 'ga6', action: 'Implement formal improvement project tracking system', owner: 'Deepak Nair', dueDate: '2026-05-15', status: 'PENDING' },
    ],
    assessmentHistory: [
      { date: '2026-03-05', assessor: 'Sunita Rao', status: 'PARTIAL', notes: 'Improvement tracking needs formalization.' },
      { date: '2025-09-01', assessor: 'Sunita Rao', status: 'PARTIAL', notes: 'Same observation; some progress made.' },
    ],
  },
];

// IATF 16949 additional requirements (sample)
export const mockIATFRequirements: ComplianceRequirement[] = [
  {
    id: 'iatf1', standard: 'IATF 16949', clauseNumber: '8.3.2.1', clauseTitle: 'Design and development planning - supplemental',
    clauseText: 'The organization shall ensure that design and development planning includes all affected stakeholders within the organization and, as appropriate, its supply chain.',
    status: 'COMPLIANT', linkedProcedures: ['QP-060 APQP Procedure'], linkedDocuments: ['APQP Status Report'],
    linkedCAPAs: [], lastAssessed: '2026-02-28', nextReview: '2026-08-28', assessor: 'Rajesh Kumar',
    findings: 'APQP process includes cross-functional team with supplier involvement.', gapActions: [],
    assessmentHistory: [{ date: '2026-02-28', assessor: 'Rajesh Kumar', status: 'COMPLIANT', notes: 'APQP well managed.' }],
  },
  {
    id: 'iatf2', standard: 'IATF 16949', clauseNumber: '8.5.6.1', clauseTitle: 'Control of changes - supplemental',
    clauseText: 'The organization shall have a documented process to control and react to changes that impact product realization.',
    status: 'PARTIAL', linkedProcedures: ['QP-061 Change Management'], linkedDocuments: ['Change Request Log'],
    linkedCAPAs: ['CAPA-2026-015'], lastAssessed: '2026-03-10', nextReview: '2026-06-10', assessor: 'Vikram Patel',
    findings: 'Change management process exists but supplier notification workflow needs improvement.',
    gapActions: [{ id: 'ga7', action: 'Update change notification procedure to include supplier communication', owner: 'Vikram Patel', dueDate: '2026-04-30', status: 'IN_PROGRESS' }],
    assessmentHistory: [{ date: '2026-03-10', assessor: 'Vikram Patel', status: 'PARTIAL', notes: 'Supplier notification gap.' }],
  },
];

export const mockISO14001Requirements: ComplianceRequirement[] = [
  {
    id: 'env1', standard: 'ISO 14001', clauseNumber: '6.1.2', clauseTitle: 'Environmental aspects',
    clauseText: 'The organization shall determine the environmental aspects of its activities, products and services that it can control and those that it can influence.',
    status: 'COMPLIANT', linkedProcedures: ['EP-010 Environmental Aspects Procedure'], linkedDocuments: ['Aspects Register 2026'],
    linkedCAPAs: [], lastAssessed: '2026-01-20', nextReview: '2026-07-20', assessor: 'Sunita Rao',
    findings: 'Environmental aspects register is comprehensive and current.', gapActions: [],
    assessmentHistory: [{ date: '2026-01-20', assessor: 'Sunita Rao', status: 'COMPLIANT', notes: 'All aspects identified and rated.' }],
  },
];

export const mockISO45001Requirements: ComplianceRequirement[] = [
  {
    id: 'ohs1', standard: 'ISO 45001', clauseNumber: '6.1.2.1', clauseTitle: 'Hazard identification',
    clauseText: 'The organization shall establish, implement and maintain an ongoing and proactive process for hazard identification.',
    status: 'COMPLIANT', linkedProcedures: ['HSE-010 Hazard Identification Procedure'], linkedDocuments: ['HIRA Register 2026'],
    linkedCAPAs: [], lastAssessed: '2026-02-10', nextReview: '2026-08-10', assessor: 'Deepak Nair',
    findings: 'HIRA conducted for all work areas. Updated after recent process changes.', gapActions: [],
    assessmentHistory: [{ date: '2026-02-10', assessor: 'Deepak Nair', status: 'COMPLIANT', notes: 'HIRA is current.' }],
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useComplianceRequirements(standard?: string) {
  return useQuery({
    queryKey: ['compliance', standard],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/compliance', { params: { standard } });
        if (!Array.isArray(data?.data)) throw new Error('unexpected response');
        return data;
      } catch {
        let requirements: ComplianceRequirement[];
        switch (standard) {
          case 'IATF 16949':
            requirements = mockIATFRequirements;
            break;
          case 'ISO 14001':
            requirements = mockISO14001Requirements;
            break;
          case 'ISO 45001':
            requirements = mockISO45001Requirements;
            break;
          default:
            requirements = mockRequirements;
        }
        return { data: requirements, total: requirements.length };
      }
    },
    staleTime: 30_000,
  });
}

export function useComplianceRequirement(id: string) {
  return useQuery<ComplianceRequirement>({
    queryKey: ['compliance', 'detail', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/compliance/${id}`);
        return data;
      } catch {
        const all = [...mockRequirements, ...mockIATFRequirements, ...mockISO14001Requirements, ...mockISO45001Requirements];
        const req = all.find((r) => r.id === id);
        if (!req) throw new Error('Requirement not found');
        return req;
      }
    },
    enabled: !!id,
  });
}
