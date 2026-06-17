import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';
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

// Medical-device DMS register — ISO 13485 / 21 CFR 820 controlled docs.
export const mockMedicalDeviceDocuments: Document[] = [
  {
    id: 'md-d1', documentNumber: 'MD-QM-2025', title: 'Quality Manual — FQ MedTech Pvt. Ltd.',
    description: 'Top-tier ISO 13485:2016 / 21 CFR 820 / EU MDR Annex IX QMS manual for the FQ MedTech tenant.',
    level: 'POLICY', status: 'PUBLISHED', category: 'QMS', department: 'Quality Assurance',
    departmentId: 'dept-md-qa', version: '4.0', owner: 'Dr. Anjali Verma', ownerId: 'u-md1',
    effectiveDate: '2025-11-01', expiryDate: '2027-10-31', reviewDate: '2026-11-01',
    tags: ['ISO 13485', '21 CFR 820', 'EU MDR'], createdAt: '2024-10-01T10:00:00Z', updatedAt: '2025-11-01T09:00:00Z',
    changeSummary: 'Major revision: integrated EU MDR Annex IX requirements and PRRC role',
  },
  {
    id: 'md-d2', documentNumber: 'SOP-MD-DC-01', title: 'Design Control Procedure',
    description: 'Design and development planning, inputs, outputs, verification, validation and transfer per ISO 13485 §7.3 and 21 CFR 820.30.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Design Controls', department: 'Design Controls',
    departmentId: 'dept-md-dc', version: '2.3', owner: 'Aditya Menon', ownerId: 'u-md6',
    effectiveDate: '2025-08-15', expiryDate: '2027-08-14', reviewDate: '2026-08-15',
    tags: ['Design Controls', 'ISO 13485', '21 CFR 820'], createdAt: '2023-04-10T10:00:00Z', updatedAt: '2025-08-15T09:00:00Z',
  },
  {
    id: 'md-d3', documentNumber: 'SOP-MD-EOS-01', title: 'EO Sterilization Process Control',
    description: 'Process parameters, alarm matrix, post-maintenance qualification and aeration cycle per ISO 11135.',
    level: 'PROCEDURE', status: 'UNDER_REVIEW', category: 'Sterilization', department: 'Sterilization',
    departmentId: 'dept-md-ster', version: '3.0', owner: 'Karthik Iyer', ownerId: 'u-md2',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['EO Sterilization', 'ISO 11135'], createdAt: '2023-06-20T09:00:00Z', updatedAt: '2026-04-10T11:00:00Z',
    changeSummary: 'Revision to require two-person sign-off post-maintenance + extended aeration to 14h',
  },
  {
    id: 'md-d4', documentNumber: 'DHF-DEV-MD-027', title: 'Design History File — Smart Infusion Pump v3.x',
    description: 'Complete Design History File for Class IIb smart infusion pump including DP, DI/DO, DV, DVa, risk file and transfer records.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'DHF', department: 'Design Controls',
    departmentId: 'dept-md-dc', version: '3.5', owner: 'Aditya Menon', ownerId: 'u-md6',
    effectiveDate: '2025-09-01', expiryDate: null, reviewDate: '2026-09-01',
    tags: ['DHF', 'IEC 62304', 'IEC 62366'], createdAt: '2022-08-12T10:00:00Z', updatedAt: '2026-04-05T15:30:00Z',
    changeSummary: 'v3.5: incorporated firmware fixed-point dosage refactor per CR-MD-2026-0014',
  },
  {
    id: 'md-d5', documentNumber: 'RMF-ISO14971-v3', title: 'Risk Management File — Infusion Pump Family',
    description: 'ISO 14971:2019 risk management file covering hazard analysis, risk evaluation, controls, residual risk and overall benefit-risk analysis.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Risk Management', department: 'Design Controls',
    departmentId: 'dept-md-dc', version: '3.1', owner: 'Aditya Menon', ownerId: 'u-md6',
    effectiveDate: '2025-12-10', expiryDate: null, reviewDate: '2026-12-10',
    tags: ['ISO 14971', 'Risk'], createdAt: '2023-06-10T10:00:00Z', updatedAt: '2025-12-10T09:00:00Z',
  },
  {
    id: 'md-d6', documentNumber: 'WI-MD-CLR-019', title: 'Class 7 Cleanroom Gowning Work Instruction',
    description: 'Step-by-step gowning sequence for Class 7 aseptic assembly area per ISO 14644.',
    level: 'WORK_INSTRUCTION', status: 'PUBLISHED', category: 'Cleanroom', department: 'Cleanroom Assembly',
    departmentId: 'dept-md-cr', version: '2.2', owner: 'Neha Bansal', ownerId: 'u-md3',
    effectiveDate: '2025-12-15', expiryDate: '2027-12-14', reviewDate: '2026-12-15',
    tags: ['Cleanroom', 'ISO 14644'], createdAt: '2024-01-15T09:00:00Z', updatedAt: '2025-12-15T11:00:00Z',
  },
  {
    id: 'md-d7', documentNumber: 'FRM-MD-UDI-001', title: 'UDI Print/Verify Release Form',
    description: 'End-of-line UDI verification form recording GS1 scan result, operator and reviewer.',
    level: 'FORM', status: 'PUBLISHED', category: 'UDI', department: 'Packaging',
    departmentId: 'dept-md-pkg', version: '1.4', owner: 'Rohit Khanna', ownerId: 'u-md4',
    effectiveDate: '2026-04-15', expiryDate: '2028-04-14', reviewDate: '2027-04-15',
    tags: ['UDI', '21 CFR 830', 'EU MDR'], createdAt: '2025-02-10T09:00:00Z', updatedAt: '2026-04-15T13:00:00Z',
  },
  {
    id: 'md-d8', documentNumber: 'SOP-MD-PMS-02', title: 'Post-Market Clinical Follow-Up (PMCF) Process',
    description: 'Continuous PMCF process aligned with EU MDR Annex XIV Part B and ISO 13485 §8.2.1 feedback.',
    level: 'PROCEDURE', status: 'PENDING_APPROVAL', category: 'PMS', department: 'Post-Market Surveillance',
    departmentId: 'dept-md-pms', version: '2.0', owner: 'Sneha Kapoor', ownerId: 'u-md5',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['PMCF', 'EU MDR', 'Vigilance'], createdAt: '2025-08-22T09:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
    changeSummary: 'v2.0: introduced quantitative FSN-trend thresholds per product family (closes MD-F3)',
  },
  {
    id: 'md-d9', documentNumber: 'TF-510K-MD-2023', title: '510(k) Technical File — IOL-25 Series',
    description: 'FDA 510(k) submission technical file for the IOL-25 series intraocular lens family.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Regulatory', department: 'Regulatory Affairs',
    departmentId: 'dept-md-ra', version: '1.0', owner: 'Sneha Kapoor', ownerId: 'u-md5',
    effectiveDate: '2023-12-18', expiryDate: null, reviewDate: '2027-12-18',
    tags: ['510(k)', 'IOL', 'FDA'], createdAt: '2023-08-01T10:00:00Z', updatedAt: '2024-02-01T09:00:00Z',
  },
  {
    id: 'md-d10', documentNumber: 'VMP-MD-2025-04', title: 'Validation Master Plan — Sterilization & Aseptic Assembly',
    description: 'Master plan for ongoing process validation, requalification and revalidation triggers for sterile-product processes.',
    level: 'POLICY', status: 'PUBLISHED', category: 'Validation', department: 'Quality Assurance',
    departmentId: 'dept-md-qa', version: '4.0', owner: 'Dr. Anjali Verma', ownerId: 'u-md1',
    effectiveDate: '2025-07-01', expiryDate: '2027-06-30', reviewDate: '2026-07-01',
    tags: ['Validation', 'Sterilization'], createdAt: '2023-05-05T10:00:00Z', updatedAt: '2025-07-01T09:00:00Z',
  },
  // ── Disposables product family ──────────────────────────────────────────
  {
    id: 'md-d11', documentNumber: 'DHF-DEV-MD-DSY-026', title: 'Design History File — 5 mL Disposable Syringe Family (DSY-26)',
    description: 'DHF for the 5 mL disposable syringe family — design plan, inputs, outputs, V&V, transfer to production, risk file linkage and CE-mark / 510(k) submission package.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'DHF', department: 'Design Controls',
    departmentId: 'dept-md-dc', version: '2.1', owner: 'Aditya Menon', ownerId: 'u-md6',
    effectiveDate: '2024-09-12', expiryDate: null, reviewDate: '2026-09-12',
    tags: ['DHF', 'Disposable Syringe', 'ISO 11608'], createdAt: '2023-02-04T10:00:00Z', updatedAt: '2026-04-08T15:30:00Z',
    changeSummary: 'v2.1: silicone-oil dose-control failure mode added post NC-MD-2026-0037',
  },
  {
    id: 'md-d12', documentNumber: 'SOP-MD-NDL-04', title: 'Hypodermic Needle Hub Assembly SOP (NAM Lines)',
    description: 'Process controls for UV bonding of cannula to hub, pin-bend straightening, lubricant application and blister sealing on NAM-01 to NAM-06 lines.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Manufacturing', department: 'Needle Manufacturing',
    departmentId: 'dept-md-ndl', version: '3.2', owner: 'Rohit Khanna', ownerId: 'u-md4',
    effectiveDate: '2025-06-18', expiryDate: '2027-06-17', reviewDate: '2026-06-18',
    tags: ['Hypodermic Needle', 'ASTM F1816', 'NAM'], createdAt: '2023-09-25T10:00:00Z', updatedAt: '2025-06-18T09:00:00Z',
  },
  {
    id: 'md-d13', documentNumber: 'WI-MD-DSY-12', title: 'Disposable Syringe — Plunger Lubrication Work Instruction',
    description: 'Step-by-step instructions for silicone-oil spray application on Line DSY-3 with HMI lock-out, dose-weight verification and operator sign-off.',
    level: 'WORK_INSTRUCTION', status: 'PUBLISHED', category: 'Manufacturing', department: 'Cleanroom Assembly',
    departmentId: 'dept-md-cr', version: '1.4', owner: 'Rohit Khanna', ownerId: 'u-md4',
    effectiveDate: '2026-04-15', expiryDate: '2028-04-14', reviewDate: '2027-04-15',
    tags: ['Disposable Syringe', 'Lubrication', 'USP <788>'], createdAt: '2024-01-10T09:00:00Z', updatedAt: '2026-04-15T13:00:00Z',
    changeSummary: 'v1.4: HMI recipe lock; dose-weight verification every 5 000th unit (CAPA-MD-2026-0021)',
  },
  {
    id: 'md-d14', documentNumber: 'DHF-DEV-MD-AD-001', title: 'Design History File — Auto-disable Syringe (ADS-26)',
    description: 'DHF for WHO PQS-compliant auto-disable syringes used in immunization programs; covers plunger-lock mechanism, IFU, biocompatibility and PQS E13/IM01.3 verification.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'DHF', department: 'Design Controls',
    departmentId: 'dept-md-dc', version: '1.3', owner: 'Aditya Menon', ownerId: 'u-md6',
    effectiveDate: '2024-11-22', expiryDate: null, reviewDate: '2026-11-22',
    tags: ['DHF', 'AD-Syringe', 'WHO PQS'], createdAt: '2023-06-01T10:00:00Z', updatedAt: '2026-04-10T11:00:00Z',
  },
  {
    id: 'md-d15', documentNumber: 'SOP-MD-FCT-02', title: 'Foley Catheter Silicone Dip-Moulding SOP',
    description: 'Process controls for silicone-bath temperature, dwell time, dip-count and burst-volume QA on FCT-MC lines; thermocouple calibration tightened to 3-monthly.',
    level: 'PROCEDURE', status: 'UNDER_REVIEW', category: 'Manufacturing', department: 'Production',
    departmentId: 'dept-md-prod', version: '2.5', owner: 'Karthik Iyer', ownerId: 'u-md2',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['Foley Catheter', 'ISO 20696', 'Dip Moulding'], createdAt: '2024-02-12T10:00:00Z', updatedAt: '2026-04-13T11:00:00Z',
    changeSummary: 'v2.5: thermocouple calibration moved from 12 → 3-monthly (post NC-MD-2026-0033)',
  },
];

