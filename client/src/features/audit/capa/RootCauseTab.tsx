import { useEffect, useState } from 'react';
import { message } from 'antd';
import { Card, Button, Textarea } from '@/components/ui';
import { useUpdateCapa, type Capa } from '@/lib/api/audit';
import {
  FISHBONE_CATEGORIES,
  parseRootCauseData,
  type FishboneCategory,
  type RootCauseData,
} from './capaData';
import Fishbone from './Fishbone';

const splitLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export default function RootCauseTab({
  capa,
  canEdit,
  mirrored = false,
}: {
  capa: Capa;
  canEdit: boolean;
  mirrored?: boolean;
}) {
  const updateMut = useUpdateCapa(capa.id);
  const [rc, setRc] = useState<RootCauseData>(() => parseRootCauseData(capa.root_cause_data));
  // Free-text fields kept alongside the structured analysis.
  const [corrective, setCorrective] = useState(capa.corrective_action ?? '');
  const [preventive, setPreventive] = useState(capa.preventive_action ?? '');

  useEffect(() => {
    setRc(parseRootCauseData(capa.root_cause_data));
    setCorrective(capa.corrective_action ?? '');
    setPreventive(capa.preventive_action ?? '');
  }, [capa]);

  const setWhy = (i: number, v: string) =>
    setRc((p) => ({ ...p, fiveWhys: p.fiveWhys.map((w, j) => (j === i ? v : w)) }));

  const setFishbone = (cat: FishboneCategory, text: string) =>
    setRc((p) => ({ ...p, fishbone: { ...p.fishbone, [cat]: splitLines(text) } }));

  const save = async () => {
    try {
      await updateMut.mutateAsync({
        root_cause_data: rc as unknown,
        root_cause: rc.conclusion || null,
        corrective_action: corrective || null,
        preventive_action: preventive || null,
      });
      message.success('Root cause analysis saved');
    } catch {
      message.error('Failed to save');
    }
  };

  return (
    <div className="space-y-4">
      {mirrored && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700">
          Mirrored from the workflow&apos;s <span className="font-medium">Root Cause Analysis</span>{' '}
          stage form — edit it under the <span className="font-medium">Stage Forms</span> tab.
        </div>
      )}
      {/* 5-Why */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">5-Why Analysis</h3>
        <div className="space-y-2">
          {rc.fiveWhys.map((w, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C9A84C]/15 text-xs font-semibold text-[#8A6C18]">
                {i + 1}
              </span>
              <Textarea
                rows={1}
                value={w}
                disabled={!canEdit}
                placeholder={i === 0 ? 'Why did the problem occur?' : 'Why did that happen?'}
                onChange={(e) => setWhy(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Fishbone */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Fishbone (Ishikawa) Diagram</h3>
        <Fishbone data={rc.fishbone} effect={capa.title} />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FISHBONE_CATEGORIES.map((cat) => (
            <div key={cat}>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {cat}
              </label>
              <Textarea
                rows={3}
                value={rc.fishbone[cat].join('\n')}
                disabled={!canEdit}
                placeholder="One cause per line"
                onChange={(e) => setFishbone(cat, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Conclusion + actions */}
      <Card>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Confirmed root cause
            </label>
            <Textarea
              rows={3}
              value={rc.conclusion}
              disabled={!canEdit}
              onChange={(e) => setRc((p) => ({ ...p, conclusion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Corrective action (fix the occurrence)
              </label>
              <Textarea
                rows={3}
                value={corrective}
                disabled={!canEdit}
                onChange={(e) => setCorrective(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Preventive action (stop recurrence)
              </label>
              <Textarea
                rows={3}
                value={preventive}
                disabled={!canEdit}
                onChange={(e) => setPreventive(e.target.value)}
              />
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={save} isLoading={updateMut.isPending}>
                Save analysis
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
