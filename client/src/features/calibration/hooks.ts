import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

export type CalibrationStatus = 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'OUT_OF_SERVICE';
export type EquipmentCategory = 'MEASUREMENT' | 'TEST' | 'MONITORING' | 'PRODUCTION';

export interface CalibrationRecord {
  id: string;
  equipmentId: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  category: EquipmentCategory;
  location: string;
  status: CalibrationStatus;
  lastCalibrated: string;
  nextDue: string;
  frequency: number; // days
  calibratedBy: string;
  certificate: string;
  accuracy: string;
  range: string;
  notes: string;
  createdAt: string;
}

const mock: CalibrationRecord[] = [
  // ── 2026 calibrations (CURRENT / DUE_SOON) ──
  {
    id: 'CAL-001', equipmentId: 'EQ-QC-001', name: 'HPLC System — Agilent 1260 Infinity II',
    manufacturer: 'Agilent Technologies', model: '1260 Infinity II', serialNumber: 'AG-HPLC-2024-001',
    category: 'TEST', location: 'QC Laboratory',
    status: 'CURRENT', lastCalibrated: '2026-02-10', nextDue: '2026-08-10', frequency: 180,
    calibratedBy: 'Agilent Technologies India (Authorised Service)',
    certificate: 'CAL-CERT-2026-011', accuracy: 'Wavelength ±1 nm; area RSD ≤1.0%',
    range: 'UV/Vis 190–950 nm; flow 0.001–10 mL/min',
    notes: 'System suitability tested per USP <621>; column oven, autosampler, and DAD detector qualified',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-002', equipmentId: 'EQ-QC-002', name: 'Dissolution Apparatus — Electrolab TDT-08L',
    manufacturer: 'Electrolab India', model: 'TDT-08L', serialNumber: 'EL-DIS-2024-002',
    category: 'TEST', location: 'QC Laboratory',
    status: 'DUE_SOON', lastCalibrated: '2025-10-20', nextDue: '2026-04-20', frequency: 180,
    calibratedBy: 'Electrolab Service Centre, Mumbai',
    certificate: 'CAL-CERT-2025-089', accuracy: 'RPM ±4%; temperature ±0.5°C',
    range: '25–250 RPM; 37.0°C ± 0.5°C',
    notes: 'CALIBRATION DUE TODAY — schedule immediately; last USP <711> performance verification passed with prednisone reference tablets',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-003', equipmentId: 'EQ-QC-003', name: 'Analytical Balance — Mettler Toledo XS205',
    manufacturer: 'Mettler Toledo', model: 'XS205', serialNumber: 'MT-BAL-2024-003',
    category: 'MEASUREMENT', location: 'QC Laboratory',
    status: 'CURRENT', lastCalibrated: '2026-03-05', nextDue: '2026-09-05', frequency: 180,
    calibratedBy: 'Mettler Toledo India (Authorised Service)',
    certificate: 'CAL-CERT-2026-021', accuracy: '±0.01 mg (readability 0.01 mg)',
    range: '0.001 g – 220 g',
    notes: 'NABL-traceable calibration; corner load test and repeatability (s ≤ 0.1 mg at 10 g) confirmed; internal reference weight check performed daily per SOP-QC-BAL-001',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-004', equipmentId: 'EQ-QC-004', name: 'Karl Fischer Titrator — Metrohm 870 KF Titrino Plus',
    manufacturer: 'Metrohm AG', model: '870 KF Titrino Plus', serialNumber: 'ME-KF-2024-004',
    category: 'TEST', location: 'QC Laboratory',
    status: 'CURRENT', lastCalibrated: '2026-01-18', nextDue: '2026-07-18', frequency: 180,
    calibratedBy: 'Metrohm India (Authorised Service)',
    certificate: 'CAL-CERT-2026-004', accuracy: '±0.1% absolute water content',
    range: '0.001–100% water (w/v); volumetric method',
    notes: 'Standardisation with sodium tartrate dihydrate (certified reference material) performed at each use per SOP-QC-KF-002; titer factor verified within 0.98–1.02',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-005', equipmentId: 'EQ-QC-005', name: 'pH Meter — Mettler Toledo SevenCompact S210',
    manufacturer: 'Mettler Toledo', model: 'SevenCompact S210', serialNumber: 'MT-PH-2024-005',
    category: 'MEASUREMENT', location: 'QC Laboratory',
    status: 'CURRENT', lastCalibrated: '2026-04-01', nextDue: '2026-10-01', frequency: 180,
    calibratedBy: 'Internal Calibration (NABL-traceable buffers)',
    certificate: 'CAL-CERT-2026-031', accuracy: '±0.01 pH unit',
    range: 'pH 0–14; temperature 0–100°C',
    notes: '3-point calibration with Ph. Eur.-compliant buffer solutions (pH 4.01, 7.00, 9.21); slope 98.8% (acceptance: 95–105%); electrode type InLab Micro Pro',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-006', equipmentId: 'EQ-QC-006', name: 'UV-Vis Spectrophotometer — Shimadzu UV-1900i',
    manufacturer: 'Shimadzu Corporation', model: 'UV-1900i', serialNumber: 'SH-UV-2024-006',
    category: 'TEST', location: 'QC Laboratory',
    status: 'DUE_SOON', lastCalibrated: '2025-10-15', nextDue: '2026-04-15', frequency: 180,
    calibratedBy: 'Shimadzu India (Authorised Service)',
    certificate: 'CAL-CERT-2025-082', accuracy: 'Wavelength ±0.5 nm; absorbance ±0.004 Abs',
    range: '190–1100 nm (dual beam)',
    notes: 'Due in 5 days — book service engineer; photometric accuracy verified with holmium oxide filter per Ph. Eur. 2.2.25',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-007', equipmentId: 'EQ-PROD-001', name: 'Autoclave — Getinge GSS 68H (Steam Steriliser)',
    manufacturer: 'Getinge AB', model: 'GSS 68H', serialNumber: 'GT-AUTO-2024-007',
    category: 'PRODUCTION', location: 'Sterile Manufacturing — Preparation Area',
    status: 'CURRENT', lastCalibrated: '2026-03-20', nextDue: '2026-09-20', frequency: 180,
    calibratedBy: 'Getinge India Service',
    certificate: 'CAL-CERT-2026-025', accuracy: 'Temperature ±1.0°C; pressure ±0.02 bar',
    range: '105–137°C; 0–4 bar (steam sterilisation)',
    notes: 'Calibration includes temperature mapping with 12 thermocouples (Fo value ≥8 min at 121°C / 15 min); biological indicator (G. stearothermophilus, 10⁶ spores) sterility confirmed; annual validation per WHO GMP Annex 1',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-008', equipmentId: 'EQ-PROD-002', name: 'Particle Counter — Lighthouse Remote 3014 (Airborne)',
    manufacturer: 'Lighthouse Worldwide Solutions', model: 'Remote 3014', serialNumber: 'LH-PC-2024-008',
    category: 'MONITORING', location: 'Clean Room — Grade A/B Injectable Fill Suite',
    status: 'OVERDUE', lastCalibrated: '2025-07-10', nextDue: '2026-01-10', frequency: 180,
    calibratedBy: 'Lighthouse Worldwide Solutions India',
    certificate: 'CAL-CERT-2025-051', accuracy: '±10% count at 0.5 µm and 5.0 µm channels',
    range: '0.3 µm – 25.0 µm particle size; ISO 21501-4',
    notes: 'OVERDUE by 100 days — instrument quarantined; all Grade A environmental monitoring data from 2026-01-10 onwards flagged as suspect pending recalibration; CAPA-2026-007 opened',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-009', equipmentId: 'EQ-WH-001', name: 'Temperature/Humidity Data Logger — Testo 174H',
    manufacturer: 'Testo SE & Co. KGaA', model: '174H', serialNumber: 'TE-DL-2024-009',
    category: 'MONITORING', location: 'Warehouse — Cold Room (2–8°C)',
    status: 'CURRENT', lastCalibrated: '2026-02-25', nextDue: '2026-08-25', frequency: 180,
    calibratedBy: 'Testo India Service',
    certificate: 'CAL-CERT-2026-018', accuracy: 'Temperature ±0.4°C; RH ±3% RH',
    range: 'Temperature −20 to +70°C; RH 10–95%',
    notes: 'Calibration traceable to NABL-accredited laboratory; logger used for continuous monitoring of Ondansetron injection cold store; alarm set points verified: low 2°C, high 8°C',
    createdAt: '2024-01-15',
  },
  // ── 2025 calibrations (OVERDUE / OUT_OF_SERVICE added for realism) ──
  {
    id: 'CAL-010', equipmentId: 'EQ-QC-007', name: 'Friabilator — Electrolab EF-2W',
    manufacturer: 'Electrolab India', model: 'EF-2W', serialNumber: 'EL-FRIB-2024-010',
    category: 'TEST', location: 'QC Laboratory',
    status: 'CURRENT', lastCalibrated: '2025-12-10', nextDue: '2026-06-10', frequency: 180,
    calibratedBy: 'Internal Calibration (NABL-traceable weights)',
    certificate: 'CAL-CERT-2025-101', accuracy: 'RPM ±1 RPM (specification 25 ± 1 RPM per Ph. Eur. 2.9.7)',
    range: '1–100 RPM; drum diameter 283–291 mm per Ph. Eur.',
    notes: 'Speed verified with calibrated tachometer; drum dimensions within Ph. Eur. 2.9.7 tolerance; used for release testing of Paracetamol 500mg and Metformin 500mg batches',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-011', equipmentId: 'EQ-QC-008', name: 'Tablet Hardness Tester — Pharmatron 10TD',
    manufacturer: 'Sotax AG (Pharmatron)', model: '10TD', serialNumber: 'PT-HT-2024-011',
    category: 'TEST', location: 'QC Laboratory',
    status: 'OUT_OF_SERVICE', lastCalibrated: '2025-03-15', nextDue: '2025-09-15', frequency: 180,
    calibratedBy: 'Sotax India (Authorised Service)',
    certificate: 'CAL-CERT-2025-022', accuracy: '±1 N (load cell)',
    range: '0–500 N hardness; 0–25 mm diameter; 0–10 mm thickness',
    notes: 'OUT OF SERVICE — load cell malfunction detected during routine check on 2025-08-20; repair quotation received; backup manual tester (Schleuniger) in use; replacement parts on order; expected return to service 2026-05-15',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-012', equipmentId: 'EQ-QC-009', name: 'Viscometer — Brookfield DV-II+ Pro',
    manufacturer: 'Brookfield Engineering (AMETEK)', model: 'DV-II+ Pro', serialNumber: 'BK-VISC-2024-012',
    category: 'TEST', location: 'QC Laboratory',
    status: 'CURRENT', lastCalibrated: '2025-11-04', nextDue: '2026-05-04', frequency: 180,
    calibratedBy: 'Brookfield India (Authorised Service)',
    certificate: 'CAL-CERT-2025-094', accuracy: '±1.0% of full-scale range (torque)',
    range: '1–2,000,000 mPa·s; spindle set RV (1–7)',
    notes: 'Calibrated with Brookfield certified silicone viscosity standards (1000 and 10000 mPa·s); used for HPMC viscosity testing (raw material release) and coating suspension viscosity monitoring',
    createdAt: '2024-01-15',
  },
  {
    id: 'CAL-013', equipmentId: 'EQ-QC-010', name: 'Microbiological Incubator — Memmert IN 260',
    manufacturer: 'Memmert GmbH', model: 'IN 260', serialNumber: 'MM-INC-2024-013',
    category: 'MONITORING', location: 'Microbiology Laboratory',
    status: 'OVERDUE', lastCalibrated: '2025-08-22', nextDue: '2026-02-22', frequency: 180,
    calibratedBy: 'Memmert India Service',
    certificate: 'CAL-CERT-2025-067', accuracy: 'Temperature ±0.5°C (at set point)',
    range: '15–70°C; ±0.1°C uniformity',
    notes: 'OVERDUE by 57 days — temperature mapping (9-point) overdue; incubator still in use for microbial limit testing under approved deviation (DEV-2026-008) with enhanced daily temperature log; recalibration scheduled 2026-05-02',
    createdAt: '2024-01-15',
  },
  // ── 2024 baseline record ──
  {
    id: 'CAL-014', equipmentId: 'EQ-ENG-001', name: 'Calibrated Reference Thermometer — Pt-100 (NABL)',
    manufacturer: 'Fluke Corporation', model: '5627A RTD', serialNumber: 'FL-REFTH-2024-014',
    category: 'MEASUREMENT', location: 'Engineering / Metrology Room',
    status: 'CURRENT', lastCalibrated: '2026-01-08', nextDue: '2027-01-08', frequency: 365,
    calibratedBy: 'NABL-Accredited External Laboratory (Advance Instruments)',
    certificate: 'CAL-CERT-2026-002', accuracy: '±0.05°C (at 0°C, 37°C, 121°C reference points)',
    range: '−200 to +650°C',
    notes: 'Master reference standard used for in-house calibration of all temperature monitoring devices (autoclave probes, cold room loggers, incubators); NABL certificate no. AI-2026-0014; traceable to NPL India',
    createdAt: '2024-01-08',
  },
];

