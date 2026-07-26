import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EscalationTarget = 'MANAGER' | 'DEPARTMENT_HEAD';

export const ESCALATION_TARGET_LABEL: Record<EscalationTarget, string> = {
  MANAGER: "Assignee's manager",
  DEPARTMENT_HEAD: 'Department head',
};

export interface EscalationLevel {
  id: string;
  order: number;
  target: EscalationTarget;
  /** SLA threshold name that fires this level; null = fire on breach. */
  atThresholdName: string | null;
}

export interface EscalationRule {
  id: string;
  /** null = the global default rule. */
  departmentId: string | null;
  isActive: boolean;
  department: { id: string; name: string; code: string } | null;
  levels: EscalationLevel[];
}

export interface UpsertEscalationRuleInput {
  departmentId: string | null;
  isActive?: boolean;
  levels: { order: number; target: EscalationTarget; atThresholdName?: string | null }[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const keys = { all: ['escalation-rules'] as const };

export const useEscalationRules = () =>
  useQuery<EscalationRule[]>({
    queryKey: keys.all,
    queryFn: () => api.get('/escalation-rules').then((r) => r.data),
  });

/** Distinct SLA threshold names, for the matrix editor's trigger dropdown. */
export const useThresholdNames = () =>
  useQuery<string[]>({
    queryKey: ['escalation-threshold-names'],
    queryFn: () => api.get('/escalation-rules/threshold-names').then((r) => r.data),
  });

export const useUpsertEscalationRule = () => {
  const qc = useQueryClient();
  return useMutation<EscalationRule, unknown, UpsertEscalationRuleInput>({
    mutationFn: (body) => api.put('/escalation-rules', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteEscalationRule = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/escalation-rules/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};