// Dairy tenant — FSSAI / ISO 22000 / HACCP controlled documents.
export const mockDairyDocuments: Document[] = [
  {
    id: 'dy-d1', documentNumber: 'DY-QM-2025', title: 'Food Safety Quality Manual',
    description: 'Top-tier FSSAI / ISO 22000:2018 quality manual covering FSMS scope, leadership, hazard analysis, PRPs, OPRPs and HACCP plan governance.',
    level: 'POLICY', status: 'PUBLISHED', category: 'QMS', department: 'Quality Assurance',
    departmentId: 'dept-dy-qa', version: '5.0', owner: 'Sandeep Joshi', ownerId: 'u-dy1',
    effectiveDate: '2025-10-01', expiryDate: '2027-09-30', reviewDate: '2026-10-01',
    tags: ['FSSAI', 'ISO 22000', 'FSMS'], createdAt: '2023-08-01T10:00:00Z', updatedAt: '2025-10-01T09:00:00Z',
    changeSummary: 'v5.0: aligned with FSSAI Eat Right amendments and ISO 22000:2018 revisions',
  },
  {
    id: 'dy-d2', documentNumber: 'HACCP-PLAN-MILK-v6', title: 'HACCP Plan — Liquid Milk (Toned, Full-cream, Double-toned)',
    description: 'Hazard analysis and CCPs for liquid milk: raw-milk reception (antibiotic residue, AfM1), pasteurization (HTST 72 °C / 15 s), post-pasteurization handling, packaging and cold-chain distribution.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'HACCP', department: 'Quality Assurance',
    departmentId: 'dept-dy-qa', version: '6.0', owner: 'Sandeep Joshi', ownerId: 'u-dy1',
    effectiveDate: '2026-05-12', expiryDate: '2028-05-11', reviewDate: '2027-05-12',
    tags: ['HACCP', 'Milk', 'FSSAI 2.1.1'], createdAt: '2023-06-12T10:00:00Z', updatedAt: '2026-05-12T15:30:00Z',
    changeSummary: 'v6.0: added pre-monsoon AfM1 sampling CCP (CAPA-DY-2026-0019)',
  },
  {
    id: 'dy-d3', documentNumber: 'HACCP-PLAN-CURD-v3', title: 'HACCP Plan — Set Curd / Dahi',
    description: 'Hazards and CCPs for set curd: starter culture inoculation, fermentation control, CIP between batches, cup-filling sealing.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'HACCP', department: 'Quality Assurance',
    departmentId: 'dept-dy-qa', version: '3.0', owner: 'Anita Kulkarni', ownerId: 'u-dy3',
    effectiveDate: '2025-11-15', expiryDate: '2027-11-14', reviewDate: '2026-11-15',
    tags: ['HACCP', 'Curd'], createdAt: '2023-11-10T10:00:00Z', updatedAt: '2025-11-15T11:00:00Z',
  },
  {
    id: 'dy-d4', documentNumber: 'HACCP-PLAN-GHEE-v2', title: 'HACCP Plan — Ghee (Cow + Buffalo)',
    description: 'Hazards and CCPs for ghee: butter ageing, clarification kettle temperature, FFA monitoring (NMT 3.0% per IS 3508), tin filling and sealing.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'HACCP', department: 'Quality Assurance',
    departmentId: 'dept-dy-qa', version: '2.0', owner: 'Ravi Deshmukh', ownerId: 'u-dy4',
    effectiveDate: '2026-03-30', expiryDate: '2028-03-29', reviewDate: '2027-03-30',
    tags: ['HACCP', 'Ghee', 'BIS IS 3508'], createdAt: '2024-01-12T10:00:00Z', updatedAt: '2026-03-30T11:00:00Z',
    changeSummary: 'v2.0: tightened butter-to-ghee turnaround to 48 h (CAPA from NC-DY-2026-0029)',
  },
  {
    id: 'dy-d5', documentNumber: 'SOP-DY-PAST-03', title: 'HTST Pasteurization SOP (PHE-01 / PHE-02)',
    description: 'Operating SOP for HTST pasteurization — feed temperature, holding-tube residence-time, divert valve actuation, phosphatase verification and CIP between batches.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Manufacturing', department: 'Pasteurization',
    departmentId: 'dept-dy-past', version: '3.2', owner: 'Ravi Deshmukh', ownerId: 'u-dy4',
    effectiveDate: '2026-05-05', expiryDate: '2028-05-04', reviewDate: '2027-05-05',
    tags: ['Pasteurization', 'FSSAI 2.1.1'], createdAt: '2023-07-18T10:00:00Z', updatedAt: '2026-05-05T13:00:00Z',
    changeSummary: 'v3.2: mandatory dual-temperature verification post NC-DY-2026-0038',
  },
  {
    id: 'dy-d6', documentNumber: 'SOP-DY-PROC-04', title: 'Raw-Milk Acceptance & Antibiotic Screening SOP',
    description: 'Procedure for raw-milk reception at the dock — temperature check, organoleptic, fat / SNF on Lactoscan, COB / alcohol test, antibiotic dipstick, AfM1 sampling cadence.',
    level: 'PROCEDURE', status: 'UNDER_REVIEW', category: 'QC', department: 'Receiving Dock',
    departmentId: 'dept-dy-dock', version: '4.0', owner: 'Sandeep Joshi', ownerId: 'u-dy1',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['Raw Milk', 'FSSAI 2.3.4', 'AfM1'], createdAt: '2023-09-25T10:00:00Z', updatedAt: '2026-05-14T11:00:00Z',
    changeSummary: 'v4.0 draft: risk-based AfM1 sampling tied to season + recent history (CAPA-DY-2026-0019)',
  },
  {
    id: 'dy-d7', documentNumber: 'SOP-DY-CIP-02', title: 'Clean-In-Place (CIP) SOP',
    description: 'CIP cycles for milk pipework, pasteurizer, fermentation tanks, filling-line product loop — water rinse → alkali → water rinse → acid → final water rinse + ATP-swab verification.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Manufacturing', department: 'Production',
    departmentId: 'dept-dy-prod', version: '2.5', owner: 'Priya Khanna', ownerId: 'u-dy5',
    effectiveDate: '2026-05-15', expiryDate: '2028-05-14', reviewDate: '2027-05-15',
    tags: ['CIP', 'Sanitation'], createdAt: '2024-02-20T10:00:00Z', updatedAt: '2026-05-15T11:00:00Z',
    changeSummary: 'v2.5: pre-shift ATP-swab verification + HMI recipe lock (CAPA-DY-2026-0018)',
  },
  {
    id: 'dy-d8', documentNumber: 'BMR-FM-CHOC-200', title: 'Batch Manufacturing Record — Chocolate Flavoured Milk 200 ml',
    description: 'BMR template for chocolate flavoured milk 200 ml — recipe sheet, dosing, homogenization, UHT, aseptic packaging, release testing.',
    level: 'FORM', status: 'PUBLISHED', category: 'Manufacturing', department: 'Production',
    departmentId: 'dept-dy-prod', version: '1.8', owner: 'Sunita Borade', ownerId: 'u-dy6',
    effectiveDate: '2025-08-12', expiryDate: '2027-08-11', reviewDate: '2026-08-12',
    tags: ['Flavoured Milk', 'BMR'], createdAt: '2024-03-04T10:00:00Z', updatedAt: '2025-08-12T11:00:00Z',
  },
  {
    id: 'dy-d9', documentNumber: 'SOP-DY-LAB-08', title: 'Aflatoxin M1 ELISA Analysis SOP',
    description: 'Procedure for ELISA-based AfM1 quantification in raw and processed milk per FSSAI 2.3.5 limit of 0.5 µg/kg.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Laboratory', department: 'Microbiology Lab',
    departmentId: 'dept-dy-micro', version: '2.0', owner: 'Anita Kulkarni', ownerId: 'u-dy3',
    effectiveDate: '2025-04-10', expiryDate: '2027-04-09', reviewDate: '2026-04-10',
    tags: ['Aflatoxin M1', 'ELISA', 'FSSAI 2.3.5'], createdAt: '2023-12-08T10:00:00Z', updatedAt: '2025-04-10T09:00:00Z',
  },
  {
    id: 'dy-d10', documentNumber: 'SOP-DY-LABEL-04', title: 'Pre-Packaged Food Labelling SOP',
    description: 'Label generation, artwork approval, FSSAI logo + licence number, ingredient list, nutritional info, vegetarian symbol, MRP / best-before date setting.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Packaging', department: 'Packaging',
    departmentId: 'dept-dy-pkg', version: '4.2', owner: 'Priya Khanna', ownerId: 'u-dy5',
    effectiveDate: '2025-10-20', expiryDate: '2027-10-19', reviewDate: '2026-10-20',
    tags: ['Labelling', 'FSSAI Labelling 2020'], createdAt: '2023-02-22T10:00:00Z', updatedAt: '2025-10-20T11:00:00Z',
  },
  {
    id: 'dy-d11', documentNumber: 'SOP-DY-COLD-04', title: 'Cold Chain SOP — Refrigerated Transport',
    description: 'Pre-loading, in-transit and depot temperature monitoring for refrigerated vans and tankers. IoT logger procedure and alert escalation.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Distribution', department: 'Cold Chain',
    departmentId: 'dept-dy-cold', version: '3.0', owner: 'Priya Khanna', ownerId: 'u-dy5',
    effectiveDate: '2026-02-15', expiryDate: '2028-02-14', reviewDate: '2027-02-15',
    tags: ['Cold Chain', 'Logistics'], createdAt: '2024-05-04T10:00:00Z', updatedAt: '2026-02-15T11:00:00Z',
    changeSummary: 'v3.0: IoT logger + GSM-alert workflow (CR-DY-2026-0006)',
  },
  {
    id: 'dy-d12', documentNumber: 'FSSAI-LIC-2024', title: 'FSSAI Central Licence Certificate (Renewed 2024)',
    description: 'Central FSSAI Licence — manufacturing of milk and milk products, valid 2024-06-18 to 2029-06-17. Includes amended product schedule (sweets, ice-cream).',
    level: 'EXTERNAL', status: 'PUBLISHED', category: 'Regulatory', department: 'Regulatory Affairs',
    departmentId: 'dept-dy-reg', version: '1.0', owner: 'Sandeep Joshi', ownerId: 'u-dy1',
    effectiveDate: '2024-06-18', expiryDate: '2029-06-17', reviewDate: '2027-06-18',
    tags: ['FSSAI Licence'], createdAt: '2024-06-18T10:00:00Z', updatedAt: '2024-06-18T10:00:00Z',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE).
// Drug-substance + aseptic cartridge fill-finish (insulin, analogues, GLP-1).
// EU GMP Annex 1 / 21 CFR Part 11 / FDA BLA controlled documents.
export const mockBiologicsDocuments: Document[] = [
  {
    id: 'bio-d1', documentNumber: 'SOP-BIO-0001', title: 'Sterility Assurance & Aseptic Processing SOP',
    description: 'Governing SOP for sterility assurance across drug-substance and aseptic cartridge fill-finish, aligned with EU GMP Annex 1 (2022) and PIC/S.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Sterility Assurance', department: 'Aseptic Fill-Finish',
    departmentId: 'dept-bio-aff', version: '4.0', owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1',
    effectiveDate: '2025-09-01', expiryDate: '2027-08-31', reviewDate: '2026-09-01',
    tags: ['Annex 1', 'Sterility Assurance', 'Aseptic'], createdAt: '2024-05-10T10:00:00Z', updatedAt: '2025-09-01T09:00:00Z',
    changeSummary: 'v4.0: incorporated EU GMP Annex 1 (2022) revision and Contamination Control Strategy linkage',
  },
  {
    id: 'bio-d2', documentNumber: 'VAL-BIO-0012', title: 'Aseptic Process Validation Protocol (Annex 1)',
    description: 'Process validation protocol for the cartridge aseptic fill-finish line covering line clearance, intervention matrix, and acceptance criteria per Annex 1.',
    level: 'PROCEDURE', status: 'UNDER_REVIEW', category: 'Validation', department: 'Validation',
    departmentId: 'dept-bio-val', version: '2.1', owner: 'Omar Al-Farsi', ownerId: 'u-bio2',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['Annex 1', 'Process Validation', 'Aseptic'], createdAt: '2024-11-02T09:00:00Z', updatedAt: '2026-04-18T11:00:00Z',
    changeSummary: 'v2.1 draft: added worst-case intervention matrix and revised acceptance criteria',
  },
  {
    id: 'bio-d3', documentNumber: 'VAL-BIO-0018', title: 'Media Fill Qualification Report — Cartridge Line FF-02',
    description: 'Aseptic Process Simulation (media fill) qualification report for cartridge fill-finish line FF-02; 3 consecutive runs, zero contaminated units accepted.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Validation', department: 'Aseptic Fill-Finish',
    departmentId: 'dept-bio-aff', version: '1.0', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3',
    effectiveDate: '2025-12-05', expiryDate: null, reviewDate: '2026-06-05',
    tags: ['Media Fill', 'APS', 'Annex 1'], createdAt: '2025-08-15T10:00:00Z', updatedAt: '2025-12-05T09:00:00Z',
  },
  {
    id: 'bio-d4', documentNumber: 'SOP-BIO-0007', title: 'Environmental Monitoring Program',
    description: 'Viable and non-viable environmental monitoring program for Grade A/B/C/D zones — sampling locations, frequency, alert/action limits and trending per Annex 1.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Environmental Monitoring', department: 'QC Lab',
    departmentId: 'dept-bio-qc', version: '3.2', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3',
    effectiveDate: '2025-10-15', expiryDate: '2027-10-14', reviewDate: '2026-10-15',
    tags: ['EM', 'Grade A', 'ISO 14644'], createdAt: '2023-07-20T10:00:00Z', updatedAt: '2025-10-15T11:00:00Z',
    changeSummary: 'v3.2: revised Grade A action limits to <1 CFU and added continuous viable monitoring',
  },
  {
    id: 'bio-d5', documentNumber: 'POL-BIO-0003', title: 'Contamination Control Strategy (CCS)',
    description: 'Site-level Contamination Control Strategy integrating facility, utilities, personnel, process and monitoring controls per EU GMP Annex 1 §2.',
    level: 'POLICY', status: 'PUBLISHED', category: 'Sterility Assurance', department: 'QA',
    departmentId: 'dept-bio-qa', version: '2.0', owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1',
    effectiveDate: '2025-09-01', expiryDate: '2027-08-31', reviewDate: '2026-09-01',
    tags: ['CCS', 'Annex 1', 'Contamination Control'], createdAt: '2024-06-01T10:00:00Z', updatedAt: '2025-09-01T09:00:00Z',
  },
  {
    id: 'bio-d6', documentNumber: 'BMR-BIO-0024', title: 'Cartridge Fill-Finish Batch Manufacturing Record — Insulin Glargine 3 mL',
    description: 'BMR for aseptic fill-finish of insulin glargine 3 mL cartridges — bulk thaw, sterile filtration, filling, stoppering, capping, IPC and release linkage.',
    level: 'FORM', status: 'PUBLISHED', category: 'Batch Record', department: 'Aseptic Fill-Finish',
    departmentId: 'dept-bio-aff', version: '1.6', owner: 'Yusuf Rahman', ownerId: 'u-bio4',
    effectiveDate: '2025-11-20', expiryDate: '2027-11-19', reviewDate: '2026-11-20',
    tags: ['BMR', 'Insulin Glargine', 'Fill-Finish'], createdAt: '2024-02-04T10:00:00Z', updatedAt: '2025-11-20T11:00:00Z',
    changeSummary: 'v1.6: added in-line CCIT check and revised IPC weight-check frequency',
  },
  {
    id: 'bio-d7', documentNumber: 'SOP-BIO-0011', title: 'Chromatography Purification SOP — Drug Substance',
    description: 'Operating SOP for downstream chromatography (capture, polishing) of recombinant insulin drug substance — column packing, loading, elution and CIP/sanitization.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Purification', department: 'Drug Substance',
    departmentId: 'dept-bio-ds', version: '2.4', owner: 'Omar Al-Farsi', ownerId: 'u-bio2',
    effectiveDate: '2025-07-10', expiryDate: '2027-07-09', reviewDate: '2026-07-10',
    tags: ['Chromatography', 'Downstream', 'Purification'], createdAt: '2023-09-12T10:00:00Z', updatedAt: '2025-07-10T09:00:00Z',
  },
  {
    id: 'bio-d8', documentNumber: 'VAL-BIO-0031', title: 'Cleaning Validation Report — Product-Contact Equipment',
    description: 'Cleaning validation report for shared product-contact equipment on the drug-substance suite — MACO calculation, swab/rinse recovery and worst-case product bracketing.',
    level: 'PROCEDURE', status: 'PENDING_APPROVAL', category: 'Validation', department: 'Validation',
    departmentId: 'dept-bio-val', version: '1.0', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['Cleaning Validation', 'MACO', 'TOC'], createdAt: '2025-10-30T09:00:00Z', updatedAt: '2026-05-02T11:00:00Z',
    changeSummary: 'v1.0: pending QA approval — health-based exposure limits (PDE) applied for MACO',
  },
  {
    id: 'bio-d9', documentNumber: 'SOP-BIO-0015', title: 'Cold-Chain Handling SOP — Drug Substance & Finished Cartridges',
    description: 'SOP for 2-8 °C and frozen (-20 °C / -70 °C) handling, storage, qualified shipping and excursion management for biologic drug substance and finished cartridges.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Cold Chain', department: 'QA',
    departmentId: 'dept-bio-qa', version: '3.0', owner: 'Yusuf Rahman', ownerId: 'u-bio4',
    effectiveDate: '2026-01-15', expiryDate: '2028-01-14', reviewDate: '2027-01-15',
    tags: ['Cold Chain', 'GDP', 'Stability'], createdAt: '2024-04-08T10:00:00Z', updatedAt: '2026-01-15T11:00:00Z',
    changeSummary: 'v3.0: added qualified shipper matrix and electronic temperature-excursion workflow',
  },
  {
    id: 'bio-d10', documentNumber: 'SPEC-BIO-0009', title: 'Container Closure Integrity Test Method (CCIT)',
    description: 'Analytical method and specification for deterministic CCIT (high-voltage leak detection) of filled insulin cartridges per USP <1207>.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Specification', department: 'QC Lab',
    departmentId: 'dept-bio-qc', version: '2.0', owner: 'Fatima Al-Hashimi', ownerId: 'u-bio3',
    effectiveDate: '2025-08-20', expiryDate: '2027-08-19', reviewDate: '2026-08-20',
    tags: ['CCIT', 'USP <1207>', 'Container Closure'], createdAt: '2023-11-15T10:00:00Z', updatedAt: '2025-08-20T09:00:00Z',
  },
  {
    id: 'bio-d11', documentNumber: 'SPEC-BIO-0014', title: 'Host Cell Protein (HCP) Assay Method',
    description: 'ELISA-based Host Cell Protein quantitation method and acceptance specification for recombinant drug substance release and process characterization.',
    level: 'PROCEDURE', status: 'UNDER_REVIEW', category: 'Specification', department: 'QC Lab',
    departmentId: 'dept-bio-qc', version: '1.3', owner: 'Omar Al-Farsi', ownerId: 'u-bio2',
    effectiveDate: null, expiryDate: null, reviewDate: null,
    tags: ['HCP', 'ELISA', 'Drug Substance'], createdAt: '2024-08-01T10:00:00Z', updatedAt: '2026-04-25T11:00:00Z',
    changeSummary: 'v1.3 draft: bridging to second-generation HCP antibody coverage per CR-BIO-2026-0008',
  },
  {
    id: 'bio-d12', documentNumber: 'POL-BIO-0020', title: 'Data Integrity Policy (21 CFR Part 11)',
    description: 'Site data integrity policy enforcing ALCOA+ principles, electronic records / signatures controls and audit-trail review per 21 CFR Part 11 and EU GMP Annex 11.',
    level: 'POLICY', status: 'PUBLISHED', category: 'Data Integrity', department: 'QA',
    departmentId: 'dept-bio-qa', version: '2.1', owner: 'Dr. Layla Al-Mansoori', ownerId: 'u-bio1',
    effectiveDate: '2025-11-01', expiryDate: '2027-10-31', reviewDate: '2026-11-01',
    tags: ['Data Integrity', '21 CFR Part 11', 'ALCOA+'], createdAt: '2023-10-05T10:00:00Z', updatedAt: '2025-11-01T09:00:00Z',
    changeSummary: 'v2.1: added mandatory periodic audit-trail review cadence per system criticality',
  },
  {
    id: 'bio-d13', documentNumber: 'BLA-BIO-2025-Q3', title: 'BLA Quality Module (CTD Module 3) — Insulin Drug Product',
    description: 'Chemistry, Manufacturing and Controls (CTD Module 3) content for the FDA Biologics License Application of the insulin cartridge drug product (S and P sections).',
    level: 'EXTERNAL', status: 'PUBLISHED', category: 'Regulatory', department: 'Regulatory Affairs',
    departmentId: 'dept-bio-ra', version: '1.0', owner: 'Yusuf Rahman', ownerId: 'u-bio4',
    effectiveDate: '2025-12-01', expiryDate: null, reviewDate: '2026-12-01',
    tags: ['BLA', 'CTD Module 3', 'CMC'], createdAt: '2025-06-10T10:00:00Z', updatedAt: '2025-12-01T09:00:00Z',
  },
  {
    id: 'bio-d14', documentNumber: 'SOP-BIO-0022', title: 'GLP-1 Aseptic Fill-Finish Line Clearance SOP',
    description: 'Line clearance and changeover SOP for the GLP-1 cartridge fill-finish line — reconciliation, label verification, residual checks and cross-contamination prevention.',
    level: 'PROCEDURE', status: 'PUBLISHED', category: 'Manufacturing', department: 'Aseptic Fill-Finish',
    departmentId: 'dept-bio-aff', version: '1.5', owner: 'Yusuf Rahman', ownerId: 'u-bio4',
    effectiveDate: '2026-02-10', expiryDate: '2028-02-09', reviewDate: '2027-02-10',
    tags: ['GLP-1', 'Line Clearance', 'Fill-Finish'], createdAt: '2024-09-18T10:00:00Z', updatedAt: '2026-02-10T11:00:00Z',
    changeSummary: 'v1.5: dual-sign-off line clearance + electronic reconciliation (CAPA-BIO-2026-0014)',
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
  const industry = useUserIndustry();
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ['documents', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/dms/documents', { params: filters });
        return unwrapList<Document>(data, flattenDoc as any);
      } catch {
        // Mock fallback
        const baseList = pickByIndustry(industry, mockDocuments, { medical_device: mockMedicalDeviceDocuments, dairy: mockDairyDocuments, biologics: mockBiologicsDocuments });
        let filtered = [...baseList];
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
  const industry = useUserIndustry();
  return useQuery<Document>({
    queryKey: ['documents', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/dms/documents/${id}`);
        return unwrapItem<Document>(data, flattenDoc as any);
      } catch {
        const baseList = pickByIndustry(industry, mockDocuments, { medical_device: mockMedicalDeviceDocuments, dairy: mockDairyDocuments, biologics: mockBiologicsDocuments });
        const doc = baseList.find((d) => d.id === id);
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