// Medical-device calibration register — instruments used across sterilization, cleanroom, packaging and QC labs.
const mockMedicalDevice: CalibrationRecord[] = [
  {
    id: 'CAL-MD-001', equipmentId: 'EQ-MD-STER-001', name: 'EO Sterilizer EOS-02 — Cycle Parameter Verification',
    manufacturer: 'Steris AST', model: 'EOS-02 / SR3 Cycle', serialNumber: 'STER-MD-2023-001',
    category: 'PRODUCTION', location: 'Sterilization Block — Bay A',
    status: 'CURRENT', lastCalibrated: '2026-04-05', nextDue: '2026-10-05', frequency: 180,
    calibratedBy: 'Steris AST India (Authorised Service)',
    certificate: 'CAL-MD-CERT-2026-018', accuracy: 'Temperature ±0.5 °C; EO concentration ±5%; pressure ±0.02 bar',
    range: '37–55 °C; EO 400–800 mg/L; vacuum −0.7 bar to +1.2 bar',
    notes: 'IQ/OQ/PQ controllers verified post-PLC battery replacement (NC-MD-2026-0042 / CAPA-MD-2026-0019); aeration timer re-baselined to 14 h per CR-MD-2026-0013',
    createdAt: '2023-06-12',
  },
  {
    id: 'CAL-MD-002', equipmentId: 'EQ-MD-PKG-002', name: 'Heat Sealer TS-04 — Temperature & Dwell Verification',
    manufacturer: 'Nelipak', model: 'TS-04 Tray Sealer', serialNumber: 'NEL-TS-2023-014',
    category: 'PRODUCTION', location: 'Sterile Barrier Packaging Line',
    status: 'CURRENT', lastCalibrated: '2026-03-01', nextDue: '2026-06-01', frequency: 90,
    calibratedBy: 'Nelipak India Service',
    certificate: 'CAL-MD-CERT-2026-008', accuracy: 'Seal temperature ±1.0 °C; dwell ±0.1 s; pressure ±0.05 bar',
    range: '120–200 °C; dwell 1.0–5.0 s; 1.0–4.0 bar',
    notes: 'PM frequency 6-monthly (was 12) post-CAPA-MD-2025-0058; SPC dashboard alerts at ±3 °C',
    createdAt: '2023-04-10',
  },
  {
    id: 'CAL-MD-003', equipmentId: 'EQ-MD-CR-003', name: 'Class 7 Cleanroom Particle Counter — Lighthouse 3014',
    manufacturer: 'Lighthouse Worldwide Solutions', model: 'Remote 3014', serialNumber: 'LH-MD-PC-2024-003',
    category: 'MONITORING', location: 'Class 7 Cleanroom — Assembly Suite',
    status: 'DUE_SOON', lastCalibrated: '2025-11-15', nextDue: '2026-05-15', frequency: 180,
    calibratedBy: 'Lighthouse Worldwide Solutions India',
    certificate: 'CAL-MD-CERT-2025-072', accuracy: '±10% count at 0.5 µm and 5.0 µm channels',
    range: '0.3 µm – 25.0 µm particle size; ISO 21501-4',
    notes: 'Continuous monitoring per ISO 14644; alarm at Class 7 action limit',
    createdAt: '2024-02-04',
  },
  {
    id: 'CAL-MD-004', equipmentId: 'EQ-MD-QC-004', name: 'Tensile Tester — Instron 5965 (ASTM F2096 seal strength)',
    manufacturer: 'Instron', model: '5965 Universal', serialNumber: 'IN-MD-TT-2024-004',
    category: 'TEST', location: 'QC Lab — Mechanical Section',
    status: 'CURRENT', lastCalibrated: '2026-02-12', nextDue: '2026-08-12', frequency: 180,
    calibratedBy: 'Instron India Service',
    certificate: 'CAL-MD-CERT-2026-005', accuracy: 'Load ±0.5%; crosshead ±0.1 mm',
    range: 'Load 0–5 kN; crosshead 0–800 mm',
    notes: 'Used for seal-strength burst tests on sterile-barrier pouches (ASTM F2096) and catheter tensile tests (ASTM F640)',
    createdAt: '2024-03-22',
  },
  {
    id: 'CAL-MD-005', equipmentId: 'EQ-MD-LAB-005', name: 'Endotoxin Reader — Charles River Endosafe',
    manufacturer: 'Charles River Laboratories', model: 'Endosafe nexgen-PTS', serialNumber: 'CR-MD-ENDO-2024-005',
    category: 'TEST', location: 'QC Lab — Microbiology Section',
    status: 'CURRENT', lastCalibrated: '2026-03-22', nextDue: '2026-09-22', frequency: 180,
    calibratedBy: 'Charles River India Service',
    certificate: 'CAL-MD-CERT-2026-019', accuracy: '±10% recovery at LAL CSE standard',
    range: '0.001–10 EU/mL (LAL kinetic chromogenic)',
    notes: 'Used for endotoxin release testing per USP <85>; calibration includes positive product control and standard curve verification',
    createdAt: '2024-04-11',
  },
  {
    id: 'CAL-MD-006', equipmentId: 'EQ-MD-PKG-006', name: 'UDI Verification Scanner — Zebra DS9908-HD',
    manufacturer: 'Zebra Technologies', model: 'DS9908-HD', serialNumber: 'ZB-MD-SCN-2024-006',
    category: 'TEST', location: 'Packaging Line PL-MD-01 — End of Line',
    status: 'CURRENT', lastCalibrated: '2026-04-12', nextDue: '2026-10-12', frequency: 180,
    calibratedBy: 'Internal Calibration (GS1-traceable reference codes)',
    certificate: 'CAL-MD-CERT-2026-024', accuracy: 'Decoded read-rate ≥99.9% on GS1-128 reference codes',
    range: 'GS1-128, DataMatrix, QR (ISO/IEC 15415 grading)',
    notes: 'Recalibrated post-NC-MD-2026-0040; ISO/IEC 15415 grade ≥C on reference UDI samples',
    createdAt: '2024-05-08',
  },
  {
    id: 'CAL-MD-007', equipmentId: 'EQ-MD-QC-007', name: 'CMM — Zeiss Contura G2',
    manufacturer: 'Zeiss', model: 'Contura G2', serialNumber: 'ZS-MD-CMM-2024-007',
    category: 'MEASUREMENT', location: 'QC Lab — Metrology Suite',
    status: 'CURRENT', lastCalibrated: '2026-01-25', nextDue: '2027-01-25', frequency: 365,
    calibratedBy: 'Zeiss India Service (NABL traceable)',
    certificate: 'CAL-MD-CERT-2026-003', accuracy: 'MPEE ±(1.6 + L/350) µm',
    range: 'Volume 700 × 1000 × 600 mm',
    notes: 'Used for IOL haptic and stent dimensional measurements; PR-VDI/VDE 2617 verification with reference ball plate',
    createdAt: '2024-01-15',
  },
];

