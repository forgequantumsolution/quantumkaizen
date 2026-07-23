/**
 * Risk frameworks — the scoring rules every risk in the system is measured
 * against: the factor scales (severity, occurrence, …), the level bands those
 * scores fall into, and the governance each band demands (CAPA, approval,
 * control, review cadence).
 *
 * A framework already used by risks or registers is frozen by the backend: the
 * PUT returns 409 rather than silently rewriting history. That error is surfaced
 * verbatim in the editor — cloning is the supported way forward, which is why
 * Clone sits next to Edit rather than behind a menu.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Drawer,
  Form,
  Input as AntInput,
  InputNumber,
  Select as AntSelect,
  Switch,
  Tooltip,
  message,
} from 'antd';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Grid3x3,
  Layers,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { DataTable, type Column, Badge, Card, CardHeader, CardTitle, Spinner } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import {
  riskKeys,
  useCloneFramework,
  useCreateFramework,
  useDeleteFramework,
  useRiskFramework,
  useRiskFrameworks,
  useUpdateFramework,
  ACCEPTANCE_BADGE,
  ACCEPTANCE_LABELS,
  FORMULA_LABELS,
  METHODOLOGY_LABELS,
  type FactorUpsert,
  type LevelDefUpsert,
  type MatrixCellUpsert,
  type RiskAcceptance,
  type RiskFactorKind,
  type RiskFormula,
  type RiskFramework,
  type RiskFrameworkUpsert,
  type RiskLevelDef,
  type RiskMethodology,
} from '@/lib/api/risk';

const METHODOLOGIES = Object.keys(METHODOLOGY_LABELS) as RiskMethodology[];
const FORMULAS = Object.keys(FORMULA_LABELS) as RiskFormula[];
const ACCEPTANCES = Object.keys(ACCEPTANCE_LABELS) as RiskAcceptance[];
const FACTOR_KINDS: RiskFactorKind[] = [
  'SEVERITY',
  'OCCURRENCE',
  'PROBABILITY',
  'DETECTABILITY',
  'EXPOSURE',
  'CUSTOM',
];

const DEFAULT_BAND_COLOR = '#64748B';

interface FrameworkFormValues {
  code?: string | null;
  name: string;
  description?: string | null;
  standard?: string | null;
  methodology: RiskMethodology;
  formula: RiskFormula;
  isActive: boolean;
  isDefault: boolean;
}

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

const errStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

/** Which level band a raw score falls into, by min/max bounds (either may be open). */
function bandForScore(levels: RiskLevelDef[], score: number | null): RiskLevelDef | null {
  if (score == null) return null;
  return (
    levels.find(
      (l) =>
        (l.min_score == null || score >= l.min_score) && (l.max_score == null || score <= l.max_score),
    ) ?? null
  );
}

