import { randomUUID } from 'node:crypto';
import { Prisma, FormStatus, FormKind } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';

// Prisma rejects literal JS `null` for nullable Json columns — use Prisma.JsonNull instead.
const json = (
  v: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue);
import type {
  CreateFormInput,
  FieldTypeUpsert,
  FormTypeUpsert,
  ListFormsQuery,
  SaveDraftInput,
  SaveFormFieldsInput,
} from './dynamic-form.schema';

// ──────────────────────────── Form types ────────────────────────────

// Lookup tables (form types / field types) change rarely. Caching them in
// process for a few minutes turns most page loads into zero-DB lookups.
const LOOKUP_TTL_MS = 5 * 60 * 1000;
type FormTypeRow = {
  id: string;
  name: string;
  version_id: string;
  is_active: boolean;
};
let formTypesCache: { data: FormTypeRow[]; expires: number } | null = null;
const invalidateFormTypesCache = () => { formTypesCache = null; };

export const listFormTypes = async (search?: string) => {
  if (!search && formTypesCache && formTypesCache.expires > Date.now()) {
    return formTypesCache.data;
  }
  const where: Prisma.FormTypeWhereInput = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const items = await prisma.formType.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  const mapped = items.map((t) => ({
    id: t.id,
    name: t.name,
    version_id: t.versionId,
    is_active: t.isActive,
  }));
  if (!search) {
    formTypesCache = { data: mapped, expires: Date.now() + LOOKUP_TTL_MS };
  }
  return mapped;
};

export const createFormType = async (input: FormTypeUpsert) => {
  const exists = await prisma.formType.findUnique({ where: { name: input.name } });
  if (exists) throw Conflict('Form type with this name already exists');
  const created = await prisma.formType.create({
    data: {
      name: input.name,
      versionId: input.version_id ?? randomUUID(),
      isActive: input.is_active ?? true,
    },
  });
  invalidateFormTypesCache();
  return { id: created.id, name: created.name, version_id: created.versionId };
};

export const updateFormType = async (id: string, input: FormTypeUpsert) => {
  const t = await prisma.formType.findUnique({ where: { id } });
  if (!t) throw NotFound('Form type not found');
  const updated = await prisma.formType.update({
    where: { id },
    data: {
      name: input.name,
      versionId: input.version_id ?? t.versionId,
      isActive: input.is_active ?? t.isActive,
    },
  });
  invalidateFormTypesCache();
  return { id: updated.id, name: updated.name, version_id: updated.versionId };
};

export const deleteFormType = async (id: string) => {
  const inUse = await prisma.form.count({ where: { formTypeId: id } });
  if (inUse > 0) throw Conflict(`Cannot delete: ${inUse} form(s) use this type`);
  await prisma.formType.delete({ where: { id } });
  invalidateFormTypesCache();
};

// ──────────────────────────── Field types ────────────────────────────

type FieldTypeRow = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  data_type: string | null;
  is_system: boolean;
  config: unknown;
};
let fieldTypesCache: { data: FieldTypeRow[]; expires: number } | null = null;
const invalidateFieldTypesCache = () => { fieldTypesCache = null; };

export const listFieldTypes = async (search?: string) => {
  if (!search && fieldTypesCache && fieldTypesCache.expires > Date.now()) {
    return fieldTypesCache.data;
  }
  const where: Prisma.FieldTypeWhereInput = { isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { label: { contains: search, mode: 'insensitive' } },
    ];
  }
  const items = await prisma.fieldType.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { label: 'asc' }],
  });
  const mapped = items.map((t) => ({
    id: t.id,
    name: t.name,
    label: t.label,
    description: t.description,
    data_type: t.dataType,
    is_system: t.isSystem,
    config: t.config,
  }));
  if (!search) {
    fieldTypesCache = { data: mapped, expires: Date.now() + LOOKUP_TTL_MS };
  }
  return mapped;
};

export const createFieldType = async (input: FieldTypeUpsert) => {
  const name = (input.name ?? input.label).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const exists = await prisma.fieldType.findUnique({ where: { name } });
  if (exists) throw Conflict('Field type with this name already exists');
  const created = await prisma.fieldType.create({
    data: {
      name,
      label: input.label,
      description: input.description ?? null,
      dataType: input.data_type ?? null,
      config: json(input.config),
      isActive: input.is_active ?? true,
      isSystem: false,
    },
  });
  invalidateFieldTypesCache();
  return created;
};

