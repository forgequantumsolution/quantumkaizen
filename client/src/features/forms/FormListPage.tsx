import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, FileText, Eye, Pencil, Trash2,
  ListChecks, Layers, ClipboardList, LayoutGrid, List, GitBranch, Check,
  CheckSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { KpiCard } from '@/components/ui/KpiCard';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import { useDeleteForm, useForms } from './hooks';
import type { FormKind, FormListItem } from './types';

type ViewMode = 'card' | 'table';

const COPY: Record<FormKind, {
  pageTitle: string;
  pageDescription: string;
  newButton: string;
  newRoute: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  totalLabel: string;
  deleteConfirm: (title: string) => string;
  deleteToast: string;
}> = {
  FORM: {
    pageTitle: 'Form Builder',
    pageDescription: 'Build and version dynamic forms for any process',
    newButton: 'New form',
    newRoute: '/forms/new',
    searchPlaceholder: 'Search forms by title…',
    emptyTitle: 'No forms yet',
    emptyDescription: 'Create your first dynamic form to get started.',
    totalLabel: 'Total forms',
    deleteConfirm: (t) => `Delete form "${t}"?`,
    deleteToast: 'Form deleted',
  },
  CHECKLIST: {
    pageTitle: 'Checklist Builder',
    pageDescription: 'Build and version reusable checklists for any process',
    newButton: 'New checklist',
    newRoute: '/forms/new?kind=CHECKLIST',
    searchPlaceholder: 'Search checklists by title…',
    emptyTitle: 'No checklists yet',
    emptyDescription: 'Create your first checklist to get started.',
    totalLabel: 'Total checklists',
    deleteConfirm: (t) => `Delete checklist "${t}"?`,
    deleteToast: 'Checklist deleted',
  },
};

export default function FormListPage() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeKind: FormKind = tabParam === 'checklists' ? 'CHECKLIST' : 'FORM';

  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('card');

  const { data, isLoading } = useForms({
    search: search || undefined,
    page_size: 50,
    kind: activeKind,
  });
  const deleteForm = useDeleteForm();
  const forms = data?.forms ?? [];
  const copy = COPY[activeKind];

  const draftCount = forms.filter((f) => f.status === 'DRAFT').length;
  const publishedCount = forms.filter((f) => f.status === 'PUBLISHED').length;

  const handleTabChange = (kind: FormKind) => {
    const next = new URLSearchParams(searchParams);
    if (kind === 'CHECKLIST') next.set('tab', 'checklists');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
    setSearch('');
  };

  const handleDelete = (f: FormListItem) => {
    if (!confirm(copy.deleteConfirm(f.title))) return;
    deleteForm.mutate(f.id, { onSuccess: () => toast.success(copy.deleteToast) });
  };

  return (
    <PageContainer>
      <PageHeader
        title={copy.pageTitle}
        description={copy.pageDescription}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => nav('/forms/field-types')}>
              <Layers className="h-4 w-4" />
              Field types
            </Button>
            <Button onClick={() => nav(copy.newRoute)}>
              <Plus className="h-4 w-4" />
              {copy.newButton}
            </Button>
          </div>
        }
      />

      <KindTabs active={activeKind} onChange={handleTabChange} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label={copy.totalLabel} value={forms.length} icon={FileText} accent="slate" selected />
        <KpiCard label="Drafts"      value={draftCount}   icon={Pencil}   accent="amber" />
        <KpiCard label="Published"   value={publishedCount} icon={ListChecks} accent="emerald" />
      </div>

      {/* Toolbar: search + view toggle */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="pl-9"
          />
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : forms.length === 0 ? (
        <EmptyState
          icon={activeKind === 'CHECKLIST' ? CheckSquare : ClipboardList}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actionLabel={copy.newButton}
          onAction={() => nav(copy.newRoute)}
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {forms.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              onPreview={() => nav(`/forms/${f.id}/fill`)}
              onEdit={() => nav(`/forms/${f.id}/builder`)}
              onSwitchVersion={(versionId) => nav(`/forms/${versionId}/builder`)}
              onDelete={() => handleDelete(f)}
            />
          ))}
        </div>
      ) : (
        <FormTable
          forms={forms}
          onPreview={(f) => nav(`/forms/${f.id}/fill`)}
          onEdit={(f) => nav(`/forms/${f.id}/builder`)}
          onSwitchVersion={(versionId) => nav(`/forms/${versionId}/builder`)}
          onDelete={handleDelete}
        />
      )}

    </PageContainer>
  );
}

