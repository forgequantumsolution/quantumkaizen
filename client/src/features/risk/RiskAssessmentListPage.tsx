/**
 * The assessment register — every formal risk assessment (FMEA, matrix, HACCP,
 * HAZOP…) the site has run, with its lifecycle state and revision number.
 *
 * An assessment is a *versioned* artefact: approving one freezes it and the only
 * way forward is a revision, so the register shows the version alongside the
 * status rather than hiding it in the detail page. Creating one is a governance
 * act too — the framework chosen here decides the scales the whole worksheet is
 * scored against, and the server snapshots it at approval.
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
import {
  Plus,
  Search,
  Download,
  Trash2,
  Eye,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';
import { DataTable, type Column, Badge } from '@/components/ui';
import { exportToCSV } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import {
  riskKeys,
  useCreateAssessment,
  useDeleteAssessment,
  useRiskAssessments,
  useRiskFrameworks,
  useRiskRegisters,
  ASSESSMENT_STATUS_LABELS,
  METHODOLOGY_LABELS,
  type ListAssessmentParams,
  type RiskAssessment,
  type RiskAssessmentStatus,
  type RiskMethodology,
} from '@/lib/api/risk';
import { AssessmentStatusBadge } from './riskStatusBadge';

const PAGE_SIZE = 15;

const STATUSES: RiskAssessmentStatus[] = [
  'DRAFT',
  'IN_ASSESSMENT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PERIODIC_REVIEW',
  'SUPERSEDED',
  'CLOSED',
  'CANCELLED',
];

const METHODOLOGIES: RiskMethodology[] = [
  'MATRIX',
  'FMEA',
  'FMECA',
  'HACCP',
  'HAZOP',
  'PHA',
  'FTA',
  'BOWTIE',
  'CUSTOM',
];

const SORTS: { value: NonNullable<ListAssessmentParams['sortBy']>; label: string }[] = [
  { value: 'createdAt', label: 'Newest first' },
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'nextReviewAt', label: 'Next review due' },
  { value: 'approvedAt', label: 'Recently approved' },
  { value: 'assessmentNumber', label: 'Assessment number' },
];

interface AssessmentFormValues {
  title: string;
  objective?: string | null;
  scopeText?: string | null;
  methodology?: RiskMethodology | null;
  frameworkId?: string | null;
  registerId?: string | null;
  leadId?: string | null;
  teamIds?: string[];
}

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

export default function RiskAssessmentListPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const canCreate = useHasPermission('risk_assessment.create');
  const canDelete = useHasPermission('risk_assessment.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(params.get('status') ?? undefined);
  const [methodology, setMethodology] = useState<string | undefined>(
    params.get('methodology') ?? undefined,
  );
  const [registerId, setRegisterId] = useState<string | undefined>(
    params.get('registerId') ?? undefined,
  );
  const [sortBy, setSortBy] = useState<NonNullable<ListAssessmentParams['sortBy']>>('createdAt');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<AssessmentFormValues>();

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(() => setPage(1), [debouncedSearch, status, methodology, registerId, sortBy]);

  // Filters live in the URL so a filtered register is a shareable link.
  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (methodology) next.set('methodology', methodology);
    if (registerId) next.set('registerId', registerId);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, methodology, registerId]);

  const { data, isLoading } = useRiskAssessments({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status as RiskAssessmentStatus | undefined,
    methodology: methodology as RiskMethodology | undefined,
    registerId,
    sortBy,
    sortDir: sortBy === 'nextReviewAt' || sortBy === 'assessmentNumber' ? 'asc' : 'desc',
  });

  const { data: registerPage } = useRiskRegisters({ isActive: true, page: 1, pageSize: 200 });
  const { data: frameworks = [] } = useRiskFrameworks({ isActive: true });
  const { data: directory } = useUserDirectory();

  const createMut = useCreateAssessment();
  const deleteMut = useDeleteAssessment();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;
  const registers = registerPage?.data ?? [];
  const users = directory?.items ?? [];

  const userName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const openCreate = () => {
    form.setFieldsValue({
      title: '',
      objective: '',
      scopeText: '',
      methodology: null,
      frameworkId: frameworks.find((f) => f.is_default)?.id ?? null,
      registerId: registerId ?? null,
      leadId: null,
      teamIds: [],
    });
    setDrawerOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    try {
      const created = await createMut.mutateAsync({
        title: values.title.trim(),
        objective: values.objective?.trim() || null,
        scopeText: values.scopeText?.trim() || null,
        methodology: values.methodology || null,
        frameworkId: values.frameworkId || null,
        registerId: values.registerId || null,
        leadId: values.leadId || null,
        teamMembers:
          values.teamIds && values.teamIds.length > 0
            ? values.teamIds.map((uid) => ({ id: uid, name: userName.get(uid) ?? uid }))
            : null,
      });
      message.success('Assessment created');
      setDrawerOpen(false);
      if (created?.id) nav(`/risk/assessments/${created.id}`);
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
      'risk-assessments',
      [
        'Assessment #',
        'Title',
        'Methodology',
        'Framework',
        'Status',
        'Version',
        'Lead',
        'Register',
        'Lines',
        'Next review',
      ],
      rows.map((a) => [
        a.assessment_number,
        a.title,
        METHODOLOGY_LABELS[a.methodology] ?? a.methodology,
        a.framework?.name ?? '',
        ASSESSMENT_STATUS_LABELS[a.status] ?? a.status,
        `v${a.version}`,
        a.lead_id ? (userName.get(a.lead_id) ?? a.lead_id) : '',
        a.register?.name ?? '',
        a.line_count,
        a.next_review_at ? new Date(a.next_review_at).toISOString().slice(0, 10) : '',
      ]),
    );
  };

  const columns = useMemo<Column<RiskAssessment>[]>(
    () => [
      {
        key: 'assessment_number',
        header: 'Assessment #',
        render: (a) => (
          <div className="min-w-0">
            <span className="font-mono text-xs text-blue-700">{a.assessment_number}</span>
            <p className="text-[11px] text-gray-400 tabular-nums">v{a.version}</p>
          </div>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        render: (a) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate max-w-[300px]">{a.title}</p>
            <p className="text-xs text-gray-500 truncate max-w-[300px]">
              {a.register?.name ?? 'No register'}
              {a.line_count > 0 ? ` · ${a.line_count} line${a.line_count === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'methodology',
        header: 'Methodology',
        render: (a) => (
          <Badge variant="info">{METHODOLOGY_LABELS[a.methodology] ?? a.methodology}</Badge>
        ),
      },
      {
        key: 'framework',
        header: 'Framework',
        render: (a) => (
          <span className="text-xs text-gray-600">
            {a.framework ? `${a.framework.name} (v${a.framework.version})` : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (a) => <AssessmentStatusBadge status={a.status} />,
      },
      {
        key: 'lead_id',
        header: 'Lead',
        render: (a) => (
          <span className="text-xs text-gray-700">
            {a.lead_id ? (userName.get(a.lead_id) ?? '—') : '—'}
          </span>
        ),
      },
      {
        key: 'next_review_at',
        header: 'Next review',
        render: (a) => (
          <span
            className={
              a.is_review_overdue
                ? 'inline-flex items-center gap-1 text-xs font-semibold text-red-600'
                : 'text-xs text-gray-600'
            }
          >
            {a.is_review_overdue && <AlertTriangle size={12} />}
            {fmtDate(a.next_review_at)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (a) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Open worksheet">
              <AntButton
                type="text"
                size="small"
                icon={<Eye size={15} />}
                onClick={() => nav(`/risk/assessments/${a.id}`)}
              />
            </Tooltip>
            {canDelete && (
              <Tooltip title={a.status === 'APPROVED' ? 'Approved assessments cannot be deleted' : 'Delete'}>
                <AntButton
                  type="text"
                  size="small"
                  danger
                  disabled={a.status === 'APPROVED'}
                  icon={<Trash2 size={15} />}
                  onClick={() =>
                    confirmDelete({
                      entityLabel: 'risk assessment',
                      name: `${a.assessment_number} — ${a.title}`,
                      extraWarning:
                        'Its worksheet lines are removed with it. Risks already promoted from those lines are kept.',
                      mutate: () => deleteMut.mutateAsync(a.id),
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
    [canDelete, userName],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Risk assessments</h2>
          <p className="text-xs text-gray-500">
            {total} assessment{total === 1 ? '' : 's'} matching the current filters
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AntInput
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search number, title or objective"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <AntButton icon={<Download size={14} />} onClick={handleExport}>
            Export CSV
          </AntButton>
          {canCreate && (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New assessment
            </AntButton>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4 p-2.5 rounded-xl bg-gray-50 border border-gray-200/70">
        <AntSelect
          allowClear
          placeholder="All methodologies"
          style={{ width: 210 }}
          value={methodology}
          onChange={(v) => setMethodology(v ?? undefined)}
          options={METHODOLOGIES.map((m) => ({ value: m, label: METHODOLOGY_LABELS[m] }))}
        />
        <AntSelect
          allowClear
          placeholder="All statuses"
          style={{ width: 190 }}
          value={status}
          onChange={(v) => setStatus(v ?? undefined)}
          options={STATUSES.map((s) => ({ value: s, label: ASSESSMENT_STATUS_LABELS[s] }))}
        />
        <AntSelect
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All registers"
          style={{ width: 230 }}
          value={registerId}
          onChange={(v) => setRegisterId(v ?? undefined)}
          options={registers.map((r) => ({ value: r.id, label: r.name }))}
        />
        <div className="ml-auto">
          <AntSelect
            style={{ width: 210 }}
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No assessments match these filters"
          onRowClick={(a) => nav(`/risk/assessments/${a.id}`)}
          rowClassName={(a) => (a.is_review_overdue ? 'bg-red-50/40' : '')}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </div>

      <Drawer
        title={
          <span className="inline-flex items-center gap-2">
            <ClipboardList size={16} />
            New risk assessment
          </span>
        }
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setDrawerOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={createMut.isPending} onClick={submit}>
              Create assessment
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="title"
            label="Assessment title"
            rules={[{ required: true, message: 'A title is required' }]}
          >
            <AntInput placeholder="e.g. Aseptic filling line — process FMEA" />
          </Form.Item>
          <Form.Item name="objective" label="Objective">
            <AntInput.TextArea rows={2} placeholder="What question this assessment answers" />
          </Form.Item>
          <Form.Item name="scopeText" label="Scope">
            <AntInput.TextArea
              rows={3}
              placeholder="Boundaries — what is in scope and what is deliberately excluded"
            />
          </Form.Item>
          <Form.Item
            name="methodology"
            label="Methodology"
            extra="Leave blank to inherit the framework's methodology. This decides the worksheet columns."
          >
            <AntSelect
              allowClear
              placeholder="Inherit from framework"
              options={METHODOLOGIES.map((m) => ({ value: m, label: METHODOLOGY_LABELS[m] }))}
            />
          </Form.Item>
          <Form.Item
            name="frameworkId"
            label="Scoring framework"
            extra="Supplies the anchored scales the worksheet is scored against. Snapshotted at approval."
          >
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Inherit organisation default"
              options={frameworks.map((f) => ({
                value: f.id,
                label: `${f.name} — ${METHODOLOGY_LABELS[f.methodology] ?? f.methodology}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="registerId"
            label="Target register"
            extra="Where lines promoted to tracked risks will land."
          >
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Choose at promotion time"
              options={registers.map((r) => ({
                value: r.id,
                label: `${r.register_number} — ${r.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="leadId" label="Assessment lead">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Unassigned"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <Form.Item name="teamIds" label="Assessment team">
            <AntSelect
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Cross-functional participants"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <p className="text-xs text-gray-500 -mt-2">
            The worksheet is built on the next screen. Scores are computed by the server from the
            factor ranks you record — nothing is calculated here.
          </p>
        </Form>
      </Drawer>
    </>
  );
}
