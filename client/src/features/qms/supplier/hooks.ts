import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import toast from 'react-hot-toast';

// Backend supplier shape differs from the UI's expected shape in a few places:
//   • `companyName` → `name`
//   • `supplierCode` → `code`
//   • `productsServices` is a delimited string → the UI expects string[]
//   • `status` can be SUSPENDED (not in the client's badge map)
// Normalize once at the hook boundary so every page below just works.
function normalizeSupplier(s: any) {
  if (!s || typeof s !== 'object') return s;
  const rawProducts = s.productsServices;
  let products: string[] = [];
  if (Array.isArray(rawProducts)) products = rawProducts;
  else if (typeof rawProducts === 'string' && rawProducts.trim())
    products = rawProducts.split(/[,;|]/).map((p: string) => p.trim()).filter(Boolean);
  // Backend exposes qualityScore + deliveryScore (0-100). UI expects `rating`
  // on a 0-5 star scale. Map if absent.
  let rating = typeof s.rating === 'number' ? s.rating : undefined;
  if (rating == null) {
    const q = typeof s.qualityScore === 'number' ? s.qualityScore : undefined;
    const d = typeof s.deliveryScore === 'number' ? s.deliveryScore : undefined;
    if (q != null || d != null) {
      const avg100 = ((q ?? 0) + (d ?? 0)) / ((q != null && d != null) ? 2 : 1);
      rating = Math.round((avg100 / 20) * 10) / 10; // 0-5 with one decimal
    } else {
      rating = 0;
    }
  }
  return {
    ...s,
    name: s.name ?? s.companyName ?? '',
    code: s.code ?? s.supplierCode ?? '',
    productsServices: products,
    rating,
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export type SupplierStatus = 'APPROVED' | 'CONDITIONAL' | 'PENDING' | 'DISQUALIFIED';
export type SupplierCategory = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface SupplierCertification {
  id: string;
  name: string;
  certificateNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface SupplierAudit {
  id: string;
  type: string;
  date: string;
  auditor: string;
  score: number;
  status: 'COMPLETED' | 'SCHEDULED' | 'OVERDUE';
  findings: string;
  ncCount: number;
}

export interface SupplierPerformance {
  quality: number;
  delivery: number;
  cost: number;
  responsiveness: number;
  innovation: number;
  overallScore: number;
  monthlyTrend: { month: string; score: number }[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  category: SupplierCategory;
  status: SupplierStatus;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  productsServices: string[];
  rating: number;
  certifications: SupplierCertification[];
  audits: SupplierAudit[];
  performance: SupplierPerformance;
  certExpiry: string;
  lastAuditDate: string;
  createdAt: string;
  updatedAt: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockSuppliers: Supplier[] = [
  {
    id: 'sup1',
    code: 'SUP-001',
    name: "Divi's Laboratories Ltd",
    category: 'CRITICAL',
    status: 'APPROVED',
    contactPerson: 'Srinivas Rao',
    email: 'srinivas.rao@divislabs.com',
    phone: '+91 40 2378 4000',
    address: 'Divi Towers, 7-1-77/E/1/303, 3rd Floor, Dharam Karam Road, Ameerpet',
    city: 'Hyderabad',
    state: 'Telangana',
    productsServices: ['Paracetamol API (Ph.Eur./USP)', 'Metformin HCl API (Ph.Eur./USP)', 'Custom API Synthesis'],
    rating: 4.7,
    certifications: [
      { id: 'cert1', name: 'WHO-GMP Certificate', certificateNumber: 'WHO-GMP-DIV-2024-001', issuedBy: 'WHO Prequalification Programme', issuedDate: '2024-05-10', expiryDate: '2027-05-09', status: 'VALID' },
      { id: 'cert2', name: 'ISO 9001:2015', certificateNumber: 'QMS-DIV-2024-002', issuedBy: 'Bureau Veritas', issuedDate: '2024-05-10', expiryDate: '2027-05-09', status: 'VALID' },
      { id: 'cert3', name: 'US FDA Drug Master File (DMF)', certificateNumber: 'DMF-2024-PCT-US', issuedBy: 'US FDA', issuedDate: '2024-01-15', expiryDate: '2029-01-14', status: 'VALID' },
      { id: 'cert4', name: 'EU CEP (Certificate of Suitability)', certificateNumber: 'CEP-2024-PCT-EU', issuedBy: 'EDQM', issuedDate: '2024-03-01', expiryDate: '2029-02-28', status: 'VALID' },
    ],
    audits: [
      { id: 'aud1', type: 'Supplier GMP Audit', date: '2026-01-20', auditor: 'Dr. Priya Sharma', score: 94, status: 'COMPLETED', findings: 'One minor observation on batch record review completeness. Immediately addressed during audit. No critical or major findings.', ncCount: 1 },
      { id: 'aud2', type: 'Annual GMP Surveillance Audit', date: '2027-01-20', auditor: 'Dr. Priya Sharma', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 97, delivery: 93, cost: 82, responsiveness: 94, innovation: 85,
      overallScore: 90,
      monthlyTrend: [
        { month: 'Oct', score: 88 }, { month: 'Nov', score: 89 }, { month: 'Dec', score: 91 },
        { month: 'Jan', score: 90 }, { month: 'Feb', score: 91 }, { month: 'Mar', score: 90 },
      ],
    },
    certExpiry: '2027-05-09',
    lastAuditDate: '2026-01-20',
    createdAt: '2022-06-01T10:00:00Z',
    updatedAt: '2026-03-20T14:00:00Z',
  },
  {
    id: 'sup2',
    code: 'SUP-002',
    name: 'Hikal Ltd',
    category: 'CRITICAL',
    status: 'APPROVED',
    contactPerson: 'Pradeep Joshi',
    email: 'pradeep.joshi@hikal.com',
    phone: '+91 20 6626 7300',
    address: 'Hikal House, 717/718 Kasba Peth',
    city: 'Pune',
    state: 'Maharashtra',
    productsServices: ['Amoxicillin Trihydrate API (Ph.Eur./BP)', 'Cephalosporin APIs', 'Beta-Lactam Intermediates'],
    rating: 4.3,
    certifications: [
      { id: 'cert5', name: 'WHO-GMP Certificate', certificateNumber: 'WHO-GMP-HIK-2024-010', issuedBy: 'WHO Prequalification Programme', issuedDate: '2024-08-15', expiryDate: '2027-08-14', status: 'VALID' },
      { id: 'cert6', name: 'ISO 9001:2015', certificateNumber: 'QMS-HIK-2024-011', issuedBy: 'DNV GL', issuedDate: '2024-08-15', expiryDate: '2027-08-14', status: 'VALID' },
      { id: 'cert7', name: 'EU CEP (Certificate of Suitability)', certificateNumber: 'CEP-2023-AMX-EU', issuedBy: 'EDQM', issuedDate: '2023-11-01', expiryDate: '2028-10-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud3', type: 'Initial Supplier Qualification Audit', date: '2024-09-15', auditor: 'Dr. Priya Sharma', score: 88, status: 'COMPLETED', findings: 'Good overall GMP compliance. Two minor NCs: environmental monitoring sampling frequency and SOP for cleaning validation. Both addressed within 30 days.', ncCount: 2 },
      { id: 'aud4', type: 'Annual GMP Surveillance Audit', date: '2026-09-15', auditor: 'Rajesh Kumar', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 93, delivery: 88, cost: 84, responsiveness: 89, innovation: 78,
      overallScore: 86,
      monthlyTrend: [
        { month: 'Oct', score: 84 }, { month: 'Nov', score: 85 }, { month: 'Dec', score: 86 },
        { month: 'Jan', score: 86 }, { month: 'Feb', score: 87 }, { month: 'Mar', score: 86 },
      ],
    },
    certExpiry: '2027-08-14',
    lastAuditDate: '2024-09-15',
    createdAt: '2024-07-05T10:00:00Z',
    updatedAt: '2026-03-18T11:00:00Z',
  },
  {
    id: 'sup3',
    code: 'SUP-003',
    name: 'Colorcon Ltd',
    category: 'MAJOR',
    status: 'APPROVED',
    contactPerson: 'Ramona Fernandes',
    email: 'ramona.fernandes@colorcon.com',
    phone: '+91 832 239 6400',
    address: 'Plot No. C-1, Verna Industrial Estate',
    city: 'Verna, Goa',
    state: 'Goa',
    productsServices: ['Opadry Film Coating Systems', 'HPMC (Hydroxypropyl Methylcellulose)', 'Surelease Enteric Coating', 'PVPVA Binders'],
    rating: 4.0,
    certifications: [
      { id: 'cert8', name: 'ISO 9001:2015', certificateNumber: 'QMS-COL-2025-020', issuedBy: 'TUV Rheinland', issuedDate: '2025-02-01', expiryDate: '2028-01-31', status: 'VALID' },
      { id: 'cert9', name: 'ISO 14001:2015', certificateNumber: 'EMS-COL-2025-021', issuedBy: 'TUV Rheinland', issuedDate: '2025-02-01', expiryDate: '2028-01-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud5', type: 'Supplier GMP Audit', date: '2025-10-08', auditor: 'Rajesh Kumar', score: 84, status: 'COMPLETED', findings: 'One major NC raised (CAPA-2025-0020): HPMC viscosity release specification not consistently tested per claimed specification. Supplier committed CAPA within 60 days.', ncCount: 1 },
      { id: 'aud6', type: 'CAPA Follow-up Audit', date: '2026-02-10', auditor: 'Rajesh Kumar', score: 91, status: 'COMPLETED', findings: 'CAPA from October 2024 audit verified as implemented. HPMC viscosity testing now part of every release CoA. No further NCs.', ncCount: 0 },
    ],
    performance: {
      quality: 85, delivery: 90, cost: 79, responsiveness: 86, innovation: 88,
      overallScore: 86,
      monthlyTrend: [
        { month: 'Oct', score: 82 }, { month: 'Nov', score: 83 }, { month: 'Dec', score: 85 },
        { month: 'Jan', score: 86 }, { month: 'Feb', score: 87 }, { month: 'Mar', score: 86 },
      ],
    },
    certExpiry: '2028-01-31',
    lastAuditDate: '2026-02-10',
    createdAt: '2021-09-15T10:00:00Z',
    updatedAt: '2026-03-15T09:00:00Z',
  },
  {
    id: 'sup4',
    code: 'SUP-004',
    name: 'Uflex Ltd',
    category: 'MAJOR',
    status: 'APPROVED',
    contactPerson: 'Anand Sharma',
    email: 'anand.sharma@uflexltd.com',
    phone: '+91 120 455 3300',
    address: 'A-1, Sector 60, Noida',
    city: 'Noida',
    state: 'Uttar Pradesh',
    productsServices: ['PVC Blister Foil (250µm)', 'PVC/PVDC Blister Foil (250µm/60gsm)', 'Alu-Alu Cold Form Foil', 'Lidding Foil (Hard Temper Aluminium)', 'Strip Packaging Foil'],
    rating: 4.2,
    certifications: [
      { id: 'cert10', name: 'ISO 9001:2015', certificateNumber: 'QMS-UFX-2024-030', issuedBy: 'Bureau Veritas', issuedDate: '2024-11-01', expiryDate: '2027-10-31', status: 'VALID' },
      { id: 'cert11', name: 'ISO 15378:2017 (Pharma Packaging GMP)', certificateNumber: 'PPS-UFX-2024-031', issuedBy: 'Bureau Veritas', issuedDate: '2024-11-01', expiryDate: '2027-10-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud7', type: 'Supplier GMP Audit (Pharma Packaging)', date: '2025-08-20', auditor: 'Vikram Patel', score: 87, status: 'COMPLETED', findings: 'Good compliance with ISO 15378. One minor observation on foil thickness measurement frequency. Acceptable overall.', ncCount: 1 },
    ],
    performance: {
      quality: 90, delivery: 86, cost: 84, responsiveness: 83, innovation: 76,
      overallScore: 84,
      monthlyTrend: [
        { month: 'Oct', score: 82 }, { month: 'Nov', score: 83 }, { month: 'Dec', score: 84 },
        { month: 'Jan', score: 85 }, { month: 'Feb', score: 84 }, { month: 'Mar', score: 84 },
      ],
    },
    certExpiry: '2027-10-31',
    lastAuditDate: '2025-08-20',
    createdAt: '2022-03-10T10:00:00Z',
    updatedAt: '2026-03-10T16:00:00Z',
  },
  {
    id: 'sup5',
    code: 'SUP-005',
    name: 'Schott AG India',
    category: 'MAJOR',
    status: 'APPROVED',
    contactPerson: 'Kaushik Das',
    email: 'kaushik.das@schott.com',
    phone: '+91 22 6635 6000',
    address: 'Schott Glass India Pvt Ltd, Bandra Kurla Complex',
    city: 'Mumbai',
    state: 'Maharashtra',
    productsServices: ['Borosilicate Glass Vials (Type I, 2ml, 5ml, 10ml)', 'Glass Ampoules (1ml, 2ml, 5ml, 10ml)', 'Rubber Stoppers', 'Aluminium Crimp Seals'],
    rating: 4.4,
    certifications: [
      { id: 'cert12', name: 'ISO 9001:2015', certificateNumber: 'QMS-SCH-2024-040', issuedBy: 'SGS', issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
      { id: 'cert13', name: 'ISO 15378:2017 (Pharma Packaging GMP)', certificateNumber: 'PPS-SCH-2024-041', issuedBy: 'SGS', issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
      { id: 'cert14', name: 'ISO 14001:2015', certificateNumber: 'EMS-SCH-2024-042', issuedBy: 'SGS', issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud8', type: 'Supplier GMP Audit (Pharma Glass)', date: '2026-01-12', auditor: 'Dr. Priya Sharma', score: 89, status: 'COMPLETED', findings: 'Well-controlled glass manufacturing process. One observation on delamination risk assessment documentation for high-pH formulations. Supplier has existing delamination risk mitigation procedure; documentation to be updated. No NCs raised.', ncCount: 0 },
      { id: 'aud9', type: 'Enhanced Audit (Post-CAPA-2026-0022)', date: '2026-04-15', auditor: 'Rajesh Kumar', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 91, delivery: 88, cost: 78, responsiveness: 87, innovation: 82,
      overallScore: 85,
      monthlyTrend: [
        { month: 'Oct', score: 84 }, { month: 'Nov', score: 85 }, { month: 'Dec', score: 85 },
        { month: 'Jan', score: 85 }, { month: 'Feb', score: 86 }, { month: 'Mar', score: 85 },
      ],
    },
    certExpiry: '2027-05-31',
    lastAuditDate: '2026-01-12',
    createdAt: '2021-07-20T10:00:00Z',
    updatedAt: '2026-03-22T10:00:00Z',
  },
  {
    id: 'sup6',
    code: 'SUP-006',
    name: 'BASF SE India',
    category: 'MINOR',
    status: 'APPROVED',
    contactPerson: 'Meera Krishnan',
    email: 'meera.krishnan@basf.com',
    phone: '+91 22 6278 5000',
    address: 'BASF India Ltd, Maker Chambers IV, 222 Nariman Point',
    city: 'Mumbai',
    state: 'Maharashtra',
    productsServices: ['Kollidon VA 64 (PVP/VA Binder)', 'Ludipress LCE (Coprocessed Excipient)', 'Pharmacoat 603 (HPMC)', 'Lutrol F68 (Poloxamer)', 'Kolliphor EL (Solubiliser)'],
    rating: 4.1,
    certifications: [
      { id: 'cert15', name: 'ISO 9001:2015', certificateNumber: 'QMS-BASF-2025-015', issuedBy: 'TUV SUD', issuedDate: '2025-04-01', expiryDate: '2028-03-31', status: 'VALID' },
      { id: 'cert16', name: 'ISO 14001:2015', certificateNumber: 'EMS-BASF-2025-016', issuedBy: 'TUV SUD', issuedDate: '2025-04-01', expiryDate: '2028-03-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud10', type: 'Desktop Qualification Assessment', date: '2025-12-10', auditor: 'Rajesh Kumar', score: 85, status: 'COMPLETED', findings: 'Comprehensive quality documentation provided. ISO 9001:2015 certified. CoA data for Pharmacoat 603 reviewed — viscosity specification confirmed equivalent to Colorcon HPMC. Suitable for qualification as alternate HPMC source.', ncCount: 0 },
      { id: 'aud11', type: 'On-Site Supplier GMP Audit', date: '2026-04-30', auditor: 'Dr. Priya Sharma', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 88, delivery: 84, cost: 81, responsiveness: 83, innovation: 90,
      overallScore: 85,
      monthlyTrend: [
        { month: 'Oct', score: 83 }, { month: 'Nov', score: 84 }, { month: 'Dec', score: 84 },
        { month: 'Jan', score: 85 }, { month: 'Feb', score: 85 }, { month: 'Mar', score: 85 },
      ],
    },
    certExpiry: '2028-03-31',
    lastAuditDate: '2025-12-10',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2026-03-20T09:00:00Z',
  },
  {
    id: 'sup7',
    code: 'SUP-007',
    name: 'Piramal Critical Care',
    category: 'MAJOR',
    status: 'CONDITIONAL',
    contactPerson: 'Shalini Kulkarni',
    email: 'shalini.kulkarni@piramal.com',
    phone: '+91 22 3027 1000',
    address: 'Piramal Andheri, Ashok Sawant Marg, Dhanukarwadi',
    city: 'Mumbai',
    state: 'Maharashtra',
    productsServices: ['Contract Analytical Testing (Sterility, Endotoxin, Microbiology)', 'Reference Standard Characterisation', 'Impurity Profiling', 'Method Validation Support'],
    rating: 3.5,
    certifications: [
      { id: 'cert17', name: 'NABL Accreditation (ISO/IEC 17025:2017)', certificateNumber: 'NABL-PCC-2024-050', issuedBy: 'NABL (National Accreditation Board for Testing and Calibration Laboratories)', issuedDate: '2024-09-01', expiryDate: '2026-08-31', status: 'EXPIRING_SOON' },
      { id: 'cert18', name: 'ISO 9001:2015', certificateNumber: 'QMS-PCC-2023-051', issuedBy: 'Intertek', issuedDate: '2023-07-01', expiryDate: '2026-06-30', status: 'EXPIRING_SOON' },
    ],
    audits: [
      { id: 'aud12', type: 'Contract Laboratory Qualification Audit', date: '2025-06-18', auditor: 'Rajesh Kumar', score: 73, status: 'COMPLETED', findings: 'Two major NCs: (1) Analyst training records incomplete for 3 analysts performing sterility tests; (2) Reference standard management log not maintained per SOP. CAPA committed by August 2025. Conditional approval granted pending CAPA closure.', ncCount: 2 },
      { id: 'aud13', type: 'CAPA Verification Audit', date: '2026-06-15', auditor: 'Rajesh Kumar', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 74, delivery: 80, cost: 88, responsiveness: 70, innovation: 65,
      overallScore: 75,
      monthlyTrend: [
        { month: 'Oct', score: 73 }, { month: 'Nov', score: 74 }, { month: 'Dec', score: 75 },
        { month: 'Jan', score: 75 }, { month: 'Feb', score: 76 }, { month: 'Mar', score: 75 },
      ],
    },
    certExpiry: '2026-08-31',
    lastAuditDate: '2025-06-18',
    createdAt: '2023-05-10T10:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'sup8',
    code: 'SUP-008',
    name: 'Vimta Labs Ltd',
    category: 'MINOR',
    status: 'PENDING',
    contactPerson: 'Nagaraju Reddy',
    email: 'nagaraju.r@vimta.com',
    phone: '+91 40 2726 8769',
    address: '142, IDA Phase II, Cherlapally',
    city: 'Hyderabad',
    state: 'Telangana',
    productsServices: ['Contract Analytical Testing (Chemical and Microbiological)', 'Stability Storage and Testing', 'Bioavailability / Bioequivalence Studies', 'Environmental Testing'],
    rating: 0,
    certifications: [
      { id: 'cert19', name: 'NABL Accreditation (ISO/IEC 17025:2017)', certificateNumber: 'NABL-VIM-2025-060', issuedBy: 'NABL', issuedDate: '2025-07-01', expiryDate: '2028-06-30', status: 'VALID' },
      { id: 'cert20', name: 'GLP Compliance Certificate', certificateNumber: 'GLP-VIM-2025-061', issuedBy: 'CDSCO', issuedDate: '2025-07-01', expiryDate: '2028-06-30', status: 'VALID' },
    ],
    audits: [],
    performance: {
      quality: 0, delivery: 0, cost: 0, responsiveness: 0, innovation: 0,
      overallScore: 0,
      monthlyTrend: [],
    },
    certExpiry: '2028-06-30',
    lastAuditDate: '',
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-03-10T10:00:00Z',
  },
  // ── Additional records (20+ total for the demo) ──
  ...((): Supplier[] => {
    const extras: Array<[string, string, string, SupplierCategory, SupplierStatus, string, string, string, string, string[], number, string]> = [
      ['sup9',  'SUP-009', 'Divis Laboratories',           'CRITICAL', 'APPROVED',     'Ramesh Kumar',   'ramesh.k@divislabs.example',   'Hyderabad',  'Telangana',   ['Naproxen API', 'Levetiracetam API', 'Custom Synthesis'],             4.7, '2027-05-09'],
      ['sup10', 'SUP-010', "Dr. Reddy's Laboratories",     'CRITICAL', 'APPROVED',     'Arjun Mehta',    'arjun.m@drreddys.example',     'Hyderabad',  'Telangana',   ['Atorvastatin API', 'Omeprazole API'],                                 4.5, '2027-08-20'],
      ['sup11', 'SUP-011', 'Colorcon Asia',                'MAJOR',    'APPROVED',     'Suresh Nair',    'snair@colorcon.example',       'Goa',        'Goa',         ['Opadry film-coating systems', 'HPMC'],                                4.8, '2028-01-15'],
      ['sup12', 'SUP-012', 'Waters Corporation India',     'MAJOR',    'APPROVED',     "John D'Souza",   'service.in@waters.example',    'Bangalore',  'Karnataka',   ['HPLC/UPLC systems', 'Columns', 'Consumables'],                        4.7, '2027-11-30'],
      ['sup13', 'SUP-013', 'Amcor India Ltd',              'MAJOR',    'CONDITIONAL',  'Ashok Patil',    'apatil@amcor.example',         'Pune',       'Maharashtra', ['Blister foil', 'Bottles', 'Closures'],                                3.9, '2027-02-28'],
      ['sup14', 'SUP-014', 'SGS India Pvt Ltd',            'MAJOR',    'APPROVED',     'Meera Iyer',     'meera.iyer@sgs.example',       'Mumbai',     'Maharashtra', ['Contract analytical testing', 'Stability studies'],                   4.6, '2028-05-10'],
      ['sup15', 'SUP-015', 'Praxair India',                'MINOR',    'APPROVED',     'Vivek Sharma',   'vsharma@praxair.example',      'Mumbai',     'Maharashtra', ['USP-grade nitrogen', 'Argon', 'Compressed air'],                      4.4, '2027-07-15'],
      ['sup16', 'SUP-016', 'Ecolab India',                 'MAJOR',    'APPROVED',     'Kavitha Reddy',  'k.reddy@ecolab.example',       'Gurgaon',    'Haryana',     ['Validated cleaning chemicals', 'Sporicidal disinfectants'],           4.7, '2028-03-20'],
      ['sup17', 'SUP-017', 'JRS Pharma India',             'MAJOR',    'APPROVED',     'Rohan Desai',    'rohan.d@jrs.example',          'Mumbai',     'Maharashtra', ['Microcrystalline cellulose', 'Binders', 'Disintegrants'],             4.6, '2027-09-10'],
      ['sup18', 'SUP-018', 'Hetero Drugs',                 'CRITICAL', 'CONDITIONAL',  'Priya Venkat',   'priya.v@hetero.example',       'Hyderabad',  'Telangana',   ['Sitagliptin API', 'Efavirenz API'],                                   3.8, '2027-04-05'],
      ['sup19', 'SUP-019', 'Bilcare Research',             'MINOR',    'APPROVED',     'Nitin Joshi',    'njoshi@bilcare.example',       'Pune',       'Maharashtra', ['Protective packaging', 'Track-and-trace labels'],                     4.3, '2027-12-01'],
      ['sup20', 'SUP-020', 'Eurofins Advinus',             'MAJOR',    'APPROVED',     'Dr. Anil Kapoor','anil.k@eurofins.example',      'Bangalore',  'Karnataka',   ['Extractables & leachables', 'Toxicology studies'],                    4.6, '2028-07-22'],
    ];
    return extras.map(([id, code, name, category, status, contact, email, city, state, products, rating, certExpiry]) => ({
      id, code, name, category, status,
      contactPerson: contact, email, phone: '+91 00 0000 0000',
      address: '—', city, state,
      productsServices: products, rating,
      certifications: [], audits: [],
      performance: { quality: Math.round(rating * 20), delivery: Math.round(rating * 18), cost: 80, responsiveness: 85, innovation: 75, overallScore: Math.round(rating * 18), monthlyTrend: [] },
      certExpiry, lastAuditDate: '2025-10-01',
      createdAt: '2025-06-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z',
    }));
  })(),
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface SupplierFilters {
  status?: string;
  category?: string;
  search?: string;
}

export function useSuppliers(filters: SupplierFilters = {}) {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/suppliers', { params: filters });
        return unwrapList<Supplier>(data, normalizeSupplier);
      } catch {
        let filtered = [...mockSuppliers];
        if (filters.status) filtered = filtered.filter((s) => s.status === filters.status);
        if (filters.category) filtered = filtered.filter((s) => s.category === filters.category);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.code.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useSupplier(id: string) {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/suppliers/${id}`);
        return unwrapItem<Supplier>(data, normalizeSupplier);
      } catch {
        const supplier = mockSuppliers.find((s) => s.id === id);
        if (!supplier) throw new Error('Supplier not found');
        return supplier;
      }
    },
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/suppliers', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier added successfully');
    },
    onError: () => {
      toast.error('Failed to add supplier');
    },
  });
}
