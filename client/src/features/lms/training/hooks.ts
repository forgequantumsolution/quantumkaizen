import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

export type ProgramType = 'INDUCTION' | 'OJT' | 'CLASSROOM' | 'E_LEARNING' | 'REGULATORY' | 'REFRESHER';
export type ProgramStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'EXPIRED';
export type ParticipantStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';

export interface TrainingProgram {
  id: string;
  programId: string;
  title: string;
  description: string;
  type: ProgramType;
  status: ProgramStatus;
  department: string;
  duration: string;
  enrolled: number;
  completionRate: number;
  validityPeriod: string;
  passingScore: number;
  objectives: string[];
  prerequisites: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlock {
  id: string;
  order: number;
  title: string;
  type: 'DOCUMENT' | 'PRESENTATION' | 'VIDEO' | 'CHECKLIST';
  url: string;
  duration: string;
}

export interface AssessmentQuestion {
  id: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'OPEN_TEXT';
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
}

export interface Participant {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  role: string;
  status: ParticipantStatus;
  score: number | null;
  completionDate: string | null;
  certificateId: string | null;
  enrolledDate: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface TrainingFilters {
  type?: string;
  status?: string;
  department?: string;
  search?: string;
}

export function useTrainingPrograms(filters: TrainingFilters = {}) {
  return useQuery<TrainingProgram[]>({
    queryKey: ['lms', 'training', 'programs', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/lms/training', { params: filters });
        return Array.isArray(data) ? (data as TrainingProgram[]) : [];
      } catch {
        return [] as TrainingProgram[];
      }
    },
    initialData: [] as TrainingProgram[],
  });
}

export function useTrainingProgram(id: string) {
  return useQuery<TrainingProgram | null>({
    queryKey: ['lms', 'training', 'programs', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/lms/training/${id}`);
        return (data?.id ? data : null) as TrainingProgram | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useTrainingContent(programId: string) {
  return useQuery<ContentBlock[]>({
    queryKey: ['lms', 'training', 'content', programId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/lms/training/${programId}/content`);
        return Array.isArray(data) ? (data as ContentBlock[]) : [];
      } catch {
        return [] as ContentBlock[];
      }
    },
    enabled: !!programId,
    initialData: [] as ContentBlock[],
  });
}

export function useAssessmentQuestions(programId: string) {
  return useQuery<AssessmentQuestion[]>({
    queryKey: ['lms', 'training', 'questions', programId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/lms/training/${programId}/questions`);
        return Array.isArray(data) ? (data as AssessmentQuestion[]) : [];
      } catch {
        return [] as AssessmentQuestion[];
      }
    },
    enabled: !!programId,
    initialData: [] as AssessmentQuestion[],
  });
}

export function useParticipants(programId: string) {
  return useQuery<Participant[]>({
    queryKey: ['lms', 'training', 'participants', programId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/lms/training/${programId}/participants`);
        return Array.isArray(data) ? (data as Participant[]) : [];
      } catch {
        return [] as Participant[];
      }
    },
    enabled: !!programId,
    initialData: [] as Participant[],
  });
}

export function useTrainingStats() {
  const { data } = useQuery({
    queryKey: ['lms', 'training', 'stats'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/lms/training/stats');
        if (!data || typeof data !== 'object') {
          return { activePrograms: 0, totalEnrolled: 0, avgCompletion: 0, expiringCerts: 0 };
        }
        return {
          activePrograms: typeof data.activePrograms === 'number' ? data.activePrograms : 0,
          totalEnrolled: typeof data.totalEnrolled === 'number' ? data.totalEnrolled : 0,
          avgCompletion: typeof data.avgCompletion === 'number' ? data.avgCompletion : 0,
          expiringCerts: typeof data.expiringCerts === 'number' ? data.expiringCerts : 0,
        };
      } catch {
        return { activePrograms: 0, totalEnrolled: 0, avgCompletion: 0, expiringCerts: 0 };
      }
    },
    initialData: { activePrograms: 0, totalEnrolled: 0, avgCompletion: 0, expiringCerts: 0 },
  });
  return data;
}


export function useCreateTrainingProgram() {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = async (payload: Record<string, unknown>) => {
    setIsPending(true);
    try {
      const { data } = await api.post('/lms/training', payload);
      return data;
    } finally {
      setIsPending(false);
    }
  };
  return { mutateAsync, isPending };
}
