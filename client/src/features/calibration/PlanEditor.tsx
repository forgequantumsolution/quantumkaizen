import { useEffect, useState } from 'react';
import { App, Alert, Button, Empty, Input, InputNumber, Select, Space, Table, Tag } from 'antd';
import { Plus, Trash2, Wand2, Save } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import {
  useCreatePlan,
  useSupersedePlan,
  usePlanSuggestion,
  useProviders,
  fmtDate,
  type Plan,
  type PlanUpsert,
  type ToleranceType,
  type IntervalType,
  type ProviderType,
} from '@/lib/api/calibration';

const TOLERANCE_TYPES: { value: ToleranceType; label: string }[] = [
  { value: 'ABSOLUTE', label: 'Absolute (±)' },
  { value: 'PERCENT_OF_READING', label: '% of reading' },
  { value: 'PERCENT_OF_SPAN', label: '% of span' },
  { value: 'MPE_MULTIPLE', label: '× MPE' },
];

const INTERVAL_TYPES: { value: IntervalType; label: string }[] = [
  { value: 'DAYS', label: 'Days' },
  { value: 'MONTHS', label: 'Months' },
];

interface DraftPoint {
  sequence: number;
  label: string;
  nominal_value: number;
  unit_code: string | null;
  tolerance_type: ToleranceType;
  tolerance_value: number;
}

/** Client-side preview of the limits the backend will compute and store. */
const previewLimits = (p: DraftPoint): [number, number] => {
  let half: number;
  switch (p.tolerance_type) {
    case 'PERCENT_OF_READING':
      half = Math.abs((p.nominal_value * p.tolerance_value) / 100);
      break;
    case 'PERCENT_OF_SPAN':
    case 'MPE_MULTIPLE':
      // Both need instrument context the server owns; show the absolute
      // fallback rather than a confidently wrong number.
      half = Math.abs(p.tolerance_value);
      break;
    default:
      half = Math.abs(p.tolerance_value);
  }
  return [Number((p.nominal_value - half).toFixed(6)), Number((p.nominal_value + half).toFixed(6))];
};

