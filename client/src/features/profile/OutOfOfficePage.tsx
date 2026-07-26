import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Plus, Trash2, UserCheck } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Card, Button, Input, Select, Textarea } from '@/components/ui';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useAuthStore } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import {
  useAvailability,
  useCreateAvailability,
  useDeleteAvailability,
  type AvailabilityWindow,
} from '@/lib/api/availability';

const extractMsg = (err: unknown) =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Something went wrong';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const coversNow = (w: AvailabilityWindow) => {
  const now = Date.now();
  return new Date(w.from).getTime() <= now && new Date(w.to).getTime() > now;
};

export default function OutOfOfficePage() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: windows = [], isLoading } = useAvailability(userId);
  const { data: directory } = useUserDirectory();
  const create = useCreateAvailability(userId ?? '');
  const del = useDeleteAvailability(userId ?? '');
  const confirmDelete = useConfirmDelete();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [delegateToId, setDelegateToId] = useState('');

  const delegates = useMemo(
    () => (directory?.items ?? []).filter((u) => u.id !== userId),
    [directory, userId],
  );

  const activeNow = windows.find(coversNow) ?? null;

  const submit = async () => {
    if (!from || !to) {
      toast.error('Pick a start and end time');
      return;
    }
    if (new Date(to) <= new Date(from)) {
      toast.error('End must be after start');
      return;
    }
    try {
      const res = await create.mutateAsync({
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        reason: reason.trim() || null,
        delegateToId: delegateToId || null,
      });
      if (res.reassigned > 0) {
        toast.success(
          `Out-of-office saved · ${res.reassigned} open ticket${res.reassigned === 1 ? '' : 's'} reassigned`,
        );
      } else {
        toast.success('Out-of-office saved');
      }
      setFrom('');
      setTo('');
      setReason('');
      setDelegateToId('');
    } catch (err) {
      toast.error(extractMsg(err));
    }
  };

  const remove = (w: AvailabilityWindow) =>
    confirmDelete({
      entityLabel: 'out-of-office window',
      name: `${fmt(w.from)} → ${fmt(w.to)}`,
      extraWarning: 'This does not bring back any tickets already reassigned.',
      mutate: () => del.mutateAsync(w.id),
      invalidateKey: ['user-availability', userId ?? ''],
      successMessage: 'Out-of-office window removed',
    });

  return (
    <PageContainer>
      <PageHeader
        title="Out of Office"
        description="Mark periods when you're unavailable. While a window is active, tickets that would escalate to you skip to your delegate or manager, and your open tickets are handed over automatically."
      />

      {activeNow && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <CalendarClock size={16} />
          You are currently marked out of office until <strong>{fmt(activeNow.to)}</strong>
          {activeNow.delegateTo ? (
            <>
              {' '}· delegate: <strong>{activeNow.delegateTo.name}</strong>
            </>
          ) : null}
        </div>
      )}

      {/* Add window */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Schedule out of office</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="From"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Select
            label="Delegate (optional)"
            value={delegateToId}
            onChange={(e) => setDelegateToId(e.target.value)}
            placeholder="No delegate"
            options={[
              { value: '', label: 'No delegate' },
              ...delegates.map((u) => ({
                value: u.id,
                label: u.isAvailable ? u.name : `${u.name} (out of office)`,
              })),
            ]}
          />
          <Textarea
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Annual leave, training, …"
            rows={1}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={submit} disabled={create.isPending}>
            <Plus size={15} />
            <span className="ml-1">{create.isPending ? 'Saving…' : 'Add window'}</span>
          </Button>
        </div>
      </Card>

      {/* Existing windows */}
      <Card noPadding className="overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Scheduled windows</h3>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-gray-400">Loading…</div>
        ) : windows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-400">No out-of-office windows scheduled.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {windows.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={
                    coversNow(w)
                      ? 'flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700'
                      : 'flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500'
                  }
                >
                  <CalendarClock size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {fmt(w.from)} → {fmt(w.to)}
                    {coversNow(w) && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Active now
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    {w.reason && <span>{w.reason}</span>}
                    {w.delegateTo && (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck size={12} /> {w.delegateTo.name}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(w)}
                  className="rounded p-1 text-gray-400 hover:text-red-600"
                  title="Remove window"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
