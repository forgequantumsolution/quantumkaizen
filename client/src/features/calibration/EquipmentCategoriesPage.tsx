import { useEffect, useState } from 'react';
import { App, Button, Drawer, Empty, Input, InputNumber, Select, Space, Switch, Table, Tag } from 'antd';
import { Layers, Plus, Edit3, Trash2, Search, Save } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import CalibrationPageHeader from './CalibrationPageHeader';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReplacePointTemplates,
  useReplaceCheckItems,
  type CheckTemplateItem,
  KIND_LABELS,
  CRITICALITY_BADGE,
  type Category,
  type InstrumentKind,
  type Criticality,
  type ToleranceType,
  type InUseFrequency,
} from '@/lib/api/calibration';

const KINDS = Object.keys(KIND_LABELS) as InstrumentKind[];
const CRITICALITIES: Criticality[] = ['CRITICAL', 'MAJOR', 'MINOR', 'INDICATIVE'];
const FREQUENCIES: InUseFrequency[] = ['PER_SHIFT', 'DAILY', 'WEEKLY', 'PER_BATCH', 'MONTHLY'];
const TOLERANCE_TYPES: { value: ToleranceType; label: string }[] = [
  { value: 'ABSOLUTE', label: 'Absolute (±)' },
  { value: 'PERCENT_OF_READING', label: '% of reading' },
  { value: 'PERCENT_OF_SPAN', label: '% of span' },
  { value: 'MPE_MULTIPLE', label: '× MPE' },
];

interface TplDraft {
  sequence: number;
  label: string;
  /** Exactly one of these is used — span-relative resolves per instrument. */
  nominal_value: number | null;
  nominal_percent_of_span: number | null;
  unit_code: string | null;
  tolerance_type: ToleranceType;
  tolerance_value: number;
}

/**
 * Instrument categories — the master data an industry pack seeds.
 *
 * A category supplies the default interval, criticality and the tolerance point
 * template every plan created from it inherits. Editing one does NOT touch the
 * plans already created — those are versioned records of what an instrument was
 * judged against.
 */
