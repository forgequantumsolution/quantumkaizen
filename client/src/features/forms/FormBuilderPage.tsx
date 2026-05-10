// Two-pane builder layout:
//   • Left rail – list of sections (click to switch)
//   • Main pane – form title/description, then a SectionPanel + FieldTable
//                 for the active section. Each field is one row of the table;
//                 click the gear to expand validation/options/logic inline.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, Pencil, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import {
  useFieldTypes, useFormDetail, useSaveDraft, useSaveFormFields,
} from './hooks';
import { fieldUsesOptions } from './fieldCatalog';
import SectionRail from './components/SectionRail';
import SectionPanel from './components/SectionPanel';
import FieldTable from './components/FieldTable';
import FormPreview from './components/FormPreview';
import { evaluateVisibility } from './lib/dependency';
import type { ParentField } from './components/DependencyEditor';
import type { FieldType, FormFieldDef, FormSectionDef } from './types';

type Mode = 'build' | 'preview';

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: detail, isLoading } = useFormDetail(id);
  const { data: fieldTypes = [] } = useFieldTypes();
  const saveFields = useSaveFormFields();
  const saveDraft = useSaveDraft();

  const [mode, setMode] = useState<Mode>('build');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<FormSectionDef[]>([]);
  const [activeSection, setActiveSection] = useState(0);

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

  const totalFields = useMemo(
    () => sections.reduce((n, s) => n + s.fields.length, 0),
    [sections]
  );

  // ── Section mutators ─────────────────────────────────────────
  const updateSection = (idx: number, patch: Partial<FormSectionDef>) =>
    setSections((s) => s.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)));

  const renameSection = (idx: number, name: string) =>
    updateSection(idx, { section_name: name });

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
    setSections((s) =>
      s.map((sec, i) =>
        i === sIdx
          ? {
              ...sec,
              fields: sec.fields.map((f) => (f.field_id === fieldId ? { ...f, ...patch } : f)),
            }
          : sec
      )
    );

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

  const previewLookup = (sectionName: string, fieldName: string): unknown => {
    const sec = sections.find((s) => s.section_name === sectionName);
    return sec?.fields.find((f) => f.name === fieldName)?.value;
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
      await saveFields.mutateAsync({ id, sections, title, description });
      toast.success('Form published');
      nav('/forms');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const currentSection = sections[activeSection];
  const sectionVisible = currentSection
    ? evaluateVisibility(currentSection.dependency, previewLookup)
    : true;
  const hiddenFieldIds = new Set<string>(
    (currentSection?.fields ?? [])
      .filter((f) => !evaluateVisibility(f.dependency, previewLookup))
      .map((f) => f.field_id ?? '')
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* TOP BAR ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="w-full h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/forms')}>
            <ArrowLeft className="h-4 w-4" /> Forms
          </Button>
          <p className="hidden md:block text-xs text-slate-500 truncate flex-1">
            {sections.length} section{sections.length === 1 ? '' : 's'} · {totalFields} field
            {totalFields === 1 ? '' : 's'}
          </p>
          <div className="flex-1 md:hidden" />

          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            <ModeTab active={mode === 'build'}   onClick={() => setMode('build')}   icon={Pencil} label="Build"   />
            <ModeTab active={mode === 'preview'} onClick={() => setMode('preview')} icon={Eye}    label="Preview" />
          </div>

          <Button variant="secondary" size="sm" onClick={onSaveDraft} disabled={saveDraft.isPending}>
            <Save className="h-4 w-4" /> Save draft
          </Button>
          <Button size="sm" onClick={onPublish} disabled={saveFields.isPending}>
            <Check className="h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      {/* CANVAS ─────────────────────────────────────────────── */}
      <div className="w-full py-6">
        {/* Form heading */}
        <div className="mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled form"
            className="w-full text-2xl sm:text-3xl font-bold text-slate-900 bg-transparent border-0 outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1 placeholder-slate-300"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description"
            className="block w-full mt-1 text-sm text-slate-500 bg-transparent border-0 outline-none focus:ring-2 focus:ring-indigo-200 rounded px-1 -mx-1 placeholder-slate-300"
          />
        </div>

        {mode === 'build' ? (
          <div className="grid grid-cols-12 gap-4">
            {/* LEFT RAIL */}
            <div className="col-span-12 md:col-span-3 lg:col-span-3 xl:col-span-2">
              <SectionRail
                sections={sections}
                activeIndex={activeSection}
                onSelect={setActiveSection}
                onAdd={addSection}
                onMove={moveSection}
                onRename={renameSection}
                onDelete={removeSection}
              />
            </div>

            {/* MAIN PANE */}
            <div className="col-span-12 md:col-span-9 lg:col-span-9 xl:col-span-10 space-y-4">
              {currentSection && (
                <>
                  <SectionPanel
                    section={currentSection}
                    index={activeSection}
                    parents={parentsBefore(activeSection - 1)}
                    onChange={(p) => updateSection(activeSection, p)}
                    hidden={!sectionVisible}
                  />
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
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <FormPreview title={title} description={description} sections={sections} />
        )}
      </div>
    </div>
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
