/**
 * Canvas-state SLA editor.
 *
 * Reads / writes a single `EmbeddedSla` object on the selected stage node.
 * No API calls — the SLA materialises as a `SlaPolicy` (+ `SlaThreshold` rows)
 * on Publish via workflow.builder.buildWorkflowGraph.
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { EmbeddedSla } from '../builder.types';
import { useCalendars } from '@/lib/api/businessCalendar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stageName: string;
  value: EmbeddedSla | null;
  onSave: (next: EmbeddedSla | null) => void;
}

interface ThresholdRow {
  name: string;
  percentage: number;
}

const DEFAULT_HOURS = '24';

export default function SlaPolicyEditor({
  isOpen,
  onClose,
  stageName,
  value,
  onSave,
}: Props) {
  const { data: calendars = [] } = useCalendars();

  const [durationHours, setDurationHours] = useState(DEFAULT_HOURS);
  const [calendarId, setCalendarId] = useState<string>('');
  const [pauseOnHold, setPauseOnHold] = useState(true);
  const [pauseOnExtensionPending, setPauseOnExtensionPending] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([
    { name: 'Warning', percentage: 80 },
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (value) {
      setDurationHours(String(Math.round((value.duration / 3600) * 100) / 100));
      setCalendarId(value.calendarId ?? '');
      setPauseOnHold(value.pauseOnHold);
      setPauseOnExtensionPending(value.pauseOnExtensionPending);
      setThresholds(
        value.thresholds.length > 0
          ? value.thresholds.map((t) => ({ name: t.name, percentage: t.percentage }))
          : [],
      );
    } else {
      setDurationHours(DEFAULT_HOURS);
      setCalendarId('');
      setPauseOnHold(true);
      setPauseOnExtensionPending(false);
      setThresholds([{ name: 'Warning', percentage: 80 }]);
    }
  }, [isOpen, value]);

  const handleSave = () => {
    const hours = Number(durationHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error('Duration must be a positive number of hours');
      return;
    }
    if (thresholds.some((t) => !t.name.trim())) {
      toast.error('Every threshold needs a name');
      return;
    }
    if (thresholds.some((t) => t.percentage < 1 || t.percentage > 100)) {
      toast.error('Threshold percentages must be 1–100');
      return;
    }

    onSave({
      duration: Math.round(hours * 3600),
      calendarId: calendarId || null,
      escalationWorkflowId: value?.escalationWorkflowId ?? null,
      pauseOnHold,
      pauseOnExtensionPending,
      thresholds: thresholds.map((t) => ({
        name: t.name.trim(),
        percentage: t.percentage,
        targetStageCanonicalId: null,
      })),
    });
    toast.success(value ? 'SLA updated' : 'SLA attached');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${value ? 'Edit' : 'Add'} SLA — ${stageName}`}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Duration (hours)
          </label>
          <Input
            type="number"
            min="0.25"
            step="0.25"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Total time a ticket has in this stage before breaching.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Business calendar
          </label>
          <Select
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            options={[
              { value: '', label: '24/7 (no calendar)' },
              ...calendars.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.timezone})`,
              })),
            ]}
          />
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pauseOnHold}
              onChange={(e) => setPauseOnHold(e.target.checked)}
            />
            <span>Pause when ticket is on hold</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pauseOnExtensionPending}
              onChange={(e) => setPauseOnExtensionPending(e.target.checked)}
            />
            <span>Pause while an extension request is pending</span>
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Thresholds
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setThresholds((arr) => [...arr, { name: '', percentage: 50 }])
              }
            >
              <Plus size={12} />
              <span className="ml-1">Add</span>
            </Button>
          </div>
          <div className="space-y-2">
            {thresholds.length === 0 && (
              <p className="text-xs text-gray-400 italic">
                No thresholds — only the breach event will fire.
              </p>
            )}
            {thresholds.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Name (e.g. Warning)"
                  value={t.name}
                  onChange={(e) =>
                    setThresholds((arr) =>
                      arr.map((x, idx) =>
                        idx === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  min="1"
                  max="100"
                  className="w-20"
                  value={t.percentage}
                  onChange={(e) =>
                    setThresholds((arr) =>
                      arr.map((x, idx) =>
                        idx === i ? { ...x, percentage: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <span className="text-xs text-gray-500">%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setThresholds((arr) => arr.filter((_, idx) => idx !== i))}
                  aria-label="remove threshold"
                >
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {value ? 'Save' : 'Attach'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