// Dairy tenant — calibration register for typical dairy equipment.
const mockDairy: CalibrationRecord[] = [
  {
    id: 'CAL-DY-001', equipmentId: 'EQ-DY-PHE-01', name: 'HTST Pasteurizer PHE-01 — Temperature & Flow Controller',
    manufacturer: 'GEA / APV', model: 'PHE-3000', serialNumber: 'GEA-PHE-2023-001',
    category: 'PRODUCTION', location: 'Pasteurization Hall — Bay A',
    status: 'CURRENT', lastCalibrated: '2026-04-20', nextDue: '2026-10-20', frequency: 180,
    calibratedBy: 'GEA Process Engineering India',
    certificate: 'CAL-DY-CERT-2026-018', accuracy: 'Outlet temperature ±0.3 °C; flow ±2%',
    range: '0–100 °C; flow 0–8 000 L/h',
    notes: 'Outlet thermometer recalibrated with NABL-traceable reference per CAPA from NC-DY-2026-0038.',
    createdAt: '2023-04-12',
  },
  {
    id: 'CAL-DY-002', equipmentId: 'EQ-DY-LACTO-01', name: 'Lactoscan SP Milk Analyser (Receiving Dock)',
    manufacturer: 'Milkotronic Ltd.', model: 'Lactoscan SP', serialNumber: 'LSP-2023-007',
    category: 'TEST', location: 'Receiving Dock — Lab Bench A',
    status: 'CURRENT', lastCalibrated: '2026-04-03', nextDue: '2026-07-03', frequency: 90,
    calibratedBy: 'Milkotronic India Service',
    certificate: 'CAL-DY-CERT-2026-011', accuracy: 'Fat ±0.1%; SNF ±0.1%; protein ±0.15%',
    range: 'Fat 0.01–25%; SNF 3–15%; protein 1–10%',
    notes: 'Calibrated against NABL-traceable certified reference milk samples (skimmed + full-cream).',
    createdAt: '2023-08-10',
  },
  {
    id: 'CAL-DY-003', equipmentId: 'EQ-DY-GERBER-01', name: 'Gerber Centrifuge for Fat Determination',
    manufacturer: 'Funke Gerber', model: 'Nova Safety', serialNumber: 'FG-NS-2023-014',
    category: 'TEST', location: 'QC Lab — Wet Chemistry Bench',
    status: 'CURRENT', lastCalibrated: '2026-02-22', nextDue: '2026-08-22', frequency: 180,
    calibratedBy: 'In-house Calibration (NABL-traceable speed reference)',
    certificate: 'CAL-DY-CERT-2026-005', accuracy: 'RPM ±20 RPM at 1 100 RPM',
    range: 'Speed 0–1 200 RPM; 12 tubes capacity',
    notes: 'Per IS 1224. Tachometer verified; reading 1 100 ± 12 RPM. NABL traceable.',
    createdAt: '2023-04-22',
  },
  {
    id: 'CAL-DY-004', equipmentId: 'EQ-DY-PH-01', name: 'pH Meter — Hanna HI 2210 (Curd / Paneer Lab)',
    manufacturer: 'Hanna Instruments', model: 'HI 2210', serialNumber: 'HI-2210-2024-018',
    category: 'MEASUREMENT', location: 'Microbiology Lab',
    status: 'CURRENT', lastCalibrated: '2026-04-10', nextDue: '2026-10-10', frequency: 180,
    calibratedBy: 'Internal calibration (NABL-traceable buffers)',
    certificate: 'CAL-DY-CERT-2026-019', accuracy: '±0.01 pH unit',
    range: '0.00–14.00 pH',
    notes: '3-point calibration with NABL-traceable buffers 4.01 / 7.00 / 10.01. Used for curd fermentation end-point.',
    createdAt: '2024-04-12',
  },
  {
    id: 'CAL-DY-005', equipmentId: 'EQ-DY-CR-01', name: 'Walk-In Cold Room WCR-01 (Finished Goods)',
    manufacturer: 'Blue Star', model: 'BS-WCR-200T', serialNumber: 'BS-WCR-2022-009',
    category: 'MONITORING', location: 'Finished Goods — Cold Room A',
    status: 'DUE_SOON', lastCalibrated: '2025-11-08', nextDue: '2026-05-31', frequency: 180,
    calibratedBy: 'Blue Star Service Pune',
    certificate: 'CAL-DY-CERT-2025-091', accuracy: 'Room temp ±0.5 °C; mapping 12-point',
    range: '−5 to +10 °C',
    notes: 'Cold-room temperature mapping (12 sensors × 24 h) per ISO 22000 §8.6.1. Calibration due in 13 days — booked.',
    createdAt: '2022-06-18',
  },
  {
    id: 'CAL-DY-006', equipmentId: 'EQ-DY-MICRO-INC', name: 'Microbiological Incubator INC-01 (32 °C)',
    manufacturer: 'Memmert', model: 'IN 110', serialNumber: 'MM-INC-2024-008',
    category: 'MONITORING', location: 'Microbiology Lab',
    status: 'OVERDUE', lastCalibrated: '2025-09-12', nextDue: '2026-03-12', frequency: 180,
    calibratedBy: 'Memmert India Service',
    certificate: 'CAL-DY-CERT-2025-068', accuracy: 'Temperature ±0.5 °C at set point',
    range: '15–70 °C',
    notes: 'OVERDUE — TPC analysis under controlled deviation; calibration booked for 2026-05-22.',
    createdAt: '2024-04-12',
  },
  {
    id: 'CAL-DY-007', equipmentId: 'EQ-DY-ELISA-01', name: 'ELISA Reader for AfM1',
    manufacturer: 'Thermo Fisher Scientific', model: 'Multiskan FC', serialNumber: 'TF-MFC-2024-002',
    category: 'TEST', location: 'Microbiology Lab — AfM1 Bench',
    status: 'CURRENT', lastCalibrated: '2026-04-18', nextDue: '2026-10-18', frequency: 180,
    calibratedBy: 'Thermo Fisher Service India',
    certificate: 'CAL-DY-CERT-2026-024', accuracy: '±2% absorbance at 450 nm',
    range: 'Optical density 0.000–4.000 Abs',
    notes: 'Standardisation with AfM1 CRM; recovery 96–104%.',
    createdAt: '2024-05-15',
  },
  {
    id: 'CAL-DY-008', equipmentId: 'EQ-DY-TKR-001', name: 'IoT Refrigerated Van Temperature Logger — VAN-N3',
    manufacturer: 'Sensitech', model: 'ColdLink GSM', serialNumber: 'SST-CL-2025-014',
    category: 'MONITORING', location: 'Refrigerated Van VAN-N3 — Distribution Fleet',
    status: 'CURRENT', lastCalibrated: '2026-01-22', nextDue: '2027-01-22', frequency: 365,
    calibratedBy: 'NABL-Accredited External Laboratory',
    certificate: 'CAL-DY-CERT-2026-002', accuracy: '±0.3 °C across 0–10 °C range',
    range: '−25 to +25 °C',
    notes: 'Installed after NC-DY-2025-0156. GSM alert escalation tested.',
    createdAt: '2025-12-18',
  },
];

