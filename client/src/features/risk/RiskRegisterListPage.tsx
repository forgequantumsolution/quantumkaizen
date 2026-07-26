/**
 * Risk registers — the containers a risk belongs to. A register carries the
 * framework its risks score against, so creating one is a governance act, not a
 * folder: the framework picked here decides how every risk inside it is scored.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button as AntButton, Drawer, Form, Input as AntInput, Select as AntSelect, Switch, Tooltip, message } from 'antd';
import { Plus, Pencil, Trash2, FolderKanban, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { DataTable, type Column, Badge } from '@/components/ui';
import FilterBar, { FilterField } from '@/components/shared/FilterBar';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import {
  riskKeys,
  useCreateRegister,
  useDeleteRegister,
  useRiskFrameworks,
  useRiskRegisters,
  useUpdateRegister,
  type RiskRegister,
} from '@/lib/api/risk';

const PAGE_SIZE = 10;

const SCOPES = [
  'SITE',
  'PRODUCT',
  'PROCESS',
  'PROJECT',
  'SUPPLIER',
  'EQUIPMENT',
  'SYSTEM',
  'ENTERPRISE',
] as const;

interface RegisterFormValues {
  name: string;
  description?: string | null;
  scope: string;
  frameworkId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  isActive: boolean;
}

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

export default function RiskRegisterListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('risk_register.create');
  const canUpdate = useHasPermission('risk_register.update');
  const canDelete = useHasPermission('risk_register.delete');
  const confirmDelete = useConfirmDelete();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<RiskRegister | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<RegisterFormValues>();

  const debouncedSearch = useDebouncedValue(search, 400);
  useEffect(() => setPage(1), [debouncedSearch, scope]);

  const { data, isLoading } = useRiskRegisters({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    scope: scope as RiskRegister['scope'] | undefined,
  });
  const { data: frameworks = [] } = useRiskFrameworks({ isActive: true });
  const { data: directory } = useUserDirectory();
  const { data: departments } = useDepartments({ isActive: true, pageSize: 200 });

  const createMut = useCreateRegister();
  const updateMut = useUpdateRegister(editing?.id ?? '');
  const deleteMut = useDeleteRegister();

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      name: '',
      description: '',
      scope: 'SITE',
      frameworkId: frameworks.find((f) => f.is_default)?.id ?? null,
      departmentId: null,
      ownerId: null,
      isActive: true,
    });
    setDrawerOpen(true);
  };

  // Report generation is per-row, so track which row is building to keep the
  // spinner on that button alone. The PDF engine is imported on demand.
  const [reportFor, setReportFor] = useState<string | null>(null);
  const downloadRegister = async (r: RiskRegister) => {
    if (reportFor) return;
    setReportFor(r.id);
    const toastId = toast.loading(`Preparing ${r.register_number} report…`);
    try {
      const { downloadRegisterReport } = await import('./report/downloadRegisterReport');
      await downloadRegisterReport(r.id, r.register_number);
      toast.success('Report downloaded', { id: toastId });
    } catch (err) {
      console.error('Register report failed', err);
      toast.error('Could not generate the report.', { id: toastId });
    } finally {
      setReportFor(null);
    }
  };

  const openEdit = (r: RiskRegister) => {
    setEditing(r);
    form.setFieldsValue({
      name: r.name,
      description: r.description ?? '',
      scope: r.scope,
      frameworkId: r.framework?.id ?? null,
      departmentId: r.department_id ?? null,
      ownerId: r.owner_id ?? null,
      isActive: r.is_active,
    });
    setDrawerOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const body = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      scope: values.scope as RiskRegister['scope'],
      frameworkId: values.frameworkId || null,
      departmentId: values.departmentId || null,
      ownerId: values.ownerId || null,
      isActive: values.isActive,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(body);
        message.success('Register updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Register created');
      }
      setDrawerOpen(false);
      setEditing(null);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const columns = useMemo<Column<RiskRegister>[]>(
    () => [
      {
        key: 'register_number',
        header: 'Register #',
        render: (r) => <span className="font-mono text-xs text-blue-700">{r.register_number}</span>,
      },
      {
        key: 'name',
        header: 'Name',
        render: (r) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate max-w-[280px]">{r.name}</p>
            {r.description && (
              <p className="text-xs text-gray-500 truncate max-w-[280px]">{r.description}</p>
            )}
          </div>
        ),
      },
      {
        key: 'scope',
        header: 'Scope',
        render: (r) => <Badge variant="info">{r.scope}</Badge>,
      },
      {
        key: 'framework',
        header: 'Framework',
        render: (r) => (
          <span className="text-xs text-gray-600">
            {r.framework ? `${r.framework.name} (${r.framework.methodology})` : '— inherits default'}
          </span>
        ),
      },
      {
        key: 'risk_count',
        header: 'Risks',
        render: (r) => <span className="tabular-nums">{r.risk_count}</span>,
      },
      {
        key: 'is_active',
        header: 'Status',
        render: (r) => (
          <Badge variant={r.is_active ? 'success' : 'default'} dot>
            {r.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (r) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Download register report (PDF)">
              <AntButton
                type="text"
                size="small"
                icon={<Download size={15} />}
                loading={reportFor === r.id}
                onClick={() => downloadRegister(r)}
              />
            </Tooltip>
            {canUpdate && (
              <Tooltip title="Edit">
                <AntButton
                  type="text"
                  size="small"
                  icon={<Pencil size={15} />}
                  onClick={() => openEdit(r)}
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
                      entityLabel: 'risk register',
                      name: `${r.register_number} — ${r.name}`,
                      extraWarning:
                        'A register holding risks cannot be deleted; move or close them first.',
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
    // `reportFor` must be here: without it the memo never recomputes while a
    // report builds and the row's spinner never appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, frameworks, reportFor],
  );

  return (
    <>
      {/* Toolbar first, then the table — the filters scope what is listed. */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or number"
        title="Filter registers"
        activeCount={scope ? 1 : 0}
        onClear={() => setScope(undefined)}
        actions={
          canCreate ? (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              New register
            </AntButton>
          ) : undefined
        }
      >
        <FilterField label="Scope">
          <AntSelect
            allowClear
            placeholder="All scopes"
            style={{ width: '100%' }}
            value={scope}
            onChange={(v) => setScope(v ?? undefined)}
            options={SCOPES.map((s) => ({ value: s, label: s }))}
          />
        </FilterField>
      </FilterBar>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No risk registers yet"
          onRowClick={(r) => nav(`/risk/risks?registerId=${r.id}`)}
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
            <FolderKanban size={16} />
            {editing ? `Edit ${editing.register_number}` : 'New risk register'}
          </span>
        }
        width={520}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setDrawerOpen(false)}>Cancel</AntButton>
            <AntButton
              type="primary"
              loading={createMut.isPending || updateMut.isPending}
              onClick={submit}
            >
              {editing ? 'Save changes' : 'Create register'}
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label="Register name"
            rules={[{ required: true, message: 'A name is required' }]}
          >
            <AntInput placeholder="e.g. Sterile Manufacturing — Process Risks" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} placeholder="What this register covers" />
          </Form.Item>
          <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
            <AntSelect options={SCOPES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item
            name="frameworkId"
            label="Scoring framework"
            extra="Leave blank to inherit the organisation default at scoring time."
          >
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Inherit default"
              options={frameworks.map((f) => ({
                value: f.id,
                label: `${f.name} — ${f.methodology}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="departmentId" label="Owning department">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Unassigned"
              options={(departments?.items ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="Register owner">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Unassigned"
              options={(directory?.items ?? []).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
