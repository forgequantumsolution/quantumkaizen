import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

export type InspectionType = 'INCOMING' | 'IN_PROCESS' | 'FINAL' | 'RECEIVING';
export type InspectionResult = 'PASS' | 'FAIL' | 'CONDITIONAL_PASS' | 'PENDING';

export interface InspectionRecord {
  id: string;
  inspectionNumber: string;
  type: InspectionType;
  result: InspectionResult;
  partNumber: string;
  partName: string;
  supplier?: string;
  batchNumber: string;
  quantity: number;
  sampledQuantity: number;
  defectsFound: number;
  inspector: string;
  inspectedAt: string;
  disposition: string;
  notes: string;
  createdAt: string;
}

const mock: InspectionRecord[] = [
  // ── 2026 records ──
  {
    id: 'INS-001', inspectionNumber: 'INS-2026-001', type: 'RECEIVING', result: 'PENDING',
    partNumber: 'RM-WFI-001', partName: 'Water for Injection (WFI) — Injectable Grade',
    supplier: 'On-site Generation (Multi-effect Distillation)',
    batchNumber: 'WFI-2026-0418', quantity: 5000, sampledQuantity: 6, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-04-18',
    disposition: 'Pending QC release — TOC, conductivity, and endotoxin tests in progress',
    notes: 'Samples dispatched to QC lab; results expected within 24 hours per SOP-QC-019',
    createdAt: '2026-04-18',
  },
  {
    id: 'INS-002', inspectionNumber: 'INS-2026-002', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-PCT-API-001', partName: 'Paracetamol API (Ph. Eur. / USP grade)',
    supplier: "Divi's Laboratories Ltd",
    batchNumber: 'DL-PCT-2026-0041', quantity: 500, sampledQuantity: 3, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-04-10',
    disposition: 'Accepted — released to approved raw material store',
    notes: 'Identity (IR), assay 99.6% (spec 98.0–101.5%), water content 0.4% (NMT 0.5%), microbial limits within Ph. Eur. limits; CoA verified against approved specification',
    createdAt: '2026-04-10',
  },
  {
    id: 'INS-003', inspectionNumber: 'INS-2026-003', type: 'INCOMING', result: 'CONDITIONAL_PASS',
    partNumber: 'PM-BF-PVDC-001', partName: 'PVDC-coated Blister Foil 250 µm',
    supplier: 'Uflex Ltd',
    batchNumber: 'UF-BF-2026-0031', quantity: 200000, sampledQuantity: 20, defectsFound: 2,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-03-28',
    disposition: 'Conditional accept — 2 rolls with edge thickness deviation quarantined; remainder released after sorting',
    notes: 'Thickness deviation of +8 µm on edges of 2 rolls (spec ±5 µm); PVDC coating weight, heat-seal strength, and print legibility on remaining 18 rolls within specification; NC-2026-0012 raised',
    createdAt: '2026-03-28',
  },
  {
    id: 'INS-004', inspectionNumber: 'INS-2026-004', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-MET-GRAN-001', partName: 'Metformin 500mg — Granulation (Moisture Content Check)',
    supplier: undefined,
    batchNumber: 'MET-2026-0022', quantity: 250, sampledQuantity: 10, defectsFound: 0,
    inspector: 'Vikram Patel', inspectedAt: '2026-03-21',
    disposition: 'Approved — proceed to compression',
    notes: 'Loss on drying (LOD) 1.8% w/w across all 10 samples; specification NMT 2.0%; granule PSD and bulk density within approved limits per BMR-MET-500-003',
    createdAt: '2026-03-21',
  },
  {
    id: 'INS-005', inspectionNumber: 'INS-2026-005', type: 'IN_PROCESS', result: 'CONDITIONAL_PASS',
    partNumber: 'WIP-PCT-COMP-001', partName: 'Paracetamol 500mg — Tablet Compression (Weight Uniformity)',
    supplier: undefined,
    batchNumber: 'PCT-2026-0019', quantity: 500000, sampledQuantity: 20, defectsFound: 2,
    inspector: 'Vikram Patel', inspectedAt: '2026-03-14',
    disposition: 'Conditional — line speed reduced; 2 tablets reworked; re-sampled and passed',
    notes: '2 of 20 tablets outside ±5% weight variation limit (618 mg and 524 mg vs. target 600 mg); punches inspected and worn tip replaced on position 14; subsequent 20-tablet sample fully within specification',
    createdAt: '2026-03-14',
  },
  {
    id: 'INS-006', inspectionNumber: 'INS-2026-006', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-PCT-500-001', partName: 'Paracetamol 500mg Tablets — Batch Release',
    supplier: undefined,
    batchNumber: 'PCT-2026-0015', quantity: 480000, sampledQuantity: 200, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2026-02-28',
    disposition: 'Released — Certificate of Analysis issued; dispatched to distribution',
    notes: 'All Ph. Eur. 9.0 release tests passed: description, identification (IR, UV), assay 99.8%, dissolution Q≥80% at 30 min (result 96%), disintegration 4 min, uniformity of dosage units, related substances within limits; sterility not applicable',
    createdAt: '2026-02-28',
  },
  // ── 2025 records ──
  {
    id: 'INS-007', inspectionNumber: 'INS-2025-048', type: 'INCOMING', result: 'FAIL',
    partNumber: 'RM-AMX-API-001', partName: 'Amoxicillin Trihydrate API (Ph. Eur. grade)',
    supplier: 'Hikal Ltd',
    batchNumber: 'HK-AMX-2025-0117', quantity: 300, sampledQuantity: 3, defectsFound: 1,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-11-14',
    disposition: 'Rejected — returned to supplier under NCR-2025-0038; replacement lot requested',
    notes: 'Assay result 97.1% (specification NLT 98.0% on anhydrous basis); two additional repeat analyses confirmed OOS; identity test (IR) passed; water content within limit; NC raised and supplier notified same day',
    createdAt: '2025-11-14',
  },
  {
    id: 'INS-008', inspectionNumber: 'INS-2025-039', type: 'INCOMING', result: 'PASS',
    partNumber: 'PM-GV-I-001', partName: 'Type I Borosilicate Glass Vials 10 mL (Ondansetron)',
    supplier: 'Schott AG',
    batchNumber: 'SC-GV-2025-0892', quantity: 50000, sampledQuantity: 125, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-09-22',
    disposition: 'Accepted — released to primary packaging store (controlled access)',
    notes: 'AQL 1.0 inspection: dimensions (height, OD, neck OD) within tolerance; particulate matter (visual and automated) zero critical defects; hydrolytic resistance (Type I confirmation by Ph. Eur. 3.2.1) passed; CoC verified',
    createdAt: '2025-09-22',
  },
  {
    id: 'INS-009', inspectionNumber: 'INS-2025-031', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-HPMC-EXC-001', partName: 'HPMC (Hypromellose) K4M — Tablet Binder',
    supplier: 'Colorcon Ltd',
    batchNumber: 'CL-HPMC-2025-0441', quantity: 100, sampledQuantity: 3, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-07-08',
    disposition: 'Accepted — released to excipient store',
    notes: 'Viscosity 3800 mPa·s (specification 3000–5600 mPa·s at 2% solution, 20°C); moisture content 3.2% (NMT 5.0%); loss on drying, substitution type, and identification by IR all within Ph. Eur. 2.2.27 specification',
    createdAt: '2025-07-08',
  },
  {
    id: 'INS-010', inspectionNumber: 'INS-2025-018', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MET-500-001', partName: 'Metformin 500mg Tablets — Batch Release',
    supplier: undefined,
    batchNumber: 'MET-2025-0009', quantity: 460000, sampledQuantity: 200, defectsFound: 1,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-04-25',
    disposition: 'Rejected — batch quarantined; OOS investigation initiated (OOS-2025-004)',
    notes: 'Dissolution failure: Q value 68% at 45 min (specification Q ≥ 75%); repeat analysis on second sample set confirmed OOS (65%); batch placed on quarantine hold; root cause investigation pointed to granulation endpoint moisture excursion in preceding in-process step',
    createdAt: '2025-04-25',
  },
  {
    id: 'INS-011', inspectionNumber: 'INS-2025-008', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-ONS-FILL-001', partName: 'Ondansetron 4mg/2mL Injection — Aseptic Fill (Fill Volume Check)',
    supplier: undefined,
    batchNumber: 'ONS-2025-0003', quantity: 20000, sampledQuantity: 20, defectsFound: 0,
    inspector: 'Vikram Patel', inspectedAt: '2025-02-11',
    disposition: 'Approved — proceed to lyophilisation hold and visual inspection',
    notes: 'Fill volume mean 2.04 mL (specification 2.0 mL ± 0.1 mL); all 20 vials within limits; particulate visual inspection during fill: no visible particulates; environmental monitoring at time of fill: Grade A viable count <1 CFU/m³',
    createdAt: '2025-02-11',
  },
  {
    id: 'INS-012', inspectionNumber: 'INS-2025-002', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-OME-20-001', partName: 'Omeprazole 20mg Capsules — Batch Release',
    supplier: undefined,
    batchNumber: 'OME-2025-0001', quantity: 360000, sampledQuantity: 200, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2025-01-20',
    disposition: 'Released — CoA issued; transferred to finished goods store',
    notes: 'All Ph. Eur. release specifications met: description, identification (HPLC, UV), assay 99.1%, acid resistance (≤10% dissolved at 120 min in 0.1M HCl), dissolution after buffer switch ≥75% at 45 min (result 88%); water content 3.1% (NMT 5.0%)',
    createdAt: '2025-01-20',
  },
  // ── 2024 records ──
  {
    id: 'INS-013', inspectionNumber: 'INS-2024-042', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-AMX-ENC-001', partName: 'Amoxicillin 250mg Capsules — Encapsulation (Fill Weight Uniformity)',
    supplier: undefined,
    batchNumber: 'AMX-2024-0031', quantity: 300000, sampledQuantity: 20, defectsFound: 0,
    inspector: 'Vikram Patel', inspectedAt: '2024-10-17',
    disposition: 'Approved — proceed to polishing and primary packaging',
    notes: 'Mean fill weight 286 mg (target 286 mg); all 20 capsules within ±7.5% limit per Ph. Eur. 2.9.5; capsule lock-length and appearance (no telescoping, splits) satisfactory',
    createdAt: '2024-10-17',
  },
  {
    id: 'INS-014', inspectionNumber: 'INS-2024-029', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-MET-API-001', partName: 'Metformin Hydrochloride API (Ph. Eur. grade)',
    supplier: "Divi's Laboratories Ltd",
    batchNumber: 'DL-MET-2024-0078', quantity: 1000, sampledQuantity: 4, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2024-07-30',
    disposition: 'Accepted — released to approved raw material store',
    notes: 'Assay 99.8% (spec 99.0–101.0%); identification by IR confirmed; chloride limit, melting point, loss on drying, heavy metals, and microbial limits all within Ph. Eur. 0931 specification; CoA cross-checked against approved specification SPC-RM-MET-001',
    createdAt: '2024-07-30',
  },
  {
    id: 'INS-015', inspectionNumber: 'INS-2024-011', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-ONS-INJ-001', partName: 'Ondansetron 4mg/2mL Injection — Batch Release',
    supplier: undefined,
    batchNumber: 'ONS-2024-0004', quantity: 18500, sampledQuantity: 60, defectsFound: 0,
    inspector: 'Rajesh Kumar', inspectedAt: '2024-03-19',
    disposition: 'Released — sterility confirmed; CoA issued; dispatched to cold chain distribution',
    notes: 'Sterility (Ph. Eur. 2.6.1) passed — no growth at 14 days; bacterial endotoxins 0.04 EU/mL (specification NMT 0.5 EU/mL); assay 99.4%; pH 3.6 (spec 3.3–4.0); particulate matter (sub-visible, LO method) within Ph. Eur. 2.9.19 limits; 100% visual inspection passed',
    createdAt: '2024-03-19',
  },
];

