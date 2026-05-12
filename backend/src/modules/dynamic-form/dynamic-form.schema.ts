import { z } from 'zod';

// ---- shared ----
const optionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const FieldSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    field_id: z.string().optional(),
    name: z.string(),
    label: z.string(),
    type: z.string().optional(),
    type_id: z.string().optional().nullable(),
    type_name: z.string().optional(),
    required: z.boolean().optional().default(false),
    position: z.number().int().optional(),
    width: z.string().optional(),
    value: z.any().optional(),
    default_value: z.any().optional(),
    validation: z.record(z.any()).optional().nullable(),
    options: z.array(optionSchema).optional().nullable(),
    dependency: z.record(z.any()).optional().nullable(),
    dynamic: z.boolean().optional(),
    end_point: z.string().optional().nullable(),
    auto_generate: z.boolean().optional(),
    auto_generate_endpoint: z.string().optional().nullable(),
    auto_generate_mappings: z.record(z.any()).optional().nullable(),
    fields: z.array(FieldSchema).optional(), // for table type
    defaultValues: z.array(z.any()).optional(),
  })
);

export const SectionSchema = z.object({
  section_id: z.string().optional(),
  section_name: z.string(),
  position: z.number().int().optional(),
  dependency: z.record(z.any()).optional().nullable(),
  fields: z.array(FieldSchema).default([]),
});

// ---- Form CRUD ----
export const CreateFormSchema = z.object({
  title: z.string().min(1).max(255),
  type_id: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  desc: z.string().max(2000).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().optional().nullable(),
  main_process: z.string().optional().nullable(),
  criteria: z.string().optional().nullable(),
  pdca_approved: z.boolean().optional(),
  workflow_name: z.string().optional().nullable(),
  workflow_type: z.string().optional().nullable(),
});

export const SaveFormFieldsSchema = z.object({
  sections: z.array(SectionSchema).default([]),
  form_details: z
    .object({
      title: z.string().optional(),
      description: z.string().optional().nullable(),
      form_type: z.string().optional().nullable(),
    })
    .optional(),
  version_id: z.string().optional().nullable(),
});

export const SaveDraftSchema = z.object({
  draft_data: z.record(z.any()),
  form_details: z.record(z.any()).optional(),
  version_id: z.string().optional().nullable(),
});

export const ListFormsQuerySchema = z.object({
  id: z.string().optional(),
  search: z.string().optional(),
  page_number: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(20),
  is_completed: z.enum(['true', 'false']).optional(),
  form_type_id: z.string().optional(),
  workflow_type_id: z.string().optional(),
  workflow_name_id: z.string().optional(),
  _t: z.string().optional(),
});

export const FormTypeUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  version_id: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const FieldTypeUpsertSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  data_type: z.string().optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const IdParamSchema = z.object({ id: z.string() });

export type CreateFormInput = z.infer<typeof CreateFormSchema>;
export type SaveFormFieldsInput = z.infer<typeof SaveFormFieldsSchema>;
export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;
export type ListFormsQuery = z.infer<typeof ListFormsQuerySchema>;
export type FormTypeUpsert = z.infer<typeof FormTypeUpsertSchema>;
export type FieldTypeUpsert = z.infer<typeof FieldTypeUpsertSchema>;
