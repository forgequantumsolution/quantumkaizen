/**
 * Audit "My Workspace" tab — the audit workflow tickets (PRs) live on the
 * generic module workspace. Render it embedded so it sits under the Audit
 * module's tab bar (Dashboard · My Workspace · Register · Program · …) instead
 * of navigating away to /modules/:typeId.
 */
import { Spin } from 'antd';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import ModulePage from '@/features/modules/ModulePage';

export default function AuditWorkspacePage() {
  const { data: workflowTypes, isLoading } = useWorkflowTypes();
  const auditType = (workflowTypes ?? []).find(
    (t) => !t.isDeleted && /^audit$/i.test(t.name),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spin />
      </div>
    );
  }

  if (!auditType) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        No “Audit” workflow type is configured yet.
      </div>
    );
  }

  return <ModulePage typeId={auditType.id} embedded />;
}
