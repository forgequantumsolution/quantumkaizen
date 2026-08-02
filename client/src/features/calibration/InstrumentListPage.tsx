import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Drawer, Input, InputNumber, Select, Space, Switch, Table, Tag } from 'antd';
import { Ruler, Plus, Search, Edit3, Trash2, QrCode, Link2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import CalibrationPageHeader from './CalibrationPageHeader';
import {
  useInstruments,
  useCategories,
  useCreateInstrument,
  useUpdateInstrument,
  useDeleteInstrument,
  useLimsEquipmentSearch,
  STATUS_BADGE,
  CRITICALITY_BADGE,
  KIND_LABELS,
  fmtDate,
  type Instrument,
  type InstrumentKind,
  type InstrumentUpsert,
  type Criticality,
} from '@/lib/api/calibration';

const KINDS = Object.keys(KIND_LABELS) as InstrumentKind[];
const CRITICALITIES: Criticality[] = ['CRITICAL', 'MAJOR', 'MINOR', 'INDICATIVE'];

export default function InstrumentListPage() {
  const nav = useNavigate();
  const { modal, message } = App.useApp();
  const [params, setParams] = useSearchParams();

  const canCreate = useHasPermission('calibration_instrument.create');
  const canUpdate = useHasPermission('calibration_instrument.update');
  const canDelete = useHasPermission('calibration_instrument.delete');

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<InstrumentKind | undefined>();
  const [status, setStatus] = useState<string | undefined>(params.get('status') ?? undefined);
  const [dueOnly, setDueOnly] = useState(false);

  useEffect(() => {
    const s = params.get('status');
    if (s) setStatus(s);
  }, [params]);

  const { data, isLoading } = useInstruments({
    search: search || undefined,
    kind,
    calibration_status: status,
    due_within: dueOnly ? 30 : undefined,
  });
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const del = useDeleteInstrument();

  const onDelete = (i: Instrument) =>
    modal.confirm({
      title: `Delete ${i.code}?`,
      content: 'Only instruments with no calibration history can be deleted. Otherwise retire them instead.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await del.mutateAsync(i.id);
          message.success('Instrument deleted');
        } catch (e) {
          message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
        }
      },
    });

  const clearStatus = () => {
    setStatus(undefined);
    params.delete('status');
    setParams(params, { replace: true });
  };

  return (
    <PageContainer>
      <CalibrationPageHeader
        title="Instruments"
        icon={Ruler}
        actions={
          <>
            <Select
              allowClear
              placeholder="Kind"
              value={kind}
              onChange={setKind}
              style={{ width: 160 }}
              options={KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            />
            <Select
              allowClear
              placeholder="Status"
              value={status}
              onChange={(v) => (v ? setStatus(v) : clearStatus())}
              style={{ width: 150 }}
              options={Object.entries(STATUS_BADGE).map(([k, v]) => ({ value: k, label: v.label }))}
            />
            <Button type={dueOnly ? 'primary' : 'default'} onClick={() => setDueOnly((v) => !v)}>
              Due in 30 days
            </Button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <Input
                placeholder="Code / name / serial…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                style={{ width: 220 }}
              />
            </div>
            {canCreate && (
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                New Instrument
              </Button>
            )}
          </>
        }
      />

      <Table<Instrument>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 25, showSizeChanger: false, showTotal: (t) => `${t} instrument(s)` }}
        onRow={(r) => ({ onClick: () => nav(`/calibration/instruments/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Code',
            dataIndex: 'code',
            width: 110,
            render: (v: string) => <span className="font-mono text-blue-600 text-xs">{v}</span>,
          },
          {
            title: 'Instrument',
            ellipsis: true,
            render: (_: unknown, r) => (
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">{r.name}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {[r.manufacturer, r.model, r.serial_no].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            ),
          },
          {
            title: 'Category',
            width: 150,
            ellipsis: true,
            render: (_: unknown, r) => <span className="text-xs">{r.category_name ?? '—'}</span>,
          },
          { title: 'Location', dataIndex: 'location', width: 150, ellipsis: true, render: (v: string | null) => <span className="text-xs">{v ?? '—'}</span> },
          {
            title: 'Criticality',
            width: 100,
            render: (_: unknown, r) => (
              <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded border ${CRITICALITY_BADGE[r.criticality]}`}>
                {r.criticality}
              </span>
            ),
          },
          {
            title: 'Status',
            width: 145,
            render: (_: unknown, r) => {
              const b = STATUS_BADGE[r.calibration_status];
              return (
                <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border ${b.cls}`}>{b.label}</span>
              );
            },
          },
          {
            title: 'Next due',
            width: 130,
            render: (_: unknown, r) => {
              if (!r.calibration_due_at) return <span className="text-xs text-gray-400">—</span>;
              const d = r.days_until_due;
              const overdue = d !== null && d < 0;
              return (
                <div>
                  <div className={`text-xs ${overdue ? 'text-red-600 font-semibold' : ''}`}>{fmtDate(r.calibration_due_at)}</div>
                  {d !== null && (
                    <div className="text-[10px] text-gray-400">{overdue ? `${-d}d overdue` : `in ${d}d`}</div>
                  )}
                </div>
              );
            },
          },
          {
            title: '',
            width: 80,
            render: (_: unknown, r) => (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                {canUpdate && (
                  <Button
                    size="small"
                    icon={<Edit3 size={12} />}
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  />
                )}
                {canDelete && <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => onDelete(r)} />}
              </Space>
            ),
          },
        ]}
      />

      <InstrumentDrawer open={open} onClose={() => setOpen(false)} instrument={editing} />
    </PageContainer>
  );
}

function InstrumentDrawer({
  open,
  onClose,
  instrument,
}: {
  open: boolean;
  onClose: () => void;
  instrument: Instrument | null;
}) {
  const { message } = App.useApp();
  const { data: cats } = useCategories();
  const create = useCreateInstrument();
  const update = useUpdateInstrument(instrument?.id ?? '');

  const blank: InstrumentUpsert = { name: '', kind: 'LAB_INSTRUMENT', criticality: 'MAJOR' };
  const [form, setForm] = useState<InstrumentUpsert>(blank);
  const [limsQuery, setLimsQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(
      instrument
        ? {
            name: instrument.name,
            kind: instrument.kind,
            category_id: instrument.category_id,
            lims_equipment_id: instrument.lims_equipment_id,
            lab_ref: instrument.lab_ref,
            serial_no: instrument.serial_no,
            manufacturer: instrument.manufacturer,
            model: instrument.model,
            location: instrument.location,
            asset_tag: instrument.asset_tag,
            criticality: instrument.criticality,
            is_calibration_required: instrument.is_calibration_required,
            exemption_reason: instrument.exemption_reason,
            measurement_range_min: instrument.measurement_range_min,
            measurement_range_max: instrument.measurement_range_max,
            unit_code: instrument.unit_code,
            resolution: instrument.resolution,
            accuracy_class: instrument.accuracy_class,
            mpe: instrument.mpe,
          }
        : blank,
    );
  }, [open, instrument]);

  // Only ask the backend about LIMS when the user is actually looking for it.
  const { data: lims } = useLimsEquipmentSearch(limsQuery, open && limsQuery.length > 0);

  const set = <K extends keyof InstrumentUpsert>(k: K, v: InstrumentUpsert[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return message.warning('Name is required');
    if (form.is_calibration_required === false && !form.exemption_reason?.trim()) {
      return message.warning('An exemption reason is required when calibration is not required');
    }
    try {
      if (instrument) await update.mutateAsync(form);
      else await create.mutateAsync(form);
      message.success(instrument ? 'Instrument updated' : 'Instrument registered');
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save');
    }
  };

  const catOptions = useMemo(
    () => (cats?.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${KIND_LABELS[c.kind]})` })),
    [cats],
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={instrument ? `Edit ${instrument.code}` : 'Register instrument'}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={create.isPending || update.isPending} onClick={save}>
            Save
          </Button>
        </Space>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Analytical Balance — QC Lab" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select
              value={form.kind}
              onChange={(v) => set('kind', v)}
              className="w-full"
              options={KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            />
          </Field>
          <Field label="Criticality">
            <Select
              value={form.criticality}
              onChange={(v) => set('criticality', v)}
              className="w-full"
              options={CRITICALITIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </div>

        <Field label="Category" hint="Supplies default interval, tolerance template and check frequency.">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={form.category_id ?? undefined}
            onChange={(v) => set('category_id', v ?? null)}
            className="w-full"
            options={catOptions}
            placeholder="Select a category"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Manufacturer">
            <Input value={form.manufacturer ?? ''} onChange={(e) => set('manufacturer', e.target.value)} />
          </Field>
          <Field label="Model">
            <Input value={form.model ?? ''} onChange={(e) => set('model', e.target.value)} />
          </Field>
          <Field label="Serial no.">
            <Input value={form.serial_no ?? ''} onChange={(e) => set('serial_no', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <Input value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="QC Lab / Bench 3" />
          </Field>
          <Field label="Asset tag">
            <Input value={form.asset_tag ?? ''} onChange={(e) => set('asset_tag', e.target.value)} />
          </Field>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Metrology</h3>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Range min">
              <InputNumber
                value={form.measurement_range_min ?? undefined}
                onChange={(v) => set('measurement_range_min', v ?? null)}
                className="w-full"
              />
            </Field>
            <Field label="Range max">
              <InputNumber
                value={form.measurement_range_max ?? undefined}
                onChange={(v) => set('measurement_range_max', v ?? null)}
                className="w-full"
              />
            </Field>
            <Field label="Unit">
              <Input value={form.unit_code ?? ''} onChange={(e) => set('unit_code', e.target.value)} placeholder="g" />
            </Field>
            <Field label="Resolution">
              <InputNumber value={form.resolution ?? undefined} onChange={(v) => set('resolution', v ?? null)} className="w-full" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Accuracy class">
              <Input value={form.accuracy_class ?? ''} onChange={(e) => set('accuracy_class', e.target.value)} placeholder="Class II / ±0.5% FS" />
            </Field>
            <Field label="MPE" hint="Maximum permissible error.">
              <InputNumber value={form.mpe ?? undefined} onChange={(v) => set('mpe', v ?? null)} className="w-full" />
            </Field>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Link2 size={12} /> LIMS link
            <Tag className="!text-[9px] !leading-4 !ml-1">optional</Tag>
          </h3>
          <p className="text-[11px] text-gray-500 mb-2">
            Linking an instrument to its LIMS equipment record lets an out-of-tolerance impact scan reach LIMS results.
            Leave blank if you do not run LIMS — the module works either way.
          </p>
          <Select
            allowClear
            showSearch
            className="w-full"
            placeholder="Search LIMS equipment…"
            value={form.lims_equipment_id ?? undefined}
            onSearch={setLimsQuery}
            onChange={(v) => set('lims_equipment_id', v ?? null)}
            filterOption={false}
            notFoundContent={
              lims && !lims.available ? (
                <span className="text-[11px] text-gray-400 px-2">{lims.reason}</span>
              ) : undefined
            }
            options={(lims?.data ?? []).map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))}
          />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Calibration required</div>
              <div className="text-[11px] text-gray-500">Turn off only for indicative-use devices, with justification.</div>
            </div>
            <Switch
              checked={form.is_calibration_required !== false}
              onChange={(v) => set('is_calibration_required', v)}
            />
          </div>
          {form.is_calibration_required === false && (
            <div className="mt-2">
              <Input.TextArea
                rows={2}
                value={form.exemption_reason ?? ''}
                onChange={(e) => set('exemption_reason', e.target.value)}
                placeholder="Why is this instrument exempt from calibration?"
              />
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

export { QrCode };
