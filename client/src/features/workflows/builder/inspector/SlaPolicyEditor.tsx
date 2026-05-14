/**
 * Builder-side SLA-policy editor.
 *
 * Modal that creates or updates the `SlaPolicy` attached to a single stage.
 * Threshold rows are edited in a sub-table — name + percentage are the
 * minimum required to fire `THRESHOLD_HIT` events; `notifyRoles`/`notifyUsers`
 * are deferred to a later iteration (the API accepts them but the inspector
 * keeps the surface narrow).
 *
 * On create the policy is POSTed with `parentStageId`; thresholds are pushed
 * in a second `useUpsertThresholds` call. Edits use the same two-call dance.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api';
import {
  slaKeys,
  useCreateSlaPolicy,
  useDeleteSlaPolicy,
  useSlaPoliciesForWorkflow,
  useUpdateSlaPolicy,
} from '@/lib/api/sla';
import { useCalendars } from '@/lib/api/businessCalendar';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  stageId: string;
  stageName: string;
}

interface ThresholdRow {
  id?: string;
  name: string;
  percentage: number;
}

export default function SlaPolicyEditor({
  isOpen,
  onClose,
  workflowId,
  stageId,
  stageName,
}: Props) {
  const { data: policies = [] } = useSlaPoliciesForWorkflow(workflowId);
  const existing = useMemo(
    () => policies.find((p) => p.parentStage.id === stageId),
    [policies, stageId],
  );

  const { data: calendars = [] } = useCalendars();

  const [durationHours, setDurationHours] = useState('24');
  const [calendarId, setCalendarId] = useState<string>('');
  const [pauseOnHold, setPauseOnHold] = useState(true);
  const [pauseOnExtensionPending, setPauseOnExtensionPending] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([
    { name: 'Warning', percentage: 80 },
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (existing) {
      setDurationHours(String(Math.round((existing.duration / 3600) * 100) / 100));
      setCalendarId(existing.calendarId ?? '');
      setPauseOnHold(existing.pauseOnHold);
      setPauseOnExtensionPending(existing.pauseOnExtensionPending);
      setThresholds(
        existing.thresholds.length > 0
          ? existing.thresholds.map((t) => ({
              id: t.id,
              name: t.name,
              percentage: t.percentage,
            }))
          : [],
      );
    } else {
      setDurationHours('24');
      setCalendarId('');
      setPauseOnHold(true);
      setPauseOnExtensionPending(false);
      setThresholds([{ name: 'Warning', percentage: 80 }]);
    }
  }, [isOpen, existing]);

  const create = useCreateSlaPolicy();
  const update = useUpdateSlaPolicy(existing?.id ?? '');
  const remove = useDeleteSlaPolicy();
  const qc = useQueryClient();

  const submit = async () => {
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

    try {
      const payload = {
        duration: Math.round(hours * 3600),
        calendarId: calendarId || null,
        pauseOnHold,
        pauseOnExtensionPending,
      };
      const policy = existing
        ? await update.mutateAsync(payload)
        : await create.mutateAsync({ parentStageId: stageId, ...payload });

      // Upsert thresholds against the now-known policy id. POST directly via
      // the api singleton — the `useUpsertThresholds` hook would need an id
      // bound at component-mount time, but for the create path we only learn
      // the policy id after the create call.
      await api.post(`/sla-policies/${policy.id}/thresholds`, {
        thresholds: thresholds.map((t) => ({
          name: t.name.trim(),
          percentage: t.percentage,
        })),
      });
      qc.invalidateQueries({ queryKey: slaKeys.all });

      toast.success(existing ? 'SLA policy updated' : 'SLA policy created');
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to save policy';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Remove the SLA for this stage? Active timers keep running.'))
      return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success('SLA policy removed');
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to delete';
      toast.error(msg);
    }
  };

  const isSubmitting = create.isPending || update.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${existing ? 'Edit' : 'Add'} SLA — ${stageName}`}>
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
                No thresholds — only the final breach event will fire.
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

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          {existing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              isLoading={remove.isPending}
              disabled={remove.isPending || isSubmitting}
            >
              <Trash2 size={14} className="text-red-500" />
              <span className="ml-1 text-red-600">Remove SLA</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              {existing ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
