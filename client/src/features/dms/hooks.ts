import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { Document, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

const flattenDoc = (d: Record<string, unknown>) => flattenUsers(d, ['owner', 'createdBy', 'updatedBy']);

// ── Mock documents ───────────────────────────────────────────────────────────

export const mockDocuments: Document[] = [
  {
    id: 'd1', documentNumber: 'SOP-QMS-001', title: 'Quality Management System Manual',
    description: 'Defines the overall QMS framework, scope, and responsibilities for the organization.',
    level: 'POLICY', status: 'PUBLISHED', category: 'Quality', department: 'Quality Assurance',
    departmentId: 'dept1', version: '3.1', owner: 'Rajesh Kumar', ownerId: 'u2',
    effectiveDate: '2025-06-01', expiryDate: '2027-06-01', reviewDate: '2026-06-01',
    tags: ['QMS', 'ISO 9001'], createdAt: '2024-03-15T10:00:00Z', updatedAt: '2025-06-01T08:00:00Z',
    changeSummary: 'Annual review with minor updates to section 5 responsibilities.',
  },
  {
    id: 'd2', documentNumber: 'SOP-MFG-003', title: 'Manufacturing Process Control Procedure',
    description: 'Standard operating procedure for monitoring and controlling critical manufacturing process parameters.',
    level: 'PROCEDURE', status: 'UNDER_REVIEW', category: 'Manufacturing', department: 'Production',
    departmentId: 'dept2', version: '2.0', owner: 'Vikram Patel', ownerId: 'u4',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['Manufacturing', 'Process Control'], createdAt: '2025-09-10T12:00:00Z', updatedAt: '2026-03-20T14:30:00Z',
    changeSummary: 'Major revision to include new production line parameters.',
  },
  {
    id: 'd3', documentNumber: 'WI-PRD-012', title: 'Assembly Line Inspection Work Instruction',
    description: 'Step-by-step work instruction for in-process inspection at assembly stations.',
    level: 'WORK_INSTRUCTION', status: 'PENDING_APPROVAL', category: 'Inspection', department: 'Production',
    departmentId: 'dept2', version: '1.2', owner: 'Priya Sharma', ownerId: 'u1',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['Inspection', 'Assembly'], createdAt: '2026-01-05T09:00:00Z', updatedAt: '2026-03-29T16:12:00Z',
    changeSummary: 'Added inspection criteria for new component variant.',
  },
  {
    id: 'd4', documentNumber: 'FRM-QC-045', title: 'Incoming Material Inspection Checklist',
    description: 'Standardized form for recording incoming raw material inspection results.',
    level: 'FORM', status: 'DRAFT', category: 'Quality Control', department: 'Quality Control',
    departmentId: 'dept3', version: '0.1', owner: 'Vikram Patel', ownerId: 'u4',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['QC', 'Incoming Inspection'], createdAt: '2026-03-29T14:55:00Z', updatedAt: '2026-03-29T14:55:00Z',
  },
  {
    id: 'd5', documentNumber: 'SOP-ENG-007', title: 'Engineering Change Request Procedure',
    description: 'Procedure for initiating, reviewing, and approving engineering change requests.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Engineering', department: 'Engineering',
    departmentId: 'dept4', version: '1.0', owner: 'Deepak Nair', ownerId: 'u6',
    effectiveDate: '2026-03-01', expiryDate: '2028-03-01', reviewDate: '2027-03-01',
    tags: ['ECR', 'Change Management'], createdAt: '2025-12-01T10:00:00Z', updatedAt: '2026-03-27T09:15:00Z',
  },
  {
    id: 'd6', documentNumber: 'POL-HSE-001', title: 'Health, Safety & Environment Policy',
    description: 'Organization-wide HSE policy statement and commitments.',
    level: 'POLICY', status: 'PUBLISHED', category: 'HSE', department: 'HSE',
    departmentId: 'dept5', version: '2.0', owner: 'Sunita Rao', ownerId: 'u5',
    effectiveDate: '2025-01-15', expiryDate: '2027-01-15', reviewDate: '2026-01-15',
    tags: ['HSE', 'Safety', 'Environment'], createdAt: '2024-11-20T08:00:00Z', updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'd7', documentNumber: 'SOP-LAB-002', title: 'Laboratory Testing Procedure',
    description: 'Standard procedure for conducting laboratory tests on finished products.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Laboratory', department: 'Quality Control',
    departmentId: 'dept3', version: '4.2', owner: 'Anita Desai', ownerId: 'u3',
    effectiveDate: '2025-08-01', expiryDate: '2027-08-01', reviewDate: '2026-08-01',
    tags: ['Lab', 'Testing'], createdAt: '2023-06-10T10:00:00Z', updatedAt: '2025-08-01T09:00:00Z',
  },
  {
    id: 'd8', documentNumber: 'EXT-STD-001', title: 'ISO 9001:2015 Standard Reference',
    description: 'External reference copy of the ISO 9001:2015 quality management standard.',
    level: 'EXTERNAL', status: 'OBSOLETE', category: 'Standards', department: 'Quality Assurance',
    departmentId: 'dept1', version: '1.0', owner: 'Rajesh Kumar', ownerId: 'u2',
    effectiveDate: '2020-01-01', expiryDate: '2025-12-31', reviewDate: null,
    tags: ['ISO', 'External'], createdAt: '2020-01-15T10:00:00Z', updatedAt: '2025-12-31T00:00:00Z',
  },
];

// ── Hooks ────────────────────────────────────────────────────────────────────

interface DocumentFilters {
  status?: string;
  level?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ['documents', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/dms/documents', { params: filters });
        return unwrapList<Document>(data, flattenDoc as any);
      } catch {
        // Mock fallback
        let filtered = [...mockDocuments];
        if (filters.status) filtered = filtered.filter((d) => d.status === filters.status);
        if (filters.level) filtered = filtered.filter((d) => d.level === filters.level);
        if (filters.department) filtered = filtered.filter((d) => d.department === filters.department);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.documentNumber.toLowerCase().includes(q),
          );
        }
        return {
          data: filtered,
          total: filtered.length,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        };
      }
    },
    staleTime: 30_000,
  });
}

