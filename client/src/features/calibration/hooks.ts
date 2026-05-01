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

export function useCalibrationRecords(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['calibration', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/calibration', { params: filters });
        return Array.isArray(data) ? (data as CalibrationRecord[]) : [];
      } catch {
        return [] as CalibrationRecord[];
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
        return (data?.id ? data : null) as CalibrationRecord | null;
      } catch {
        return null;
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
  return useQuery({
    queryKey: ['calibration', 'stats'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/calibration/stats');
        return data;
      } catch {
        return {
          total: 0,
          current: 0,
          dueSoon: 0,
          overdue: 0,
          outOfService: 0,
        };
      }
    },
  });
}