export const updateFieldType = async (id: string, input: FieldTypeUpsert) => {
  const t = await prisma.fieldType.findUnique({ where: { id } });
  if (!t) throw NotFound('Field type not found');
  if (t.isSystem) throw Conflict('System field types cannot be modified');
  const updated = await prisma.fieldType.update({
    where: { id },
    data: {
      label: input.label,
      description: input.description ?? null,
      dataType: input.data_type ?? null,
      config: json(input.config),
      isActive: input.is_active ?? t.isActive,
    },
  });
  invalidateFieldTypesCache();
  return updated;
};

export const deleteFieldType = async (id: string) => {
  const t = await prisma.fieldType.findUnique({ where: { id } });
  if (!t) throw NotFound('Field type not found');
  if (t.isSystem) throw Conflict('System field types cannot be deleted');
  const inUse = await prisma.formField.count({ where: { typeId: id } });
  if (inUse > 0) throw Conflict(`Cannot delete: ${inUse} field(s) reference this type`);
  await prisma.fieldType.delete({ where: { id } });
  invalidateFieldTypesCache();
};

// list of primitive data types — frontend just needs labels
export const listDataTypes = async () => [
  { id: 'string', name: 'String' },
  { id: 'number', name: 'Number' },
  { id: 'boolean', name: 'Boolean' },
  { id: 'date', name: 'Date' },
  { id: 'json', name: 'JSON' },
  { id: 'file', name: 'File' },
];

// ──────────────────────────── Forms ──────────────────────────────────

export const listForms = async (q: ListFormsQuery) => {
  const where: Prisma.FormWhereInput = {};
  if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
  if (q.is_completed !== undefined) where.isCompleted = q.is_completed === 'true';
  if (q.form_type_id) where.formTypeId = q.form_type_id;
  if (q.kind) where.kind = q.kind as FormKind;

  const skip = (q.page_number - 1) * q.page_size;
  const [items, total] = await Promise.all([
    prisma.form.findMany({
      where,
      include: {
        formType: { select: { id: true, name: true, versionId: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: q.page_size,
    }),
    prisma.form.count({ where }),
  ]);

  // group all versions by templateKey for `all_versions`
  const keys = items.map((i) => i.templateKey);
  const siblings = keys.length
    ? await prisma.form.findMany({
        where: { templateKey: { in: keys } },
        select: { id: true, templateKey: true, version: true },
        orderBy: { version: 'asc' },
      })
    : [];
  const byKey = new Map<string, { id: string; version: number }[]>();
  for (const s of siblings) {
    const arr = byKey.get(s.templateKey) ?? [];
    arr.push({ id: s.id, version: s.version });
    byKey.set(s.templateKey, arr);
  }

  return {
    forms: items.map((f) => serializeForm(f, byKey.get(f.templateKey) ?? [])),
    obj_count: total,
    max_rows: q.page_size,
  };
};

export const getFormFields = async (id: string) => {
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      formType: true,
      sections: {
        orderBy: { position: 'asc' },
        include: {
          fields: {
            where: { parentFieldId: null },
            orderBy: { position: 'asc' },
            include: {
              type: true,
              children: { include: { type: true }, orderBy: { position: 'asc' } },
            },
          },
        },
      },
      draft: true,
    },
  });
  if (!form) throw NotFound('Form not found');

  const serialised = {
    sections: form.sections.map(serializeSection),
  };
  return {
    draft_data: form.draft?.draftData ?? serialised,
    form_details: {
      title: form.title,
      description: form.description,
      version: form.version,
      version_id: form.versionId,
      kind: form.kind,
      form_type: form.formType ? form.formType.name : null,
      workflow_name: form.workflowName,
      workflow_type: form.workflowType,
    },
  };
};

export const getFormDraft = async (id: string) => {
  const form = await prisma.form.findUnique({
    where: { id },
    include: { draft: true, formType: true },
  });
  if (!form) throw NotFound('Form not found');
  return {
    draft_data: form.draft?.draftData ?? { sections: [], fields: [] },
    form_details: form.draft?.formDetails ?? {
      title: form.title,
      description: form.description,
      version: form.version,
      version_id: form.versionId,
      form_type: form.formType?.name,
    },
  };
};