// Medical-device inspection records — incoming materials, in-process and final release.
const mockMedicalDevice: InspectionRecord[] = [
  {
    id: 'INS-MD-001', inspectionNumber: 'INS-MD-2026-001', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-MD-TI-001', partName: 'Medical-grade Titanium Ti-6Al-4V ELI Bar Stock (ASTM F136)',
    supplier: 'Sandvik Materials Technology India',
    batchNumber: 'SMT-Ti-2026-0124', quantity: 200, sampledQuantity: 5, defectsFound: 0,
    inspector: 'Sneha Kapoor', inspectedAt: '2026-04-14',
    disposition: 'Accepted — released to controlled raw-material store',
    notes: 'Chemistry within ASTM F136 limits; tensile per ASTM E8; ultrasonic and dye-penetrant inspection clean; CoA cross-checked against approved specification SPC-RM-MD-TI-001',
    createdAt: '2026-04-14',
  },
  {
    id: 'INS-MD-002', inspectionNumber: 'INS-MD-2026-002', type: 'INCOMING', result: 'CONDITIONAL_PASS',
    partNumber: 'RM-MD-PLA-001', partName: 'PLA Bioresorbable Resin Lot SP-PLA-2026-0048',
    supplier: 'Specur Polymers Pvt. Ltd.',
    batchNumber: 'SP-PLA-2026-0048', quantity: 500, sampledQuantity: 5, defectsFound: 1,
    inspector: 'Sneha Kapoor', inspectedAt: '2026-03-19',
    disposition: 'Conditional — release pending ISO 10993-5 cytotoxicity retest; lot held for OBS family use',
    notes: 'IV viscosity within range; DSC profile compliant. CoA flagged supplier site change — NC-MD-2026-0039 raised; biocompatibility retest in progress at BST CRO Pune',
    createdAt: '2026-03-19',
  },
  {
    id: 'INS-MD-003', inspectionNumber: 'INS-MD-2026-003', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-MD-IOL-MOULD', partName: 'IOL Injection Mould Run — Cavity 03 (Post Tooling Replacement)',
    batchNumber: 'IOL-26-0033B', quantity: 1200, sampledQuantity: 30, defectsFound: 0,
    inspector: 'Karthik Iyer', inspectedAt: '2026-03-22',
    disposition: 'Approved — proceed to packaging',
    notes: 'Sub-visible particle count zero on AOI sample; dimensional readings within ±0.005 mm; cavity 03 tooling revalidated per CAPA-MD-2026-0011',
    createdAt: '2026-03-22',
  },
  {
    id: 'INS-MD-004', inspectionNumber: 'INS-MD-2026-004', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-MD-HEAT-SEAL', partName: 'Heart-valve pouch heat seal — seal-strength burst test (ASTM F2096)',
    batchNumber: 'HV-26-0014', quantity: 240, sampledQuantity: 6, defectsFound: 0,
    inspector: 'Neha Bansal', inspectedAt: '2026-03-30',
    disposition: 'Approved — release as per ISO 11607-1',
    notes: 'Burst-test results 28–32 psi (spec ≥25 psi); SPC chart shows seal temperature stable at 165 °C ±1.5 °C',
    createdAt: '2026-03-30',
  },
  {
    id: 'INS-MD-005', inspectionNumber: 'INS-MD-2026-005', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-MD-IOL-25', partName: 'Intraocular Lens — Batch Release IOL-26-0034',
    batchNumber: 'IOL-26-0034', quantity: 1800, sampledQuantity: 50, defectsFound: 0,
    inspector: 'Dr. Anjali Verma', inspectedAt: '2026-04-02',
    disposition: 'Released — CoA issued; transferred to bonded finished-goods store',
    notes: 'Optical-power, dioptric tolerance and visual inspection per IS 14794; sterility USP <71> pass at 14 days; endotoxin LAL <0.5 EU/device',
    createdAt: '2026-04-02',
  },
  {
    id: 'INS-MD-006', inspectionNumber: 'INS-MD-2026-006', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MD-ISET-26', partName: 'Infusion Set — Batch Release ISET-26-0118 (EO Residual OOS)',
    batchNumber: 'ISET-26-0118', quantity: 12000, sampledQuantity: 6, defectsFound: 6,
    inspector: 'Karthik Iyer', inspectedAt: '2026-03-30',
    disposition: 'Rejected — held in bonded store; reprocess via 14-hr aeration cycle per CR-MD-2026-0013',
    notes: 'EO residual 14.2 mg/device (spec ≤4 mg); ECH 9.8 mg (spec ≤9 mg). NC-MD-2026-0042 / CAPA-MD-2026-0019 open',
    createdAt: '2026-03-30',
  },
  {
    id: 'INS-MD-007', inspectionNumber: 'INS-MD-2025-097', type: 'INCOMING', result: 'PASS',
    partNumber: 'PM-MD-TYVEK-001', partName: 'Tyvek 1073B Sterile-barrier roll stock',
    supplier: 'Nelipak Healthcare Packaging',
    batchNumber: 'NEL-TY-2025-0902', quantity: 50000, sampledQuantity: 25, defectsFound: 0,
    inspector: 'Neha Bansal', inspectedAt: '2025-12-09',
    disposition: 'Accepted — released to sterile-packaging store',
    notes: 'Basis weight, MVTR and tensile strength within ASTM F1980 limits; CoC verified; seal integrity sample passed bubble-emission test',
    createdAt: '2025-12-09',
  },
  {
    id: 'INS-MD-008', inspectionNumber: 'INS-MD-2025-072', type: 'INCOMING', result: 'PASS',
    partNumber: 'PM-MD-GLASS-001', partName: 'Type I Borosilicate Vials — Stent Saline Soak',
    supplier: 'Schott AG',
    batchNumber: 'SC-GV-2025-0411', quantity: 30000, sampledQuantity: 60, defectsFound: 0,
    inspector: 'Karthik Iyer', inspectedAt: '2025-10-04',
    disposition: 'Accepted — released to controlled primary-packaging area',
    notes: 'AQL 0.65: dimensional and hydrolytic resistance compliant per Ph. Eur. 3.2.1; visual inspection no critical defects',
    createdAt: '2025-10-04',
  },
  {
    id: 'INS-MD-009', inspectionNumber: 'INS-MD-2025-051', type: 'FINAL', result: 'CONDITIONAL_PASS',
    partNumber: 'FP-MD-HV-25', partName: 'Heart-valve sterile barrier release — HV-25-0061 (Re-release after CAPA)',
    batchNumber: 'HV-25-0061R', quantity: 240, sampledQuantity: 60, defectsFound: 0,
    inspector: 'Dr. Anjali Verma', inspectedAt: '2025-10-02',
    disposition: 'Released after re-test post heater-element replacement',
    notes: 'Seal-strength burst 26–30 psi; reprocessed pouches under CAPA-MD-2025-0058',
    createdAt: '2025-10-02',
  },
  {
    id: 'INS-MD-010', inspectionNumber: 'INS-MD-2025-029', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-MD-CR-EM', partName: 'Class 7 Cleanroom Environmental Monitoring — Morning Sample',
    batchNumber: 'EM-CR-2025-073', quantity: 1, sampledQuantity: 6, defectsFound: 0,
    inspector: 'Neha Bansal', inspectedAt: '2025-06-18',
    disposition: 'Approved — cleanroom open for production',
    notes: 'Viable air ≤ 1 CFU/m³ (action 5); non-viable particles within ISO 14644 Class 7 limits',
    createdAt: '2025-06-18',
  },
  // ── Disposables product family ──────────────────────────────────────────
  {
    id: 'INS-MD-011', inspectionNumber: 'INS-MD-2026-011', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MD-DSY-26', partName: 'Disposable Syringe Release — 5 mL Lot DSY-26-0204 (particulate)',
    batchNumber: 'DSY-26-0204', quantity: 48000, sampledQuantity: 4800, defectsFound: 38,
    inspector: 'Sneha Kapoor', inspectedAt: '2026-04-01',
    disposition: 'Rejected — lot quarantined; NC-MD-2026-0037 / CAPA-MD-2026-0021 open',
    notes: 'AOI rejected 38 / 4 800 units for sub-visible particulate inside the barrel; FTIR identified silicone-oil agglomerates. Lot held pending CAPA effectiveness.',
    createdAt: '2026-04-01',
  },
  {
    id: 'INS-MD-012', inspectionNumber: 'INS-MD-2026-012', type: 'IN_PROCESS', result: 'CONDITIONAL_PASS',
    partNumber: 'WIP-MD-HYP-26', partName: 'Hypodermic Needle Pin-Bend Inspection — 23G × 1" Lot HYP-26-0312',
    batchNumber: 'HYP-26-0312', quantity: 96000, sampledQuantity: 9600, defectsFound: 40,
    inspector: 'Karthik Iyer', inspectedAt: '2026-03-27',
    disposition: 'Conditional — 100% re-inspection; line NAM-04 stopped pending cam-follower replacement',
    notes: 'Pin-bend rate 0.42% vs. limit NMT 0.30% per ASTM F1816 / IS 10654. Cam follower wear identified on NAM-04 carriage; NC-MD-2026-0036 / CAPA-MD-2026-0020 open.',
    createdAt: '2026-03-27',
  },
  {
    id: 'INS-MD-013', inspectionNumber: 'INS-MD-2026-013', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MD-IVC-26', partName: 'IV Cannula Release — 20G Lot IVC-26-0089 (under-flow)',
    batchNumber: 'IVC-26-0089', quantity: 36000, sampledQuantity: 20, defectsFound: 4,
    inspector: 'Sneha Kapoor', inspectedAt: '2026-04-03',
    disposition: 'Rejected — lot quarantined; extrusion line EX-02 re-zeroed',
    notes: 'Gravity flow-rate per ISO 10555-5 measured 49 mL/min vs. ≥55 mL/min spec; mean 51.2 mL/min, 4 of 20 below limit. Wall-thickness drift confirmed via laser micrometer.',
    createdAt: '2026-04-03',
  },
  {
    id: 'INS-MD-014', inspectionNumber: 'INS-MD-2026-014', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MD-ADS-26', partName: 'Auto-disable Syringe Function Verification — 1 mL Lot ADS-26-0048',
    batchNumber: 'ADS-26-0048', quantity: 100000, sampledQuantity: 200, defectsFound: 3,
    inspector: 'Dr. Anjali Verma', inspectedAt: '2026-04-07',
    disposition: 'Rejected — UNICEF tender batch held; NC-MD-2026-0034 raised',
    notes: 'WHO PQS E13/IM01.3 verification — 3 of 200 sampled units allowed retraction after single use; lock-tab dimensional drift suspected on Line ADS-2.',
    createdAt: '2026-04-07',
  },
  {
    id: 'INS-MD-015', inspectionNumber: 'INS-MD-2026-015', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-MD-FCT-26', partName: 'Foley Catheter Balloon Burst-Volume — 18Fr Lot FCT-26-0067',
    batchNumber: 'FCT-26-0067', quantity: 240, sampledQuantity: 20, defectsFound: 18,
    inspector: 'Karthik Iyer', inspectedAt: '2026-04-10',
    disposition: 'Rejected — recall of distributed cartons initiated',
    notes: 'Balloon burst per ISO 20696 measured mean 78 mL vs. NMT 50 mL spec; 18 of 20 above limit. Silicone-bath thermocouple +3.8 °C out-of-cal. NC-MD-2026-0033 / CMP-MD-2026-0016 raised.',
    createdAt: '2026-04-10',
  },
  {
    id: 'INS-MD-016', inspectionNumber: 'INS-MD-2026-016', type: 'IN_PROCESS', result: 'PASS',
    partNumber: 'WIP-MD-ISET-26', partName: 'IV Administration Set — Drop Chamber Visual Inspection',
    batchNumber: 'ISET-26-0205', quantity: 24000, sampledQuantity: 240, defectsFound: 0,
    inspector: 'Karthik Iyer', inspectedAt: '2026-04-05',
    disposition: 'Approved — proceed to EO sterilization',
    notes: 'Drop chamber clarity, spike integrity, tubing burst (≥45 psi) and roller clamp closure all within spec per ISO 8536-4',
    createdAt: '2026-04-05',
  },
  {
    id: 'INS-MD-017', inspectionNumber: 'INS-MD-2026-017', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-MD-PP-001', partName: 'Medical-grade Polypropylene Pellets (RIL USP Class VI)',
    supplier: 'Reliance Industries Ltd. — Polymers Division',
    batchNumber: 'RIL-PP-2026-0411', quantity: 5000, sampledQuantity: 50, defectsFound: 0,
    inspector: 'Sneha Kapoor', inspectedAt: '2026-04-02',
    disposition: 'Accepted — released to syringe-line raw-material store',
    notes: 'MFI and density within validated range; USP Class VI biocompatibility CoA verified; lot traceability matches PO',
    createdAt: '2026-04-02',
  },
  {
    id: 'INS-MD-018', inspectionNumber: 'INS-MD-2026-018', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-MD-NDL-TUBE', partName: 'Stainless Steel 304 Needle Tubing (NIPRO drawn 23G OD)',
    supplier: 'NIPRO India Corporation Pvt. Ltd.',
    batchNumber: 'NIP-NT-2026-0228', quantity: 50000, sampledQuantity: 60, defectsFound: 0,
    inspector: 'Sneha Kapoor', inspectedAt: '2026-04-08',
    disposition: 'Accepted — released to needle-line cleanroom',
    notes: 'OD and ID within ASTM A249 / IS 6911 tolerance; ultrasonic and pin-bend pre-screen pass; lot CoA verified',
    createdAt: '2026-04-08',
  },
];

