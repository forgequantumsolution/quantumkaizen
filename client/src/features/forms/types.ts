// Shape of objects exchanged with /api/forms/* and /api/form-submissions/*.
// Mirrors the backend serialiser, kept loose to tolerate JSON blobs.

export interface FieldType {
  id: string;
  name: string;
  label: string;
  description: string | null;
  data_type: string | null;
  is_system: boolean;
  config: Record<string, unknown> | null;
}

export interface FormType {
  id: string;
  name: string;
  version_id: string;
  is_active?: boolean;
}

export type FieldOption = { label: string; value: string | number | boolean };

export interface FormFieldDef {
  field_id?: string;
  name: string;
  label: string;
  type?: string | null;
  type_id?: string | null;
  required?: boolean;
  position?: number;
  width?: '25' | '33' | '50' | '66' | '75' | '100' | string;
  value?: unknown;
  options?: FieldOption[];
  validation?: unknown; // see lib/validation.ts -> ValidationRules
  dependency?: unknown; // see lib/dependency.ts -> DependencyRule
  dynamic?: boolean;
  end_point?: string | null;
  auto_generate?: boolean;
  auto_generate_endpoint?: string | null;
  auto_generate_mappings?: Record<string, unknown> | null;
  helpText?: string;
  placeholder?: string;
  fields?: FormFieldDef[]; // for table type
}

export interface FormSectionDef {
  section_id?: string;
  section_name: string;
  position?: number;
  description?: string;
  dependency?: unknown;
  fields: FormFieldDef[];
}

export interface FormListItem {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  type_id: string | null;
  version: number;
  version_id: string;
  is_completed: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_on: string;
  created_by: { id: string; name: string } | null;
  all_versions: Array<{ id: string; version: number }>;
}

export interface FormDetailResponse {
  draft_data: { sections: FormSectionDef[] } | Record<string, unknown>;
  form_details: {
    title: string;
    description: string | null;
    version: number;
    version_id: string;
    form_type: string | null;
    workflow_name?: string | null;
    workflow_type?: string | null;
  };
}

export interface SubmissionListItem {
  id: string;
  formId: string;
  versionId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  responses: Record<string, unknown>;
  meta: Record<string, unknown> | null;
  submittedAt: string | null;
  createdAt: string;
  form: { id: string; title: string; version: number; versionId: string };
  submittedBy: { id: string; name: string; email: string } | null;
}