export default function EquipmentCategoriesPage() {
  const { modal, message } = App.useApp();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<InstrumentKind | undefined>();
  const { data, isLoading } = useCategories({ search: search || undefined, kind });
  const canUpdate = useHasPermission('calibration_config.update');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const del = useDeleteCategory();

  const onDelete = (c: Category) =>
    modal.confirm({
      title: `Delete ${c.name}?`,
      content:
        (c.instrument_count ?? 0) > 0
          ? `${c.instrument_count} instrument(s) use this category — it cannot be deleted. Deactivate it instead.`
          : 'This category has no instruments and can be removed.',
      okText: 'Delete',
      okButtonProps: { danger: true, disabled: (c.instrument_count ?? 0) > 0 },
      centered: true,
      onOk: async () => {
        try {
          await del.mutateAsync(c.id);
          message.success('Category deleted');
        } catch (e) {
          message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
        }
      },
    });

  return (
    <PageContainer>
      <CalibrationPageHeader
        title="Instrument Categories"
        icon={Layers}
        actions={
          <>
            <Select
              allowClear
              placeholder="Kind"
              value={kind}
              onChange={setKind}
              style={{ width: 165 }}
              options={KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            />
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <Input placeholder="Name / code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 210 }} />
            </div>
            {canUpdate && (
              <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>
                New Category
              </Button>
            )}
          </>
        }
      />

      <Table<Category>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} categor${t === 1 ? 'y' : 'ies'}` }}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No categories — apply an industry pack or add one" />
          ),
        }}
        expandable={{
          expandedRowRender: (r) =>
            (r.point_templates?.length ?? 0) === 0 ? (
              <span className="text-xs text-gray-400">No point templates on this category.</span>
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={r.point_templates}
                columns={[
                  { title: '#', dataIndex: 'sequence', width: 45 },
                  { title: 'Point', dataIndex: 'label', ellipsis: true },
                  {
                    title: 'Nominal',
                    width: 170,
                    render: (_: unknown, p) =>
                      p.nominal_percent_of_span !== null ? (
                        <span className="text-xs text-gray-600">{p.nominal_percent_of_span}% of span</span>
                      ) : (
                        <span className="font-mono text-xs">
                          {p.nominal_value} {p.unit_code ?? ''}
                        </span>
                      ),
                  },
                  {
                    title: 'Tolerance',
                    width: 210,
                    render: (_: unknown, p) => (
                      <span className="text-xs">
                        ±{p.tolerance_value}{' '}
                        <span className="text-gray-400">{p.tolerance_type.replace(/_/g, ' ').toLowerCase()}</span>
                      </span>
                    ),
                  },
                ]}
              />
            ),
        }}
        columns={[
          {
            title: 'Code',
            dataIndex: 'code',
            width: 180,
            render: (v: string) => <span className="font-mono text-[11px] text-gray-600">{v}</span>,
          },
          { title: 'Category', dataIndex: 'name', ellipsis: true },
          { title: 'Kind', width: 150, render: (_: unknown, r) => <span className="text-xs">{KIND_LABELS[r.kind]}</span> },
          {
            title: 'Pack',
            width: 105,
            render: (_: unknown, r) =>
              r.industry_pack ? <Tag className="!text-[10px]">{r.industry_pack}</Tag> : <span className="text-xs text-gray-400">custom</span>,
          },
          {
            title: 'Interval',
            width: 80,
            align: 'right' as const,
            render: (_: unknown, r) => (r.default_interval_days ? `${r.default_interval_days}d` : '—'),
          },
          {
            title: 'Criticality',
            width: 95,
            render: (_: unknown, r) => (
              <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded border ${CRITICALITY_BADGE[r.default_criticality]}`}>
                {r.default_criticality}
              </span>
            ),
          },
          { title: 'Points', width: 60, align: 'right' as const, render: (_: unknown, r) => r.point_templates?.length ?? 0 },
          { title: 'In use', width: 60, align: 'right' as const, render: (_: unknown, r) => r.instrument_count ?? 0 },
          {
            title: 'Flags',
            width: 130,
            render: (_: unknown, r) => (
              <span className="flex gap-1 flex-wrap">
                {r.requires_msa && (
                  <Tag color="purple" className="!text-[9px] !mr-0">
                    MSA
                  </Tag>
                )}
                {r.requires_in_use_check && (
                  <Tag color="blue" className="!text-[9px] !mr-0">
                    {r.in_use_check_frequency?.toLowerCase().replace('_', ' ')}
                  </Tag>
                )}
                {!r.is_active && (
                  <Tag className="!text-[9px] !mr-0">inactive</Tag>
                )}
              </span>
            ),
          },
          {
            title: '',
            width: 80,
            render: (_: unknown, r) =>
              canUpdate ? (
                <Space size={4}>
                  <Button
                    size="small"
                    icon={<Edit3 size={12} />}
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  />
                  <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => onDelete(r)} />
                </Space>
              ) : null,
          },
        ]}
      />

      <CategoryDrawer open={open} onClose={() => setOpen(false)} category={editing} />
    </PageContainer>
  );
}