// Dairy tenant — FSSAI / ISO 22000 inspection records.
const mockDairy: InspectionRecord[] = [
  {
    id: 'INS-DY-001', inspectionNumber: 'INS-DY-2026-001', type: 'RECEIVING', result: 'FAIL',
    partNumber: 'RM-RAW-MILK-T0512', partName: 'Raw milk — Tanker T-2026-0512 (AfM1 OOS)',
    supplier: 'Pune Cluster Farmer Co-operative (Cluster A)',
    batchNumber: 'T-2026-0512', quantity: 6000, sampledQuantity: 1, defectsFound: 1,
    inspector: 'Sandeep Joshi', inspectedAt: '2026-05-15',
    disposition: 'Rejected — diverted to non-food disposal; NC-DY-2026-0042 / CAPA-DY-2026-0019 open',
    notes: 'ELISA AfM1 = 0.71 µg/kg vs. FSSAI 2.3.5 limit ≤ 0.5 µg/kg. Cattle-feed audit launched at 4 source villages.',
    createdAt: '2026-05-15',
  },
  {
    id: 'INS-DY-002', inspectionNumber: 'INS-DY-2026-002', type: 'RECEIVING', result: 'FAIL',
    partNumber: 'RM-RAW-MILK-T0498', partName: 'Raw milk — Tanker T-2026-0498 (beta-lactam positive)',
    supplier: 'Pune Cluster Farmer Co-operative (Cluster C)',
    batchNumber: 'T-2026-0498', quantity: 4800, sampledQuantity: 2, defectsFound: 1,
    inspector: 'Sandeep Joshi', inspectedAt: '2026-05-07',
    disposition: 'Rejected — segregated at receiving bay; NC-DY-2026-0040 / CAPA-DY-2026-0017',
    notes: 'Charm SL beta-lactam positive on first + confirmatory tests. Source farm suspended.',
    createdAt: '2026-05-07',
  },
  {
    id: 'INS-DY-003', inspectionNumber: 'INS-DY-2026-003', type: 'RECEIVING', result: 'PASS',
    partNumber: 'RM-RAW-MILK-T0533', partName: 'Raw milk — Tanker T-2026-0533',
    supplier: 'Pune Cluster Farmer Co-operative (Cluster B)',
    batchNumber: 'T-2026-0533', quantity: 5800, sampledQuantity: 6, defectsFound: 0,
    inspector: 'Rohit Pawar', inspectedAt: '2026-05-16',
    disposition: 'Accepted — released to pasteurization feed tank',
    notes: 'Temp 4.2 °C; fat 3.8% / SNF 8.7%; COB negative; antibiotic dipstick negative; AfM1 ELISA 0.18 µg/kg; FPD −0.534 °C (no water adulteration).',
    createdAt: '2026-05-16',
  },
  {
    id: 'INS-DY-004', inspectionNumber: 'INS-DY-2026-004', type: 'IN_PROCESS', result: 'FAIL',
    partNumber: 'WIP-PHE-01-PHOS', partName: 'PHE-01 post-pasteurization phosphatase test — Batch PTM-26-0413',
    batchNumber: 'PTM-26-0413', quantity: 1, sampledQuantity: 3, defectsFound: 3,
    inspector: 'Ravi Deshmukh', inspectedAt: '2026-04-18',
    disposition: 'Re-pasteurize through PHE-01 after temperature controller recalibration; NC-DY-2026-0038',
    notes: 'Phosphatase positive — under-pasteurization confirmed. PHE-01 outlet thermometer drift.',
    createdAt: '2026-04-18',
  },
  {
    id: 'INS-DY-005', inspectionNumber: 'INS-DY-2026-005', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-PTM-1L', partName: 'Pasteurized Toned Milk 1L — Batch PTM-26-0431 (TPC OOS)',
    batchNumber: 'PTM-26-0431', quantity: 14400, sampledQuantity: 12, defectsFound: 6,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-05-11',
    disposition: 'Rejected — recall initiated at 12 retail depots; NC-DY-2026-0041 / CAPA-DY-2026-0018',
    notes: 'TPC = 95 000 cfu/ml vs. FSSAI limit NMT 30 000 cfu/ml; phosphatase negative — post-pasteurization recontamination at FM-02.',
    createdAt: '2026-05-11',
  },
  {
    id: 'INS-DY-006', inspectionNumber: 'INS-DY-2026-006', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-PTM-500', partName: 'Pasteurized Toned Milk 500ml — Batch PTM-26-0438',
    batchNumber: 'PTM-26-0438', quantity: 24000, sampledQuantity: 12, defectsFound: 0,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-05-13',
    disposition: 'Released — CoA issued; transferred to cold-store dispatch',
    notes: 'TPC 4 200 cfu/ml; coliform 0; phosphatase negative; fat 3.0% / SNF 8.6%; drop test pass.',
    createdAt: '2026-05-13',
  },
  {
    id: 'INS-DY-007', inspectionNumber: 'INS-DY-2026-007', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-DAH-200', partName: 'Set Curd 200g — Lot DAH-26-0167 (coliform)',
    batchNumber: 'DAH-26-0167', quantity: 4800, sampledQuantity: 8, defectsFound: 4,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-04-02',
    disposition: 'Rejected — diverted to non-food disposal; NC-DY-2026-0034 / CAPA-DY-2026-0018',
    notes: 'Coliform 12 cfu/g vs. FSSAI limit <10 cfu/g. CIP gap on fermentation tank FT-03.',
    createdAt: '2026-04-02',
  },
  {
    id: 'INS-DY-008', inspectionNumber: 'INS-DY-2026-008', type: 'FINAL', result: 'FAIL',
    partNumber: 'FP-GHC-1L', partName: 'Cow Ghee 1L tin — Batch GHC-26-0091 (FFA OOS)',
    batchNumber: 'GHC-26-0091', quantity: 1200, sampledQuantity: 8, defectsFound: 8,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-03-15',
    disposition: 'Rejected — diverted to industrial-grade fat; NC-DY-2026-0029',
    notes: 'FFA = 3.4% (as oleic acid) vs. BIS IS 3508 NMT 3.0%. Butter-to-ghee turnaround exceeded 48 h.',
    createdAt: '2026-03-15',
  },
  {
    id: 'INS-DY-009', inspectionNumber: 'INS-DY-2026-009', type: 'FINAL', result: 'PASS',
    partNumber: 'FP-PFC-1L', partName: 'Full-cream Milk 1L pouches — Batch PFC-26-0220',
    batchNumber: 'PFC-26-0220', quantity: 18000, sampledQuantity: 10, defectsFound: 0,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-05-14',
    disposition: 'Released — CoA issued; transferred to cold-store',
    notes: 'Fat 6.1% / SNF 9.2%; TPC 3 800 cfu/ml; coliform 0; phosphatase negative.',
    createdAt: '2026-05-14',
  },
  {
    id: 'INS-DY-010', inspectionNumber: 'INS-DY-2026-010', type: 'FINAL', result: 'CONDITIONAL_PASS',
    partNumber: 'FP-PNR-200', partName: 'Paneer 200g blocks — Lot PNR-26-0144',
    batchNumber: 'PNR-26-0144', quantity: 1800, sampledQuantity: 12, defectsFound: 2,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-05-04',
    disposition: 'Conditional release — 2 blocks with edge discolouration sorted out; remainder released',
    notes: 'Moisture 56% (FSSAI NMT 60%), fat 22% (NLT 20%), TPC 8 000 cfu/g; 2 blocks aesthetic-defect rejection.',
    createdAt: '2026-05-04',
  },
  {
    id: 'INS-DY-011', inspectionNumber: 'INS-DY-2026-011', type: 'INCOMING', result: 'PASS',
    partNumber: 'PM-FILM-DY-001', partName: 'Multi-layer LDPE Milk-pouch Film',
    supplier: 'Uflex Healthcare Films',
    batchNumber: 'UFX-FILM-2026-0314', quantity: 12000, sampledQuantity: 30, defectsFound: 0,
    inspector: 'Priya Khanna', inspectedAt: '2026-04-22',
    disposition: 'Accepted — released to pouch-film store',
    notes: 'Pouch-film GSM, COF, seal strength, opacity all within spec per IS 6312 / FSSAI 21. BRCGS / FSSAI CoA verified.',
    createdAt: '2026-04-22',
  },
  {
    id: 'INS-DY-012', inspectionNumber: 'INS-DY-2026-012', type: 'INCOMING', result: 'PASS',
    partNumber: 'RM-STARTER-001', partName: 'DVS Starter Culture YC-X11 (Curd)',
    supplier: 'Chr. Hansen India Pvt. Ltd.',
    batchNumber: 'CHR-YC-X11-2026-0118', quantity: 60, sampledQuantity: 2, defectsFound: 0,
    inspector: 'Anita Kulkarni', inspectedAt: '2026-04-10',
    disposition: 'Accepted — released to controlled −20 °C storage',
    notes: 'Activity test pass; CoA + GLP report verified; cold-chain temperature on arrival 2.4 °C.',
    createdAt: '2026-04-10',
  },
];

export function useInspectionRecords(filters?: { type?: string; result?: string }) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['inspections', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/inspections', { params: filters });
        if (!Array.isArray(data)) throw new Error('unexpected response');
        return data as InspectionRecord[];
      } catch {
        const baseList = pickByIndustry(industry, mock, { medical_device: mockMedicalDevice, dairy: mockDairy });
        let r = [...baseList];
        if (filters?.type) r = r.filter(x => x.type === filters.type);
        if (filters?.result) r = r.filter(x => x.result === filters.result);
        return r;
      }
    },
  });
}

export function useInspectionRecord(id: string) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['inspections', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/inspections/${id}`);
        if (!data?.id) throw new Error('unexpected response');
        return data as InspectionRecord;
      } catch {
        const baseList = pickByIndustry(industry, mock, { medical_device: mockMedicalDevice, dairy: mockDairy });
        return baseList.find(r => r.id === id) ?? baseList[0];
      }
    },
    enabled: !!id,
  });
}

export function useCreateInspectionRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<InspectionRecord>) => {
      const { data } = await api.post('/inspections', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  });
}
