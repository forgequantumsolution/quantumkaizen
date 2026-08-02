import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, CalendarClock, Check, ChevronDown, Globe, Mail, MapPin,
  Phone, Shield, ShieldCheck,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Badge, Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useLocaleStore } from '@/stores/localeStore';
import { SUPPORTED_LOCALES } from '@/i18n';
import { useAvailability } from '@/lib/api/availability';

/**
 * The authenticated user's own profile. Read-only by design: editing identity
 * fields (role, department, site, employee id) is an administrative,
 * audit-trailed action behind `user.update` — it lives in Settings → Users, not
 * here. What a user *can* change for themselves — display language and
 * out-of-office windows — is actionable from this page.
 */

// `/auth/me` carries fields the persisted auth store trims away (designation,
// first/last name, joined date), so the page reads from it and falls back to
// the store while it loads.
interface MeResponse {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  employeeId: string | null;
  designation: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  site: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
  role: { id: string; name: string } | null;
  permissions: string[];
}

const useMe = () =>
  useQuery<MeResponse>({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.user),
    staleTime: 60_000,
  });

const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: 'Admin',
  QUALITY_MANAGER: 'QA Manager',
  QUALITY_ENGINEER: 'QA Engineer',
  REGULATORY_AFFAIRS: 'Reg. Affairs',
  LAB_ANALYST: 'Lab Analyst',
  PRODUCTION_OPERATOR: 'Production',
  READ_ONLY: 'Read Only',
  SUPER_ADMIN: 'Super Admin',
};

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