export default function RiskFrameworkPage() {
  const canCreate = useHasPermission('risk_framework.create');
  const canUpdate = useHasPermission('risk_framework.update');
  const canDelete = useHasPermission('risk_framework.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [methodology, setMethodology] = useState<RiskMethodology | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RiskFramework | null>(null);

  const debouncedSearch = useDebouncedValue(search, 400);

  const { data: frameworks = [], isLoading } = useRiskFrameworks({
    search: debouncedSearch || undefined,
    methodology,
  });

  const cloneMut = useCloneFramework();
  const deleteMut = useDeleteFramework();

  // Keep a framework selected so the detail pane is never an empty void.
  useEffect(() => {
    if (!frameworks.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !frameworks.some((f) => f.id === selectedId)) {
      setSelectedId(frameworks.find((f) => f.is_default)?.id ?? frameworks[0]!.id);
    }
  }, [frameworks, selectedId]);

  const { data: selected, isLoading: detailLoading } = useRiskFramework(selectedId ?? undefined);

  const onClone = async (f: RiskFramework) => {
    try {
      const clone = await cloneMut.mutateAsync(f.id);
      setSelectedId(clone.id);
      message.success(`Cloned as “${clone.name}”`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (f: RiskFramework) => {
    setEditing(f);
    setDrawerOpen(true);
  };

  const columns = useMemo<Column<RiskFramework>[]>(
    () => [
      {
        key: 'name',
        header: 'Framework',
        render: (f) => (
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight
              size={14}
              className={f.id === selectedId ? 'text-blue-600' : 'text-transparent'}
            />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate max-w-[260px]">{f.name}</p>
              <p className="text-xs text-gray-500 truncate max-w-[260px]">
                {f.code ? `${f.code} · ` : ''}v{f.version}
                {f.description ? ` · ${f.description}` : ''}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'standard',
        header: 'Standard',
        render: (f) =>
          f.standard ? (
            <span className="text-xs text-gray-700">{f.standard}</span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'methodology',
        header: 'Methodology',
        render: (f) => <Badge variant="info">{METHODOLOGY_LABELS[f.methodology]}</Badge>,
      },
      {
        key: 'formula',
        header: 'Formula',
        render: (f) => <span className="text-xs text-gray-700">{FORMULA_LABELS[f.formula]}</span>,
      },
      {
        key: 'factors',
        header: 'Scales / bands',
        sortable: false,
        render: (f) => (
          <span className="text-xs text-gray-700 tabular-nums">
            {f.factors.length} factor{f.factors.length === 1 ? '' : 's'} · {f.levels.length} band
            {f.levels.length === 1 ? '' : 's'}
          </span>
        ),
      },
      {
        key: 'usage',
        header: 'In use',
        render: (f) => (
          <span className="text-xs text-gray-700 tabular-nums">
            {f.risk_count} risks · {f.register_count} registers
          </span>
        ),
      },
      {
        key: 'flags',
        header: 'Status',
        sortable: false,
        render: (f) => (
          <div className="flex items-center gap-1 flex-wrap">
            {f.is_default && <Badge variant="purple">Default</Badge>}
            <Badge variant={f.is_active ? 'success' : 'default'} dot>
              {f.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (f) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canUpdate && (
              <Tooltip title="Edit">
                <AntButton
                  type="text"
                  size="small"
                  icon={<Pencil size={15} />}
                  onClick={() => openEdit(f)}
                />
              </Tooltip>
            )}
            {canCreate && (
              <Tooltip title="Clone">
                <AntButton
                  type="text"
                  size="small"
                  icon={<Copy size={15} />}
                  loading={cloneMut.isPending}
                  onClick={() => onClone(f)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete">
                <AntButton
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={15} />}
                  onClick={() =>
                    confirmDelete({
                      entityLabel: 'risk framework',
                      name: f.name,
                      extraWarning:
                        'A framework used by any register or risk cannot be deleted; deactivate it instead.',
                      mutate: () => deleteMut.mutateAsync(f.id),
                      invalidateKey: riskKeys.all,
                    })
                  }
                />
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canCreate, canUpdate, canDelete, selectedId, cloneMut.isPending],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Risk frameworks</h2>
          <p className="text-xs text-gray-500">
            Scoring scales, level bands and the governance each band triggers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AntInput
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search name, code or standard"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <AntSelect
            allowClear
            placeholder="All methodologies"
            style={{ width: 190 }}
            value={methodology}
            onChange={(v) => setMethodology(v ?? undefined)}
            options={METHODOLOGIES.map((m) => ({ value: m, label: METHODOLOGY_LABELS[m] }))}
          />
          {canCreate && (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New framework
            </AntButton>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={frameworks}
          isLoading={isLoading}
          pageSize={10}
          emptyMessage="No risk frameworks configured yet"
          onRowClick={(f) => setSelectedId(f.id)}
          rowClassName={(f) => (f.id === selectedId ? 'bg-blue-50/60' : '')}
        />
      </div>

      {selectedId && (
        <div className="mt-5">
          {detailLoading && !selected ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : selected ? (
            <FrameworkDetail
              framework={selected}
              canUpdate={canUpdate}
              canCreate={canCreate}
              cloning={cloneMut.isPending}
              onEdit={() => openEdit(selected)}
              onClone={() => onClone(selected)}
            />
          ) : null}
        </div>
      )}

      <FrameworkDrawer
        open={drawerOpen}
        framework={editing}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSaved={(id) => setSelectedId(id)}
      />
    </>
  );
}

// ── Detail viewer ───────────────────────────────────────────────────────────

function FrameworkDetail({
  framework,
  canUpdate,
  canCreate,
  cloning,
  onEdit,
  onClone,
}: {
  framework: RiskFramework;
  canUpdate: boolean;
  canCreate: boolean;
  cloning: boolean;
  onEdit: () => void;
  onClone: () => void;
}) {
  const factors = [...framework.factors].sort((a, b) => a.order - b.order);
  const levels = [...framework.levels].sort((a, b) => a.order - b.order);
  const inUse = framework.risk_count > 0 || framework.register_count > 0;

  return (
    <div className="space-y-4">
      <Card noPadding className="p-5">
        <CardHeader className="mb-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{framework.name}</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {framework.code ? `${framework.code} · ` : ''}version {framework.version}
              {framework.standard ? ` · ${framework.standard}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canUpdate && (
              <AntButton size="small" icon={<Pencil size={14} />} onClick={onEdit}>
                Edit
              </AntButton>
            )}
            {canCreate && (
              <AntButton size="small" icon={<Copy size={14} />} loading={cloning} onClick={onClone}>
                Clone
              </AntButton>
            )}
          </div>
        </CardHeader>

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <Badge variant="info">{METHODOLOGY_LABELS[framework.methodology]}</Badge>
          <Badge variant="outline">{FORMULA_LABELS[framework.formula]}</Badge>
          {framework.is_default && <Badge variant="purple">Organisation default</Badge>}
          <Badge variant={framework.is_active ? 'success' : 'default'} dot>
            {framework.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant={inUse ? 'warning' : 'outline'}>
            {framework.risk_count} risks · {framework.register_count} registers
          </Badge>
        </div>

        {framework.description && (
          <p className="text-sm text-gray-700">{framework.description}</p>
        )}

        {inUse && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              This framework is in use. The server rejects structural edits with a 409 so scored
              risks keep their meaning — clone it and edit the copy instead.
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card noPadding className="p-5">
          <CardHeader className="mb-3">
            <CardTitle className="inline-flex items-center gap-1.5">
              <Layers size={14} className="text-gray-400" /> Scales
            </CardTitle>
            <span className="text-xs text-gray-500">{factors.length} factors</span>
          </CardHeader>

          {factors.length === 0 ? (
            <p className="text-sm text-gray-500">No factors configured.</p>
          ) : (
            <div className="space-y-4">
              {factors.map((f) => (
                <div key={f.id}>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-medium text-gray-900">{f.label}</span>
                    <span className="font-mono text-[11px] text-blue-700">{f.key}</span>
                    <Badge variant="outline">{f.kind}</Badge>
                    <span className="text-[11px] text-gray-500 tabular-nums">weight {f.weight}</span>
                  </div>
                  {f.description && (
                    <p className="text-xs text-gray-500 mb-1.5">{f.description}</p>
                  )}
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left font-medium px-2 py-1 w-10">#</th>
                          <th className="text-left font-medium px-2 py-1 w-36">Level</th>
                          <th className="text-left font-medium px-2 py-1">Definition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...f.levels]
                          .sort((a, b) => a.rank - b.rank)
                          .map((l) => (
                            <tr key={l.id} className="border-t border-gray-100 align-top">
                              <td className="px-2 py-1.5 tabular-nums text-gray-700">{l.rank}</td>
                              <td className="px-2 py-1.5">
                                <span className="inline-flex items-center gap-1.5 text-gray-900">
                                  {l.color && (
                                    <span
                                      className="w-2 h-2 rounded-full border border-black/10 shrink-0"
                                      style={{ backgroundColor: l.color }}
                                    />
                                  )}
                                  {l.label}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-gray-600">
                                {l.definition ?? l.guidance ?? '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card noPadding className="p-5">
          <CardHeader className="mb-3">
            <CardTitle className="inline-flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-gray-400" /> Level bands
            </CardTitle>
            <span className="text-xs text-gray-500">{levels.length} bands</span>
          </CardHeader>

          {levels.length === 0 ? (
            <p className="text-sm text-gray-500">No level bands configured.</p>
          ) : (
            <div className="border border-gray-200 rounded-md overflow-x-auto">
              <table className="w-full text-xs min-w-[520px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-2 py-1">Band</th>
                    <th className="text-left font-medium px-2 py-1 w-24">Score</th>
                    <th className="text-left font-medium px-2 py-1 w-28">Acceptance</th>
                    <th className="text-left font-medium px-2 py-1">Policy</th>
                    <th className="text-left font-medium px-2 py-1 w-20">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100 align-top">
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-sm border border-black/10 shrink-0"
                            style={{ backgroundColor: l.color }}
                          />
                          <span className="text-gray-900 font-medium">{l.label}</span>
                          <span className="font-mono text-[11px] text-gray-400">{l.code}</span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-700">
                        {l.min_score ?? '−∞'} – {l.max_score ?? '∞'}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={ACCEPTANCE_BADGE[l.acceptance]}>
                          {ACCEPTANCE_LABELS[l.acceptance]}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {l.requires_capa && <Badge variant="danger">CAPA</Badge>}
                          {l.requires_approval && <Badge variant="warning">Approval</Badge>}
                          {l.requires_control && <Badge variant="info">Control</Badge>}
                          {!l.requires_capa && !l.requires_approval && !l.requires_control && (
                            <span className="text-gray-400">No mandatory action</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-gray-700">
                        {l.review_months ? `${l.review_months} mo` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <MatrixPreview framework={framework} />
    </div>
  );
}

// ── Read-only matrix preview ────────────────────────────────────────────────

/**
 * Rows are the first factor's ranks, columns the second's. An explicitly
 * configured matrix cell always wins; otherwise the score is derived from the
 * framework formula so the grid still reads correctly for PRODUCT/SUM setups.
 * ACTION_PRIORITY frameworks score on a third factor, so the derived preview is
 * labelled as indicative rather than authoritative.
 */
function MatrixPreview({ framework }: { framework: RiskFramework }) {
  const factors = [...framework.factors].sort((a, b) => a.order - b.order);
  const levels = [...framework.levels].sort((a, b) => a.order - b.order);
  const rowFactor = factors[0];
  const colFactor = factors[1];

  const cellIndex = useMemo(() => {
    const map = new Map<string, { score: number | null; level_id: string | null }>();
    for (const c of framework.matrix_cells) {
      map.set(`${c.row_factor_key}:${c.row_rank}|${c.col_factor_key}:${c.col_rank}`, {
        score: c.score,
        level_id: c.level_id,
      });
    }
    return map;
  }, [framework.matrix_cells]);

  const levelById = useMemo(() => new Map(levels.map((l) => [l.id, l])), [levels]);

  if (!rowFactor || !colFactor) {
    return (
      <Card noPadding className="p-5">
        <CardHeader className="mb-3">
          <CardTitle className="inline-flex items-center gap-1.5">
            <Grid3x3 size={14} className="text-gray-400" /> Matrix preview
          </CardTitle>
        </CardHeader>
        <p className="text-sm text-gray-500">
          A matrix preview needs at least two factors — this framework defines{' '}
          {factors.length === 1 ? 'one' : 'none'}.
        </p>
      </Card>
    );
  }

  const rowLevels = [...rowFactor.levels].sort((a, b) => b.rank - a.rank);
  const colLevels = [...colFactor.levels].sort((a, b) => a.rank - b.rank);

  const scoreFor = (rowRank: number, colRank: number): number | null => {
    const explicit = cellIndex.get(
      `${rowFactor.key}:${rowRank}|${colFactor.key}:${colRank}`,
    );
    if (explicit?.score != null) return explicit.score;
    if (framework.formula === 'MATRIX_LOOKUP') return null;
    if (framework.formula === 'SUM') return rowRank + colRank;
    if (framework.formula === 'WEIGHTED_PRODUCT') {
      return Math.round(rowRank * rowFactor.weight * colRank * colFactor.weight * 100) / 100;
    }
    return rowRank * colRank;
  };

  const levelFor = (rowRank: number, colRank: number, score: number | null) => {
    const explicit = cellIndex.get(`${rowFactor.key}:${rowRank}|${colFactor.key}:${colRank}`);
    if (explicit?.level_id) return levelById.get(explicit.level_id) ?? null;
    return bandForScore(levels, score);
  };

  return (
    <Card noPadding className="p-5">
      <CardHeader className="mb-3">
        <div className="min-w-0">
          <CardTitle className="inline-flex items-center gap-1.5">
            <Grid3x3 size={14} className="text-gray-400" /> Matrix preview
          </CardTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            {rowFactor.label} (rows) × {colFactor.label} (columns)
            {framework.formula === 'ACTION_PRIORITY' && ' — indicative; AP also uses detectability'}
          </p>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-left font-medium text-gray-500 sticky left-0 bg-white">
                {rowFactor.label} \ {colFactor.label}
              </th>
              {colLevels.map((c) => (
                <th
                  key={c.id}
                  className="p-1.5 font-medium text-gray-600 text-center min-w-[76px] align-bottom"
                >
                  <div className="tabular-nums text-gray-400">{c.rank}</div>
                  <div className="truncate max-w-[90px]" title={c.label}>
                    {c.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLevels.map((r) => (
              <tr key={r.id}>
                <th className="p-1.5 text-left font-medium text-gray-600 whitespace-nowrap sticky left-0 bg-white">
                  <span className="tabular-nums text-gray-400 mr-1">{r.rank}</span>
                  <span title={r.label}>{r.label}</span>
                </th>
                {colLevels.map((c) => {
                  const score = scoreFor(r.rank, c.rank);
                  const level = levelFor(r.rank, c.rank, score);
                  return (
                    <td key={c.id} className="p-0.5">
                      <div
                        className="rounded-sm px-2 py-2 text-center border"
                        style={{
                          backgroundColor: level ? `${level.color}22` : '#F8FAFC',
                          borderColor: level ? `${level.color}66` : '#E2E8F0',
                          color: level ? level.color : '#94A3B8',
                        }}
                        title={
                          level
                            ? `${level.label}${score != null ? ` — score ${score}` : ''}`
                            : 'No band matches this combination'
                        }
                      >
                        <div className="font-semibold tabular-nums leading-tight">
                          {score ?? '—'}
                        </div>
                        <div className="text-[10px] truncate max-w-[80px] leading-tight">
                          {level ? level.code : 'unbanded'}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {levels.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {levels.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-3 h-3 rounded-sm border border-black/10"
                style={{ backgroundColor: l.color }}
              />
              {l.label}
              <span className="text-gray-400 tabular-nums">
                ({l.min_score ?? '−∞'}–{l.max_score ?? '∞'})
              </span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

type FactorDraft = FactorUpsert;
type LevelDraft = LevelDefUpsert;

const emptyFactor = (order: number): FactorDraft => ({
  kind: 'SEVERITY',
  key: '',
  label: '',
  description: null,
  weight: 1,
  order,
  levels: [],
});

const emptyBand = (order: number): LevelDraft => ({
  code: '',
  label: '',
  color: DEFAULT_BAND_COLOR,
  order,
  minScore: null,
  maxScore: null,
  acceptance: 'ACCEPTABLE',
  requiresCapa: false,
  requiresApproval: false,
  requiresControl: false,
  reviewMonths: null,
  escalateToRoleId: null,
});

function FrameworkDrawer({
  open,
  framework,
  onClose,
  onSaved,
}: {
  open: boolean;
  framework: RiskFramework | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form] = Form.useForm<FrameworkFormValues>();
  const [factors, setFactors] = useState<FactorDraft[]>([]);
  const [bands, setBands] = useState<LevelDraft[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const createMut = useCreateFramework();
  const updateMut = useUpdateFramework(framework?.id ?? '');

  const inUse = !!framework && (framework.risk_count > 0 || framework.register_count > 0);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    if (framework) {
      form.setFieldsValue({
        code: framework.code ?? '',
        name: framework.name,
        description: framework.description ?? '',
        standard: framework.standard ?? '',
        methodology: framework.methodology,
        formula: framework.formula,
        isActive: framework.is_active,
        isDefault: framework.is_default,
      });
      setFactors(
        [...framework.factors]
          .sort((a, b) => a.order - b.order)
          .map((f) => ({
            kind: f.kind,
            key: f.key,
            label: f.label,
            description: f.description,
            weight: f.weight,
            order: f.order,
            levels: [...f.levels]
              .sort((a, b) => a.rank - b.rank)
              .map((l) => ({
                rank: l.rank,
                label: l.label,
                definition: l.definition,
                guidance: l.guidance,
                color: l.color,
              })),
          })),
      );
      setBands(
        [...framework.levels]
          .sort((a, b) => a.order - b.order)
          .map((l) => ({
            code: l.code,
            label: l.label,
            color: l.color,
            order: l.order,
            minScore: l.min_score,
            maxScore: l.max_score,
            acceptance: l.acceptance,
            requiresCapa: l.requires_capa,
            requiresApproval: l.requires_approval,
            requiresControl: l.requires_control,
            reviewMonths: l.review_months,
            escalateToRoleId: l.escalate_to_role_id,
          })),
      );
    } else {
      form.setFieldsValue({
        code: '',
        name: '',
        description: '',
        standard: '',
        methodology: 'MATRIX',
        formula: 'PRODUCT',
        isActive: true,
        isDefault: false,
      });
      setFactors([]);
      setBands([]);
    }
  }, [open, framework, form]);

  const patchFactor = (idx: number, patch: Partial<FactorDraft>) =>
    setFactors((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const patchBand = (idx: number, patch: Partial<LevelDraft>) =>
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  /**
   * Existing matrix cells are carried through untouched (keyed by level *code*,
   * as the API expects) so editing a name never silently discards a hand-built
   * lookup table. Cells pointing at a band that has been removed are dropped.
   */
  const carriedMatrixCells = useMemo<MatrixCellUpsert[]>(() => {
    if (!framework) return [];
    const codeById = new Map(framework.levels.map((l) => [l.id, l.code]));
    const keptCodes = new Set(bands.map((b) => b.code.trim()));
    return framework.matrix_cells.flatMap((c) => {
      const code = c.level_id ? codeById.get(c.level_id) : undefined;
      if (!code || !keptCodes.has(code)) return [];
      return [
        {
          rowFactorKey: c.row_factor_key,
          rowRank: c.row_rank,
          colFactorKey: c.col_factor_key,
          colRank: c.col_rank,
          score: c.score,
          levelCode: code,
        },
      ];
    });
  }, [framework, bands]);

  const validateStructure = (): string | null => {
    if (!factors.length) return 'Add at least one factor scale.';
    const keys = new Set<string>();
    for (const f of factors) {
      if (!f.key.trim()) return 'Every factor needs a key.';
      if (keys.has(f.key.trim())) return `Duplicate factor key “${f.key.trim()}”.`;
      keys.add(f.key.trim());
      if (!f.label.trim()) return `Factor “${f.key}” needs a label.`;
      if (f.levels.length < 2) return `Factor “${f.label || f.key}” needs at least two levels.`;
      const ranks = new Set<number>();
      for (const l of f.levels) {
        if (!l.label.trim()) return `Every level of “${f.label || f.key}” needs a label.`;
        if (ranks.has(l.rank)) return `Duplicate rank ${l.rank} in “${f.label || f.key}”.`;
        ranks.add(l.rank);
      }
    }
    if (!bands.length) return 'Add at least one level band.';
    const codes = new Set<string>();
    for (const b of bands) {
      if (!b.code.trim()) return 'Every level band needs a code.';
      if (codes.has(b.code.trim())) return `Duplicate band code “${b.code.trim()}”.`;
      codes.add(b.code.trim());
      if (!b.label.trim()) return `Band “${b.code}” needs a label.`;
      if (b.minScore != null && b.maxScore != null && b.minScore > b.maxScore) {
        return `Band “${b.label || b.code}” has a minimum above its maximum.`;
      }
    }
    return null;
  };

  const submit = async () => {
    const values = await form.validateFields();
    const structural = validateStructure();
    if (structural) {
      setSaveError(structural);
      message.error(structural);
      return;
    }
    setSaveError(null);

    const body: RiskFrameworkUpsert = {
      code: values.code?.trim() || null,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      standard: values.standard?.trim() || null,
      methodology: values.methodology,
      formula: values.formula,
      isActive: values.isActive,
      isDefault: values.isDefault,
      factors: factors.map((f, i) => ({
        ...f,
        key: f.key.trim(),
        label: f.label.trim(),
        description: f.description?.trim() || null,
        order: i,
        levels: f.levels.map((l) => ({
          ...l,
          label: l.label.trim(),
          definition: l.definition?.trim() || null,
          guidance: l.guidance?.trim() || null,
        })),
      })),
      levels: bands.map((b, i) => ({
        ...b,
        code: b.code.trim(),
        label: b.label.trim(),
        order: i,
      })),
      ...(carriedMatrixCells.length ? { matrixCells: carriedMatrixCells } : {}),
    };

    try {
      if (framework) {
        const saved = await updateMut.mutateAsync(body);
        onSaved(saved.id);
        message.success('Framework updated');
      } else {
        const saved = await createMut.mutateAsync(body);
        onSaved(saved.id);
        message.success('Framework created');
      }
      onClose();
    } catch (err) {
      const msg = extractErr(err);
      // 409 = the framework is already in use and may not be restructured. Say so
      // rather than letting the drawer look like it merely failed to save.
      setSaveError(
        errStatus(err) === 409
          ? `${msg} Clone this framework and edit the copy — scored risks must keep the rules they were scored under.`
          : msg,
      );
      message.error(msg);
    }
  };

  return (
    <Drawer
      title={
        <span className="inline-flex items-center gap-2">
          <Grid3x3 size={16} />
          {framework ? `Edit ${framework.name}` : 'New risk framework'}
        </span>
      }
      width={760}
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={
        <div className="flex justify-end gap-2">
          <AntButton onClick={onClose}>Cancel</AntButton>
          <AntButton
            type="primary"
            loading={createMut.isPending || updateMut.isPending}
            onClick={submit}
          >
            {framework ? 'Save changes' : 'Create framework'}
          </AntButton>
        </div>
      }
    >
      {saveError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-800">{saveError}</p>
        </div>
      )}
      {inUse && !saveError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            {framework?.risk_count} risks and {framework?.register_count} registers already use this
            framework. Structural changes will be rejected with a 409 — clone it instead.
          </p>
        </div>
      )}

      <Form form={form} layout="vertical" requiredMark>
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item
            name="name"
            label="Framework name"
            rules={[{ required: true, message: 'A name is required' }]}
          >
            <AntInput placeholder="e.g. ICH Q9 5×5 Matrix" />
          </Form.Item>
          <Form.Item name="code" label="Code">
            <AntInput placeholder="e.g. Q9-5X5" />
          </Form.Item>
        </div>
        <Form.Item name="description" label="Description">
          <AntInput.TextArea rows={2} placeholder="When this framework should be used" />
        </Form.Item>
        <div className="grid grid-cols-3 gap-x-4">
          <Form.Item name="standard" label="Standard">
            <AntInput placeholder="e.g. ICH Q9, ISO 14971" />
          </Form.Item>
          <Form.Item name="methodology" label="Methodology" rules={[{ required: true }]}>
            <AntSelect
              options={METHODOLOGIES.map((m) => ({ value: m, label: METHODOLOGY_LABELS[m] }))}
            />
          </Form.Item>
          <Form.Item name="formula" label="Scoring formula" rules={[{ required: true }]}>
            <AntSelect options={FORMULAS.map((f) => ({ value: f, label: FORMULA_LABELS[f] }))} />
          </Form.Item>
        </div>
        <div className="flex items-center gap-8">
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="isDefault"
            label="Organisation default"
            valuePropName="checked"
            extra="Used by registers that do not pick a framework."
          >
            <Switch />
          </Form.Item>
        </div>
      </Form>

      {/* Factors */}
      <div className="mt-2 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
            <Layers size={14} className="text-gray-400" /> Factor scales
          </h4>
          <AntButton
            size="small"
            icon={<Plus size={13} />}
            onClick={() => setFactors((prev) => [...prev, emptyFactor(prev.length)])}
          >
            Add factor
          </AntButton>
        </div>

        {factors.length === 0 ? (
          <p className="text-xs text-gray-500">
            No factors yet — a framework scores nothing until at least one scale is defined.
          </p>
        ) : (
          <div className="space-y-3">
            {factors.map((f, fi) => (
              <div key={fi} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="grid grid-cols-4 gap-2 flex-1 min-w-0">
                    <LabeledField label="Kind">
                      <AntSelect
                        size="small"
                        className="w-full"
                        value={f.kind}
                        onChange={(v) => patchFactor(fi, { kind: v })}
                        options={FACTOR_KINDS.map((k) => ({ value: k, label: k }))}
                      />
                    </LabeledField>
                    <LabeledField label="Key">
                      <AntInput
                        size="small"
                        value={f.key}
                        placeholder="severity"
                        onChange={(e) => patchFactor(fi, { key: e.target.value })}
                      />
                    </LabeledField>
                    <LabeledField label="Label">
                      <AntInput
                        size="small"
                        value={f.label}
                        placeholder="Severity"
                        onChange={(e) => patchFactor(fi, { label: e.target.value })}
                      />
                    </LabeledField>
                    <LabeledField label="Weight">
                      <InputNumber
                        size="small"
                        className="w-full"
                        min={0}
                        step={0.1}
                        value={f.weight}
                        onChange={(v) => patchFactor(fi, { weight: v ?? 1 })}
                      />
                    </LabeledField>
                  </div>
                  <Tooltip title="Remove factor">
                    <AntButton
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() => setFactors((prev) => prev.filter((_, i) => i !== fi))}
                    />
                  </Tooltip>
                </div>

                <div className="mt-2">
                  <LabeledField label="Description">
                    <AntInput
                      size="small"
                      value={f.description ?? ''}
                      placeholder="What this scale measures"
                      onChange={(e) => patchFactor(fi, { description: e.target.value })}
                    />
                  </LabeledField>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-gray-600">
                      Levels ({f.levels.length})
                    </span>
                    <AntButton
                      size="small"
                      type="link"
                      icon={<Plus size={12} />}
                      onClick={() =>
                        patchFactor(fi, {
                          levels: [
                            ...f.levels,
                            {
                              rank: f.levels.length
                                ? Math.max(...f.levels.map((l) => l.rank)) + 1
                                : 1,
                              label: '',
                              definition: null,
                              guidance: null,
                              color: null,
                            },
                          ],
                        })
                      }
                    >
                      Add level
                    </AntButton>
                  </div>

                  {f.levels.length === 0 ? (
                    <p className="text-[11px] text-gray-400">No levels defined.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {f.levels.map((l, li) => (
                        <div key={li} className="flex items-center gap-2">
                          <InputNumber
                            size="small"
                            min={0}
                            style={{ width: 64 }}
                            value={l.rank}
                            onChange={(v) =>
                              patchFactor(fi, {
                                levels: f.levels.map((x, i) =>
                                  i === li ? { ...x, rank: v ?? x.rank } : x,
                                ),
                              })
                            }
                          />
                          <AntInput
                            size="small"
                            style={{ width: 150 }}
                            placeholder="Label"
                            value={l.label}
                            onChange={(e) =>
                              patchFactor(fi, {
                                levels: f.levels.map((x, i) =>
                                  i === li ? { ...x, label: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <AntInput
                            size="small"
                            className="flex-1"
                            placeholder="Definition — the anchoring text assessors read"
                            value={l.definition ?? ''}
                            onChange={(e) =>
                              patchFactor(fi, {
                                levels: f.levels.map((x, i) =>
                                  i === li ? { ...x, definition: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <input
                            type="color"
                            aria-label="Level colour"
                            value={l.color ?? DEFAULT_BAND_COLOR}
                            onChange={(e) =>
                              patchFactor(fi, {
                                levels: f.levels.map((x, i) =>
                                  i === li ? { ...x, color: e.target.value } : x,
                                ),
                              })
                            }
                            className="w-7 h-7 p-0 border border-gray-200 rounded bg-transparent cursor-pointer shrink-0"
                          />
                          <AntButton
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 size={13} />}
                            onClick={() =>
                              patchFactor(fi, { levels: f.levels.filter((_, i) => i !== li) })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Level bands */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-gray-400" /> Level bands
          </h4>
          <AntButton
            size="small"
            icon={<Plus size={13} />}
            onClick={() => setBands((prev) => [...prev, emptyBand(prev.length)])}
          >
            Add band
          </AntButton>
        </div>

        {bands.length === 0 ? (
          <p className="text-xs text-gray-500">
            No bands yet — without them a computed score cannot be classified.
          </p>
        ) : (
          <div className="space-y-3">
            {bands.map((b, bi) => (
              <div key={bi} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="grid grid-cols-5 gap-2 flex-1 min-w-0">
                    <LabeledField label="Code">
                      <AntInput
                        size="small"
                        value={b.code}
                        placeholder="HIGH"
                        onChange={(e) => patchBand(bi, { code: e.target.value })}
                      />
                    </LabeledField>
                    <LabeledField label="Label">
                      <AntInput
                        size="small"
                        value={b.label}
                        placeholder="High"
                        onChange={(e) => patchBand(bi, { label: e.target.value })}
                      />
                    </LabeledField>
                    <LabeledField label="Min score">
                      <InputNumber
                        size="small"
                        className="w-full"
                        value={b.minScore ?? null}
                        onChange={(v) => patchBand(bi, { minScore: v ?? null })}
                      />
                    </LabeledField>
                    <LabeledField label="Max score">
                      <InputNumber
                        size="small"
                        className="w-full"
                        value={b.maxScore ?? null}
                        onChange={(v) => patchBand(bi, { maxScore: v ?? null })}
                      />
                    </LabeledField>
                    <LabeledField label="Acceptance">
                      <AntSelect
                        size="small"
                        className="w-full"
                        value={b.acceptance}
                        onChange={(v) => patchBand(bi, { acceptance: v })}
                        options={ACCEPTANCES.map((a) => ({
                          value: a,
                          label: ACCEPTANCE_LABELS[a],
                        }))}
                      />
                    </LabeledField>
                  </div>
                  <input
                    type="color"
                    aria-label="Band colour"
                    value={b.color || DEFAULT_BAND_COLOR}
                    onChange={(e) => patchBand(bi, { color: e.target.value })}
                    className="w-7 h-7 mt-4 p-0 border border-gray-200 rounded bg-transparent cursor-pointer shrink-0"
                  />
                  <Tooltip title="Remove band">
                    <AntButton
                      className="mt-4"
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() => setBands((prev) => prev.filter((_, i) => i !== bi))}
                    />
                  </Tooltip>
                </div>

                <div className="flex items-center gap-5 flex-wrap mt-2">
                  <SwitchField
                    label="Requires CAPA"
                    checked={b.requiresCapa}
                    onChange={(v) => patchBand(bi, { requiresCapa: v })}
                  />
                  <SwitchField
                    label="Requires approval"
                    checked={b.requiresApproval}
                    onChange={(v) => patchBand(bi, { requiresApproval: v })}
                  />
                  <SwitchField
                    label="Requires control"
                    checked={b.requiresControl}
                    onChange={(v) => patchBand(bi, { requiresControl: v })}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-600">Review every</span>
                    <InputNumber
                      size="small"
                      min={1}
                      max={120}
                      style={{ width: 76 }}
                      value={b.reviewMonths ?? null}
                      onChange={(v) => patchBand(bi, { reviewMonths: v ?? null })}
                    />
                    <span className="text-[11px] text-gray-600">months</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Switch size="small" checked={checked} onChange={onChange} />
      <span className="text-[11px] text-gray-600">{label}</span>
    </div>
  );
}