export default function PlanEditor({ instrumentId, plans }: { instrumentId: string; plans: Plan[] }) {
  const { message } = App.useApp();
  const canCreate = useHasPermission('calibration_plan.create');
  const canUpdate = useHasPermission('calibration_plan.update');

  const active = plans.find((p) => p.is_active) ?? null;
  const history = plans.filter((p) => !p.is_active);

  const [editing, setEditing] = useState(false);
  const [intervalType, setIntervalType] = useState<IntervalType>('DAYS');
  const [intervalValue, setIntervalValue] = useState(365);
  const [justification, setJustification] = useState('');
  const [providerType, setProviderType] = useState<ProviderType>('INTERNAL');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [methodRef, setMethodRef] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [points, setPoints] = useState<DraftPoint[]>([]);

  const { data: providers } = useProviders();
  const { data: suggestion, refetch: fetchSuggestion } = usePlanSuggestion(instrumentId, false);

  const create = useCreatePlan(instrumentId);
  const supersede = useSupersedePlan(active?.id ?? '');

  useEffect(() => {
    if (!editing) return;
    if (active) {
      setIntervalType(active.interval_type === 'MONTHS' ? 'MONTHS' : 'DAYS');
      setIntervalValue(active.interval_value);
      setJustification(active.interval_justification ?? '');
      setProviderType(active.provider_type);
      setProviderId(active.provider_id);
      setMethodRef(active.method_ref ?? '');
      setPoints(
        active.points.map((p) => ({
          sequence: p.sequence,
          label: p.label,
          nominal_value: p.nominal_value,
          unit_code: p.unit_code,
          tolerance_type: p.tolerance_type,
          tolerance_value: p.tolerance_value,
        })),
      );
    }
  }, [editing, active]);

  const applySuggestion = async () => {
    const res = await fetchSuggestion();
    const s = res.data;
    if (!s?.available) {
      message.info(s?.reason ?? 'No category template available for this instrument');
      return;
    }
    setIntervalValue(s.interval_value ?? 365);
    setIntervalType('DAYS');
    setPoints(
      s.points.map((p) => ({
        sequence: p.sequence,
        label: p.label,
        nominal_value: p.nominal_value,
        unit_code: p.unit_code,
        tolerance_type: p.tolerance_type,
        tolerance_value: p.tolerance_value,
      })),
    );
    message.success(`${s.points.length} point(s) loaded from ${s.category_name ?? 'the category'} template`);
  };

  const save = async () => {
    if (points.length === 0) return message.warning('Add at least one calibration point');
    if (points.some((p) => !p.label.trim())) return message.warning('Every point needs a label');

    const body: PlanUpsert = {
      interval_type: intervalType,
      interval_value: intervalValue,
      interval_justification: justification || null,
      method_ref: methodRef || null,
      provider_type: providerType,
      provider_id: providerId,
      points: points.map((p, i) => ({ ...p, sequence: i + 1 })),
      change_reason: changeReason || null,
    };

    try {
      if (active) await supersede.mutateAsync(body);
      else await create.mutateAsync(body);
      message.success(active ? `Plan superseded — now v${active.version + 1}` : 'Plan created');
      setEditing(false);
      setChangeReason('');
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save plan');
    }
  };

  if (!editing) {
    return (
      <div>
        {!active ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No calibration plan yet"
            className="py-8"
          >
            {canCreate && (
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setEditing(true)}>
                Create plan
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Tag color="blue">v{active.version}</Tag>
                <span className="text-sm text-gray-700">
                  Every <strong>{active.interval_value}</strong> {active.interval_type.toLowerCase()} ·{' '}
                  {active.provider_type.toLowerCase()} · next due {fmtDate(active.next_due_at)}
                </span>
              </div>
              {canUpdate && (
                <Button icon={<Plus size={14} />} onClick={() => setEditing(true)}>
                  Revise plan (new version)
                </Button>
              )}
            </div>

            {active.interval_justification && (
              <Alert type="info" className="mb-3" message="Interval justification" description={active.interval_justification} />
            )}

            <Table
              size="small"
              rowKey="sequence"
              pagination={false}
              dataSource={active.points}
              columns={[
                { title: '#', dataIndex: 'sequence', width: 45 },
                { title: 'Point', dataIndex: 'label', ellipsis: true },
                {
                  title: 'Nominal',
                  width: 130,
                  align: 'right' as const,
                  render: (_: unknown, r) => (
                    <span className="font-mono text-xs">
                      {r.nominal_value} {r.unit_code ?? ''}
                    </span>
                  ),
                },
                {
                  title: 'Tolerance',
                  width: 150,
                  render: (_: unknown, r) => (
                    <span className="text-xs">
                      ±{r.tolerance_value} {TOLERANCE_TYPES.find((t) => t.value === r.tolerance_type)?.label ?? ''}
                    </span>
                  ),
                },
                {
                  title: 'Limits',
                  width: 190,
                  align: 'right' as const,
                  render: (_: unknown, r) => (
                    <span className="font-mono text-xs text-gray-600">
                      {r.lower_limit} … {r.upper_limit}
                    </span>
                  ),
                },
              ]}
            />

            {history.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Superseded versions</h3>
                <p className="text-[11px] text-gray-500 mb-2">
                  Kept so any certificate issued under an older version stays reproducible.
                </p>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={history}
                  columns={[
                    { title: 'Version', width: 80, render: (_: unknown, r) => <Tag>v{r.version}</Tag> },
                    { title: 'Interval', width: 140, render: (_: unknown, r) => `${r.interval_value} ${r.interval_type.toLowerCase()}` },
                    { title: 'Points', width: 70, render: (_: unknown, r) => r.points.length },
                    { title: 'Created', width: 120, render: (_: unknown, r) => fmtDate(r.created_at) },
                    { title: 'Justification', ellipsis: true, render: (_: unknown, r) => <span className="text-xs">{r.interval_justification ?? '—'}</span> },
                  ]}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message={active ? `Revising plan v${active.version}` : 'New calibration plan'}
        description={
          active
            ? 'Saving creates a new version. The current one is kept, so past certificates remain reproducible against the criteria they were issued under.'
            : 'Define the interval and the points this instrument will be judged against.'
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Interval</label>
          <Space.Compact className="w-full">
            <InputNumber min={1} value={intervalValue} onChange={(v) => setIntervalValue(v ?? 1)} className="w-full" />
            <Select value={intervalType} onChange={setIntervalType} options={INTERVAL_TYPES} style={{ width: 110 }} />
          </Space.Compact>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Provider</label>
          <Select
            value={providerType}
            onChange={setProviderType}
            className="w-full"
            options={[
              { value: 'INTERNAL', label: 'Internal' },
              { value: 'EXTERNAL', label: 'External agency' },
              { value: 'MANUFACTURER', label: 'Manufacturer' },
            ]}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Agency</label>
          <Select
            allowClear
            disabled={providerType === 'INTERNAL'}
            value={providerId ?? undefined}
            onChange={(v) => setProviderId(v ?? null)}
            className="w-full"
            placeholder="Select provider"
            options={(providers?.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Method / SOP ref</label>
          <Input value={methodRef} onChange={(e) => setMethodRef(e.target.value)} placeholder="SOP-QC-014" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
          Interval justification
          <span className="text-gray-400 font-normal ml-1">— why this interval, not a longer one?</span>
        </label>
        <Input.TextArea
          rows={2}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Based on as-found drift over the trailing three cycles…"
        />
      </div>

      {active && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
            Reason for change<span className="text-red-500 ml-0.5">*</span>
            <span className="text-gray-400 font-normal ml-1">— required by GxP configurations</span>
          </label>
          <Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="Interval shortened following OOT finding…" />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Calibration points</h3>
          <Space>
            <Button size="small" icon={<Wand2 size={12} />} onClick={applySuggestion}>
              Load from category template
            </Button>
            <Button
              size="small"
              icon={<Plus size={12} />}
              onClick={() =>
                setPoints((p) => [
                  ...p,
                  { sequence: p.length + 1, label: '', nominal_value: 0, unit_code: null, tolerance_type: 'ABSOLUTE', tolerance_value: 0 },
                ])
              }
            >
              Add point
            </Button>
          </Space>
        </div>

        {points.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No points — load a template or add one" className="py-6" />
        ) : (
          <Table<DraftPoint>
            size="small"
            rowKey={(_, i) => String(i)}
            pagination={false}
            dataSource={points}
            columns={[
              { title: '#', width: 40, render: (_: unknown, __: DraftPoint, i: number) => i + 1 },
              {
                title: 'Label',
                render: (_: unknown, r, i) => (
                  <Input
                    size="small"
                    value={r.label}
                    onChange={(e) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="50% of span"
                  />
                ),
              },
              {
                title: 'Nominal',
                width: 120,
                render: (_: unknown, r, i) => (
                  <InputNumber
                    size="small"
                    value={r.nominal_value}
                    onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, nominal_value: v ?? 0 } : x)))}
                    className="w-full"
                  />
                ),
              },
              {
                title: 'Unit',
                width: 80,
                render: (_: unknown, r, i) => (
                  <Input
                    size="small"
                    value={r.unit_code ?? ''}
                    onChange={(e) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, unit_code: e.target.value } : x)))}
                  />
                ),
              },
              {
                title: 'Tolerance type',
                width: 150,
                render: (_: unknown, r, i) => (
                  <Select
                    size="small"
                    value={r.tolerance_type}
                    onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, tolerance_type: v } : x)))}
                    className="w-full"
                    options={TOLERANCE_TYPES}
                  />
                ),
              },
              {
                title: '±',
                width: 100,
                render: (_: unknown, r, i) => (
                  <InputNumber
                    size="small"
                    value={r.tolerance_value}
                    onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? { ...x, tolerance_value: v ?? 0 } : x)))}
                    className="w-full"
                  />
                ),
              },
              {
                title: 'Limits (preview)',
                width: 170,
                align: 'right' as const,
                render: (_: unknown, r) => {
                  const [lo, hi] = previewLimits(r);
                  return (
                    <span className="font-mono text-[11px] text-gray-500">
                      {lo} … {hi}
                    </span>
                  );
                },
              },
              {
                title: '',
                width: 40,
                render: (_: unknown, __: DraftPoint, i: number) => (
                  <Button size="small" danger icon={<Trash2 size={11} />} onClick={() => setPoints((p) => p.filter((_, j) => j !== i))} />
                ),
              },
            ]}
          />
        )}
      </div>

      <Space>
        <Button
          type="primary"
          icon={<Save size={14} />}
          loading={create.isPending || supersede.isPending}
          onClick={save}
        >
          {active ? `Save as v${active.version + 1}` : 'Create plan'}
        </Button>
        <Button onClick={() => setEditing(false)}>Cancel</Button>
      </Space>
    </div>
  );
}
