// Single-page form creator:
//   1. Top header (search + Bulk Export / Bulk Upload / Close Template).
//   2. Form details card — collapses to a one-line summary once Next is clicked,
//      so the sections panel below has more room.
//   3. Sections panel: each section embeds the full FieldTable, so users get
//      validation, width, dependency, options, and reordering controls per field.
//   4. Submit creates the form, saves its fields, and routes back to /forms.
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Download, Upload as UploadIcon, X, Plus, Trash2,
  Check, Search, ChevronDown, ChevronUp, FileText, AlertTriangle, RefreshCw,
  Eye, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button as AntButton, Divider, Input as AntInput, Modal as AntModal, Select } from 'antd';
import Spinner from '@/components/ui/Spinner';
import {
  useCreateForm, useCreateFormType, useFieldTypes, useFormTypes,
  useSaveDraft, useSaveFormFields,
} from './hooks';
import { fieldUsesOptions } from './fieldCatalog';
import FieldTable from './components/FieldTable';
import FormPreview from './components/FormPreview';
import type { ParentField } from './components/DependencyEditor';
import { remapDependencies } from './lib/dependency';
import type { FieldType, FormFieldDef, FormKind, FormSectionDef } from './types';

export default function FormCreatePage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const kind: FormKind = searchParams.get('kind') === 'CHECKLIST' ? 'CHECKLIST' : 'FORM';
  const isChecklist = kind === 'CHECKLIST';
  const noun = isChecklist ? 'checklist' : 'form';
  const Noun = isChecklist ? 'Checklist' : 'Form';
  const listTab = isChecklist ? '/forms?tab=checklists' : '/forms';

  // ── Form-detail state ─────────────────────────────────
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [detailsLocked, setDetailsLocked] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  // ── Sections / fields state ───────────────────────────
  const [sections, setSections] = useState<FormSectionDef[]>([]);

  // ── Type-picker modal ─────────────────────────────────
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // ── Preview modal ─────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);

  // After Save Draft, we keep the created form id so subsequent saves
  // update the same record instead of creating a new one each time.
  const [draftFormId, setDraftFormId] = useState<string | null>(null);

  const { data: formTypes = [] } = useFormTypes();
  const {
    data: fieldTypes = [],
    isLoading: loadingFieldTypes,
    isError: fieldTypesError,
    refetch: refetchFieldTypes,
    isFetching: refetchingFieldTypes,
  } = useFieldTypes();
  const createForm = useCreateForm();
  const saveFields = useSaveFormFields();
  const saveDraft = useSaveDraft();
  const createFormType = useCreateFormType();

  const activeTypes = useMemo(
    () => formTypes.filter((t) => t.is_active !== false),
    [formTypes]
  );
  const typeName = activeTypes.find((t) => t.id === typeId)?.name ?? '—';
  const totalFields = sections.reduce((n, s) => n + s.fields.length, 0);

  const canNext = title.trim().length > 0;
  const isSubmitting = createForm.isPending || saveFields.isPending;
  const isSavingDraft = createForm.isPending || saveDraft.isPending;
  const hasFields = sections.some((s) => s.fields.length > 0);

  const handleReset = () => {
    setTitle('');
    setTypeId('');
    setDescription('');
    setDetailsLocked(false);
    setDetailsCollapsed(false);
    setSections([]);
  };

  const handleNext = () => {
    if (!canNext) return;
    if (sections.length === 0) {
      setSections([
        {
          section_id: `s_${Date.now()}`,
          section_name: 'Section 1',
          position: 0,
          fields: [],
        },
      ]);
    }
    setDetailsLocked(true);
    setDetailsCollapsed(true);
  };

  const handleClose = () => nav(listTab);

  const handleCreateType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    try {
      const created = await createFormType.mutateAsync({ name });
      toast.success(`Type "${name}" added`);
      if (created?.id) setTypeId(created.id);
      setNewTypeName('');
      setAddTypeOpen(false);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to add type');
    }
  };

  // ── Section mutators ──────────────────────────────────
  const addSection = () =>
    setSections((s) => [
      ...s,
      {
        section_id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        section_name: `Section ${s.length + 1}`,
        position: s.length,
        fields: [],
      },
    ]);

  const removeSection = (idx: number) => {
    if (sections.length <= 1) {
      toast.error('At least one section is required');
      return;
    }
    setSections((s) => s.filter((_, i) => i !== idx));
  };

  // Rewrites dependency rules that reference the old section name so they
  // keep matching after rename. Mirrors FormBuilderPage.updateSection.
  const renameSection = (idx: number, name: string) =>
    setSections((s) => {
      const oldName = s[idx]?.section_name;
      const updated = s.map((sec, i) => (i === idx ? { ...sec, section_name: name } : sec));
      if (!oldName || oldName === name) return updated;
      return remapDependencies(updated, (cond) =>
        cond.sectionName === oldName ? { sectionName: name } : null,
      );
    });

  // ── Field mutators (per section) ──────────────────────
  const addField = (sIdx: number, atIndex: number, type: FieldType) => {
    const slug = type.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const newField: FormFieldDef = {
      field_id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${slug}_${Math.random().toString(36).slice(2, 4)}`,
      label: type.label,
      type: type.name,
      type_id: type.id,
      required: false,
      width: '100',
      options: fieldUsesOptions(type.name)
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : undefined,
    };
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sIdx) return sec;
        const fields = [...sec.fields];
        fields.splice(atIndex, 0, newField);
        return { ...sec, fields };
      })
    );
  };

  // Rewrites dependency rules that reference a renamed field so they keep
  // matching. Mirrors FormBuilderPage.updateField.
  const updateField = (sIdx: number, fid: string, patch: Partial<FormFieldDef>) =>
    setSections((s) => {
      const sectionName = s[sIdx]?.section_name;
      const oldField = s[sIdx]?.fields.find((f) => f.field_id === fid);
      const renamedTo =
        oldField && patch.name !== undefined && patch.name !== oldField.name
          ? patch.name
          : null;
      const next = s.map((sec, i) =>
        i === sIdx
          ? {
              ...sec,
              fields: sec.fields.map((f) =>
                f.field_id === fid ? { ...f, ...patch } : f
              ),
            }
          : sec
      );
      if (!renamedTo || !sectionName || !oldField) return next;
      return remapDependencies(next, (cond) =>
        cond.sectionName === sectionName && cond.fieldName === oldField.name
          ? { fieldName: renamedTo }
          : null,
      );
    });

  const moveField = (sIdx: number, fid: string, dir: -1 | 1) =>
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sIdx) return sec;
        const idx = sec.fields.findIndex((f) => f.field_id === fid);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= sec.fields.length) return sec;
        const fields = [...sec.fields];
        [fields[idx], fields[target]] = [fields[target], fields[idx]];
        return { ...sec, fields };
      })
    );

  const duplicateField = (sIdx: number, fid: string) =>
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sIdx) return sec;
        const orig = sec.fields.find((f) => f.field_id === fid);
        if (!orig) return sec;
        const idx = sec.fields.findIndex((f) => f.field_id === fid);
        const copy: FormFieldDef = {
          ...orig,
          field_id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
          name: `${orig.name}_copy`,
          label: `${orig.label} (copy)`,
        };
        const fields = [...sec.fields];
        fields.splice(idx + 1, 0, copy);
        return { ...sec, fields };
      })
    );

  const removeField = (sIdx: number, fid: string) =>
    setSections((s) =>
      s.map((sec, i) =>
        i === sIdx ? { ...sec, fields: sec.fields.filter((f) => f.field_id !== fid) } : sec
      )
    );

  // ── Dependency parents (fields earlier on the canvas) ─
  const parentsBefore = (sIdx: number, fieldId?: string): ParentField[] => {
    const out: ParentField[] = [];
    for (let i = 0; i <= sIdx; i++) {
      const sec = sections[i];
      if (!sec) continue;
      for (const f of sec.fields) {
        if (i === sIdx && f.field_id === fieldId) return out;
        out.push({
          sectionName: sec.section_name,
          fieldName: f.name,
          label: f.label,
          type: f.type ?? '',
          options: f.options,
        });
      }
    }
    return out;
  };

  // Ensure we have a backend form record to save against. Used by both
  // Save Draft and Create Form so we don't duplicate forms on retries.
  const ensureFormId = async (): Promise<string> => {
    if (draftFormId) return draftFormId;
    const created = await createForm.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      type_id: typeId || null,
      kind,
    });
    setDraftFormId(created.form_id);
    return created.form_id;
  };

  // ── Save ──────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!canNext) {
      toast.error('Please add a title');
      return;
    }
    if (sections.some((s) => !s.section_name.trim())) {
      toast.error('Each section needs a name');
      return;
    }
    try {
      const formId = await ensureFormId();
      await saveDraft.mutateAsync({
        id: formId,
        sections,
        title: title.trim(),
        description: description.trim() || null,
      });
      toast.success('Draft saved');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to save draft');
    }
  };

  const handleSubmit = async () => {
    if (!canNext) {
      toast.error('Please add a title');
      return;
    }
    if (sections.some((s) => !s.section_name.trim())) {
      toast.error('Each section needs a name');
      return;
    }
    try {
      const formId = await ensureFormId();
      await saveFields.mutateAsync({
        id: formId,
        sections,
        title: title.trim(),
        description: description.trim() || null,
        form_type: typeId || null,
      });
      toast.success(`${Noun} created`);
      nav(listTab);
    } catch (err) {
      toast.error((err as Error).message ?? `Failed to create ${noun}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* TOP HEADER ─────────────────────────────────────── */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{Noun} Templates</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create entries and manage their status
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <AntInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title..."
              prefix={<Search className="h-4 w-4 text-slate-400" />}
              style={{ width: 256 }}
              allowClear
            />
            <HeaderButton icon={Download} label="Bulk Export" onClick={() => toast('Coming soon')} />
            <HeaderButton icon={UploadIcon} label="Bulk Upload" onClick={() => toast('Coming soon')} />
            <HeaderButton icon={X} label="Close Template" onClick={handleClose} />
          </div>
        </div>
      </div>

      {/* BODY ───────────────────────────────────────────── */}
      <div className="px-6 py-6 space-y-6">
        {/* ── Details card ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Collapsed summary */}
          {detailsLocked && detailsCollapsed ? (
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-indigo-50 text-indigo-600 shrink-0">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {title || `Untitled ${noun}`}
                  </h3>
                  {typeId && (
                    <span className="text-[10px] font-medium uppercase tracking-wide bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                      {typeName}
                    </span>
                  )}
                </div>
                {description && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{description}</p>
                )}
              </div>
              <span className="hidden sm:inline text-xs text-slate-400">
                {sections.length} section{sections.length === 1 ? '' : 's'} · {totalFields} field{totalFields === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setDetailsCollapsed(false)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                <ChevronDown className="h-3.5 w-3.5" /> Edit details
              </button>
            </div>
          ) : (
            <div className="p-6">
              {detailsLocked && (
                <div className="flex justify-end -mt-2 -mr-2 mb-1">
                  <button
                    type="button"
                    onClick={() => setDetailsCollapsed(true)}
                    title="Collapse"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Title</label>
                  <AntInput
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter Title"
                    size="large"
                    allowClear
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Type</label>
                  <Select
                    value={typeId || undefined}
                    onChange={(v) => setTypeId(v ?? '')}
                    placeholder={activeTypes.length === 0 ? 'No types yet — add one' : 'Select Type'}
                    size="large"
                    style={{ width: '100%' }}
                    options={activeTypes.map((t) => ({ label: t.name, value: t.id }))}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    popupRender={(menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '4px 0' }} />
                        <AntButton
                          type="link"
                          icon={<Plus className="h-4 w-4" />}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setAddTypeOpen(true)}
                          style={{ width: '100%', textAlign: 'left' }}
                        >
                          Add new type
                        </AntButton>
                      </>
                    )}
                    notFoundContent={
                      <div className="py-2 text-center text-xs text-slate-500">
                        No types in the system yet
                      </div>
                    }
                  />
                  {activeTypes.length === 0 && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      No types in the system yet. Use <span className="font-medium text-slate-600">Add new type</span> in the dropdown to create one.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Description</label>
                <AntInput.TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  autoSize={{ minRows: 4, maxRows: 8 }}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <AntButton onClick={handleReset} disabled={isSubmitting}>
                  Reset
                </AntButton>
                {!detailsLocked ? (
                  <AntButton type="primary" onClick={handleNext} disabled={!canNext}>
                    Next
                  </AntButton>
                ) : (
                  <AntButton type="primary" onClick={() => setDetailsCollapsed(true)} disabled={!canNext}>
                    Done
                  </AntButton>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Sections builder ─────────────────────────── */}
        {detailsLocked && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sections</h2>
                <p className="text-sm text-slate-500">
                  Add sections and pick the field types that go in each.
                </p>
              </div>
              <AntButton onClick={addSection} icon={<Plus className="h-4 w-4" />}>
                Add Section
              </AntButton>
            </div>

            {(fieldTypesError || (!loadingFieldTypes && fieldTypes.length === 0)) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Couldn't load field types
                  </p>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    {fieldTypesError
                      ? 'The server returned an error. This often happens when the database connection drops — try again.'
                      : 'No field types are configured. Click retry, or add some in Field types.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchFieldTypes()}
                  disabled={refetchingFieldTypes}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  <RefreshCw className={'h-3.5 w-3.5 ' + (refetchingFieldTypes ? 'animate-spin' : '')} />
                  {refetchingFieldTypes ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            )}

            {sections.map((sec, idx) => (
              <SectionCard
                key={sec.section_id}
                section={sec}
                index={idx}
                fieldTypes={fieldTypes}
                fieldTypesLoading={loadingFieldTypes}
                parentsFor={(fid) => parentsBefore(idx, fid)}
                onRename={(name) => renameSection(idx, name)}
                onChangeField={(fid, p) => updateField(idx, fid, p)}
                onMoveField={(fid, dir) => moveField(idx, fid, dir)}
                onDuplicateField={(fid) => duplicateField(idx, fid)}
                onRemoveField={(fid) => removeField(idx, fid)}
                onAddField={(at, t) => addField(idx, at, t)}
                onRemove={() => removeSection(idx)}
              />
            ))}

            <div className="pt-2 flex flex-wrap justify-end gap-3">
              <AntButton onClick={handleClose} disabled={isSubmitting || isSavingDraft}>
                Cancel
              </AntButton>
              <AntButton
                icon={<Eye className="h-4 w-4" />}
                onClick={() => setPreviewOpen(true)}
                disabled={!hasFields || isSubmitting || isSavingDraft}
                title={hasFields ? `Preview ${noun}` : 'Add at least one field to preview'}
              >
                Preview
              </AntButton>
              <AntButton
                icon={<Save className="h-4 w-4" />}
                onClick={handleSaveDraft}
                loading={isSavingDraft && !isSubmitting}
                disabled={!canNext || isSubmitting || isSavingDraft}
              >
                Save Draft
              </AntButton>
              <AntButton
                type="primary"
                icon={<Check className="h-4 w-4" />}
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting || isSavingDraft}
              >
                Create {Noun}
              </AntButton>
            </div>
          </section>
        )}
      </div>

      {/* ── Preview modal ────────────────────────────── */}
      <AntModal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        title={`${Noun} preview`}
        width={900}
        footer={[
          <AntButton key="close" onClick={() => setPreviewOpen(false)}>
            Close
          </AntButton>,
          <AntButton
            key="create"
            type="primary"
            loading={isSubmitting}
            onClick={() => {
              setPreviewOpen(false);
              handleSubmit();
            }}
          >
            Looks good — Create {noun}
          </AntButton>,
        ]}
      >
        <FormPreview
          title={title || `Untitled ${noun}`}
          description={description}
          sections={sections}
        />
      </AntModal>

      {/* ── New-type modal ───────────────────────────── */}
      <AntModal
        open={addTypeOpen}
        onCancel={() => setAddTypeOpen(false)}
        title={`Add new ${noun} type`}
        footer={[
          <AntButton key="cancel" onClick={() => setAddTypeOpen(false)}>
            Cancel
          </AntButton>,
          <AntButton
            key="add"
            type="primary"
            loading={createFormType.isPending}
            disabled={!newTypeName.trim() || createFormType.isPending}
            onClick={handleCreateType}
          >
            Add type
          </AntButton>,
        ]}
      >
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Type name
        </label>
        <AntInput
          autoFocus
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          onPressEnter={handleCreateType}
          placeholder="e.g. Inspection, Calibration"
        />
      </AntModal>
    </div>
  );
}

// ─── Header button ────────────────────────────────────────
function HeaderButton({
  icon: Icon, label, onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-medium transition"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ─── Section card (uses FieldTable for full per-field controls) ──
function SectionCard({
  section, index, fieldTypes, fieldTypesLoading, parentsFor,
  onRename, onChangeField, onMoveField, onDuplicateField, onRemoveField, onAddField, onRemove,
}: {
  section: FormSectionDef;
  index: number;
  fieldTypes: FieldType[];
  fieldTypesLoading: boolean;
  parentsFor: (fieldId?: string) => ParentField[];
  onRename: (name: string) => void;
  onChangeField: (fieldId: string, patch: Partial<FormFieldDef>) => void;
  onMoveField: (fieldId: string, dir: -1 | 1) => void;
  onDuplicateField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onAddField: (atIndex: number, type: FieldType) => void;
  onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
        <span className="text-[11px] font-mono text-slate-400 w-6 shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <input
          value={section.section_name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Section name"
          className="flex-1 bg-transparent border-0 outline-none text-base font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1"
        />
        <span className="text-xs text-slate-500">
          {section.fields.length} field{section.fields.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Delete section"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div className="p-5">
          {fieldTypesLoading && fieldTypes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 p-10 text-center">
              <Spinner />
              <p className="mt-3 text-sm text-slate-500">Loading field types…</p>
            </div>
          ) : (
            <FieldTable
              fields={section.fields}
              fieldTypes={fieldTypes}
              parentsFor={parentsFor}
              onChangeField={onChangeField}
              onMoveField={onMoveField}
              onDuplicateField={onDuplicateField}
              onRemoveField={onRemoveField}
              onAddField={onAddField}
              hiddenFieldIds={new Set()}
              inlineTypePicker
            />
          )}
        </div>
      )}
    </div>
  );
}