function CategoryDrawer({ open, onClose, category }: { open: boolean; onClose: () => void; category: Category | null }) {
  const { message } = App.useApp();
  const create = useCreateCategory();
  const update = useUpdateCategory(category?.id ?? '');
  const savePoints = useReplacePointTemplates();
  const saveChecks = useReplaceCheckItems();

  const blank = {
    name: '',
    kind: 'LAB_INSTRUMENT' as InstrumentKind,
    default_criticality: 'MAJOR' as Criticality,
    default_interval_days: 365,
    requires_msa: false,
    requires_in_use_check: false,
    is_active: true,
  };
  const [form, setForm] = useState<Record<string, unknown>>(blank);
  const [points, setPoints] = useState<TplDraft[]>([]);
  const [checks, setChecks] = useState<Omit<CheckTemplateItem, 'id'>[]>([]);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setForm({
        name: category.name,
        kind: category.kind,
        description: category.description,
        default_interval_days: category.default_interval_days,
        default_criticality: category.default_criticality,
        requires_msa: category.requires_msa,
        requires_in_use_check: category.requires_in_use_check,
        in_use_check_frequency: category.in_use_check_frequency,
        is_active: category.is_active,
      });
      setChecks(
        (category.check_items ?? []).map((c) => ({
          sequence: c.sequence,
          label: c.label,
          check_type: c.check_type,
          nominal_value: c.nominal_value,
          tolerance_value: c.tolerance_value,
          unit_code: c.unit_code,
          is_required: c.is_required,
          guidance: c.guidance,
        })),
      );
      setPoints(
        (category.point_templates ?? []).map((p) => ({
          sequence: p.sequence,
          label: p.label,
          nominal_value: p.nominal_value,
          nominal_percent_of_span: p.nominal_percent_of_span,
          unit_code: p.unit_code,
          tolerance_type: p.tolerance_type,
          tolerance_value: p.tolerance_value,
        })),
      );
    } else {
      setForm(blank);
      setPoints([]);
      setChecks([]);
    }
  }, [open, category]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!String(form.name ?? '').trim()) return message.warning('Name is required');
    if (form.requires_in_use_check && !form.in_use_check_frequency) {
      return message.warning('Choose a check frequency when in-use checks are required');
    }
    if (points.some((p) => !p.label.trim())) return message.warning('Every point template needs a label');

    try {
      const body = form as unknown as Category & { name: string };
      const saved = category ? await update.mutateAsync(body) : await create.mutateAsync(body);
      if (points.length > 0) {
        await savePoints.mutateAsync({
          id: saved.id,
          points: points.map((p, i) => ({ ...p, sequence: i + 1 })),
        });
      }
      // Only push the checklist when this category actually uses one, so
      // turning the toggle off does not leave orphaned items behind.
      if (form.requires_in_use_check) {
        await saveChecks.mutateAsync({ id: saved.id, items: checks.map((c, i) => ({ ...c, sequence: i + 1 })) });
      } else if ((category?.check_items?.length ?? 0) > 0) {
        await saveChecks.mutateAsync({ id: saved.id, items: [] });
      }
      message.success(category ? 'Category updated' : 'Category created');
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save');
    }
  };

  const addPoint = () =>
    setPoints((p) => [
      ...p,
      {
        sequence: p.length + 1,
        label: '',
        nominal_value: 0,
        nominal_percent_of_span: null,
        unit_code: null,
        tolerance_type: 'ABSOLUTE',
        tolerance_value: 0,
      },
    ]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={category ? `Edit ${category.code}` : 'New instrument category'}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            icon={<Save size={14} />}
            loading={create.isPending || update.isPending || savePoints.isPending || saveChecks.isPending}
            onClick={save}
          >
            Save
          </Button>
        </Space>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <L label="Name" required>
            <Input value={form.name as string} onChange={(e) => set('name', e.target.value)} placeholder="Analytical Balance" />
          </L>
          <L label="Kind">
            <Select
              className="w-full"
              value={form.kind as string}
              onChange={(v) => set('kind', v)}
              options={KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            />
          </L>
        </div>

        <L label="Description">
          <Input.TextArea rows={2} value={(form.description as string) ?? ''} onChange={(e) => set('description', e.target.value)} />
        </L>

        <div className="grid grid-cols-3 gap-3">
          <L label="Default interval (days)">
            <InputNumber
              min={1}
              max={3650}
              className="w-full"
              value={form.default_interval_days as number}
              onChange={(v) => set('default_interval_days', v)}
            />
          </L>
          <L label="Default criticality">
            <Select
              className="w-full"
              value={form.default_criticality as string}
              onChange={(v) => set('default_criticality', v)}
              options={CRITICALITIES.map((c) => ({ value: c, label: c }))}
            />
          </L>
          <L label="Active">
            <div className="pt-1">
              <Switch checked={form.is_active !== false} onChange={(v) => set('is_active', v)} />
            </div>
          </L>
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Requires MSA / Gage R&amp;R</div>
              <div className="text-[11px] text-gray-500">
                Blocks plan activation until an acceptable study exists (IATF §7.1.5.1.1).
              </div>
            </div>
            <Switch checked={!!form.requires_msa} onChange={(v) => set('requires_msa', v)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Requires in-use verification</div>
              <div className="text-[11px] text-gray-500">Shift or daily checks between full calibrations.</div>
            </div>
            <Space>
              {!!form.requires_in_use_check && (
                <Select
                  size="small"
                  style={{ width: 130 }}
                  value={(form.in_use_check_frequency as string) ?? undefined}
                  onChange={(v) => set('in_use_check_frequency', v)}
                  placeholder="Frequency"
                  options={FREQUENCIES.map((f) => ({ value: f, label: f.toLowerCase().replace('_', ' ') }))}
                />
              )}
              <Switch checked={!!form.requires_in_use_check} onChange={(v) => set('requires_in_use_check', v)} />
            </Space>
          </div>
        </div>

        {!!form.requires_in_use_check && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">In-use checklist</h3>
                <p className="text-[11px] text-gray-500">
                  What the shift / daily check consists of. Without this the entry screen can only offer one generic row.
                </p>
              </div>
              <Button
                size="small"
                icon={<Plus size={12} />}
                onClick={() =>
                  setChecks((c) => [
                    ...c,
                    { sequence: c.length + 1, label: '', check_type: 'NUMERIC', nominal_value: 0, tolerance_value: 0, unit_code: null, is_required: true, guidance: null },
                  ])
                }
              >
                Add check
              </Button>
            </div>

            {checks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No checklist items" className="py-4" />
            ) : (
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                pagination={false}
                dataSource={checks}
                columns={[
                  { title: '#', width: 38, render: (_: unknown, __: unknown, i: number) => i + 1 },
                  {
                    title: 'Check',
                    render: (_: unknown, r, i) => (
                      <Input
                        size="small"
                        value={r.label}
                        placeholder="Ferrous test piece detected"
                        onChange={(e) => setChecks((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      />
                    ),
                  },
                  {
                    title: 'Type',
                    width: 110,
                    render: (_: unknown, r, i) => (
                      <Select
                        size="small"
                        className="w-full"
                        value={r.check_type}
                        onChange={(v) => setChecks((p) => p.map((x, j) => (j === i ? { ...x, check_type: v } : x)))}
                        options={[
                          { value: 'NUMERIC', label: 'Measured' },
                          { value: 'PASS_FAIL', label: 'Pass / fail' },
                        ]}
                      />
                    ),
                  },
                  {
                    title: 'Expect',
                    width: 90,
                    render: (_: unknown, r, i) =>
                      r.check_type === 'NUMERIC' ? (
                        <InputNumber
                          size="small"
                          className="w-full"
                          value={r.nominal_value ?? undefined}
                          onChange={(v) => setChecks((p) => p.map((x, j) => (j === i ? { ...x, nominal_value: v ?? null } : x)))}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">n/a</span>
                      ),
                  },
                  {
                    title: '±',
                    width: 80,
                    render: (_: unknown, r, i) =>
                      r.check_type === 'NUMERIC' ? (
                        <InputNumber
                          size="small"
                          className="w-full"
                          value={r.tolerance_value ?? undefined}
                          onChange={(v) => setChecks((p) => p.map((x, j) => (j === i ? { ...x, tolerance_value: v ?? null } : x)))}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      ),
                  },
                  {
                    title: 'Unit',
                    width: 70,
                    render: (_: unknown, r, i) =>
                      r.check_type === 'NUMERIC' ? (
                        <Input
                          size="small"
                          value={r.unit_code ?? ''}
                          onChange={(e) => setChecks((p) => p.map((x, j) => (j === i ? { ...x, unit_code: e.target.value } : x)))}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      ),
                  },
                  {
                    title: 'Req.',
                    width: 52,
                    render: (_: unknown, r, i) => (
                      <Switch
                        size="small"
                        checked={r.is_required !== false}
                        onChange={(v) => setChecks((p) => p.map((x, j) => (j === i ? { ...x, is_required: v } : x)))}
                      />
                    ),
                  },
                  {
                    title: '',
                    width: 38,
                    render: (_: unknown, __: unknown, i: number) => (
                      <Button size="small" danger icon={<Trash2 size={11} />} onClick={() => setChecks((p) => p.filter((_, j) => j !== i))} />
                    ),
                  },
                ]}
              />
            )}
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Point templates</h3>
              <p className="text-[11px] text-gray-500">
                Span-relative points resolve to real values per instrument from its measurement range.
              </p>
            </div>
            <Button size="small" icon={<Plus size={12} />} onClick={addPoint}>
              Add point
            </Button>
          </div>

          {points.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No point templates" className="py-4" />
          ) : (
            <Table<TplDraft>
              size="small"
              rowKey={(_, i) => String(i)}
              pagination={false}
              dataSource={points}
              columns={[
                { title: '#', width: 38, render: (_: unknown, __: TplDraft, i: number) => i + 1 },
                {
                  title: 'Label',
                  render: (_: unknown, r, i) => (
                    <Input
                      size="small"
                      value={r.label}
                      placeholder="50% of span"
                      onChange={(e) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                  ),
                },
                {
                  title: 'Basis',
                  width: 105,
                  render: (_: unknown, r, i) => (
                    <Select
                      size="small"
                      className="w-full"
                      value={r.nominal_percent_of_span !== null ? 'span' : 'abs'}
                      onChange={(v) =>
                        setPoints((p) =>
                          p.map((x, j) =>
                            j === i
                              ? v === 'span'
                                ? { ...x, nominal_percent_of_span: 50, nominal_value: null }
                                : { ...x, nominal_percent_of_span: null, nominal_value: 0 }
                              : x,
                          ),
                        )
                      }
                      options={[
                        { value: 'abs', label: 'Absolute' },
                        { value: 'span', label: '% of span' },
                      ]}
                    />
                  ),
                },
                {
                  title: 'Nominal',
                  width: 105,
                  render: (_: unknown, r, i) =>
                    r.nominal_percent_of_span !== null ? (
                      <InputNumber
                        size="small"
                        className="w-full"
                        min={0}
                        max={100}
                        addonAfter="%"
                        value={r.nominal_percent_of_span}
                        onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, nominal_percent_of_span: v ?? 0 } : x)))}
                      />
                    ) : (
                      <InputNumber
                        size="small"
                        className="w-full"
                        value={r.nominal_value ?? 0}
                        onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, nominal_value: v ?? 0 } : x)))}
                      />
                    ),
                },
                {
                  title: 'Tolerance type',
                  width: 140,
                  render: (_: unknown, r, i) => (
                    <Select
                      size="small"
                      className="w-full"
                      value={r.tolerance_type}
                      onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, tolerance_type: v } : x)))}
                      options={TOLERANCE_TYPES}
                    />
                  ),
                },
                {
                  title: '±',
                  width: 90,
                  render: (_: unknown, r, i) => (
                    <InputNumber
                      size="small"
                      className="w-full"
                      value={r.tolerance_value}
                      onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, tolerance_value: v ?? 0 } : x)))}
                    />
                  ),
                },
                {
                  title: '',
                  width: 38,
                  render: (_: unknown, __: TplDraft, i: number) => (
                    <Button size="small" danger icon={<Trash2 size={11} />} onClick={() => setPoints((p) => p.filter((_, j) => j !== i))} />
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </Drawer>
  );
}

function L({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