export const createForm = async (input: CreateFormInput, userId?: string) => {
  const description = input.description ?? input.desc ?? null;
  const versionId = randomUUID();
  const templateKey = randomUUID();

  const form = await prisma.form.create({
    data: {
      title: input.title,
      description,
      templateKey,
      version: 1,
      versionId,
      status: FormStatus.DRAFT,
      kind: (input.kind ?? 'FORM') as FormKind,
      formTypeId: input.type_id ?? null,
      location: input.location ?? null,
      mainProcess: input.main_process ?? null,
      criteria: input.criteria ?? null,
      pdcaApproved: input.pdca_approved ?? false,
      workflowName: input.workflow_name ?? null,
      workflowType: input.workflow_type ?? null,
      createdById: userId ?? null,
    },
  });
  return { form_id: form.id, id: form.id, version_id: form.versionId, kind: form.kind };
};

export const saveFormFields = async (id: string, input: SaveFormFieldsInput) => {
  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) throw NotFound('Form not found');

  // Pre-compute uuids in JS so we can build flat createMany payloads — every
  // section row already knows the field rows that reference it, and every
  // child field row already knows its parent's id. This keeps the whole save
  // to a handful of round-trips even on a remote database.
  const sectionRows: Prisma.FormSectionCreateManyInput[] = [];
  const fieldRows: Prisma.FormFieldCreateManyInput[] = [];

  const buildField = (
    sectionDbId: string,
    parentFieldId: string | null,
    field: RawField,
    position: number
  ): void => {
    const fieldDbId = randomUUID();
    fieldRows.push({
      id: fieldDbId,
      sectionId: sectionDbId,
      parentFieldId,
      fieldId: field.field_id ?? randomUUID(),
      name: field.name,
      label: field.label,
      position: field.position ?? position,
      width: field.width ?? '100',
      required: field.required ?? false,
      typeId: field.type_id ?? null,
      typeName: field.type_name ?? field.type ?? null,
      defaultValue: json(field.default_value ?? field.value),
      options: json(field.options),
      validation: json(field.validation),
      dependency: json(field.dependency),
      dynamic: field.dynamic ?? false,
      endpoint: field.end_point ?? null,
      autoGenerate: field.auto_generate ?? false,
      autoGenerateEndpoint: field.auto_generate_endpoint ?? null,
      autoGenerateMappings: json(field.auto_generate_mappings),
    });
    if (Array.isArray(field.fields)) {
      field.fields.forEach((child, i) => buildField(sectionDbId, fieldDbId, child, i));
    }
  };

  input.sections.forEach((section, sIdx) => {
    const sectionDbId = randomUUID();
    sectionRows.push({
      id: sectionDbId,
      formId: id,
      sectionId: section.section_id ?? `section_${randomUUID()}`,
      name: section.section_name,
      position: section.position ?? sIdx,
      dependency: json(section.dependency),
    });
    section.fields.forEach((field, fIdx) =>
      buildField(sectionDbId, null, field as RawField, fIdx)
    );
  });

  // Sequential transaction array — single round-trip per statement, no
  // interactive back-and-forth. Five statements total regardless of field
  // count.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.formSection.deleteMany({ where: { formId: id } }),
    prisma.formSection.createMany({ data: sectionRows }),
    prisma.formField.createMany({ data: fieldRows }),
    prisma.formDraft.deleteMany({ where: { formId: id } }),
  ];

  if (input.form_details) {
    ops.push(
      prisma.form.update({
        where: { id },
        data: {
          title: input.form_details.title ?? form.title,
          description: input.form_details.description ?? form.description,
          formTypeId: input.form_details.form_type ?? form.formTypeId,
          isCompleted: true,
          status: FormStatus.PUBLISHED,
        },
      })
    );
  }

  await prisma.$transaction(ops);
};

export const saveDraft = async (
  id: string,
  input: SaveDraftInput,
  userId?: string
) => {
  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) throw NotFound('Form not found');
  await prisma.formDraft.upsert({
    where: { formId: id },
    create: {
      formId: id,
      draftData: input.draft_data as Prisma.InputJsonValue,
      formDetails: (input.form_details ?? {}) as Prisma.InputJsonValue,
      versionId: input.version_id ?? form.versionId,
      savedById: userId ?? null,
    },
    update: {
      draftData: input.draft_data as Prisma.InputJsonValue,
      formDetails: (input.form_details ?? {}) as Prisma.InputJsonValue,
      versionId: input.version_id ?? form.versionId,
      savedById: userId ?? null,
    },
  });
};