function Field({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xxs font-medium uppercase tracking-wide text-ink-tertiary">{label}</dt>
      <dd className="mt-1 flex items-center gap-1.5 text-sm text-ink">
        {icon && <span className="shrink-0 text-ink-tertiary">{icon}</span>}
        <span className="truncate">{value || '—'}</span>
      </dd>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const storeUser = useAuthStore((s) => s.user);
  const { locale, setLocale } = useLocaleStore();
  const { data: me, isLoading } = useMe();
  const { data: windows = [] } = useAvailability(storeUser?.id);
  const [showPerms, setShowPerms] = useState(false);

  const name = me?.name ?? storeUser?.name ?? '—';
  const email = me?.email ?? storeUser?.email ?? '—';
  const avatarUrl = me?.avatarUrl ?? storeUser?.avatarUrl ?? null;
  const roleKey = me?.role?.name ?? storeUser?.role ?? '';
  const roleLabel = ROLE_LABELS[roleKey] ?? roleKey.replace(/_/g, ' ');
  const permissions = me?.permissions ?? storeUser?.permissions ?? [];
  const allowedSites = storeUser?.allowedSites ?? [];

  const initials =
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'QK';

  // An out-of-office window covering right now — surfaced here because it
  // silently changes where the user's work is routed.
  const activeOoo = useMemo(() => {
    const now = Date.now();
    return (
      windows.find(
        (w) => new Date(w.from).getTime() <= now && new Date(w.to).getTime() > now,
      ) ?? null
    );
  }, [windows]);

  // Permissions read as `module.action` — grouping by module turns a flat wall
  // of 300 keys into something scannable.
  const permsByModule = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const key of [...permissions].sort()) {
      const mod = key.split('.')[0] ?? 'other';
      const list = groups.get(mod) ?? [];
      list.push(key);
      groups.set(mod, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const currentLocale =
    SUPPORTED_LOCALES.find((l) => l.code === locale) ?? SUPPORTED_LOCALES[0];

  return (
    <PageContainer>
      <PageHeader
        title="Profile & Preferences"
        description="Your account details, access, and the settings you control."
        actions={
          <Button variant="secondary" onClick={() => navigate('/out-of-office')}>
            <CalendarClock size={15} />
            <span className="ml-1">Out of Office</span>
          </Button>
        }
      />

      {activeOoo && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <CalendarClock size={16} className="shrink-0" />
          You are currently marked out of office until{' '}
          <strong>{fmtDate(activeOoo.to)}</strong>
          {activeOoo.delegateTo && (
            <>
              {' '}· delegate: <strong>{activeOoo.delegateTo.name}</strong>
            </>
          )}
        </div>
      )}

      {/* ── Identity ── */}
      <Card>
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
              style={{ backgroundColor: '#0D0E17', color: '#F59E0B' }}
            >
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-ink">{name}</h2>
              {roleLabel && (
                <span
                  className="inline-flex items-center rounded px-2 py-0.5 text-xxs font-semibold tracking-wide"
                  style={{
                    backgroundColor: 'rgba(201,168,76,0.12)',
                    border: '1px solid rgba(201,168,76,0.30)',
                    color: '#A88937',
                  }}
                >
                  {roleLabel}
                </span>
              )}
              {me && (
                <Badge variant={me.isActive ? 'success' : 'danger'} dot>
                  {me.isActive ? 'Active' : 'Inactive'}
                </Badge>
              )}
            </div>
            {me?.designation && (
              <p className="mt-0.5 text-sm text-ink-secondary">{me.designation}</p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-tertiary">
              <Mail size={13} />
              {email}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-surface-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee ID" value={me?.employeeId ?? storeUser?.employeeId} />
          <Field
            label="Department"
            icon={<Building2 size={13} />}
            value={me?.department?.name ?? storeUser?.department}
          />
          <Field
            label="Site"
            icon={<MapPin size={13} />}
            value={me?.site?.name ?? storeUser?.site?.name}
          />
          <Field label="Role" icon={<Shield size={13} />} value={roleLabel} />
          <Field label="Member since" value={fmtDate(me?.createdAt)} />
          <Field
            label="Sites you can access"
            value={
              allowedSites.length > 1
                ? `${allowedSites.length} sites`
                : allowedSites[0]?.name
            }
          />
        </dl>

        {isLoading && (
          <p className="mt-4 text-xs text-ink-tertiary">Loading latest details…</p>
        )}

        <p className="mt-5 border-t border-surface-border pt-4 text-xs text-ink-tertiary">
          Identity details (role, department, site, employee ID) are controlled by an
          administrator and changed under Settings → Users, so every change stays on the
          audit trail. Ask your QA administrator if something here is wrong.
        </p>
      </Card>

      {/* ── Preferences ── */}
      <Card>
        <h3 className="text-sm font-semibold text-ink">Preferences</h3>
        <p className="mt-0.5 text-xs text-ink-tertiary">
          These apply to you only, on this browser.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Globe size={14} className="text-ink-tertiary" />
              Display language
            </p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Interface labels and dates render in this language.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={
                  l.code === currentLocale.code
                    ? 'inline-flex items-center gap-1.5 rounded-lg border border-surface-border-strong bg-surface-bg px-2.5 py-1.5 text-xs font-medium text-ink'
                    : 'inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-2.5 py-1.5 text-xs text-ink-secondary hover:border-surface-border-strong hover:text-ink transition-colors'
                }
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {l.code === currentLocale.code && (
                  <Check size={12} className="text-pharma-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <CalendarClock size={14} className="text-ink-tertiary" />
              Out of office
            </p>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              {windows.length === 0
                ? 'No windows scheduled — your tickets route to you as normal.'
                : `${windows.length} window${windows.length === 1 ? '' : 's'} scheduled.`}
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/out-of-office')}>
            Manage
          </Button>
        </div>
      </Card>

      {/* ── Access ── */}
      <Card noPadding className="overflow-hidden">
        <button
          onClick={() => setShowPerms((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-bg transition-colors"
        >
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <ShieldCheck size={14} className="text-ink-tertiary" />
              Your access
            </h3>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              {permissions.length} effective permission
              {permissions.length === 1 ? '' : 's'} across {permsByModule.length} module
              {permsByModule.length === 1 ? '' : 's'}, resolved from your role, department,
              and any individual overrides.
            </p>
          </div>
          <ChevronDown
            size={16}
            className={
              showPerms
                ? 'shrink-0 rotate-180 text-ink-tertiary transition-transform'
                : 'shrink-0 text-ink-tertiary transition-transform'
            }
          />
        </button>

        {showPerms && (
          <div className="max-h-96 overflow-y-auto border-t border-surface-border px-5 py-4">
            {permsByModule.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No permissions assigned.</p>
            ) : (
              <div className="space-y-4">
                {permsByModule.map(([mod, keys]) => (
                  <div key={mod}>
                    <p className="text-xxs font-semibold uppercase tracking-wide text-ink-tertiary">
                      {mod.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {keys.map((k) => (
                        <span
                          key={k}
                          className="rounded border border-surface-border bg-surface-bg px-1.5 py-0.5 font-mono text-xxs text-ink-secondary"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
