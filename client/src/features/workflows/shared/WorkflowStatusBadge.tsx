import { Badge } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import type { WorkflowLifecycleStatus } from '@/lib/api/workflow';

const VARIANT: Record<WorkflowLifecycleStatus, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  DRAFT: 'warning',
  DRAFT_UPDATE: 'warning',
};

const LABEL: Record<WorkflowLifecycleStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
  DRAFT_UPDATE: 'Draft update',
};

export default function WorkflowStatusBadge({ status }: { status: WorkflowLifecycleStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
