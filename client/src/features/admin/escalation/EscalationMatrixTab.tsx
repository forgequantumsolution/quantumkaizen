import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowUpNarrowWide, Settings2 } from 'lucide-react';
import { Card, Button, Select, Modal } from '@/components/ui';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useDepartments } from '@/features/admin/departments/hooks';
import {
  useEscalationRules,
  useThresholdNames,
  useUpsertEscalationRule,
  useDeleteEscalationRule,
  ESCALATION_TARGET_LABEL,
  type EscalationRule,
  type EscalationTarget,
} from '@/lib/api/escalation';

// Sentinel for the "on breach" option in the trigger dropdown (maps to null).
const ON_BREACH = '__breach__';

const extractMsg = (err: unknown) =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Something went wrong';

interface DraftLevel {
  target: EscalationTarget;
  atThresholdName: string;
}

const toDraft = (rule?: EscalationRule | null): DraftLevel[] =>
  (rule?.levels ?? []).map((l) => ({ target: l.target, atThresholdName: l.atThresholdName ?? '' }));

// ─── Ladder editor (reused for the global default + each department) ──────────

function LadderEditor({
  departmentId,
  initial,
  onSaved,
}: {
  departmentId: string | null;
  initial?: EscalationRule | null;
  onSaved?: () => void;
}) {
  const [levels, setLevels] = useState<DraftLevel[]>(toDraft(initial));
  const upsert = useUpsertEscalationRule();
  const { data: thresholdNames = [] } = useThresholdNames();

  // Threshold options + any names already used by this rule that no longer
  // exist as live thresholds (so an existing level never silently loses its value).
  const thresholdOptions = useMemo(() => {
    const names = new Set(thresholdNames);
    for (const l of levels) if (l.atThresholdName) names.add(l.atThresholdName);
    return [
      { value: ON_BREACH, label: 'On SLA breach' },
      ...[...names].sort().map((n) => ({ value: n, label: `At “${n}”` })),
    ];
  }, [thresholdNames, levels]);

  const addLevel = () =>
    setLevels((ls) => [...ls, { target: 'MANAGER', atThresholdName: '' }]);
  const removeLevel = (i: number) => setLevels((ls) => ls.filter((_, idx) => idx !== i));
  const patchLevel = (i: number, patch: Partial<DraftLevel>) =>
    setLevels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    try {
      await upsert.mutateAsync({
        departmentId,
        isActive: true,
        levels: levels.map((l, idx) => ({
          order: idx + 1,
          target: l.target,
          atThresholdName: l.atThresholdName.trim() || null,
        })),
      });
      toast.success('Escalation ladder saved');
      onSaved?.();
    } catch (err) {
      toast.error(extractMsg(err));
    }
  };

  return (
    <div className="space-y-3">
      {levels.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
          No levels yet — add the first escalation step below.
        </p>
      ) : (
        <div className="space-y-2">
          {levels.map((lvl, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
                {i + 1}
              </span>
              <Select
                value={lvl.target}
                onChange={(e) => patchLevel(i, { target: e.target.value as EscalationTarget })}
                options={[
                  { value: 'MANAGER', label: ESCALATION_TARGET_LABEL.MANAGER },
                  { value: 'DEPARTMENT_HEAD', label: ESCALATION_TARGET_LABEL.DEPARTMENT_HEAD },
                ]}
                className="w-56"
              />
              <span className="shrink-0 text-xs text-gray-400">when</span>
              <Select
                value={lvl.atThresholdName || ON_BREACH}
                onChange={(e) =>
                  patchLevel(i, {
                    atThresholdName: e.target.value === ON_BREACH ? '' : e.target.value,
                  })
                }
                options={thresholdOptions}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeLevel(i)}
                className="shrink-0 rounded p-1 text-gray-400 hover:text-red-600"
                title="Remove level"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={addLevel}>
          <Plus size={14} />
          <span className="ml-1">Add level</span>
        </Button>
        <Button variant="primary" size="sm" onClick={save} disabled={upsert.isPending}>
          {upsert.isPending ? 'Saving…' : 'Save ladder'}
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400">
        Each level reassigns the ticket to the chosen person. The <em>when</em> menu lists the SLA
        threshold names configured on your policies; “On SLA breach” fires when the deadline passes.
      </p>
    </div>
  );
}

// ─── Ladder summary chips (department table) ──────────────────────────────────

function LadderSummary({ rule }: { rule?: EscalationRule | null }) {
  if (!rule || rule.levels.length === 0) {
    return <span className="text-xs italic text-gray-400">Uses global default</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {rule.levels.map((l, i) => (
        <span
          key={l.id}
          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
        >
          {i + 1}. {ESCALATION_TARGET_LABEL[l.target]}
          <span className="ml-1 text-gray-400">
            {l.atThresholdName ? `@ ${l.atThresholdName}` : '(breach)'}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export default function EscalationMatrixTab() {
  const { data: rules = [], isLoading } = useEscalationRules();
  const { data: deptResp } = useDepartments({ pageSize: 200 });
  const del = useDeleteEscalationRule();
  const confirmDelete = useConfirmDelete();
  const [editingDept, setEditingDept] = useState<{ id: string; name: string } | null>(null);

  const globalRule = rules.find((r) => r.departmentId === null) ?? null;
  const ruleByDept = useMemo(() => {
    const m = new Map<string, EscalationRule>();
    for (const r of rules) if (r.departmentId) m.set(r.departmentId, r);
    return m;
  }, [rules]);

  const depts = (deptResp?.items ?? []).filter((d) => d.isActive);
  const editingRule = editingDept ? ruleByDept.get(editingDept.id) ?? null : null;

  const handleRevert = () => {
    if (!editingDept) return;
    const rule = ruleByDept.get(editingDept.id);
    if (!rule) return;
    const name = editingDept.name;
    setEditingDept(null);
    confirmDelete({
      entityLabel: 'escalation ladder',
      name,
      extraWarning: 'This department will fall back to the global default ladder.',
      mutate: () => del.mutateAsync(rule.id),
      invalidateKey: ['escalation-rules'],
      successMessage: 'Reverted to global default',
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
        <h2 className="text-h3 text-gray-900">Escalation Matrix</h2>
        <p className="mt-1 text-sm text-gray-600">
          When a ticket crosses its SLA threshold or breaches, it is automatically reassigned up
          this ladder — skipping anyone who is out of office. Configure a global default and, where
          needed, a per-department override.
        </p>
      </div>

      {/* Global default */}
      <Card>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <ArrowUpNarrowWide size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Global default ladder</h3>
            <p className="text-xs text-gray-500">
              Applies to every department that doesn’t define its own ladder.
            </p>
          </div>
        </div>
        <LadderEditor key={`global-${globalRule?.id ?? 'new'}`} departmentId={null} initial={globalRule} />
      </Card>

      {/* Per-department overrides */}
      <Card noPadding className="overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Per-department overrides</h3>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
        ) : depts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-400">No active departments.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {depts.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{d.name}</span>
                    <span className="text-[11px] font-mono text-gray-400">{d.code}</span>
                    {!d.head && (
                      <span className="text-[11px] text-amber-600" title="No department head set">
                        · no head set
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <LadderSummary rule={ruleByDept.get(d.id)} />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingDept({ id: d.id, name: d.name })}
                >
                  <Settings2 size={14} />
                  <span className="ml-1">Configure</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editingDept && (
        <Modal
          isOpen
          onClose={() => setEditingDept(null)}
          title={`Escalation ladder · ${editingDept.name}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between">
              {ruleByDept.get(editingDept.id) ? (
                <Button variant="ghost" onClick={handleRevert}>
                  Revert to global default
                </Button>
              ) : (
                <span />
              )}
              <Button variant="ghost" onClick={() => setEditingDept(null)}>
                Close
              </Button>
            </div>
          }
        >
          <p className="mb-3 text-xs text-gray-500">
            Leave the ladder empty to keep using the global default. Saving any level makes this a
            department-specific override.
          </p>
          <LadderEditor
            key={editingDept.id}
            departmentId={editingDept.id}
            initial={editingRule}
            onSaved={() => setEditingDept(null)}
          />
        </Modal>
      )}
    </div>
  );
}
