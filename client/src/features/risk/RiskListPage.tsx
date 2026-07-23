/**
 * The flat risk register — every risk across every register, filtered and paged
 * by the server. The dashboard heat map deep-links here with a level/register
 * pre-selected, so filters are mirrored into the URL and read back on mount.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button as AntButton,
  Drawer,
  Form,
  Input as AntInput,
  Select as AntSelect,
  Tooltip,
  message,
} from 'antd';
import { Plus, Search, Download, Trash2, Eye, AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui';
import { exportToCSV } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import {
  riskKeys,
  useCreateRisk,
  useDeleteRisk,
  useRiskCategories,
  useRiskFrameworks,
  useRiskRegisters,
  useRisks,
  type Risk,
} from '@/lib/api/risk';
import { RiskStatusBadge, RiskLevelBadge } from './riskStatusBadge';

const PAGE_SIZE = 15;

const RISK_STATUSES = [
  'IDENTIFIED',
  'UNDER_ASSESSMENT',
  'TREATMENT_PLANNED',
  'TREATMENT_IN_PROGRESS',
  'RESIDUAL_ASSESSED',
  'ACCEPTED',
  'MONITORED',
  'CLOSED',
  'REOPENED',
  'ESCALATED',
] as const;

const TREATMENTS = ['AVOID', 'REDUCE', 'TRANSFER', 'ACCEPT'] as const;

const SORTS = [
  { value: 'createdAt', label: 'Newest first' },
  { value: 'residualScore', label: 'Highest residual score' },
  { value: 'initialScore', label: 'Highest initial score' },
  { value: 'nextReviewAt', label: 'Next review due' },
  { value: 'riskNumber', label: 'Risk number' },
] as const;

interface RiskFormValues {
  registerId: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  frameworkId?: string | null;
  hazard?: string | null;
  cause?: string | null;
  consequence?: string | null;
  treatment?: string | null;
  ownerId?: string | null;
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

export default function RiskListPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const canCreate = useHasPermission('risk.create');
  const canDelete = useHasPermission('risk.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(params.get('status') ?? undefined);
  const [registerId, setRegisterId] = useState<string | undefined>(
    params.get('registerId') ?? undefined,
  );
  const [categoryId, setCategoryId] = useState<string | undefined>(
    params.get('categoryId') ?? undefined,
  );
  const [levelCode, setLevelCode] = useState<string | undefined>(
    params.get('levelCode') ?? undefined,
  );
  const [overdueReview, setOverdueReview] = useState(params.get('overdueReview') === 'true');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<RiskFormValues>();

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(
    () => setPage(1),
    [debouncedSearch, status, registerId, categoryId, levelCode, overdueReview, sortBy, sortDir],
  );

  // Keep the address bar in step with the filters so a filtered view is shareable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (registerId) next.set('registerId', registerId);
    if (categoryId) next.set('categoryId', categoryId);
    if (levelCode) next.set('levelCode', levelCode);
    if (overdueReview) next.set('overdueReview', 'true');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, registerId, categoryId, levelCode, overdueReview]);

  const { data, isLoading } = useRisks({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status as Risk['status'] | undefined,
    registerId,
    categoryId,
    levelCode,
    overdueReview: overdueReview || undefined,
    sortBy: sortBy as 'createdAt',
    sortDir,
  });

  const { data: registerPage } = useRiskRegisters({ isActive: true, page: 1, pageSize: 200 });
  const { data: categories = [] } = useRiskCategories({ isActive: true });
  const { data: frameworks = [] } = useRiskFrameworks({ isActive: true });
  const { data: directory } = useUserDirectory();

  const createMut = useCreateRisk();
  const deleteMut = useDeleteRisk();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;
  const registers = registerPage?.data ?? [];

  // Every distinct level configured across the active frameworks — the filter
  // works on level *code*, which is what the API accepts.
  const levelOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of frameworks) for (const l of f.levels) if (!seen.has(l.code)) seen.set(l.code, l.label);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [frameworks]);

  const openCreate = () => {
    form.setFieldsValue({
      registerId: registerId ?? registers[0]?.id ?? '',
      title: '',
      description: '',
      categoryId: null,
      frameworkId: null,
      hazard: '',
      cause: '',
      consequence: '',
      treatment: null,
      ownerId: null,
    });
    setDrawerOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    try {
      const created = await createMut.mutateAsync({
        registerId: values.registerId,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        categoryId: values.categoryId || null,
        frameworkId: values.frameworkId || null,
        hazard: values.hazard?.trim() || null,
        cause: values.cause?.trim() || null,
        consequence: values.consequence?.trim() || null,
        treatment: (values.treatment || null) as Risk['treatment'],
        ownerId: values.ownerId || null,
      });
      message.success('Risk created');
      setDrawerOpen(false);
      const id = (created as { id?: string } | undefined)?.id;
      if (id) nav(`/risk/risks/${id}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      message.info('Nothing to export on this page');
      return;
    }
    exportToCSV(
      'risk-register',
      [
        'Risk #',
        'Title',
        'Register',
        'Category',
        'Status',
        'Initial score',
        'Initial level',
        'Residual score',
        'Residual level',
        'Next review',
        'Identified',
      ],
      rows.map((r) => [
        r.risk_number,
        r.title,
        r.register?.name ?? '',
        r.category?.name ?? '',
        r.status,
        r.initial_score ?? '',
        r.initial_level?.label ?? '',
        r.residual_score ?? '',
        r.residual_level?.label ?? '',
        r.next_review_at ? new Date(r.next_review_at).toISOString().slice(0, 10) : '',
        r.identified_at ? new Date(r.identified_at).toISOString().slice(0, 10) : '',
      ]),
    );
  };

  const columns = useMemo<Column<Risk>[]>(
    () => [
      {
        key: 'risk_number',
        header: 'Risk #',
        render: (r) => <span className="font-mono text-xs text-blue-700">{r.risk_number}</span>,
      },
      {
        key: 'title',
        header: 'Title',
        render: (r) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate max-w-[300px]">{r.title}</p>
            <p className="text-xs text-gray-500 truncate max-w-[300px]">
              {r.register?.name ?? '—'}
              {r.category ? ` · ${r.category.name}` : ''}
            </p>
          </div>
        ),
      },
      { key: 'status', header: 'Status', render: (r) => <RiskStatusBadge status={r.status} /> },
      {
        key: 'initial',
        header: 'Initial',
        render: (r) => <RiskLevelBadge level={r.initial_level} score={r.initial_score} />,
      },
      {
        key: 'residual',
        header: 'Residual',
        render: (r) => <RiskLevelBadge level={r.residual_level} score={r.residual_score} />,
      },
      {
        key: 'next_review_at',
        header: 'Next review',
        render: (r) => (
          <span
            className={
              r.is_review_overdue
                ? 'inline-flex items-center gap-1 text-xs font-semibold text-red-600'
                : 'text-xs text-gray-600'
            }
          >
            {r.is_review_overdue && <AlertTriangle size={12} />}
            {fmtDate(r.next_review_at)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (r) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Open">
              <AntButton
                type="text"
                size="small"
                icon={<Eye size={15} />}
                onClick={() => nav(`/risk/risks/${r.id}`)}
              />
            </Tooltip>
            {canDelete && (
              <Tooltip title="Delete">
                <AntButton
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={15} />}
                  onClick={() =>
                    confirmDelete({
                      entityLabel: 'risk',
                      name: `${r.risk_number} — ${r.title}`,
                      extraWarning: 'Its score history, controls and reviews are removed with it.',
                      mutate: () => deleteMut.mutateAsync(r.id),
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
    [canDelete],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Risk register</h2>
          <p className="text-xs text-gray-500">
            {total} risk{total === 1 ? '' : 's'} matching the current filters
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AntInput
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search risk #, title or hazard"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <AntButton icon={<Download size={14} />} onClick={handleExport}>
            Export CSV
          </AntButton>
          {canCreate && (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New risk
            </AntButton>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4 p-2.5 rounded-xl bg-gray-50 border border-gray-200/70">
        <AntSelect
          allowClear
          placeholder="All statuses"
          style={{ width: 190 }}
          value={status}
          onChange={(v) => setStatus(v ?? undefined)}
          options={RISK_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
        />
        <AntSelect
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All registers"
          style={{ width: 220 }}
          value={registerId}
          onChange={(v) => setRegisterId(v ?? undefined)}
          options={registers.map((r) => ({ value: r.id, label: r.name }))}
        />
        <AntSelect
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All categories"
          style={{ width: 190 }}
          value={categoryId}
          onChange={(v) => setCategoryId(v ?? undefined)}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <AntSelect
          allowClear
          placeholder="All levels"
          style={{ width: 160 }}
          value={levelCode}
          onChange={(v) => setLevelCode(v ?? undefined)}
          options={levelOptions}
        />
        <AntButton
          type={overdueReview ? 'primary' : 'default'}
          danger={overdueReview}
          icon={<AlertTriangle size={14} />}
          onClick={() => setOverdueReview((v) => !v)}
        >
          Review overdue
        </AntButton>
        <div className="ml-auto flex items-center gap-2">
          <AntSelect
            style={{ width: 200 }}
            value={sortBy}
            onChange={(v) => {
              setSortBy(v);
              setSortDir(v === 'nextReviewAt' || v === 'riskNumber' ? 'asc' : 'desc');
            }}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No risks match these filters"
          onRowClick={(r) => nav(`/risk/risks/${r.id}`)}
          rowClassName={(r) => (r.is_review_overdue ? 'bg-red-50/40' : '')}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </div>

      <Drawer
        title="New risk"
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setDrawerOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={createMut.isPending} onClick={submit}>
              Create risk
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="registerId"
            label="Register"
            rules={[{ required: true, message: 'A risk must belong to a register' }]}
          >
            <AntSelect
              showSearch
              optionFilterProp="label"
              placeholder="Select a register"
              options={registers.map((r) => ({
                value: r.id,
                label: `${r.register_number} — ${r.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Risk title"
            rules={[{ required: true, message: 'A title is required' }]}
          >
            <AntInput placeholder="e.g. Cross-contamination during product changeover" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Uncategorised"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item
            name="frameworkId"
            label="Scoring framework"
            extra="Leave blank to inherit the register's framework."
          >
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Inherit from register"
              options={frameworks.map((f) => ({ value: f.id, label: `${f.name} — ${f.methodology}` }))}
            />
          </Form.Item>
          <Form.Item name="hazard" label="Hazard">
            <AntInput placeholder="The source of potential harm" />
          </Form.Item>
          <Form.Item name="cause" label="Cause">
            <AntInput.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="consequence" label="Consequence">
            <AntInput.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="treatment" label="Planned treatment">
            <AntSelect
              allowClear
              placeholder="Not decided"
              options={TREATMENTS.map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="Risk owner">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Unassigned"
              options={(directory?.items ?? []).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <p className="text-xs text-gray-500 -mt-2">
            Scoring happens on the risk workspace — the server computes and records the score.
          </p>
        </Form>
      </Drawer>
    </>
  );
}
