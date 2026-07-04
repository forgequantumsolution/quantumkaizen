import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  Input,
  Space,
  Switch,
  message,
} from 'antd';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import type { QueryKey, UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { DataTable } from '@/components/ui';
import type { LookupMaster, LookupMasterUpsert } from '@/lib/api/audit';
import { useHasPermission } from '@/stores/authStore';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';

interface PaginatedResp {
  data: LookupMaster[];
  pagination?: { total_items: number; page: number; page_size: number };
}

interface LookupMasterPageProps {
  /** Singular entity label, e.g. "Focus Area". */
  title: string;
  /** Short helper line under the title. */
  subtitle: string;
  /** Placeholder for the name input. */
  namePlaceholder: string;
  /** Permission prefix, e.g. "focus_area" → focus_area.create/update/delete. */
  permissionPrefix: string;
  /** React Query key prefix to invalidate on delete (e.g. ['audit', 'focus-areas']). */
  invalidateKey: QueryKey;
  useList: (q?: { page_size?: number }) => UseQueryResult<PaginatedResp>;
  useCreate: () => UseMutationResult<unknown, unknown, LookupMasterUpsert>;
  useUpdate: (id: string) => UseMutationResult<unknown, unknown, LookupMasterUpsert>;
  useDelete: () => UseMutationResult<unknown, unknown, string>;
}

export default function LookupMasterPage({
  title,
  subtitle,
  namePlaceholder,
  permissionPrefix,
  invalidateKey,
  useList,
  useCreate,
  useUpdate,
  useDelete,
}: LookupMasterPageProps) {
  const canCreate = useHasPermission(`${permissionPrefix}.create`);
  const canUpdate = useHasPermission(`${permissionPrefix}.update`);
  const canDelete = useHasPermission(`${permissionPrefix}.delete`);

  const { data, isLoading } = useList({ page_size: 200 });
  const rows: LookupMaster[] = data?.data ?? [];
  const deleteMut = useDelete();
  const confirmDelete = useConfirmDelete();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LookupMaster | null>(null);

  const handleDelete = (m: LookupMaster) =>
    confirmDelete({
      entityLabel: title.toLowerCase(),
      name: m.name,
      mutate: () => deleteMut.mutateAsync(m.id),
      invalidateKey,
      successMessage: `${title} deleted`,
    });

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
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
            New {title}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <DataTable<LookupMaster>
          data={rows}
          isLoading={isLoading}
          pageSize={30}
          emptyMessage={`No ${title.toLowerCase()} records found`}
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (r) => <span className="font-medium text-gray-800">{r.name}</span>,
            },
            {
              key: 'description',
              header: 'Description',
              sortable: false,
              render: (r) => r.description ?? '—',
            },
            {
              key: 'is_active',
              header: 'Active',
              render: (r) => (
                <span className={`text-xs ${r.is_active ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {r.is_active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (r) => (
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
                    <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => handleDelete(r)} />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <LookupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        record={editing}
        title={title}
        namePlaceholder={namePlaceholder}
        useCreate={useCreate}
        useUpdate={useUpdate}
      />
    </>
  );
}

/* ─── Drawer ─── */

interface Draft {
  name: string;
  description: string;
  is_active: boolean;
}

const initialDraft = (m: LookupMaster | null): Draft => ({
  name: m?.name ?? '',
  description: m?.description ?? '',
  is_active: m?.is_active ?? true,
});

function LookupDrawer({
  open,
  onClose,
  record,
  title,
  namePlaceholder,
  useCreate,
  useUpdate,
}: {
  open: boolean;
  onClose: () => void;
  record: LookupMaster | null;
  title: string;
  namePlaceholder: string;
  useCreate: () => UseMutationResult<unknown, unknown, LookupMasterUpsert>;
  useUpdate: (id: string) => UseMutationResult<unknown, unknown, LookupMasterUpsert>;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(record));

  useEffect(() => {
    if (open) setDraft(initialDraft(record));
  }, [open, record]);

  const createMut = useCreate();
  const updateMut = useUpdate(record?.id ?? '');

  const submit = async () => {
    if (!draft.name.trim()) {
      message.error('Name is required');
      return;
    }
    const body: LookupMasterUpsert = {
      name: draft.name.trim(),
      description: draft.description || null,
      is_active: draft.is_active,
    };
    try {
      if (record) {
        await updateMut.mutateAsync(body);
        message.success(`${title} updated`);
      } else {
        await createMut.mutateAsync(body);
        message.success(`${title} created`);
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Drawer
      title={record ? `Edit ${record.name}` : `New ${title}`}
      open={open}
      onClose={onClose}
      width={460}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>
            {record ? 'Save' : 'Create'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <Field label="Name *">
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={namePlaceholder}
          />
        </Field>
        <Field label="Description">
          <Input.TextArea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Active">
          <Switch checked={draft.is_active} onChange={(v) => update('is_active', v)} />
        </Field>
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
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? 'Operation failed'
  );
}