// ─── Kind tabs (Forms / Checklists) ────────────────────────────
function KindTabs({
  active, onChange,
}: { active: FormKind; onChange: (k: FormKind) => void }) {
  const tabs: Array<{ kind: FormKind; label: string; icon: React.ElementType }> = [
    { kind: 'FORM',      label: 'Forms',      icon: FileText },
    { kind: 'CHECKLIST', label: 'Checklists', icon: CheckSquare },
  ];
  return (
    <div className="mb-5 border-b border-slate-200">
      <nav className="-mb-px flex gap-1">
        {tabs.map(({ kind, label, icon: Icon }) => {
          const selected = active === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onChange(kind)}
              className={
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ' +
                (selected
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── View toggle ───────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
      <button
        onClick={() => onChange('card')}
        className={
          'h-8 px-2.5 inline-flex items-center gap-1.5 text-xs rounded-md transition ' +
          (view === 'card' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700')
        }
        title="Card view"
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Cards
      </button>
      <button
        onClick={() => onChange('table')}
        className={
          'h-8 px-2.5 inline-flex items-center gap-1.5 text-xs rounded-md transition ' +
          (view === 'table' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700')
        }
        title="Table view"
      >
        <List className="h-3.5 w-3.5" /> Table
      </button>
    </div>
  );
}

// ─── Compact form card ─────────────────────────────────────────
function FormCard({
  form: f, onPreview, onEdit, onSwitchVersion, onDelete,
}: {
  form: FormListItem;
  onPreview: () => void;
  onEdit: () => void;
  onSwitchVersion: (versionId: string) => void;
  onDelete: () => void;
}) {
  const tone =
    f.status === 'PUBLISHED' ? 'border-l-emerald-500'
    : f.status === 'DRAFT'   ? 'border-l-amber-500'
    : 'border-l-slate-300';

  return (
    <div
      className={
        'group/card relative rounded-xl bg-white border border-slate-200 border-l-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all ' + tone
      }
    >
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <StatusBadge status={f.status} />
            <h3
              onClick={onEdit}
              className="mt-1.5 text-sm font-semibold text-slate-800 line-clamp-2 cursor-pointer hover:text-indigo-600 transition leading-snug"
            >
              {f.title}
            </h3>
          </div>
          <VersionMenu form={f} onSwitch={onSwitchVersion} />
        </div>

        {f.description && (
          <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">{f.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate">{f.created_by?.name ?? '—'}</span>
          <span>{new Date(f.created_on).toLocaleDateString()}</span>
        </div>

        <div className="mt-2.5 -mx-1 flex items-center gap-0.5">
          <ActionBtn icon={Eye}    label="Preview" onClick={onPreview} />
          <ActionBtn icon={Pencil} label="Edit"    onClick={onEdit}    />
          <span className="flex-1" />
          <ActionBtn icon={Trash2} label="Delete"  onClick={onDelete}  danger />
        </div>
      </div>
    </div>
  );
}

const ActionBtn = ({
  icon: Icon, label, onClick, danger,
}: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean;
}) => (
  <button
    onClick={onClick}
    title={label}
    className={
      'h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] transition ' +
      (danger
        ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700')
    }
  >
    <Icon className="h-3.5 w-3.5" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const StatusBadge = ({ status }: { status: FormListItem['status'] }) => {
  const tone =
    status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : status === 'DRAFT'   ? 'bg-amber-50 text-amber-700 ring-amber-200'
    : 'bg-slate-100 text-slate-500 ring-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}>
      {status.toLowerCase()}
    </span>
  );
};

// ─── Version dropdown ──────────────────────────────────────────
function VersionMenu({
  form, onSwitch,
}: {
  form: FormListItem;
  onSwitch: (versionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const versions = form.all_versions ?? [];
  const hasMultiple = versions.length > 1;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => hasMultiple && setOpen((v) => !v)}
        disabled={!hasMultiple}
        title={hasMultiple ? 'Switch version' : 'Only one version'}
        className={
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono transition ' +
          (hasMultiple
            ? 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer'
            : 'bg-slate-100 text-slate-600')
        }
      >
        <GitBranch className="h-3 w-3" />v{form.version}
      </button>
      {open && hasMultiple && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          <p className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-400 font-medium">
            Versions
          </p>
          {versions
            .slice()
            .sort((a, b) => b.version - a.version)
            .map((v) => {
              const current = v.id === form.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setOpen(false);
                    if (!current) onSwitch(v.id);
                  }}
                  className={
                    'w-full flex items-center justify-between px-2.5 py-1.5 text-xs transition ' +
                    (current
                      ? 'bg-indigo-50 text-indigo-700 font-medium cursor-default'
                      : 'text-slate-700 hover:bg-slate-50')
                  }
                >
                  <span className="font-mono">v{v.version}</span>
                  {current && <Check className="h-3 w-3" />}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ─── Table view ────────────────────────────────────────────────
function FormTable({
  forms, onPreview, onEdit, onSwitchVersion, onDelete,
}: {
  forms: FormListItem[];
  onPreview: (f: FormListItem) => void;
  onEdit: (f: FormListItem) => void;
  onSwitchVersion: (versionId: string) => void;
  onDelete: (f: FormListItem) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-semibold w-28">Status</th>
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Created by</th>
              <th className="px-4 py-2.5 font-semibold hidden md:table-cell w-28">Created</th>
              <th className="px-4 py-2.5 font-semibold hidden lg:table-cell w-16">Version</th>
              <th className="px-4 py-2.5 font-semibold w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr
                key={f.id}
                className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition"
              >
                <td className="px-4 py-2.5">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-2.5 min-w-0">
                  <button
                    onClick={() => onEdit(f)}
                    className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition text-left line-clamp-1"
                  >
                    {f.title}
                  </button>
                  {f.description && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{f.description}</p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-600 hidden md:table-cell">
                  {f.created_by?.name ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">
                  {new Date(f.created_on).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 hidden lg:table-cell">
                  <VersionMenu form={f} onSwitch={onSwitchVersion} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-0.5">
                    <RowBtn icon={Eye}    title="Preview" onClick={() => onPreview(f)} />
                    <RowBtn icon={Pencil} title="Edit"    onClick={() => onEdit(f)}    />
                    <RowBtn icon={Trash2} title="Delete"  onClick={() => onDelete(f)}  danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const RowBtn = ({
  icon: Icon, title, onClick, danger,
}: {
  icon: React.ElementType; title: string; onClick: () => void; danger?: boolean;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={
      'h-7 w-7 inline-flex items-center justify-center rounded-md transition ' +
      (danger
        ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700')
    }
  >
    <Icon className="h-3.5 w-3.5" />
  </button>
);

