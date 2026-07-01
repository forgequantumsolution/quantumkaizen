// Two-pane builder layout:
//   • Left rail – list of sections (click to switch)
//   • Main pane – form title/description, then a SectionPanel + FieldTable
//                 for the active section. Each field is one row of the table;
//                 click the gear to expand validation/options/logic inline.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, Monitor, Pencil, Save, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button as AntButton, Input as AntInput, Segmented } from 'antd';
import Spinner from '@/components/ui/Spinner';
import PageContainer from '@/components/layout/PageContainer';
import {
  useFieldTypes, useFormDetail, useSaveDraft, useSaveFormFields,
} from './hooks';
import { fieldUsesOptions, fieldIsTable } from './fieldCatalog';
import SectionTabsBar from './components/SectionTabsBar';
import SectionPanel from './components/SectionPanel';
import FieldTable from './components/FieldTable';
import FormPreview, { type PreviewDevice } from './components/FormPreview';
import type { ParentField } from './components/DependencyEditor';
import { remapDependencies } from './lib/dependency';
import type { FieldType, FormFieldDef, FormKind, FormSectionDef } from './types';

type Mode = 'build' | 'preview';

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: detail, isLoading } = useFormDetail(id);
  const { data: fieldTypes = [] } = useFieldTypes();
  const saveFields = useSaveFormFields();
  const saveDraft = useSaveDraft();

  const [mode, setMode] = useState<Mode>('build');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<FormSectionDef[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  const kind: FormKind = detail?.form_details.kind ?? 'FORM';
  const isChecklist = kind === 'CHECKLIST';
  const noun = isChecklist ? 'checklist' : 'form';
  const Noun = isChecklist ? 'Checklist' : 'Form';
  const backLabel = isChecklist ? 'Checklists' : 'Forms';
  const backRoute = isChecklist
    ? '/settings?section=forms&tab=checklists'
    : '/settings?section=forms';

  // Hydrate from server payload
  useEffect(() => {
    if (!detail) return;
    setTitle(detail.form_details.title ?? '');
    setDescription(detail.form_details.description ?? '');
    const draft = (detail.draft_data as { sections?: FormSectionDef[] }).sections ?? [];
    setSections(
      draft.length
        ? draft
        : [{ section_name: 'Section 1', section_id: `s_${Date.now()}`, fields: [], position: 0 }]
    );
    setActiveSection(0);
  }, [detail]);

  // ── Section mutators ─────────────────────────────────────────
  // updateSection is rename-aware: when section_name changes, any dependency
  // rules referencing the old name are rewritten so they keep matching.
  const updateSection = (idx: number, patch: Partial<FormSectionDef>) =>
    setSections((s) => {
      const oldName = s[idx]?.section_name;
      const newName = patch.section_name;
      const nameChanged =
        newName !== undefined && oldName !== undefined && newName !== oldName;
      const updated = s.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec));
      if (!nameChanged) return updated;
      return remapDependencies(updated, (cond) =>
        cond.sectionName === oldName ? { sectionName: newName } : null,
      );
    });

  const addSection = () => {
    const next: FormSectionDef = {
      section_name: `Section ${sections.length + 1}`,
      section_id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fields: [],
      position: sections.length,
    };
    setSections((s) => [...s, next]);
    setActiveSection(sections.length);
  };

  const removeSection = (idx: number) => {
    if (sections.length <= 1) {
      toast.error('At least one section is required');
      return;
    }
    setSections((s) => s.filter((_, i) => i !== idx));
    setActiveSection((prev) => Math.max(0, prev - (idx <= prev ? 1 : 0)));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    setSections((s) => {
      const next = [...s];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    if (activeSection === idx) setActiveSection(target);
    else if (activeSection === target) setActiveSection(idx);
  };

  // ── Field mutators (scoped to active section) ────────────────
  const updateField = (sIdx: number, fieldId: string, patch: Partial<FormFieldDef>) =>
    setSections((s) => {
      const sectionName = s[sIdx]?.section_name;
      const oldField = s[sIdx]?.fields.find((f) => f.field_id === fieldId);
      const renamedTo =
        oldField && patch.name !== undefined && patch.name !== oldField.name
          ? patch.name
          : null;
      const next = s.map((sec, i) =>
        i === sIdx
          ? {
              ...sec,
              fields: sec.fields.map((f) =>
                f.field_id === fieldId ? { ...f, ...patch } : f,
              ),
            }
          : sec,
      );
      if (!renamedTo || !sectionName || !oldField) return next;
      return remapDependencies(next, (cond) =>
        cond.sectionName === sectionName && cond.fieldName === oldField.name
          ? { fieldName: renamedTo }
          : null,
      );
    });

  const insertField = (sIdx: number, atIndex: number, type: FieldType) => {
    const slug = type.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const fieldId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newField: FormFieldDef = {
      field_id: fieldId,
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
      // Seed table fields with one column so the preview renders a real table
      // (with the Add-row control) immediately; more columns via Settings.
      fields: fieldIsTable(type.name)
        ? [
            {
              field_id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: 'column_1',
              label: 'Column 1',
              type: 'text',
              required: false,
            },
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

  const moveField = (sIdx: number, fieldId: string, dir: -1 | 1) =>
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sIdx) return sec;
        const idx = sec.fields.findIndex((f) => f.field_id === fieldId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= sec.fields.length) return sec;
        const fields = [...sec.fields];
        [fields[idx], fields[target]] = [fields[target], fields[idx]];
        return { ...sec, fields };
      })
    );

  const duplicateField = (sIdx: number, fieldId: string) =>
    setSections((s) =>
      s.map((sec, i) => {
        if (i !== sIdx) return sec;
        const orig = sec.fields.find((f) => f.field_id === fieldId);
        if (!orig) return sec;
        const idx = sec.fields.findIndex((f) => f.field_id === fieldId);
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

  const removeField = (sIdx: number, fieldId: string) =>
    setSections((s) =>
      s.map((sec, i) =>
        i === sIdx ? { ...sec, fields: sec.fields.filter((f) => f.field_id !== fieldId) } : sec
      )
    );

  // ── Dependency parents (fields earlier on the canvas) ───────
  const parentsBefore = (sIdx: number, fieldId?: string): ParentField[] => {
    const out: ParentField[] = [];
    for (let i = 0; i <= sIdx; i++) {
      const sec = sections[i];
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

  // ── Save handlers ───────────────────────────────────────────
  const onSaveDraft = async () => {
    if (!id) return;
    try {
      await saveDraft.mutateAsync({ id, sections, title, description });
      toast.success('Draft saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const onPublish = async () => {
    if (!id) return;
    try {
      const result = await saveFields.mutateAsync({ id, sections, title, description });
      // When the form is bound to a workflow that already has tickets the
      // server clones into a new version row instead of mutating the live
      // schema — tell the user which version they now have AND that older
      // stage bindings still point to the previous version (so any new
      // visibility/validation rules won't apply until they re-bind).
      if (result.version_bumped) {
        toast.success(
          `${Noun} saved as v${result.version}. Heads up: in-flight tickets keep the old version — re-attach this form on your workflow stages to use the new rules.`,
          { duration: 8000 },
        );
      } else {
        toast.success(`${Noun} published`);
      }
      nav(backRoute);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const currentSection = sections[activeSection];
  // Conditional rules are evaluated against real responses in the Preview
  // tab and on the fill page. The build canvas always shows every field so
  // they remain editable — the rule itself is summarised on each row.
  const hiddenFieldIds = new Set<string>();

  return (
    <PageContainer noSpacing>
      {/* TOP BAR ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="w-full h-14 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <AntInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Untitled ${noun}`}
              variant="borderless"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#0f172a',
                padding: '2px 6px',
                margin: '0 -6px',
                lineHeight: 1.25,
                width: 'auto',
                flex: '0 1 auto',
                minWidth: 120,
                maxWidth: 360,
              }}
            />
          </div>

          {mode === 'preview' && (
            <>
              <Segmented
                size="small"
                value={previewDevice}
                onChange={(v) => setPreviewDevice(v as PreviewDevice)}
                options={[
                  { label: <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Desktop</span>, value: 'desktop' },
                  { label: <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> Mobile</span>, value: 'mobile' },
                ]}
              />
              <span className="h-5 w-px bg-slate-200" />
            </>
          )}

          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            <ModeTab active={mode === 'build'}   onClick={() => setMode('build')}   icon={Pencil} label="Build"   />
            <ModeTab active={mode === 'preview'} onClick={() => setMode('preview')} icon={Eye}    label="Preview" />
          </div>

          <span className="h-5 w-px bg-slate-200" />

          <AntButton
            size="small"
            icon={<Save className="h-4 w-4" />}
            loading={saveDraft.isPending}
            onClick={onSaveDraft}
          >
            Save draft
          </AntButton>
          <AntButton
            type="primary"
            size="small"
            icon={<Check className="h-4 w-4" />}
            loading={saveFields.isPending}
            onClick={onPublish}
          >
            Publish
          </AntButton>

          <span className="h-5 w-px bg-slate-200" />

          <button
            type="button"
            onClick={() => nav(backRoute)}
            title={`Back to ${backLabel}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-700 hover:text-slate-900 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>
        {description && (
          <div className="pb-2 -mt-1">
            <AntInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description"
              variant="borderless"
              style={{
                fontSize: 12.5,
                color: '#64748b',
                padding: '0 6px',
                margin: '0 -6px',
              }}
            />
          </div>
        )}
      </div>

      {/* CANVAS ─────────────────────────────────────────────── */}
      <div className="w-full pt-4 pb-2">
        {mode === 'build' ? (
          <div className="space-y-3">
            {/* Combined sections card: tabs row + active-section header */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100">
                <SectionTabsBar
                  sections={sections}
                  activeIndex={activeSection}
                  onSelect={setActiveSection}
                  onAdd={addSection}
                />
              </div>
              {currentSection && (
                <SectionPanel
                  section={currentSection}
                  index={activeSection}
                  total={sections.length}
                  parents={parentsBefore(activeSection - 1)}
                  onChange={(p) => updateSection(activeSection, p)}
                  onMove={(d) => moveSection(activeSection, d)}
                  onDelete={() => removeSection(activeSection)}
                />
              )}
            </div>

            {currentSection && (
              <FieldTable
                fields={currentSection.fields}
                fieldTypes={fieldTypes}
                parentsFor={(fid) => parentsBefore(activeSection, fid)}
                onChangeField={(fid, p) => updateField(activeSection, fid, p)}
                onMoveField={(fid, d) => moveField(activeSection, fid, d)}
                onDuplicateField={(fid) => duplicateField(activeSection, fid)}
                onRemoveField={(fid) => removeField(activeSection, fid)}
                onAddField={(at, t) => insertField(activeSection, at, t)}
                hiddenFieldIds={hiddenFieldIds}
                inlineTypePicker
              />
            )}
          </div>
        ) : (
          <FormPreview
            title={title}
            description={description}
            sections={sections}
            device={previewDevice}
          />
        )}
      </div>
    </PageContainer>
  );
}

const ModeTab = ({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'h-8 px-3 inline-flex items-center gap-1.5 text-xs rounded-md transition ' +
      (active ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700')
    }
  >
    <Icon className="h-3.5 w-3.5" /> {label}
  </button>
);