export function useDocument(id: string) {
  return useQuery<Document>({
    queryKey: ['documents', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/dms/documents/${id}`);
        return unwrapItem<Document>(data, flattenDoc as any);
      } catch {
        const doc = mockDocuments.find((d) => d.id === id);
        if (!doc) throw new Error('Document not found');
        return doc;
      }
    },
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/dms/documents', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document created successfully');
    },
    onError: () => {
      toast.error('Failed to create document');
    },
  });
}

// ── Template Types ──────────────────────────────────────────────────────────

export interface TemplateVersion {
  version: string;
  date: string;
  changes: string;
  author: string;
}

export interface DocumentTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  documentLevel: string;
  author: string;
  downloads: number;
  documentsCreated: number;
  activeUsers: number;
  sections: string[];
  fields: string[];
  guidelines: string[];
  tags: string[];
  applicableDepartments?: string[];
  versions: TemplateVersion[];
  createdAt: string;
  updatedAt: string;
}

// ── Mock Template Data ──────────────────────────────────────────────────────

export const mockTemplates: DocumentTemplate[] = [
  {
    id: 'tmpl1', templateId: 'TPL-SOP-001', name: 'SOP Template - Manufacturing',
    description: 'Comprehensive Standard Operating Procedure template designed for manufacturing environments. Includes sections for purpose, scope, responsibilities, equipment, safety precautions, procedure steps, and quality checks.',
    category: 'SOPs', industry: 'Manufacturing', documentLevel: 'PROCEDURE',
    author: 'Rajesh Kumar', downloads: 234, documentsCreated: 87, activeUsers: 42,
    sections: ['Purpose & Scope', 'Definitions & Abbreviations', 'Responsibilities', 'Equipment & Materials', 'Safety Precautions', 'Procedure Steps', 'Quality Checks', 'Records & Documentation', 'Revision History'],
    fields: ['Document Number', 'Effective Date', 'Review Date', 'Department', 'Prepared By', 'Reviewed By', 'Approved By', 'Version'],
    guidelines: ['Fill in all header fields before distributing', 'Use numbered steps for procedure sections', 'Include photos or diagrams where applicable', 'Reference related SOPs using document numbers', 'Ensure all safety precautions are clearly stated'],
    tags: ['SOP', 'Manufacturing', 'Process Control'],
    versions: [
      { version: '3.0', date: '2026-02-15', changes: 'Added safety precautions section and quality checks template', author: 'Rajesh Kumar' },
      { version: '2.1', date: '2025-08-01', changes: 'Updated revision history format and added definitions section', author: 'Priya Sharma' },
      { version: '2.0', date: '2025-01-10', changes: 'Major redesign with new branding and improved layout', author: 'Rajesh Kumar' },
    ],
    createdAt: '2024-03-15T10:00:00Z', updatedAt: '2026-02-15T08:00:00Z',
  },
  {
    id: 'tmpl2', templateId: 'TPL-CAPA-001', name: 'CAPA Form Template',
    description: 'Corrective and Preventive Action form template with structured sections for root cause analysis, action planning, implementation tracking, and effectiveness verification.',
    category: 'CAPA Forms', industry: 'Quality Management', documentLevel: 'FORM',
    author: 'Anita Desai', downloads: 189, documentsCreated: 64, activeUsers: 38,
    sections: ['Issue Description', 'Containment Actions', 'Root Cause Analysis (5-Why / Fishbone)', 'Corrective Actions', 'Preventive Actions', 'Implementation Plan', 'Effectiveness Verification', 'Closure Approval'],
    fields: ['CAPA Number', 'Initiation Date', 'Source', 'Severity', 'Product/Process', 'Responsible Person', 'Target Closure Date', 'Actual Closure Date'],
    guidelines: ['Document the issue with specific measurable details', 'Complete root cause analysis before defining actions', 'Set realistic target dates for each action item', 'Include effectiveness check criteria upfront', 'Attach supporting evidence for closure'],
    tags: ['CAPA', 'Quality', 'Corrective Action', 'Root Cause'],
    versions: [
      { version: '2.0', date: '2026-01-20', changes: 'Added 5-Why and Fishbone analysis templates', author: 'Anita Desai' },
      { version: '1.0', date: '2025-04-10', changes: 'Initial template release', author: 'Anita Desai' },
    ],
    createdAt: '2025-04-10T10:00:00Z', updatedAt: '2026-01-20T14:30:00Z',
  },
  {
    id: 'tmpl3', templateId: 'TPL-AUD-001', name: 'Internal Audit Checklist',
    description: 'ISO 9001:2015 aligned internal audit checklist template covering all clauses with finding classification and evidence recording sections.',
    category: 'Checklists', industry: 'Quality Management', documentLevel: 'CHECKLIST',
    author: 'Vikram Patel', downloads: 156, documentsCreated: 52, activeUsers: 28,
    sections: ['Audit Header & Scope', 'Clause 4: Context of the Organization', 'Clause 5: Leadership', 'Clause 6: Planning', 'Clause 7: Support', 'Clause 8: Operation', 'Clause 9: Performance Evaluation', 'Clause 10: Improvement', 'Audit Summary & Findings'],
    fields: ['Audit Number', 'Audit Date', 'Auditor', 'Auditee', 'Department', 'Scope', 'Finding Type', 'Evidence Reference'],
    guidelines: ['Prepare audit plan before the audit', 'Record objective evidence for each check item', 'Classify findings as Major NC, Minor NC, or Observation', 'Discuss findings with auditee before finalizing', 'Submit report within 5 working days of audit'],
    tags: ['Audit', 'ISO 9001', 'Checklist', 'Compliance'],
    versions: [
      { version: '2.2', date: '2026-03-01', changes: 'Updated for latest ISO 9001 amendments', author: 'Vikram Patel' },
      { version: '2.1', date: '2025-09-15', changes: 'Added risk-based thinking checkpoints', author: 'Vikram Patel' },
      { version: '2.0', date: '2025-03-01', changes: 'Complete restructure per ISO 9001:2015 clauses', author: 'Rajesh Kumar' },
    ],
    createdAt: '2024-06-01T10:00:00Z', updatedAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'tmpl4', templateId: 'TPL-FRM-001', name: 'Risk Assessment Form',
    description: 'Structured risk assessment form template for identifying, evaluating, and controlling workplace and process risks using likelihood-severity matrix.',
    category: 'Forms', industry: 'HSE', documentLevel: 'FORM',
    author: 'Sunita Rao', downloads: 142, documentsCreated: 48, activeUsers: 35,
    sections: ['Risk Assessment Header', 'Hazard Identification', 'Risk Evaluation Matrix', 'Existing Controls', 'Residual Risk Rating', 'Additional Controls Required', 'Action Plan', 'Review & Sign-off'],
    fields: ['Assessment Number', 'Date', 'Location', 'Activity', 'Assessor', 'Reviewer', 'Next Review Date', 'Risk Level'],
    guidelines: ['Involve workers who perform the activity in the assessment', 'Use the 5x5 risk matrix for consistent evaluation', 'Consider both routine and non-routine activities', 'Review assessments annually or after incidents', 'Communicate findings to all affected personnel'],
    tags: ['Risk Assessment', 'HSE', 'Safety', 'Hazard'],
    versions: [
      { version: '1.2', date: '2026-02-10', changes: 'Added residual risk calculation section', author: 'Sunita Rao' },
      { version: '1.0', date: '2025-06-01', changes: 'Initial template release', author: 'Sunita Rao' },
    ],
    createdAt: '2025-06-01T10:00:00Z', updatedAt: '2026-02-10T11:00:00Z',
  },
  {
    id: 'tmpl5', templateId: 'TPL-WI-001', name: 'Work Instruction - Assembly',
    description: 'Detailed work instruction template for assembly line operations with visual aids placeholders, quality checkpoints, and troubleshooting guides.',
    category: 'Work Instructions', industry: 'Manufacturing', documentLevel: 'WORK_INSTRUCTION',
    author: 'Deepak Nair', downloads: 198, documentsCreated: 73, activeUsers: 55,
    sections: ['Purpose', 'Required Tools & Materials', 'Safety Requirements', 'Step-by-Step Instructions', 'Quality Checkpoints', 'Visual Aids / Photos', 'Troubleshooting Guide', 'Sign-off'],
    fields: ['WI Number', 'Station/Area', 'Product', 'Cycle Time', 'Prepared By', 'Approved By', 'Effective Date'],
    guidelines: ['Use clear action verbs for each step', 'Include photos or diagrams for complex steps', 'Mark critical-to-quality steps with a star symbol', 'Include torque values, temperatures, and other specifications', 'Keep language simple for shop floor readability'],
    tags: ['Work Instruction', 'Assembly', 'Manufacturing', 'Shop Floor'],
    versions: [
      { version: '2.0', date: '2026-01-15', changes: 'Added troubleshooting guide section and visual aids placeholders', author: 'Deepak Nair' },
      { version: '1.0', date: '2025-02-01', changes: 'Initial template release', author: 'Deepak Nair' },
    ],
    createdAt: '2025-02-01T10:00:00Z', updatedAt: '2026-01-15T16:00:00Z',
  },
  {
    id: 'tmpl6', templateId: 'TPL-AUD-002', name: 'Supplier Audit Report Template',
    description: 'Comprehensive supplier audit report template covering quality system evaluation, process capability assessment, and supplier rating scorecard.',
    category: 'Audit Reports', industry: 'Supply Chain', documentLevel: 'REPORT',
    author: 'Vikram Patel', downloads: 98, documentsCreated: 31, activeUsers: 18,
    sections: ['Audit Header', 'Supplier Information', 'Quality System Assessment', 'Process Capability Review', 'Product Quality Data', 'Delivery Performance', 'Corrective Actions Status', 'Overall Rating & Recommendation', 'Attachments'],
    fields: ['Report Number', 'Audit Date', 'Supplier Name', 'Supplier Code', 'Auditor', 'Rating Score', 'Recommendation'],
    guidelines: ['Schedule audits at least 2 weeks in advance', 'Share the audit plan with the supplier beforehand', 'Use the standardized scoring criteria for ratings', 'Include evidence photos for non-conformances', 'Follow up on open corrective actions from previous audits'],
    tags: ['Supplier Audit', 'Report', 'Supply Chain', 'Quality'],
    versions: [
      { version: '1.1', date: '2025-11-20', changes: 'Added supplier scorecard section', author: 'Vikram Patel' },
      { version: '1.0', date: '2025-05-01', changes: 'Initial template release', author: 'Rajesh Kumar' },
    ],
    createdAt: '2025-05-01T10:00:00Z', updatedAt: '2025-11-20T13:00:00Z',
  },
  {
    id: 'tmpl7', templateId: 'TPL-CHK-001', name: 'Incoming Inspection Checklist',
    description: 'Standardized incoming material inspection checklist template for raw materials and components with acceptance criteria and disposition options.',
    category: 'Checklists', industry: 'Quality Control', documentLevel: 'CHECKLIST',
    author: 'Priya Sharma', downloads: 167, documentsCreated: 58, activeUsers: 40,
    sections: ['Material Information', 'Visual Inspection', 'Dimensional Checks', 'Material Test Reports (MTR) Verification', 'Certificate of Analysis (CoA) Review', 'Sampling Plan', 'Disposition Decision', 'Inspector Sign-off'],
    fields: ['Inspection Number', 'PO Number', 'Supplier', 'Material Code', 'Batch/Lot Number', 'Quantity Received', 'Inspector', 'Disposition'],
    guidelines: ['Verify material against purchase order specifications', 'Use calibrated instruments for dimensional checks', 'Record lot/batch numbers for traceability', 'Quarantine non-conforming materials immediately', 'Attach MTR/CoA copies to inspection records'],
    tags: ['Inspection', 'Incoming', 'QC', 'Checklist'],
    versions: [
      { version: '3.0', date: '2026-03-10', changes: 'Added sampling plan section per AQL standards', author: 'Priya Sharma' },
      { version: '2.0', date: '2025-07-15', changes: 'Added MTR/CoA verification sections', author: 'Priya Sharma' },
    ],
    createdAt: '2024-09-01T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z',
  },
  {
    id: 'tmpl8', templateId: 'TPL-SOP-002', name: 'SOP Template - Laboratory Testing',
    description: 'Laboratory testing SOP template with sections for test method, sample preparation, equipment calibration, result recording, and acceptance criteria.',
    category: 'SOPs', industry: 'Laboratory', documentLevel: 'PROCEDURE',
    author: 'Anita Desai', downloads: 121, documentsCreated: 45, activeUsers: 22,
    sections: ['Purpose & Scope', 'References & Standards', 'Equipment & Reagents', 'Sample Preparation', 'Test Procedure', 'Calculations & Results', 'Acceptance Criteria', 'Out-of-Specification Handling', 'Records'],
    fields: ['SOP Number', 'Test Method', 'Product/Material', 'Equipment Used', 'Analyst', 'Reviewed By', 'Version', 'Effective Date'],
    guidelines: ['Reference applicable ASTM/ISO test methods', 'Document all equipment calibration status', 'Include sample preparation steps with exact quantities', 'Define OOS investigation procedure', 'Record all raw data in laboratory notebook'],
    tags: ['SOP', 'Laboratory', 'Testing', 'Quality Control'],
    versions: [
      { version: '1.1', date: '2025-12-01', changes: 'Added OOS handling section', author: 'Anita Desai' },
      { version: '1.0', date: '2025-03-15', changes: 'Initial template release', author: 'Anita Desai' },
    ],
    createdAt: '2025-03-15T10:00:00Z', updatedAt: '2025-12-01T09:00:00Z',
  },
  {
    id: 'tmpl9', templateId: 'TPL-FRM-002', name: 'Deviation Report Form',
    description: 'Deviation report form template for documenting planned and unplanned deviations from standard procedures, including impact assessment and disposition.',
    category: 'Forms', industry: 'Quality Management', documentLevel: 'FORM',
    author: 'Rajesh Kumar', downloads: 134, documentsCreated: 42, activeUsers: 30,
    sections: ['Deviation Description', 'Classification (Planned/Unplanned)', 'Impact Assessment', 'Root Cause (if applicable)', 'Immediate Actions Taken', 'Product/Batch Disposition', 'Corrective Actions Required', 'Approval & Closure'],
    fields: ['Deviation Number', 'Date Reported', 'Reporter', 'Department', 'Product/Process', 'Severity', 'Status', 'Closure Date'],
    guidelines: ['Report deviations within 24 hours of occurrence', 'Classify severity based on product impact', 'For critical deviations, initiate CAPA immediately', 'Include batch/lot numbers for affected products', 'Obtain QA approval before closing the deviation'],
    tags: ['Deviation', 'Quality', 'Non-conformance', 'Form'],
    versions: [
      { version: '2.1', date: '2026-02-28', changes: 'Added impact assessment matrix', author: 'Rajesh Kumar' },
      { version: '2.0', date: '2025-08-20', changes: 'Restructured for better workflow alignment', author: 'Rajesh Kumar' },
    ],
    createdAt: '2024-12-01T10:00:00Z', updatedAt: '2026-02-28T15:00:00Z',
  },
  {
    id: 'tmpl10', templateId: 'TPL-WI-002', name: 'Equipment Maintenance Work Instruction',
    description: 'Preventive and corrective maintenance work instruction template for production equipment including safety lockout/tagout procedures and spare parts reference.',
    category: 'Work Instructions', industry: 'Manufacturing', documentLevel: 'WORK_INSTRUCTION',
    author: 'Deepak Nair', downloads: 88, documentsCreated: 29, activeUsers: 20,
    sections: ['Equipment Information', 'Safety - LOTO Procedure', 'Required Tools & Spare Parts', 'Preventive Maintenance Steps', 'Corrective Maintenance Procedures', 'Post-Maintenance Verification', 'Maintenance Log', 'Sign-off'],
    fields: ['WI Number', 'Equipment ID', 'Equipment Name', 'Location', 'Maintenance Type', 'Technician', 'Date', 'Next Scheduled Maintenance'],
    guidelines: ['Always follow LOTO procedures before maintenance', 'Refer to OEM manual for torque specifications', 'Record all spare parts used with part numbers', 'Perform post-maintenance verification before restart', 'Update maintenance log in the CMMS system'],
    tags: ['Maintenance', 'Equipment', 'Work Instruction', 'LOTO'],
    versions: [
      { version: '1.0', date: '2025-09-01', changes: 'Initial template release with LOTO integration', author: 'Deepak Nair' },
    ],
    createdAt: '2025-09-01T10:00:00Z', updatedAt: '2025-09-01T10:00:00Z',
  },
];

// ── Template Hooks ──────────────────────────────────────────────────────────

interface TemplateFilters {
  search?: string;
  category?: string;
}

export function useTemplates(filters: TemplateFilters = {}) {
  const data = useMemo(() => {
    let filtered = [...mockTemplates];
    if (filters.category) {
      filtered = filtered.filter((t) => t.category === filters.category);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.templateId.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [filters.search, filters.category]);

  return { data, isLoading: false };
}

export function useTemplate(id: string) {
  const data = useMemo(() => mockTemplates.find((t) => t.id === id) ?? null, [id]);
  return { data, isLoading: false };
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  category: string;
  documentLevel: string;
  industry: string;
  applicableDepartments: string[];
  tags?: string[];
}

export function useCreateTemplate() {
  const [isLoading, setIsLoading] = React.useState(false);

  const mutateAsync = async (payload: CreateTemplatePayload): Promise<DocumentTemplate> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const newTemplate: DocumentTemplate = {
      id: `tmpl-${Date.now()}`,
      templateId: `TPL-${payload.category.toUpperCase().slice(0, 3)}-${String(mockTemplates.length + 1).padStart(3, '0')}`,
      name: payload.name,
      description: payload.description ?? '',
      category: payload.category,
      documentLevel: payload.documentLevel as DocumentTemplate['documentLevel'],
      industry: payload.industry,
      applicableDepartments: payload.applicableDepartments,
      downloads: 0,
      documentsCreated: 0,
      activeUsers: 0,
      author: 'You',
      sections: [],
      fields: [],
      guidelines: [],
      tags: payload.tags ?? [],
      versions: [{ version: '1.0', date: new Date().toISOString().slice(0, 10), changes: 'Initial version', author: 'You' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockTemplates.push(newTemplate);
    setIsLoading(false);
    return newTemplate;
  };

  return { mutateAsync, isLoading };
}