export const deleteForm = async (id: string) => {
  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) throw NotFound('Form not found');
  await prisma.form.delete({ where: { id } });
};

// ──────────────────────────── lookups ───────────────────────────────

export const listMainProcesses = async () => ({
  main_processes: [
    { id: 'production', name: 'Production' },
    { id: 'quality', name: 'Quality Control' },
    { id: 'maintenance', name: 'Maintenance' },
    { id: 'warehouse', name: 'Warehouse' },
    { id: 'rd', name: 'R&D' },
  ],
});

export const listCriteria = async () => ({
  criteria: [
    { id: 'iso9001', name: 'ISO 9001:2015' },
    { id: 'iso14001', name: 'ISO 14001:2015' },
    { id: 'iso45001', name: 'ISO 45001:2018' },
    { id: 'iatf16949', name: 'IATF 16949:2016' },
    { id: 'gmp', name: 'GMP' },
  ],
});

// ──────────────────────────── helpers ───────────────────────────────

type RawField = {
  field_id?: string;
  name: string;
  label: string;
  type?: string;
  type_id?: string | null;
  type_name?: string;
  required?: boolean;
  position?: number;
  width?: string;
  default_value?: unknown;
  value?: unknown;
  validation?: Record<string, unknown> | null;
  options?: Array<{ label: string; value: string | number | boolean }> | null;
  dependency?: Record<string, unknown> | null;
  dynamic?: boolean;
  end_point?: string | null;
  auto_generate?: boolean;
  auto_generate_endpoint?: string | null;
  auto_generate_mappings?: Record<string, unknown> | null;
  fields?: RawField[];
};

const serializeForm = (
  f: Awaited<ReturnType<typeof prisma.form.findFirst>> & {
    formType?: { id: string; name: string; versionId: string } | null;
    createdBy?: { id: string; name: string } | null;
  },
  versions: { id: string; version: number }[]
) => ({
  id: f!.id,
  title: f!.title,
  description: f!.description,
  type: f!.formType?.name ?? null,
  type_id: f!.formTypeId,
  version: f!.version,
  version_id: f!.versionId,
  is_completed: f!.isCompleted,
  status: f!.status,
  kind: f!.kind,
  workflow_name: f!.workflowName,
  workflow_type: f!.workflowType,
  location: f!.location,
  main_process: f!.mainProcess,
  criteria: f!.criteria,
  pdca_approved: f!.pdcaApproved,
  created_on: f!.createdAt,
  created_by: f!.createdBy ?? null,
  all_versions: versions,
});

const serializeSection = (s: {
  sectionId: string;
  name: string;
  position: number;
  dependency: unknown;
  fields: SerializableField[];
}) => ({
  section_id: s.sectionId,
  section_name: s.name,
  position: s.position,
  dependency: s.dependency,
  fields: s.fields.map(serializeField),
});

type SerializableField = {
  fieldId: string;
  name: string;
  label: string;
  position: number;
  width: string;
  required: boolean;
  typeId: string | null;
  typeName: string | null;
  type?: { id: string; name: string; label: string } | null;
  defaultValue: unknown;
  options: unknown;
  validation: unknown;
  dependency: unknown;
  dynamic: boolean;
  endpoint: string | null;
  autoGenerate: boolean;
  autoGenerateEndpoint: string | null;
  autoGenerateMappings: unknown;
  children?: SerializableField[];
};

const serializeField = (f: SerializableField): Record<string, unknown> => ({
  field_id: f.fieldId,
  name: f.name,
  label: f.label,
  type: f.type?.name ?? f.typeName ?? null,
  type_id: f.typeId,
  position: f.position,
  width: f.width,
  required: f.required,
  value: f.defaultValue,
  options: f.options ?? [],
  validation: f.validation ?? {},
  dependency: f.dependency ?? null,
  dynamic: f.dynamic,
  end_point: f.endpoint,
  auto_generate: f.autoGenerate,
  auto_generate_endpoint: f.autoGenerateEndpoint,
  auto_generate_mappings: f.autoGenerateMappings,
  fields: (f.children ?? []).map(serializeField),
});