export function useCalibrationRecords(filters?: { status?: string; category?: string }) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['calibration', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/calibration', { params: filters });
        if (!Array.isArray(data)) throw new Error('unexpected response');
        return data as CalibrationRecord[];
      } catch {
        const baseList = pickByIndustry(industry, mock, { medical_device: mockMedicalDevice, dairy: mockDairy });
        let r = [...baseList];
        if (filters?.status) r = r.filter(x => x.status === filters.status);
        if (filters?.category) r = r.filter(x => x.category === filters.category);
        return r;
      }
    },
  });
}

export function useCalibrationRecord(id: string) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['calibration', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/calibration/${id}`);
        if (!data?.id) throw new Error('unexpected response');
        return data as CalibrationRecord;
      } catch {
        const baseList = pickByIndustry(industry, mock, { medical_device: mockMedicalDevice, dairy: mockDairy });
        return baseList.find(r => r.id === id) ?? baseList[0];
      }
    },
    enabled: !!id,
  });
}

export function useCreateCalibrationRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<CalibrationRecord>) => {
      const { data } = await api.post('/calibration', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calibration'] }),
  });
}

export function useCalibrationStats() {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['calibration', 'stats', industry ?? 'default'],
    queryFn: async () => {
      try { const { data } = await api.get('/calibration/stats'); return data; }
      catch {
        const baseList = pickByIndustry(industry, mock, { medical_device: mockMedicalDevice, dairy: mockDairy });
        return {
          total: baseList.length,
          current: baseList.filter(r => r.status === 'CURRENT').length,
          dueSoon: baseList.filter(r => r.status === 'DUE_SOON').length,
          overdue: baseList.filter(r => r.status === 'OVERDUE').length,
          outOfService: baseList.filter(r => r.status === 'OUT_OF_SERVICE').length,
        };
      }
    },
  });
}
