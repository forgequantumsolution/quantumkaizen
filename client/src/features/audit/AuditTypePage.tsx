import LookupMasterPage from './LookupMasterPage';
import {
  useAuditTypes,
  useCreateAuditType,
  useUpdateAuditType,
  useDeleteAuditType,
} from '@/lib/api/audit';

export default function AuditTypePage() {
  return (
    <LookupMasterPage
      title="Audit Type"
      subtitle="Reusable audit types / categories used across audit masters."
      namePlaceholder="Process Audit"
      permissionPrefix="audit_type"
      useList={useAuditTypes}
      useCreate={useCreateAuditType}
      useUpdate={useUpdateAuditType}
      useDelete={useDeleteAuditType}
    />
  );
}
