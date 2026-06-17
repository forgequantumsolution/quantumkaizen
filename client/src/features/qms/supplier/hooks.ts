import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';
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

// Medical-device supplier base — ISO 13485 §7.4 / 21 CFR 820.50 vendors.
const md = (q: number, d: number) => ({
  quality: q, delivery: d, cost: 78, responsiveness: 84, innovation: 76, overallScore: Math.round((q + d) / 2),
  monthlyTrend: [
    { month: 'Oct 25', score: Math.round((q + d) / 2) - 2 },
    { month: 'Nov 25', score: Math.round((q + d) / 2) - 1 },
    { month: 'Dec 25', score: Math.round((q + d) / 2)     },
    { month: 'Jan 26', score: Math.round((q + d) / 2) + 1 },
    { month: 'Feb 26', score: Math.round((q + d) / 2) + 1 },
    { month: 'Mar 26', score: Math.round((q + d) / 2) + 2 },
  ],
});

export const mockMedicalDeviceSuppliers: Supplier[] = [
  {
    id: 'md-sup1', code: 'MDV-101', name: 'Sterimed Medical Devices Pvt. Ltd.', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Vikas Saxena', email: 'vikas.saxena@sterimed.in', phone: '+91 11 4708 0000',
    address: 'Plot 92, Sector 6, IMT Manesar', city: 'Gurugram', state: 'Haryana',
    productsServices: ['Sterile blister packaging', 'Tyvek lidding'],
    rating: 4.6, performance: md(94, 92), certExpiry: '2027-03-31', lastAuditDate: '2025-09-18',
    certifications: [
      { id: 'md-sc1', name: 'ISO 13485:2016', certificateNumber: 'BSI-MD-104812', issuedBy: 'BSI', issuedDate: '2024-04-01', expiryDate: '2027-03-31', status: 'VALID' },
      { id: 'md-sc2', name: 'ISO 11607-1 / -2',  certificateNumber: 'TUV-PAK-22019', issuedBy: 'TÜV SÜD', issuedDate: '2024-06-12', expiryDate: '2027-06-11', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa1', type: 'On-site GMP', date: '2025-09-18', auditor: 'Neha Bansal', score: 92, status: 'COMPLETED', findings: '1 Minor (CAR closed), 1 OFI', ncCount: 1 }],
    createdAt: '2024-04-12T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-sup2', code: 'MDV-102', name: 'Sandvik Materials Technology India', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Anand Pradeep', email: 'anand.pradeep@sandvik.com', phone: '+91 20 6712 2000',
    address: 'Survey 119, Chinchwad', city: 'Pune', state: 'Maharashtra',
    productsServices: ['Medical-grade titanium alloy', 'Stainless 316LVM wire'],
    rating: 4.8, performance: md(97, 93), certExpiry: '2027-08-30', lastAuditDate: '2025-08-04',
    certifications: [
      { id: 'md-sc3', name: 'ISO 13485:2016',     certificateNumber: 'DNV-MD-7611',  issuedBy: 'DNV',   issuedDate: '2024-08-31', expiryDate: '2027-08-30', status: 'VALID' },
      { id: 'md-sc4', name: 'ASTM F136 (Ti-6Al-4V ELI)', certificateNumber: 'INSP-2024-1144', issuedBy: 'In-house Lab', issuedDate: '2024-01-15', expiryDate: '2026-12-31', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'md-sa2', type: 'Tier-1 Material Supplier', date: '2025-08-04', auditor: 'Sneha Kapoor', score: 95, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2023-12-01T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-sup3', code: 'MDV-103', name: 'Specur Polymers Pvt. Ltd.', category: 'MAJOR', status: 'CONDITIONAL',
    contactPerson: 'Manish Bhardwaj', email: 'manish@specur.in', phone: '+91 79 2675 1111',
    address: 'GIDC Naroda, Phase III', city: 'Ahmedabad', state: 'Gujarat',
    productsServices: ['PLA bioresorbable resin', 'Medical-grade PEEK'],
    rating: 3.6, performance: md(78, 82), certExpiry: '2026-09-30', lastAuditDate: '2025-09-19',
    certifications: [
      { id: 'md-sc5', name: 'ISO 13485:2016', certificateNumber: 'IRQS-MD-3320', issuedBy: 'IRQS', issuedDate: '2023-10-01', expiryDate: '2026-09-30', status: 'EXPIRING_SOON' },
      { id: 'md-sc6', name: 'ISO 10993 panel',  certificateNumber: 'TPL-3411',    issuedBy: 'Sigma Lab', issuedDate: '2024-04-21', expiryDate: '2026-04-21', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'md-sa3', type: 'For-cause audit (change-notification breach)', date: '2025-09-19', auditor: 'Neha Bansal', score: 74, status: 'COMPLETED', findings: '1 Major, 1 Minor — CAR open', ncCount: 2 }],
    createdAt: '2023-04-01T09:00:00Z', updatedAt: '2026-03-22T15:00:00Z',
  },
  {
    id: 'md-sup4', code: 'MDV-104', name: 'BD Becton Dickinson India Pvt. Ltd.', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Geetika Sharma', email: 'geetika.sharma@bd.com', phone: '+91 124 488 0000',
    address: 'Plot 305A, Phase II, Udyog Vihar', city: 'Gurugram', state: 'Haryana',
    productsServices: ['Needle hubs', 'Catheter components'],
    rating: 4.7, performance: md(95, 94), certExpiry: '2027-11-30', lastAuditDate: '2025-11-12',
    certifications: [
      { id: 'md-sc7', name: 'ISO 13485:2016',  certificateNumber: 'BSI-MD-22414', issuedBy: 'BSI',       issuedDate: '2024-12-01', expiryDate: '2027-11-30', status: 'VALID' },
      { id: 'md-sc8', name: 'US FDA 510(k) — component', certificateNumber: 'K224118', issuedBy: 'USFDA',     issuedDate: '2022-09-12', expiryDate: '2027-09-12', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa4', type: 'Routine surveillance', date: '2025-11-12', auditor: 'Karthik Iyer', score: 96, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2022-02-15T09:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'md-sup5', code: 'MDV-105', name: 'Aravali Sterilization Services Ltd.', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Pradeep Joshi', email: 'pradeep.joshi@aravali-sterile.in', phone: '+91 1276 274 999',
    address: 'IMT Manesar, Plot 18', city: 'Manesar', state: 'Haryana',
    productsServices: ['Contract EO sterilization', 'Gamma sterilization'],
    rating: 4.4, performance: md(91, 90), certExpiry: '2027-04-30', lastAuditDate: '2025-10-15',
    certifications: [
      { id: 'md-sc9',  name: 'ISO 13485:2016',  certificateNumber: 'TUV-2222',   issuedBy: 'TÜV SÜD',  issuedDate: '2024-05-01', expiryDate: '2027-04-30', status: 'VALID' },
      { id: 'md-sc10', name: 'ISO 11135 EO',    certificateNumber: 'INTERTEK-991',issuedBy: 'Intertek', issuedDate: '2024-09-12', expiryDate: '2026-09-12', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'md-sa5', type: 'Sterilization vendor audit', date: '2025-10-15', auditor: 'Karthik Iyer', score: 88, status: 'COMPLETED', findings: '2 Minor', ncCount: 2 }],
    createdAt: '2023-05-10T09:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'md-sup6', code: 'MDV-106', name: 'Nelipak Healthcare Packaging', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Sanjay Krishnan', email: 'sanjay.k@nelipak.com', phone: '+91 80 4185 4000',
    address: 'Plot 31, KIADB Industrial Area', city: 'Bengaluru', state: 'Karnataka',
    productsServices: ['Thermoformed trays', 'Sterile barrier systems'],
    rating: 4.5, performance: md(92, 91), certExpiry: '2027-02-15', lastAuditDate: '2025-12-09',
    certifications: [
      { id: 'md-sc11', name: 'ISO 11607-1 / -2', certificateNumber: 'DNV-MD-4477', issuedBy: 'DNV',      issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
      { id: 'md-sc12', name: 'ISO 13485:2016',   certificateNumber: 'DNV-MD-4478', issuedBy: 'DNV',      issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa6', type: 'Packaging vendor surveillance', date: '2025-12-09', auditor: 'Neha Bansal', score: 93, status: 'COMPLETED', findings: '1 OFI', ncCount: 0 }],
    createdAt: '2024-02-20T09:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'md-sup7', code: 'MDV-107', name: 'Resonetics India LLP', category: 'MAJOR', status: 'PENDING',
    contactPerson: 'Reema Jaiswal', email: 'reema.jaiswal@resonetics.com', phone: '+91 80 4123 5678',
    address: 'EPIP Zone, Whitefield', city: 'Bengaluru', state: 'Karnataka',
    productsServices: ['Laser-cut Nitinol stents', 'Precision micro-machining'],
    rating: 4.0, performance: md(86, 84), certExpiry: '2027-05-31', lastAuditDate: '2026-02-04',
    certifications: [
      { id: 'md-sc13', name: 'ISO 13485:2016 (under transfer)', certificateNumber: 'BSI-MD-66501', issuedBy: 'BSI', issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa7', type: 'Initial qualification audit', date: '2026-02-04', auditor: 'Sneha Kapoor', score: 84, status: 'COMPLETED', findings: '3 Minor — qualification in progress', ncCount: 3 }],
    createdAt: '2025-12-10T09:00:00Z', updatedAt: '2026-02-15T11:00:00Z',
  },
  {
    id: 'md-sup9', code: 'MDV-109', name: 'NIPRO India Corporation Pvt. Ltd.', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Hemant Joshi', email: 'hemant.joshi@nipro.in', phone: '+91 22 6612 8000',
    address: 'Plot 14, MIDC Andheri (East)', city: 'Mumbai', state: 'Maharashtra',
    productsServices: ['Medical-grade stainless steel needle tubing (304 / 316L)', 'Drawn micro-cannula stock'],
    rating: 4.7, performance: md(96, 95), certExpiry: '2027-07-31', lastAuditDate: '2025-08-22',
    certifications: [
      { id: 'md-sc16', name: 'ISO 13485:2016',         certificateNumber: 'DNV-MD-9912', issuedBy: 'DNV',     issuedDate: '2024-08-01', expiryDate: '2027-07-31', status: 'VALID' },
      { id: 'md-sc17', name: 'ASTM A249 / IS 6911',     certificateNumber: 'NABL-T-3344', issuedBy: 'NABL',   issuedDate: '2024-04-15', expiryDate: '2027-04-14', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa9', type: 'Tier-1 needle-tubing audit', date: '2025-08-22', auditor: 'Sneha Kapoor', score: 95, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2023-08-12T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-sup10', code: 'MDV-110', name: 'Reliance Industries Ltd. — Polymers Division', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Rajiv Bansal', email: 'rajiv.bansal@ril.com', phone: '+91 22 2278 5000',
    address: 'Maker Chambers IV, Nariman Point', city: 'Mumbai', state: 'Maharashtra',
    productsServices: ['Medical-grade polypropylene homopolymer (USP Class VI)', 'Medical-grade polyethylene resin'],
    rating: 4.5, performance: md(94, 92), certExpiry: '2027-09-30', lastAuditDate: '2025-09-04',
    certifications: [
      { id: 'md-sc18', name: 'ISO 13485:2016 — material supplier', certificateNumber: 'BSI-MD-21077', issuedBy: 'BSI',  issuedDate: '2024-10-01', expiryDate: '2027-09-30', status: 'VALID' },
      { id: 'md-sc19', name: 'USP Class VI Biocompatibility',     certificateNumber: 'IRQS-USP-2244', issuedBy: 'IRQS', issuedDate: '2024-02-15', expiryDate: '2027-02-14', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa10', type: 'Annual resin supplier audit', date: '2025-09-04', auditor: 'Sneha Kapoor', score: 93, status: 'COMPLETED', findings: '1 OFI on lot-traceability documentation', ncCount: 0 }],
    createdAt: '2022-11-18T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-sup11', code: 'MDV-111', name: 'Mitsubishi Chemical Performance Polymers India', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Pradeep Iyer', email: 'pradeep.iyer@mcppolymers.in', phone: '+91 79 6612 0001',
    address: 'Sanand GIDC, Phase II', city: 'Ahmedabad', state: 'Gujarat',
    productsServices: ['Medical-grade silicone elastomer (Foley catheter dip)', 'TPE pellets (cannula septa / IV set tubing)'],
    rating: 4.4, performance: md(91, 90), certExpiry: '2027-05-31', lastAuditDate: '2025-12-04',
    certifications: [
      { id: 'md-sc20', name: 'ISO 13485:2016',          certificateNumber: 'DNV-MD-8104',   issuedBy: 'DNV',       issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
      { id: 'md-sc21', name: 'ISO 10993 panel',          certificateNumber: 'TPL-MD-4011',   issuedBy: 'Sigma Lab', issuedDate: '2024-08-12', expiryDate: '2027-08-11', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa11', type: 'Silicone supplier audit', date: '2025-12-04', auditor: 'Neha Bansal', score: 92, status: 'COMPLETED', findings: '1 Minor — incoming-CoA template', ncCount: 1 }],
    createdAt: '2024-05-08T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-sup12', code: 'MDV-112', name: 'Amcor Healthcare Packaging India', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Anuja Deshpande', email: 'anuja.deshpande@amcor.com', phone: '+91 124 469 9000',
    address: 'Sector 18 IMT Manesar', city: 'Manesar', state: 'Haryana',
    productsServices: ['PVC/Aclar blister films (syringe & cannula)', 'Tyvek-foil pouch laminates'],
    rating: 4.6, performance: md(95, 94), certExpiry: '2027-02-15', lastAuditDate: '2025-12-09',
    certifications: [
      { id: 'md-sc22', name: 'ISO 11607-1 / -2', certificateNumber: 'DNV-PKG-2102',    issuedBy: 'DNV',  issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
      { id: 'md-sc23', name: 'ISO 13485:2016',   certificateNumber: 'DNV-MD-2103',    issuedBy: 'DNV',  issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa12', type: 'Healthcare packaging audit', date: '2025-12-09', auditor: 'Neha Bansal', score: 94, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2024-02-12T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-sup8', code: 'MDV-108', name: 'Bioseparation Technologies CRO Pune', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Dr. Ramya Iyer', email: 'ramya.iyer@bst-cro.in', phone: '+91 20 6512 1212',
    address: 'Pirangut MIDC, Block B', city: 'Pune', state: 'Maharashtra',
    productsServices: ['ISO 10993 biocompatibility testing', 'USP <85> endotoxin LAL'],
    rating: 4.4, performance: md(93, 88), certExpiry: '2027-10-30', lastAuditDate: '2025-11-22',
    certifications: [
      { id: 'md-sc14', name: 'NABL ISO 17025', certificateNumber: 'NABL-T-2031',   issuedBy: 'NABL',    issuedDate: '2024-10-31', expiryDate: '2027-10-30', status: 'VALID' },
      { id: 'md-sc15', name: 'GLP — CDSCO',    certificateNumber: 'CDSCO-GLP-552', issuedBy: 'CDSCO',   issuedDate: '2024-04-12', expiryDate: '2027-04-11', status: 'VALID' },
    ],
    audits: [{ id: 'md-sa8', type: 'Contract lab audit', date: '2025-11-22', auditor: 'Sneha Kapoor', score: 91, status: 'COMPLETED', findings: '1 Minor, 1 OFI', ncCount: 1 }],
    createdAt: '2024-10-12T09:00:00Z', updatedAt: '2026-03-01T11:00:00Z',
  },
];

// Dairy tenant — typical supplier mix for an Indian dairy plant.
const dy = (q: number, d: number) => ({
  quality: q, delivery: d, cost: 80, responsiveness: 85, innovation: 70, overallScore: Math.round((q + d) / 2),
  monthlyTrend: [
    { month: 'Nov 25', score: Math.round((q + d) / 2) - 2 },
    { month: 'Dec 25', score: Math.round((q + d) / 2) - 1 },
    { month: 'Jan 26', score: Math.round((q + d) / 2) },
    { month: 'Feb 26', score: Math.round((q + d) / 2) + 1 },
    { month: 'Mar 26', score: Math.round((q + d) / 2) + 1 },
    { month: 'Apr 26', score: Math.round((q + d) / 2) + 2 },
  ],
});

export const mockDairySuppliers: Supplier[] = [
  {
    id: 'dy-sup1', code: 'DY-001', name: 'Pune Cluster Farmer Co-operative (Cluster A)', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Co-op Secretary Vijay Pawar', email: 'vp.cluster.a@dairycoop.in', phone: '+91 20 2421 1111',
    address: 'Village Wagholi, Tal. Haveli', city: 'Pune', state: 'Maharashtra',
    productsServices: ['Raw cow milk (3.5%+ fat)', 'Raw buffalo milk (6%+ fat)'],
    rating: 4.4, performance: dy(91, 94), certExpiry: '2027-03-31', lastAuditDate: '2025-09-15',
    certifications: [
      { id: 'dy-sc1', name: 'FSSAI Petty Licence (group)', certificateNumber: 'FSSAI-PMC-MAH-12188', issuedBy: 'FSSAI',          issuedDate: '2024-04-01', expiryDate: '2027-03-31', status: 'VALID' },
      { id: 'dy-sc2', name: 'Quality Agreement (signed)',   certificateNumber: 'QAA-DY-2024-04',     issuedBy: 'In-house',       issuedDate: '2024-04-01', expiryDate: '2026-04-01', status: 'EXPIRED' },
    ],
    audits: [{ id: 'dy-sa1', type: 'Farm Audit', date: '2025-09-15', auditor: 'Meera Pillai', score: 86, status: 'COMPLETED', findings: '1 Major, 1 Minor — antibiotic-withdrawal log (closed)', ncCount: 2 }],
    createdAt: '2023-03-12T09:00:00Z', updatedAt: '2026-05-12T11:00:00Z',
  },
  {
    id: 'dy-sup2', code: 'DY-002', name: 'Pune Cluster Farmer Co-operative (Cluster B)', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Co-op Secretary Sundar Jadhav', email: 'sj.cluster.b@dairycoop.in', phone: '+91 20 2421 2222',
    address: 'Village Talegaon, Tal. Maval', city: 'Pune', state: 'Maharashtra',
    productsServices: ['Raw cow milk (3.5%+ fat)'],
    rating: 4.6, performance: dy(94, 95), certExpiry: '2027-04-30', lastAuditDate: '2025-09-19',
    certifications: [
      { id: 'dy-sc3', name: 'FSSAI Petty Licence (group)', certificateNumber: 'FSSAI-PMC-MAH-13044', issuedBy: 'FSSAI',          issuedDate: '2024-05-01', expiryDate: '2027-04-30', status: 'VALID' },
    ],
    audits: [{ id: 'dy-sa2', type: 'Farm Audit', date: '2025-09-19', auditor: 'Meera Pillai', score: 93, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2023-04-18T09:00:00Z', updatedAt: '2026-05-12T11:00:00Z',
  },
  {
    id: 'dy-sup3', code: 'DY-003', name: 'Pune Cluster Farmer Co-operative (Cluster C)', category: 'MAJOR', status: 'CONDITIONAL',
    contactPerson: 'Co-op Secretary Ramesh Kale', email: 'rk.cluster.c@dairycoop.in', phone: '+91 20 2421 3333',
    address: 'Village Khed, Tal. Khed', city: 'Pune', state: 'Maharashtra',
    productsServices: ['Raw cow milk (3.5%+ fat)', 'Raw buffalo milk (6%+ fat)'],
    rating: 3.7, performance: dy(82, 86), certExpiry: '2026-09-30', lastAuditDate: '2026-05-10',
    certifications: [
      { id: 'dy-sc4', name: 'FSSAI Petty Licence (group)', certificateNumber: 'FSSAI-PMC-MAH-14502', issuedBy: 'FSSAI',          issuedDate: '2023-10-01', expiryDate: '2026-09-30', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'dy-sa3', type: 'For-cause audit (antibiotic residue)', date: '2026-05-10', auditor: 'Meera Pillai', score: 76, status: 'COMPLETED', findings: '1 Major (open) — antibiotic-withdrawal documentation', ncCount: 1 }],
    createdAt: '2023-05-22T09:00:00Z', updatedAt: '2026-05-12T15:00:00Z',
  },
  {
    id: 'dy-sup4', code: 'DY-004', name: 'Uflex Healthcare Films', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Rohan Garg', email: 'rohan.garg@uflex.in', phone: '+91 120 4779 0000',
    address: 'A-1, Sector 60', city: 'Noida', state: 'Uttar Pradesh',
    productsServices: ['3-layer LDPE milk-pouch film', 'Co-extruded barrier curd-cup laminate'],
    rating: 4.5, performance: dy(93, 92), certExpiry: '2027-06-30', lastAuditDate: '2025-11-12',
    certifications: [
      { id: 'dy-sc5', name: 'BRCGS Packaging — AA',      certificateNumber: 'BRC-PKG-2024-7711',  issuedBy: 'BRC',             issuedDate: '2024-07-01', expiryDate: '2027-06-30', status: 'VALID' },
      { id: 'dy-sc6', name: 'Food-contact compliance',   certificateNumber: 'FSSAI-21-2024-2244', issuedBy: 'FSSAI',           issuedDate: '2024-08-15', expiryDate: '2026-08-14', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'dy-sa4', type: 'Routine surveillance', date: '2025-11-12', auditor: 'Priya Khanna', score: 95, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2022-08-15T09:00:00Z', updatedAt: '2026-04-20T11:00:00Z',
  },
  {
    id: 'dy-sup5', code: 'DY-005', name: 'Chr. Hansen India Pvt. Ltd.', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Dr. Sangeeta Iyer', email: 'sangeeta.iyer@chr-hansen.com', phone: '+91 20 4044 0000',
    address: 'Hinjewadi Phase II, Plot 24', city: 'Pune', state: 'Maharashtra',
    productsServices: ['DVS starter cultures (curd, dahi)', 'Probiotic strains (BB-12, LA-5)', 'Rennet for paneer'],
    rating: 4.8, performance: dy(97, 95), certExpiry: '2027-08-31', lastAuditDate: '2025-10-04',
    certifications: [
      { id: 'dy-sc7', name: 'FSSC 22000:V6', certificateNumber: 'FSSC-VAS-22000-99012', issuedBy: 'Bureau Veritas', issuedDate: '2024-09-01', expiryDate: '2027-08-31', status: 'VALID' },
      { id: 'dy-sc8', name: 'ISO 22000:2018', certificateNumber: 'BVQ-22000-11122',     issuedBy: 'Bureau Veritas', issuedDate: '2024-09-01', expiryDate: '2027-08-31', status: 'VALID' },
    ],
    audits: [{ id: 'dy-sa5', type: 'Tier-1 ingredient supplier audit', date: '2025-10-04', auditor: 'Anita Kulkarni', score: 96, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2023-09-14T09:00:00Z', updatedAt: '2026-03-30T11:00:00Z',
  },
  {
    id: 'dy-sup6', code: 'DY-006', name: 'Parry Sugar Industries', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Kaushik Subramanian', email: 'kaushik.s@parrysugar.in', phone: '+91 80 3001 4000',
    address: 'Crystal Plant, Bagalkot', city: 'Bagalkot', state: 'Karnataka',
    productsServices: ['Crystallised sugar (M30)', 'Liquid sugar (66% Brix)'],
    rating: 4.3, performance: dy(90, 92), certExpiry: '2027-05-31', lastAuditDate: '2025-12-04',
    certifications: [
      { id: 'dy-sc9',  name: 'FSSC 22000:V6', certificateNumber: 'FSSC-PSI-22-04412', issuedBy: 'TÜV India',      issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
      { id: 'dy-sc10', name: 'BIS IS 5982 (M30 sugar)', certificateNumber: 'BIS-9112-1', issuedBy: 'BIS',          issuedDate: '2024-04-15', expiryDate: '2027-04-14', status: 'VALID' },
    ],
    audits: [{ id: 'dy-sa6', type: 'Sugar supplier audit', date: '2025-12-04', auditor: 'Anita Kulkarni', score: 91, status: 'COMPLETED', findings: '1 Minor — moisture variability', ncCount: 1 }],
    createdAt: '2023-06-19T09:00:00Z', updatedAt: '2026-03-30T11:00:00Z',
  },
  {
    id: 'dy-sup7', code: 'DY-007', name: 'TGV Group SRA — Dairy Whitener Manufacturer', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Pradeep Reddy', email: 'pradeep.reddy@tgvgroup.in', phone: '+91 40 2349 6000',
    address: 'Plot 17, Patancheru SEZ', city: 'Hyderabad', state: 'Telangana',
    productsServices: ['Skim milk powder', 'Whole milk powder'],
    rating: 4.4, performance: dy(91, 90), certExpiry: '2027-09-30', lastAuditDate: '2025-12-09',
    certifications: [
      { id: 'dy-sc11', name: 'BIS IS 1165 (SMP)', certificateNumber: 'BIS-1165-552', issuedBy: 'BIS',         issuedDate: '2024-10-01', expiryDate: '2027-09-30', status: 'VALID' },
      { id: 'dy-sc12', name: 'FSSAI Central Licence', certificateNumber: 'FSSAI-CL-TS-21099', issuedBy: 'FSSAI', issuedDate: '2024-10-01', expiryDate: '2026-10-01', status: 'VALID' },
    ],
    audits: [{ id: 'dy-sa7', type: 'Milk-powder supplier audit', date: '2025-12-09', auditor: 'Anita Kulkarni', score: 92, status: 'COMPLETED', findings: '1 OFI on Pseudomonas trend reporting', ncCount: 0 }],
    createdAt: '2024-02-12T09:00:00Z', updatedAt: '2026-03-30T11:00:00Z',
  },
  {
    id: 'dy-sup8', code: 'DY-008', name: 'Tetra Pak India Pvt. Ltd.', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Sanjay Rao', email: 'sanjay.rao@tetrapak.com', phone: '+91 124 469 9000',
    address: 'Cyber City, DLF Phase II', city: 'Gurugram', state: 'Haryana',
    productsServices: ['Aseptic packaging machines + spares', '180/200/500ml TBA carton material'],
    rating: 4.7, performance: dy(95, 94), certExpiry: '2027-02-15', lastAuditDate: '2025-11-21',
    certifications: [
      { id: 'dy-sc13', name: 'ISO 22000:2018', certificateNumber: 'DNV-TPK-22-7711', issuedBy: 'DNV',     issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
      { id: 'dy-sc14', name: 'FSSC 22000:V6',  certificateNumber: 'FSSC-TPK-22-771', issuedBy: 'DNV',     issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
    ],
    audits: [{ id: 'dy-sa8', type: 'Equipment + packaging audit', date: '2025-11-21', auditor: 'Priya Khanna', score: 94, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2022-04-22T09:00:00Z', updatedAt: '2026-04-10T11:00:00Z',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE): biologics
// drug-substance + aseptic cartridge fill-finish (insulin, analogues, GLP-1).
// GMP biologics supplier mix — single-use bioprocess, chromatography, media,
// primary packaging, sterile filtration, clean utilities, cold-chain, reagents.
const bio = (q: number, d: number) => ({
  quality: q, delivery: d, cost: 82, responsiveness: 86, innovation: 81, overallScore: Math.round((q + d) / 2),
  monthlyTrend: [
    { month: 'Oct 25', score: Math.round((q + d) / 2) - 2 },
    { month: 'Nov 25', score: Math.round((q + d) / 2) - 1 },
    { month: 'Dec 25', score: Math.round((q + d) / 2)     },
    { month: 'Jan 26', score: Math.round((q + d) / 2) + 1 },
    { month: 'Feb 26', score: Math.round((q + d) / 2) + 1 },
    { month: 'Mar 26', score: Math.round((q + d) / 2) + 2 },
  ],
});

export const mockBiologicsSuppliers: Supplier[] = [
  {
    id: 'bio-sup1', code: 'SUP-BIO-0001', name: 'Sartorius Stedim MENA FZ-LLC', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Khalid Al Mansoori', email: 'khalid.almansoori@sartorius.com', phone: '+971 4 818 9000',
    address: 'Dubai Science Park, Tower B, Office 1204', city: 'Dubai', state: 'Dubai',
    productsServices: ['Single-use bioprocess bags & assemblies', 'Flexsafe 2D/3D mixing bags', 'Gamma-irradiated tubing manifolds'],
    rating: 4.7, performance: bio(95, 93), certExpiry: '2027-04-30', lastAuditDate: '2025-09-16',
    certifications: [
      { id: 'bio-sc1', name: 'ISO 9001:2015',        certificateNumber: 'TUV-SUS-90118',  issuedBy: 'TÜV SÜD',  issuedDate: '2024-05-01', expiryDate: '2027-04-30', status: 'VALID' },
      { id: 'bio-sc2', name: 'USP <88> Class VI / ISO 10993', certificateNumber: 'EXT-SUS-2241', issuedBy: 'Toxikon', issuedDate: '2024-06-12', expiryDate: '2027-06-11', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa1', type: 'Single-use supplier GMP audit', date: '2025-09-16', auditor: 'Dr. Fatima Al Hashimi', score: 94, status: 'COMPLETED', findings: '1 Minor (extractables data pack) — CAR closed', ncCount: 1 }],
    createdAt: '2024-04-12T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'bio-sup2', code: 'SUP-BIO-0002', name: 'Cytiva Bioprocess Middle East', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Dr. Lina Haddad', email: 'lina.haddad@cytiva.com', phone: '+971 2 654 7800',
    address: 'Masdar City, Incubator Building, Unit 7', city: 'Abu Dhabi', state: 'Abu Dhabi',
    productsServices: ['Protein A chromatography resin (MabSelect)', 'Ion-exchange resins', 'Pre-packed columns'],
    rating: 4.8, performance: bio(97, 94), certExpiry: '2027-08-30', lastAuditDate: '2025-08-05',
    certifications: [
      { id: 'bio-sc3', name: 'ISO 9001:2015',          certificateNumber: 'DNV-CYT-7611', issuedBy: 'DNV',  issuedDate: '2024-08-31', expiryDate: '2027-08-30', status: 'VALID' },
      { id: 'bio-sc4', name: 'EMA EXCiPACT GMP',        certificateNumber: 'EXC-2024-1144', issuedBy: 'EXCiPACT', issuedDate: '2024-01-15', expiryDate: '2026-12-31', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'bio-sa2', type: 'Chromatography resin supplier audit', date: '2025-08-05', auditor: 'Omar Khalil', score: 96, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2023-12-01T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'bio-sup3', code: 'SUP-BIO-0003', name: 'Thermo Fisher Scientific (Gibco) Gulf', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Rajesh Menon', email: 'rajesh.menon@thermofisher.com', phone: '+971 4 421 7000',
    address: 'Jebel Ali Free Zone, JAFZA One, Tower A', city: 'Dubai', state: 'Dubai',
    productsServices: ['Chemically-defined cell-culture media (CHO)', 'Feeds & supplements', 'L-glutamine substitute'],
    rating: 4.7, performance: bio(95, 92), certExpiry: '2027-11-30', lastAuditDate: '2025-11-13',
    certifications: [
      { id: 'bio-sc5', name: 'ISO 9001:2015',     certificateNumber: 'BSI-TF-22414', issuedBy: 'BSI',  issuedDate: '2024-12-01', expiryDate: '2027-11-30', status: 'VALID' },
      { id: 'bio-sc6', name: 'IPEC-PQG GMP (media)', certificateNumber: 'IPEC-TF-4118', issuedBy: 'IPEC', issuedDate: '2024-09-12', expiryDate: '2027-09-12', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa3', type: 'Cell-culture media supplier audit', date: '2025-11-13', auditor: 'Dr. Fatima Al Hashimi', score: 95, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2022-02-15T09:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'bio-sup4', code: 'SUP-BIO-0004', name: 'SCHOTT Pharma MENA', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Yasmine Bouazizi', email: 'yasmine.bouazizi@schott.com', phone: '+971 2 491 5500',
    address: 'KIZAD Industrial Zone, Plot AZ-12', city: 'Abu Dhabi', state: 'Abu Dhabi',
    productsServices: ['Type-I borosilicate glass cartridges (3ml)', 'Elastomer plungers & septa', 'Aluminium crimp caps'],
    rating: 4.6, performance: bio(94, 92), certExpiry: '2027-04-30', lastAuditDate: '2025-10-16',
    certifications: [
      { id: 'bio-sc7', name: 'ISO 15378:2017 (GMP primary packaging)', certificateNumber: 'TUV-PKG-2222', issuedBy: 'TÜV SÜD', issuedDate: '2024-05-01', expiryDate: '2027-04-30', status: 'VALID' },
      { id: 'bio-sc8', name: 'USP <660> / <381> compliance',          certificateNumber: 'INTERTEK-991', issuedBy: 'Intertek', issuedDate: '2024-09-12', expiryDate: '2026-09-12', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'bio-sa4', type: 'Primary packaging GMP audit', date: '2025-10-16', auditor: 'Omar Khalil', score: 90, status: 'COMPLETED', findings: '2 Minor — particulate trend & glass delamination study', ncCount: 2 }],
    createdAt: '2023-05-10T09:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'bio-sup5', code: 'SUP-BIO-0005', name: 'Pall Life Sciences Gulf FZE', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Sami Nasser', email: 'sami.nasser@pall.com', phone: '+971 4 883 1200',
    address: 'Dubai Investment Park, Block 4, Unit 22', city: 'Dubai', state: 'Dubai',
    productsServices: ['0.2µm sterilizing-grade filters', 'Mycoplasma-reduction filters', 'Filter integrity test cartridges'],
    rating: 4.7, performance: bio(96, 93), certExpiry: '2027-02-15', lastAuditDate: '2025-12-10',
    certifications: [
      { id: 'bio-sc9',  name: 'ISO 9001:2015',         certificateNumber: 'DNV-PALL-4477', issuedBy: 'DNV', issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
      { id: 'bio-sc10', name: 'ASTM F838 bacterial retention validation', certificateNumber: 'VAL-PALL-3041', issuedBy: 'Nelson Labs', issuedDate: '2024-02-16', expiryDate: '2027-02-15', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa5', type: 'Sterilizing filter supplier audit', date: '2025-12-10', auditor: 'Dr. Fatima Al Hashimi', score: 94, status: 'COMPLETED', findings: '1 OFI on validation guide revision', ncCount: 0 }],
    createdAt: '2024-02-20T09:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'bio-sup6', code: 'SUP-BIO-0006', name: 'BWT Pharma & Biotech Middle East', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Hassan Al Rashed', email: 'hassan.alrashed@bwt.com', phone: '+971 2 555 9100',
    address: 'Mussafah Industrial Area, M-40, Plot 88', city: 'Abu Dhabi', state: 'Abu Dhabi',
    productsServices: ['WFI generation skids (distillation)', 'Clean steam generators', 'WFI loop qualification & service'],
    rating: 4.5, performance: bio(92, 91), certExpiry: '2027-05-31', lastAuditDate: '2026-02-05',
    certifications: [
      { id: 'bio-sc11', name: 'ISO 9001:2015',                 certificateNumber: 'BV-BWT-2102', issuedBy: 'Bureau Veritas', issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
      { id: 'bio-sc12', name: 'USP <1231> / Ph.Eur. WFI qualification', certificateNumber: 'QUAL-BWT-3110', issuedBy: 'In-house Validation', issuedDate: '2024-08-12', expiryDate: '2027-08-11', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa6', type: 'Clean-utilities vendor audit', date: '2026-02-05', auditor: 'Omar Khalil', score: 91, status: 'COMPLETED', findings: '1 Minor — endotoxin sampling SOP', ncCount: 1 }],
    createdAt: '2024-05-08T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'bio-sup7', code: 'SUP-BIO-0007', name: 'Emirates Cold Chain Logistics LLC', category: 'CRITICAL', status: 'APPROVED',
    contactPerson: 'Noura Al Suwaidi', email: 'noura.alsuwaidi@emiratescoldchain.ae', phone: '+971 2 677 4400',
    address: 'ICAD III, Logistics Park, Building L-9', city: 'Abu Dhabi', state: 'Abu Dhabi',
    productsServices: ['2-8°C GDP cold-chain transport', 'Validated reefer & qualified shippers', 'Temperature-excursion management'],
    rating: 4.6, performance: bio(94, 93), certExpiry: '2027-07-31', lastAuditDate: '2025-08-23',
    certifications: [
      { id: 'bio-sc13', name: 'EU GDP (2013/C 343/01) compliance', certificateNumber: 'GDP-ECC-9912', issuedBy: 'SGS', issuedDate: '2024-08-01', expiryDate: '2027-07-31', status: 'VALID' },
      { id: 'bio-sc14', name: 'IATA CEIV Pharma',                  certificateNumber: 'CEIV-ECC-3344', issuedBy: 'IATA', issuedDate: '2024-04-15', expiryDate: '2027-04-14', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa7', type: 'Cold-chain logistics GDP audit', date: '2025-08-23', auditor: 'Dr. Fatima Al Hashimi', score: 93, status: 'COMPLETED', findings: 'No findings', ncCount: 0 }],
    createdAt: '2023-08-12T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'bio-sup8', code: 'SUP-BIO-0008', name: 'USP Reference Standards & Bioassay Reagents', category: 'MAJOR', status: 'APPROVED',
    contactPerson: 'Dr. Amira El-Sayed', email: 'amira.elsayed@usp-reagents.com', phone: '+971 4 360 5500',
    address: 'Dubai Healthcare City, Building 27, Block A', city: 'Dubai', state: 'Dubai',
    productsServices: ['Insulin reference standards', 'GLP-1 bioassay reagents', 'HPLC system suitability standards'],
    rating: 4.5, performance: bio(93, 90), certExpiry: '2027-09-30', lastAuditDate: '2025-09-05',
    certifications: [
      { id: 'bio-sc15', name: 'ISO 17034 (reference material producer)', certificateNumber: 'ILAC-RMP-21077', issuedBy: 'ILAC',  issuedDate: '2024-10-01', expiryDate: '2027-09-30', status: 'VALID' },
      { id: 'bio-sc16', name: 'ISO/IEC 17025',                            certificateNumber: 'ILAC-T-2244', issuedBy: 'ILAC', issuedDate: '2024-02-15', expiryDate: '2027-02-14', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa8', type: 'Reference standard supplier audit', date: '2025-09-05', auditor: 'Omar Khalil', score: 92, status: 'COMPLETED', findings: '1 OFI on CoA traceability', ncCount: 0 }],
    createdAt: '2022-11-18T09:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'bio-sup9', code: 'SUP-BIO-0009', name: 'Hamilton Process Analytics MENA', category: 'MAJOR', status: 'CONDITIONAL',
    contactPerson: 'Tariq Bensalah', email: 'tariq.bensalah@hamilton.ae', phone: '+971 6 557 2200',
    address: 'Sharjah Research, Technology & Innovation Park, Unit 14', city: 'Sharjah', state: 'Sharjah',
    productsServices: ['Single-use pH/DO sensors', 'Optical viable-cell-density probes', 'Pre-calibrated sensor patches'],
    rating: 3.8, performance: bio(82, 84), certExpiry: '2026-09-30', lastAuditDate: '2026-05-11',
    certifications: [
      { id: 'bio-sc17', name: 'ISO 9001:2015', certificateNumber: 'IRQS-HAM-3320', issuedBy: 'IRQS', issuedDate: '2023-10-01', expiryDate: '2026-09-30', status: 'EXPIRING_SOON' },
      { id: 'bio-sc18', name: 'Sensor calibration validation', certificateNumber: 'CAL-HAM-3411', issuedBy: 'In-house Lab', issuedDate: '2024-04-21', expiryDate: '2026-04-21', status: 'EXPIRING_SOON' },
    ],
    audits: [{ id: 'bio-sa9', type: 'For-cause audit (calibration drift)', date: '2026-05-11', auditor: 'Dr. Fatima Al Hashimi', score: 75, status: 'COMPLETED', findings: '1 Major (open), 1 Minor — sensor pre-calibration documentation', ncCount: 2 }],
    createdAt: '2024-10-12T09:00:00Z', updatedAt: '2026-05-12T15:00:00Z',
  },
  {
    id: 'bio-sup10', code: 'SUP-BIO-0010', name: 'Gulf Pharma Printpack LLC', category: 'MAJOR', status: 'PENDING',
    contactPerson: 'Reema Al Farsi', email: 'reema.alfarsi@gulfprintpack.ae', phone: '+971 2 558 7700',
    address: 'Mussafah Industrial Area, M-32, Plot 41', city: 'Abu Dhabi', state: 'Abu Dhabi',
    productsServices: ['Secondary cartons & inserts', 'Braille-embossed labels', 'Serialization-ready leaflets'],
    rating: 4.0, performance: bio(86, 85), certExpiry: '2027-05-31', lastAuditDate: '2026-02-06',
    certifications: [
      { id: 'bio-sc19', name: 'ISO 15378:2017 (secondary packaging)', certificateNumber: 'TUV-PKG-66501', issuedBy: 'TÜV SÜD', issuedDate: '2024-06-01', expiryDate: '2027-05-31', status: 'VALID' },
    ],
    audits: [{ id: 'bio-sa10', type: 'Initial qualification audit', date: '2026-02-06', auditor: 'Omar Khalil', score: 85, status: 'COMPLETED', findings: '3 Minor — qualification in progress', ncCount: 3 }],
    createdAt: '2025-12-10T09:00:00Z', updatedAt: '2026-02-15T11:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface SupplierFilters {
  status?: string;
  category?: string;
  search?: string;
}

export function useSuppliers(filters: SupplierFilters = {}) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['suppliers', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/suppliers', { params: filters });
        return unwrapList<Supplier>(data, normalizeSupplier);
      } catch {
        const baseList = pickByIndustry(industry, mockSuppliers, { medical_device: mockMedicalDeviceSuppliers, dairy: mockDairySuppliers, biologics: mockBiologicsSuppliers });
        let filtered = [...baseList];
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
  const industry = useUserIndustry();
  return useQuery<Supplier>({
    queryKey: ['suppliers', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/suppliers/${id}`);
        return unwrapItem<Supplier>(data, normalizeSupplier);
      } catch {
        const baseList = pickByIndustry(industry, mockSuppliers, { medical_device: mockMedicalDeviceSuppliers, dairy: mockDairySuppliers, biologics: mockBiologicsSuppliers });
        const supplier = baseList.find((s) => s.id === id);
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
