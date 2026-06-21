import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Input,
  Modal,
  Space,
  Spin,
  Switch,
  Table,
  Tooltip,
  message,
} from 'antd';
import { Plus, Edit3, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';
import {
  useCreateIsoStandard,
  useDeleteIsoStandard,
  useIsoStandards,
  useUpdateIsoStandard,
  type IsoClauseDto,
  type IsoStandardSummary,
  type IsoStandardUpsert,
  type IsoSubClauseDto,
} from '@/lib/api/audit';
import { useHasPermission } from '@/stores/authStore';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';

export default function IsoStandardsPage() {
  const canCreate = useHasPermission('iso_standard.create');
  const canUpdate = useHasPermission('iso_standard.update');
  const canDelete = useHasPermission('iso_standard.delete');

  const { data, isLoading } = useIsoStandards();
  const rows: IsoStandardSummary[] = data?.data ?? [];
  const deleteMut = useDeleteIsoStandard();
  const confirmDelete = useConfirmDelete();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<IsoStandardSummary | null>(null);

  const handleDelete = (s: IsoStandardSummary) =>
    confirmDelete({
      entityLabel: 'ISO standard',
      name: s.name,
      extraWarning: 'This will also delete its clauses. This action cannot be undone.',
      mutate: () => deleteMut.mutateAsync(s.id),
      invalidateKey: ['iso-standards'],
      successMessage: 'ISO standard deleted',
    });

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">ISO Standards</h2>
          <p className="text-xs text-gray-500">
            Reference standards (ISO 9001, 14001, 45001 …) cited by audit findings.
          </p>
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            New ISO Standard
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-24 text-center text-sm text-gray-400">
          No ISO standards yet. Click "New ISO Standard" to add one.
        </div>
      ) : (
        <Table<IsoStandardSummary>
          size="small"
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 30, showSizeChanger: false }}
          expandable={{
            expandedRowRender: (record) => <ClausePreview clauses={record.clauses} />,
            rowExpandable: (record) => record.clauses.length > 0,
            expandIcon: ({ expanded, onExpand, record }) =>
              record.clauses.length === 0 ? (
                <span className="inline-block w-4" />
              ) : (
                <span
                  className="cursor-pointer text-gray-500 inline-flex"
                  onClick={(e) => onExpand(record, e)}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              ),
          }}
          columns={[
            {
              title: 'Name',
              dataIndex: 'name',
              render: (v: string) => <span className="font-medium text-gray-900">{v}</span>,
            },
            {
              title: 'Clauses',
              dataIndex: 'clauses_count',
              width: 100,
              render: (v: number) => (
                <span className="text-sm font-semibold text-gray-700">{v}</span>
              ),
            },
            {
              title: 'Remarks',
              dataIndex: 'remarks',
              ellipsis: true,
              render: (v: string | null) =>
                v ? (
                  <Tooltip title={v}>
                    <span className="text-xs text-gray-600">{v}</span>
                  </Tooltip>
                ) : (
                  '—'
                ),
            },
            {
              title: 'Active',
              dataIndex: 'is_active',
              width: 80,
              render: (v: boolean) => (
                <span
                  className={`text-xs ${v ? 'text-emerald-700' : 'text-gray-400'}`}
                >
                  {v ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              title: 'Actions',
              width: 100,
              render: (_: unknown, r) => (
                <Space size={4}>
                  {canUpdate && (
                    <Button
                      size="small"
                      icon={<Edit3 size={12} />}
                      onClick={() => {
                        setEditing(r);
                        setDrawerOpen(true);
                      }}
                    />
                  )}
                  {canDelete && (
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={12} />}
                      onClick={() => handleDelete(r)}
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      <IsoStandardDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        standard={editing}
      />
    </>
  );
}

/* ─── Inline clauses preview ─── */

function ClausePreview({ clauses }: { clauses: IsoClauseDto[] }) {
  return (
    <div className="pl-8 pr-3 py-2 bg-gray-50">
      <ul className="space-y-2">
        {clauses.map((c) => (
          <li key={c.id ?? c.clause_number}>
            <div className="text-[13px]">
              <span className="font-mono text-blue-700">{c.clause_number}</span>{' '}
              <span className="text-gray-900">{c.clause_title}</span>
            </div>
            {c.sub_clauses.length > 0 && (
              <ul className="ml-5 mt-1 space-y-0.5">
                {c.sub_clauses.map((s) => (
                  <li
                    key={s.id ?? `${c.clause_number}-${s.sub_clause_number}`}
                    className="text-[12px] text-gray-700"
                  >
                    <span className="font-mono text-gray-500">{s.sub_clause_number}</span>{' '}
                    {s.sub_clause_title}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Drawer (with nested clauses editor) ─── */

interface DraftClause {
  id?: string;
  clause_number: string;
  clause_title: string;
  sub_clauses: DraftSubClause[];
}
interface DraftSubClause {
  id?: string;
  sub_clause_number: string;
  sub_clause_title: string;
  requirement_text?: string | null;
}

interface DraftIso {
  name: string;
  remarks: string;
  is_active: boolean;
  clauses: DraftClause[];
}

const initialDraft = (s: IsoStandardSummary | null): DraftIso => ({
  name: s?.name ?? '',
  remarks: s?.remarks ?? '',
  is_active: s?.is_active ?? true,
  clauses:
    s?.clauses.map((c) => ({
      id: c.id,
      clause_number: c.clause_number,
      clause_title: c.clause_title,
      sub_clauses: c.sub_clauses.map((sc) => ({
        id: sc.id,
        sub_clause_number: sc.sub_clause_number,
        sub_clause_title: sc.sub_clause_title,
        requirement_text: sc.requirement_text ?? '',
      })),
    })) ?? [],
});

function IsoStandardDrawer({
  open,
  onClose,
  standard,
}: {
  open: boolean;
  onClose: () => void;
  standard: IsoStandardSummary | null;
}) {
  const [draft, setDraft] = useState<DraftIso>(() => initialDraft(standard));
  useEffect(() => {
    if (open) setDraft(initialDraft(standard));
  }, [open, standard]);

  const createMut = useCreateIsoStandard();
  const updateMut = useUpdateIsoStandard(standard?.id ?? '');

  const submit = async () => {
    if (!draft.name.trim()) {
      message.error('Name is required');
      return;
    }
    const body: IsoStandardUpsert = {
      name: draft.name.trim(),
      remarks: draft.remarks || null,
      is_active: draft.is_active,
      clauses: draft.clauses
        .filter((c) => c.clause_number.trim() && c.clause_title.trim())
        .map((c, idx) => ({
          id: c.id,
          clause_number: c.clause_number.trim(),
          clause_title: c.clause_title.trim(),
          position: idx,
          sub_clauses: c.sub_clauses
            .filter((sc) => sc.sub_clause_number.trim() && sc.sub_clause_title.trim())
            .map((sc, sIdx) => ({
              id: sc.id,
              sub_clause_number: sc.sub_clause_number.trim(),
              sub_clause_title: sc.sub_clause_title.trim(),
              requirement_text: sc.requirement_text || null,
              position: sIdx,
            })),
        })),
    };
    try {
      if (standard) {
        await updateMut.mutateAsync(body);
        message.success('ISO standard updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('ISO standard created');
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const addClause = () =>
    setDraft((d) => ({
      ...d,
      clauses: [
        ...d.clauses,
        { clause_number: '', clause_title: '', sub_clauses: [] },
      ],
    }));

  const removeClause = (idx: number) =>
    setDraft((d) => ({ ...d, clauses: d.clauses.filter((_, i) => i !== idx) }));

  const updateClause = (idx: number, patch: Partial<DraftClause>) =>
    setDraft((d) => ({
      ...d,
      clauses: d.clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));

  const addSubClause = (cIdx: number) =>
    updateClause(cIdx, {
      sub_clauses: [
        ...draft.clauses[cIdx]!.sub_clauses,
        { sub_clause_number: '', sub_clause_title: '', requirement_text: '' },
      ],
    });

  const removeSubClause = (cIdx: number, sIdx: number) =>
    updateClause(cIdx, {
      sub_clauses: draft.clauses[cIdx]!.sub_clauses.filter((_, i) => i !== sIdx),
    });

  const updateSubClause = (cIdx: number, sIdx: number, patch: Partial<DraftSubClause>) =>
    updateClause(cIdx, {
      sub_clauses: draft.clauses[cIdx]!.sub_clauses.map((sc, i) =>
        i === sIdx ? { ...sc, ...patch } : sc,
      ),
    });

  return (
    <Drawer
      title={standard ? `Edit ${standard.name}` : 'New ISO Standard'}
      open={open}
      onClose={onClose}
      width={680}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={submit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {standard ? 'Save' : 'Create'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="ISO 9001:2015"
            />
          </Field>
          <Field label="Active">
            <Switch
              checked={draft.is_active}
              onChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
            />
          </Field>
        </div>
        <Field label="Remarks">
          <Input.TextArea
            value={draft.remarks}
            onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
            rows={2}
            placeholder="Optional notes"
          />
        </Field>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Clauses</h3>
              <p className="text-[11px] text-gray-500">
                Optional — used so findings can reference a specific clause/sub-clause.
              </p>
            </div>
            <Button size="small" icon={<Plus size={12} />} onClick={addClause}>
              Add Clause
            </Button>
          </div>

          {draft.clauses.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400 border border-dashed rounded">
              No clauses added. You can add them later too.
            </div>
          ) : (
            <div className="space-y-3">
              {draft.clauses.map((c, cIdx) => (
                <div
                  key={cIdx}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50/30"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      size="small"
                      placeholder="No."
                      value={c.clause_number}
                      onChange={(e) =>
                        updateClause(cIdx, { clause_number: e.target.value })
                      }
                      style={{ width: 80 }}
                    />
                    <Input
                      size="small"
                      placeholder="Clause title"
                      value={c.clause_title}
                      onChange={(e) =>
                        updateClause(cIdx, { clause_title: e.target.value })
                      }
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<X size={12} />}
                      onClick={() => removeClause(cIdx)}
                    />
                  </div>

                  <div className="mt-2 pl-3 space-y-1.5 border-l-2 border-gray-200">
                    {c.sub_clauses.map((sc, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2">
                        <Input
                          size="small"
                          placeholder="No."
                          value={sc.sub_clause_number}
                          onChange={(e) =>
                            updateSubClause(cIdx, sIdx, {
                              sub_clause_number: e.target.value,
                            })
                          }
                          style={{ width: 80 }}
                        />
                        <Input
                          size="small"
                          placeholder="Sub-clause title"
                          value={sc.sub_clause_title}
                          onChange={(e) =>
                            updateSubClause(cIdx, sIdx, {
                              sub_clause_title: e.target.value,
                            })
                          }
                        />
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<X size={12} />}
                          onClick={() => removeSubClause(cIdx, sIdx)}
                        />
                      </div>
                    ))}
                    <Button
                      size="small"
                      type="link"
                      icon={<Plus size={11} />}
                      onClick={() => addSubClause(cIdx)}
                    >
                      Add sub-clause
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
