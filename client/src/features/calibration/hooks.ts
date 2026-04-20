import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

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

export function useCalibrationRecords(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['calibration', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/calibration', { params: filters });
        if (!Array.isArray(data)) throw new Error('unexpected response');
        return data as CalibrationRecord[];
      } catch {
        let r = [...mock];
        if (filters?.status) r = r.filter(x => x.status === filters.status);
        if (filters?.category) r = r.filter(x => x.category === filters.category);
        return r;
      }
    },
  });
}

export function useCalibrationRecord(id: string) {
  return useQuery({
    queryKey: ['calibration', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/calibration/${id}`);
        if (!data?.id) throw new Error('unexpected response');
        return data as CalibrationRecord;
      } catch { return mock.find(r => r.id === id) ?? mock[0]; }
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
  return useQuery({
    queryKey: ['calibration', 'stats'],
    queryFn: async () => {
      try { const { data } = await api.get('/calibration/stats'); return data; }
      catch {
        return {
          total: mock.length,
          current: mock.filter(r => r.status === 'CURRENT').length,
          dueSoon: mock.filter(r => r.status === 'DUE_SOON').length,
          overdue: mock.filter(r => r.status === 'OVERDUE').length,
          outOfService: mock.filter(r => r.status === 'OUT_OF_SERVICE').length,
        };
      }
    },
  });
}
