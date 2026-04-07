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
  { id: 'CAL-001', equipmentId: 'EQ-2024-001', name: 'Vernier Caliper 0-150mm', manufacturer: 'Mitutoyo', model: '530-312', serialNumber: 'MT2024001', category: 'MEASUREMENT', location: 'Production Floor A', status: 'CURRENT', lastCalibrated: '2026-01-15', nextDue: '2026-07-15', frequency: 180, calibratedBy: 'ABC Calibration Lab', certificate: 'CERT-2026-001', accuracy: '±0.02mm', range: '0-150mm', notes: '', createdAt: '2024-01-01' },
  { id: 'CAL-002', equipmentId: 'EQ-2024-002', name: 'Digital Torque Wrench 20-100Nm', manufacturer: 'Snap-on', model: 'ATECH2FR100', serialNumber: 'SN2024002', category: 'MEASUREMENT', location: 'Assembly Line B', status: 'DUE_SOON', lastCalibrated: '2025-10-01', nextDue: '2026-04-15', frequency: 180, calibratedBy: 'Internal Lab', certificate: 'CERT-2025-042', accuracy: '±3%', range: '20-100Nm', notes: 'Schedule before April 15', createdAt: '2024-01-01' },
  { id: 'CAL-003', equipmentId: 'EQ-2024-003', name: 'Temperature Data Logger', manufacturer: 'Fluke', model: '1620A', serialNumber: 'FL2024003', category: 'MONITORING', location: 'QA Lab', status: 'OVERDUE', lastCalibrated: '2025-09-01', nextDue: '2026-03-01', frequency: 180, calibratedBy: 'ABC Calibration Lab', certificate: 'CERT-2025-028', accuracy: '±0.5°C', range: '-40 to 85°C', notes: 'URGENT: 30 days overdue', createdAt: '2024-01-01' },
  { id: 'CAL-004', equipmentId: 'EQ-2024-004', name: 'Pressure Gauge 0-10 bar', manufacturer: 'Wika', model: 'EN837-1', serialNumber: 'WK2024004', category: 'MONITORING', location: 'Hydraulics Room', status: 'CURRENT', lastCalibrated: '2026-02-10', nextDue: '2027-02-10', frequency: 365, calibratedBy: 'Internal Lab', certificate: 'CERT-2026-015', accuracy: '±0.1 bar', range: '0-10 bar', notes: '', createdAt: '2024-01-01' },
  { id: 'CAL-005', equipmentId: 'EQ-2024-005', name: 'Surface Roughness Tester', manufacturer: 'Mitutoyo', model: 'SJ-210', serialNumber: 'MT2024005', category: 'TEST', location: 'QA Lab', status: 'OUT_OF_SERVICE', lastCalibrated: '2025-06-01', nextDue: '2025-12-01', frequency: 180, calibratedBy: 'ABC Calibration Lab', certificate: 'CERT-2025-019', accuracy: '±2%', range: 'Ra 0.05-10μm', notes: 'Sent for repair — damaged stylus', createdAt: '2024-01-01' },
];

export function useCalibrationRecords(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['calibration', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/calibration', { params: filters });
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
      try { const { data } = await api.get(`/calibration/${id}`); return data as CalibrationRecord; }
      catch { return mock.find(r => r.id === id) ?? mock[0]; }
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
