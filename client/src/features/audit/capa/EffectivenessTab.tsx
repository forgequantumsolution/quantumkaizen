import { useEffect, useState } from 'react';
import { message } from 'antd';
import { Card, Button, Textarea } from '@/components/ui';
import { useUpdateCapa, type Capa } from '@/lib/api/audit';
import {
  parseEffectivenessData,
  type CheckInStatus,
  type EffectivenessData,
} from './capaData';

const STATUS_STYLES: Record<CheckInStatus, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  fail: 'bg-red-50 text-red-700 border-red-300',
};
const OPTIONS: CheckInStatus[] = ['pending', 'pass', 'fail'];

export default function EffectivenessTab({
  capa,
  canEdit,
  mirrored = false,
}: {
  capa: Capa;
  canEdit: boolean;
  mirrored?: boolean;
}) {
  const updateMut = useUpdateCapa(capa.id);
  const [data, setData] = useState<EffectivenessData>(() =>
    parseEffectivenessData(capa.effectiveness_data),
  );

  useEffect(() => setData(parseEffectivenessData(capa.effectiveness_data)), [capa]);

  const setStatus = (idx: number, status: CheckInStatus) =>
    setData((p) => ({
      ...p,
      checkIns: p.checkIns.map((c, i) => (i === idx ? { ...c, status } : c)),
    }));
  const setNotes = (idx: number, notes: string) =>
    setData((p) => ({
      ...p,
      checkIns: p.checkIns.map((c, i) => (i === idx ? { ...c, notes } : c)),
    }));

  const save = async () => {
    try {
      await updateMut.mutateAsync({ effectiveness_data: data as unknown });
      message.success('Effectiveness check-ins saved');
    } catch {
      message.error('Failed to save');
    }
  };

  return (
    <div className="space-y-4">
      {mirrored && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700">
          Mirrored from the workflow&apos;s{' '}
          <span className="font-medium">Effectiveness Verification</span> stage form — edit it under
          the <span className="font-medium">Stage Forms</span> tab.
        </div>
      )}
      <p className="text-sm text-gray-500">
        Verify that corrective actions remain effective over time. Each check-in assesses whether the
        root cause has been eliminated.
      </p>
      {data.checkIns.map((c, idx) => (
        <Card key={c.day}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {c.day}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {c.day === 90 ? '90-Day Verification' : `${c.day}-Day Check-in`}
              </span>
            </div>
            <div className="flex gap-1">
              {OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setStatus(idx, opt)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    c.status === opt
                      ? STATUS_STYLES[opt]
                      : 'border-transparent text-gray-400 hover:bg-gray-50'
                  } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            rows={2}
            value={c.notes}
            disabled={!canEdit}
            placeholder="Notes on effectiveness verification…"
            onChange={(e) => setNotes(idx, e.target.value)}
          />
        </Card>
      ))}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} isLoading={updateMut.isPending}>
            Save check-ins
          </Button>
        </div>
      )}
    </div>
  );
}
