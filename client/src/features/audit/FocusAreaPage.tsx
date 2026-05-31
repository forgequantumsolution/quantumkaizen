import LookupMasterPage from './LookupMasterPage';
import {
  useFocusAreas,
  useCreateFocusArea,
  useUpdateFocusArea,
  useDeleteFocusArea,
} from '@/lib/api/audit';

export default function FocusAreaPage() {
  return (
    <LookupMasterPage
      title="Focus Area"
      subtitle="Reusable audit focus areas used when scoping audits."
      namePlaceholder="Quality Management System"
      permissionPrefix="focus_area"
      useList={useFocusAreas}
      useCreate={useCreateFocusArea}
      useUpdate={useUpdateFocusArea}
      useDelete={useDeleteFocusArea}
    />
  );
}
