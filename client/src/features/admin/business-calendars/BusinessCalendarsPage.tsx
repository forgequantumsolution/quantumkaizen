/**
 * Admin page: list, create, edit, delete BusinessCalendars.
 *
 * Calendars define the working-hours window used by SLA timers — `Mon 09:00
 * to 17:00`, holidays, and the timezone everything resolves in. Deletion is
 * soft, but the backend returns `{ affectedPolicies: N }` when one or more
 * SlaPolicies still point at the calendar so we can warn before confirming.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Modal, Spinner } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { useAuthStore } from '@/stores/authStore';
import {
  useCalendars,
  useCreateCalendar,
  useDeleteCalendar,
  useUpdateCalendar,
  type BusinessCalendar,
  type WeekDay,
  type WeeklySchedule,
} from '@/lib/api/businessCalendar';

const WEEKDAYS: { key: WeekDay; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const DEFAULT_HOURS = { start: '09:00', end: '17:00' };

const defaultSchedule = (): WeeklySchedule => ({
  mon: DEFAULT_HOURS,
  tue: DEFAULT_HOURS,
  wed: DEFAULT_HOURS,
  thu: DEFAULT_HOURS,
  fri: DEFAULT_HOURS,
  sat: null,
  sun: null,
});

const errorMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

const summarizeSchedule = (s: WeeklySchedule): string => {
  const days = WEEKDAYS.filter((d) => s[d.key]).map((d) => d.label);
  if (days.length === 0) return 'No working days';
  return `${days.join(', ')}`;
};

interface FormState {
  name: string;
  timezone: string;
  weeklySchedule: WeeklySchedule;
  holidays: string;
  isActive: boolean;
}

const buildInitial = (cal: BusinessCalendar | null): FormState =>
  cal
    ? {
        name: cal.name,
        timezone: cal.timezone,
        weeklySchedule: { ...defaultSchedule(), ...cal.weeklySchedule },
        holidays: cal.holidays.join('\n'),
        isActive: cal.isActive,
      }
    : {
        name: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weeklySchedule: defaultSchedule(),
        holidays: '',
        isActive: true,
      };

interface FormProps {
  isOpen: boolean;
  onClose: () => void;
  editing: BusinessCalendar | null;
}

function CalendarForm({ isOpen, onClose, editing }: FormProps) {
  const [form, setForm] = useState<FormState>(() => buildInitial(editing));
  const create = useCreateCalendar();
  const update = useUpdateCalendar(editing?.id ?? '');

  useEffect(() => {
    if (isOpen) setForm(buildInitial(editing));
  }, [isOpen, editing]);

  const setDayEnabled = (day: WeekDay, enabled: boolean) => {
    setForm((f) => ({
      ...f,
      weeklySchedule: {
        ...f.weeklySchedule,
        [day]: enabled ? DEFAULT_HOURS : null,
      },
    }));
  };

  const setDayHours = (day: WeekDay, field: 'start' | 'end', value: string) => {
    setForm((f) => {
      const cur = f.weeklySchedule[day] ?? DEFAULT_HOURS;
      return {
        ...f,
        weeklySchedule: {
          ...f.weeklySchedule,
          [day]: { ...cur, [field]: value },
        },
      };
    });
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) return toast.error('Name is required');
    if (!form.timezone.trim()) return toast.error('Timezone is required');

    const holidays = form.holidays
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const h of holidays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) {
        return toast.error(`"${h}" is not a YYYY-MM-DD date`);
      }
    }

    try {
      const body = {
        name,
        timezone: form.timezone.trim(),
        weeklySchedule: form.weeklySchedule,
        holidays,
        isActive: form.isActive,
      };
      if (editing) {
        await update.mutateAsync(body);
        toast.success('Calendar updated');
      } else {
        await create.mutateAsync(body);
        toast.success('Calendar created');
      }
      onClose();
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to save'));
    }
  };

  const isSubmitting = create.isPending || update.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit calendar' : 'New calendar'}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Standard EU Business Hours"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Timezone
            </label>
            <Input
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="e.g. Europe/Berlin"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Working hours
          </label>
          <div className="space-y-1.5">
            {WEEKDAYS.map((d) => {
              const hours = form.weeklySchedule[d.key];
              const enabled = !!hours;
              return (
                <div key={d.key} className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-2 w-20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setDayEnabled(d.key, e.target.checked)}
                    />
                    <span>{d.label}</span>
                  </label>
                  {enabled ? (
                    <>
                      <Input
                        type="time"
                        value={hours.start}
                        onChange={(e) => setDayHours(d.key, 'start', e.target.value)}
                        className="w-28"
                      />
                      <span className="text-gray-400 text-xs">to</span>
                      <Input
                        type="time"
                        value={hours.end}
                        onChange={(e) => setDayHours(d.key, 'end', e.target.value)}
                        className="w-28"
                      />
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Day off</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Holidays
          </label>
          <textarea
            value={form.holidays}
            onChange={(e) => setForm((f) => ({ ...f, holidays: e.target.value }))}
            rows={3}
            className="w-full text-sm font-mono border border-gray-200 rounded px-2 py-1.5"
            placeholder="2026-12-25&#10;2026-01-01&#10;…"
          />
          <p className="text-xs text-gray-500 mt-1">
            One YYYY-MM-DD date per line (or space-separated).
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <span>Active (selectable in SLA policy editor)</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function BusinessCalendarsPage() {
  const [search, setSearch] = useState('');
  const filters = useMemo(
    () => ({ search: search.trim() || undefined, withPolicyCount: true }),
    [search],
  );
  const { data: calendars = [], isLoading } = useCalendars(filters);
  const remove = useDeleteCalendar();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BusinessCalendar | null>(null);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('business-calendar.create');
  const canUpdate = hasPermission('business-calendar.update');
  const canDelete = hasPermission('business-calendar.delete');

  const handleEdit = (cal: BusinessCalendar) => {
    setEditing(cal);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleDelete = async (cal: BusinessCalendar) => {
    const policyCount = cal.policyCount ?? 0;
    const warn =
      policyCount > 0
        ? `${policyCount} SLA polic${policyCount === 1 ? 'y' : 'ies'} reference this calendar and will be left without one. `
        : '';
    if (!confirm(`${warn}Delete "${cal.name}"?`)) return;
    try {
      const res = await remove.mutateAsync(cal.id);
      if (res.affectedPolicies > 0) {
        toast.success(
          `Calendar deleted (${res.affectedPolicies} polic${res.affectedPolicies === 1 ? 'y' : 'ies'} unlinked)`,
        );
      } else {
        toast.success('Calendar deleted');
      }
    } catch (err) {
      toast.error(errorMsg(err, 'Failed to delete'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Business Calendars"
        description="Working-hour windows used by SLA timers — when the clock counts, when it pauses."
        actions={
          canCreate ? (
            <Button variant="primary" onClick={handleCreate}>
              <Plus size={14} />
              <span className="ml-1">New calendar</span>
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : calendars.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500 text-center py-6">
              No calendars yet. SLA policies will fall back to 24/7 timing without one.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {calendars.map((cal) => (
              <Card key={cal.id} className="!p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {cal.name}
                      </h3>
                      {!cal.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      {cal.timezone} · {summarizeSchedule(cal.weeklySchedule)}
                      {cal.holidays.length > 0 && (
                        <> · {cal.holidays.length} holidays</>
                      )}
                    </div>
                    {typeof cal.policyCount === 'number' && cal.policyCount > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Used by {cal.policyCount} SLA polic
                        {cal.policyCount === 1 ? 'y' : 'ies'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(cal)}
                        aria-label="edit"
                      >
                        <Pencil size={14} />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cal)}
                        aria-label="delete"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CalendarForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        editing={editing}
      />
    </PageContainer>
  );
}
