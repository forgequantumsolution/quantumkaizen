import { useMemo, useState } from 'react';
import { Select as AntSelect, Empty, Spin, Tag } from 'antd';
import {
  Download,
  Printer,
  User as UserIcon,
  Shield,
  Building2,
  Search,
  GitCompare,
  BarChart3,
  KeyRound,
} from 'lucide-react';
import { useRoles, usePermissionsGrouped } from '@/features/admin/roles/hooks';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useUserPermissions, useWhoCan } from './hooks';
import { cn } from '@/lib/utils';

type AnalysisTab = 'effective' | 'whoCan' | 'compare' | 'coverage';

interface CatalogEntry {
  key: string;
  module: string;
  action: string;
  description?: string;
}

export default function AccessAnalysisView() {
  const [tab, setTab] = useState<AnalysisTab>('effective');
  const { data: permGroups = [] } = usePermissionsGrouped();

  const catalog: CatalogEntry[] = useMemo(() => {
    const flat: CatalogEntry[] = [];
    permGroups.forEach((g) =>
      g.permissions.forEach((p) =>
        flat.push({ key: p.key, module: g.module, action: p.action, description: p.description }),
      ),
    );
    return flat.sort((a, b) => a.key.localeCompare(b.key));
  }, [permGroups]);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 flex-wrap">
        <SubTab active={tab === 'effective'} onClick={() => setTab('effective')} icon={<UserIcon size={13} />} label="Effective Access" />
        <SubTab active={tab === 'whoCan'} onClick={() => setTab('whoCan')} icon={<Search size={13} />} label="Who Can Do X" />
        <SubTab active={tab === 'compare'} onClick={() => setTab('compare')} icon={<GitCompare size={13} />} label="Compare" />
        <SubTab active={tab === 'coverage'} onClick={() => setTab('coverage')} icon={<BarChart3 size={13} />} label="Coverage" />
      </div>

      {tab === 'effective' && <EffectiveAccess catalog={catalog} />}
      {tab === 'whoCan' && <WhoCanDoX catalog={catalog} />}
      {tab === 'compare' && <CompareSubjects catalog={catalog} />}
      {tab === 'coverage' && <CoverageStats catalog={catalog} />}
    </div>
  );
}

/* ── 1. Effective access for a user ───────────────────────────────────── */
function EffectiveAccess({ catalog }: { catalog: CatalogEntry[] }) {
  const [userId, setUserId] = useState<string | undefined>();
  const { data: usersResp } = useAdminUsers({ pageSize: 500 });
  const users = usersResp?.items ?? [];
  const { data: perms, isLoading } = useUserPermissions(userId);

  const catalogByKey = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    catalog.forEach((c) => m.set(c.key, c));
    return m;
  }, [catalog]);

  const selectedUser = users.find((u) => u.id === userId) ?? null;

  const sourcesFor = (key: string): { role: boolean; dept: boolean; grant: boolean } => ({
    role: perms?.sources.role.includes(key) ?? false,
    dept: perms?.sources.department.includes(key) ?? false,
    grant: perms?.sources.grants.includes(key) ?? false,
  });

  // Group effective keys by module.
  const grouped = useMemo(() => {
    if (!perms) return [];
    const m = new Map<string, string[]>();
    perms.effective.forEach((key) => {
      const mod = catalogByKey.get(key)?.module ?? 'OTHER';
      const arr = m.get(mod) ?? [];
      arr.push(key);
      m.set(mod, arr);
    });
    return [...m.entries()]
      .map(([module, keys]) => ({ module, keys: keys.sort() }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [perms, catalogByKey]);

  const exportCsv = () => {
    if (!perms || !selectedUser) return;
    const rows = [['permission_key', 'module', 'action', 'via_role', 'via_department', 'explicit_grant']];
    perms.effective.forEach((key) => {
      const c = catalogByKey.get(key);
      const s = sourcesFor(key);
      rows.push([key, c?.module ?? '', c?.action ?? '', String(s.role), String(s.dept), String(s.grant)]);
    });
    perms.sources.denies.forEach((key) => {
      const c = catalogByKey.get(key);
      rows.push([key, c?.module ?? '', c?.action ?? '', 'DENIED', 'DENIED', 'DENIED']);
    });
    downloadCsv(`effective-access-${selectedUser.email}.csv`, rows);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-[280px]">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">User</label>
          <AntSelect
            showSearch
            value={userId}
            onChange={setUserId}
            placeholder="Select a user"
            className="w-72"
            optionFilterProp="label"
            options={users.map((u) => ({ value: u.id, label: `${u.name ?? u.email} (${u.email})` }))}
          />
        </div>
        {perms && selectedUser && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        )}
      </div>

      {!userId ? (
        <Empty description="Pick a user to see their resolved permissions and where each one comes from." />
      ) : isLoading ? (
        <div className="py-16 text-center"><Spin /></div>
      ) : !perms || perms.effective.length === 0 ? (
        <Empty description="This user has no effective permissions." />
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <SummaryChip label="Effective" value={perms.effective.length} tone="blue" />
            <SummaryChip label="Via role" value={perms.sources.role.length} tone="slate" />
            <SummaryChip label="Via department" value={perms.sources.department.length} tone="slate" />
            <SummaryChip label="Explicit grants" value={perms.sources.grants.length} tone="emerald" />
            <SummaryChip label="Explicit denies" value={perms.sources.denies.length} tone="red" />
          </div>

          {perms.sources.denies.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
              <span className="font-semibold">Denied (override):</span>{' '}
              {perms.sources.denies.join(', ')}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped.map((g) => (
              <div key={g.module} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-[10px] font-mono font-semibold text-blue-700 uppercase tracking-wide mb-2">
                  {g.module}
                </div>
                <ul className="space-y-1.5">
                  {g.keys.map((key) => {
                    const s = sourcesFor(key);
                    return (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-gray-800 truncate">{key}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {s.role && <Tag color="blue" className="!m-0 !text-[9px] !leading-4 !px-1">role</Tag>}
                          {s.dept && <Tag color="geekblue" className="!m-0 !text-[9px] !leading-4 !px-1">dept</Tag>}
                          {s.grant && <Tag color="green" className="!m-0 !text-[9px] !leading-4 !px-1">grant</Tag>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── 2. Who can do X ──────────────────────────────────────────────────── */
function WhoCanDoX({ catalog }: { catalog: CatalogEntry[] }) {
  const [permKey, setPermKey] = useState<string | undefined>();
  const { data, isLoading } = useWhoCan(permKey);

  return (
    <div className="space-y-3">
      <div className="min-w-[280px]">
        <label className="block text-[11px] font-medium text-gray-600 mb-1">Permission</label>
        <AntSelect
          showSearch
          value={permKey}
          onChange={setPermKey}
          placeholder="Select a permission key"
          className="w-96 max-w-full"
          optionFilterProp="label"
          options={catalog.map((c) => ({ value: c.key, label: `${c.key} — ${c.description ?? c.module}` }))}
        />
      </div>

      {!permKey ? (
        <Empty description="Pick a permission to see every role, department and user that grants it." />
      ) : isLoading ? (
        <div className="py-16 text-center"><Spin /></div>
      ) : !data ? (
        <Empty description="No data." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <WhoCanColumn icon={<Shield size={14} />} title="Roles" items={data.roles.map((r) => r.name)} />
          <WhoCanColumn icon={<Building2 size={14} />} title="Departments" items={data.departments.map((d) => d.name)} />
          <WhoCanColumn icon={<UserIcon size={14} />} title="Users" items={data.users.map((u) => `${u.name ?? u.email}`)} />
        </div>
      )}
    </div>
  );
}

function WhoCanColumn({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-800 mb-2">
        {icon}
        {title}
        <span className="text-gray-400 font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic">None</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="text-[12px] text-gray-700">{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── 3. Compare two subjects (role/user) ──────────────────────────────── */
type SubjectRef = { type: 'role' | 'user'; id: string } | null;

function CompareSubjects({ catalog }: { catalog: CatalogEntry[] }) {
  const { data: rolesResp } = useRoles({ pageSize: 200 });
  const roles = rolesResp?.items ?? [];
  const { data: usersResp } = useAdminUsers({ pageSize: 500 });
  const users = usersResp?.items ?? [];

  const [a, setA] = useState<SubjectRef>(null);
  const [b, setB] = useState<SubjectRef>(null);

  const keysA = useSubjectKeys(a, roles);
  const keysB = useSubjectKeys(b, roles);

  const catalogByKey = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    catalog.forEach((c) => m.set(c.key, c));
    return m;
  }, [catalog]);

  const setA_ = keysA.set;
  const setB_ = keysB.set;

  const diff = useMemo(() => {
    const sa = setA_;
    const sb = setB_;
    const onlyA = [...sa].filter((k) => !sb.has(k)).sort();
    const onlyB = [...sb].filter((k) => !sa.has(k)).sort();
    const both = [...sa].filter((k) => sb.has(k)).sort();
    return { onlyA, onlyB, both };
  }, [setA_, setB_]);

  const options = [
    { label: 'Roles', options: roles.map((r) => ({ value: `role:${r.id}`, label: `Role · ${r.name}` })) },
    { label: 'Users', options: users.map((u) => ({ value: `user:${u.id}`, label: `User · ${u.name ?? u.email}` })) },
  ];
  const parse = (v: string | undefined): SubjectRef => {
    if (!v) return null;
    const [type, id] = v.split(':');
    return { type: type as 'role' | 'user', id: id! };
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Subject A</label>
          <AntSelect showSearch className="w-full" placeholder="Role or user" optionFilterProp="label"
            value={a ? `${a.type}:${a.id}` : undefined} onChange={(v) => setA(parse(v))} options={options} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Subject B</label>
          <AntSelect showSearch className="w-full" placeholder="Role or user" optionFilterProp="label"
            value={b ? `${b.type}:${b.id}` : undefined} onChange={(v) => setB(parse(v))} options={options} />
        </div>
      </div>

      {!a || !b ? (
        <Empty description="Pick two subjects to diff their permission sets." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DiffColumn title="Only in A" keys={diff.onlyA} tone="red" catalogByKey={catalogByKey} />
          <DiffColumn title="Shared" keys={diff.both} tone="slate" catalogByKey={catalogByKey} />
          <DiffColumn title="Only in B" keys={diff.onlyB} tone="emerald" catalogByKey={catalogByKey} />
        </div>
      )}
    </div>
  );
}

function DiffColumn({
  title,
  keys,
  tone,
  catalogByKey,
}: {
  title: string;
  keys: string[];
  tone: 'red' | 'emerald' | 'slate';
  catalogByKey: Map<string, CatalogEntry>;
}) {
  const toneCls =
    tone === 'red' ? 'text-red-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-gray-700';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className={cn('text-[12px] font-semibold mb-2', toneCls)}>
        {title} <span className="text-gray-400 font-normal">({keys.length})</span>
      </div>
      {keys.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic">None</div>
      ) : (
        <ul className="space-y-1 max-h-96 overflow-y-auto">
          {keys.map((k) => (
            <li key={k} className="font-mono text-[11px] text-gray-700 truncate" title={catalogByKey.get(k)?.description}>
              {k}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Resolve the permission-key set for a compare subject. Hooks are always called
 * (enabled-gated) to satisfy the rules-of-hooks. */
function useSubjectKeys(ref: SubjectRef, roles: { id: string; permissions: { key: string }[] }[]) {
  const { data: userPerms } = useUserPermissions(ref?.type === 'user' ? ref.id : null);
  return useMemo(() => {
    if (!ref) return { set: new Set<string>() };
    if (ref.type === 'role') {
      const role = roles.find((r) => r.id === ref.id);
      return { set: new Set(role?.permissions.map((p) => p.key) ?? []) };
    }
    return { set: new Set(userPerms?.effective ?? []) };
  }, [ref, roles, userPerms]);
}

/* ── 4. Coverage stats ────────────────────────────────────────────────── */
function CoverageStats({ catalog }: { catalog: CatalogEntry[] }) {
  const { data: rolesResp, isLoading } = useRoles({ pageSize: 200 });
  const roles = rolesResp?.items ?? [];

  const stats = useMemo(() => {
    const allKeys = catalog.map((c) => c.key);
    const grantsByKey = new Map<string, number>();
    allKeys.forEach((k) => grantsByKey.set(k, 0));
    roles.forEach((r) =>
      r.permissions.forEach((p) => {
        if (grantsByKey.has(p.key)) grantsByKey.set(p.key, (grantsByKey.get(p.key) ?? 0) + 1);
      }),
    );
    const orphanKeys = allKeys.filter((k) => (grantsByKey.get(k) ?? 0) === 0);
    const godRoles = roles
      .filter((r) => allKeys.length > 0 && r.permissions.length / allKeys.length >= 0.9)
      .map((r) => r.name);

    // per-module coverage
    const byModule = new Map<string, { total: number; covered: number }>();
    catalog.forEach((c) => {
      const entry = byModule.get(c.module) ?? { total: 0, covered: 0 };
      entry.total += 1;
      if ((grantsByKey.get(c.key) ?? 0) > 0) entry.covered += 1;
      byModule.set(c.module, entry);
    });
    const modules = [...byModule.entries()]
      .map(([module, v]) => ({ module, ...v, pct: v.total ? Math.round((v.covered / v.total) * 100) : 0 }))
      .sort((a, b) => a.module.localeCompare(b.module));

    return { orphanKeys, godRoles, modules, totalKeys: allKeys.length };
  }, [catalog, roles]);

  if (isLoading) return <div className="py-16 text-center"><Spin /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <SummaryChip label="Permission keys" value={stats.totalKeys} tone="slate" />
        <SummaryChip label="Orphan (0 roles)" value={stats.orphanKeys.length} tone="red" />
        <SummaryChip label="Roles" value={roles.length} tone="blue" />
        <SummaryChip label="God roles (≥90%)" value={stats.godRoles.length} tone="amber" />
      </div>

      {stats.godRoles.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
          <span className="font-semibold">Near-full-access roles:</span> {stats.godRoles.join(', ')}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-600 uppercase tracking-wide">
              <th className="text-left px-4 py-2 font-semibold">Module</th>
              <th className="text-center px-4 py-2 font-semibold">Keys</th>
              <th className="text-center px-4 py-2 font-semibold">Covered</th>
              <th className="text-left px-4 py-2 font-semibold w-1/3">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {stats.modules.map((m) => (
              <tr key={m.module} className="border-b border-gray-50">
                <td className="px-4 py-2 font-mono text-[11px] text-gray-800">{m.module}</td>
                <td className="text-center px-4 py-2 text-gray-600">{m.total}</td>
                <td className="text-center px-4 py-2 text-gray-600">{m.covered}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', m.pct === 0 ? 'bg-red-400' : m.pct >= 90 ? 'bg-amber-400' : 'bg-blue-500')}
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 w-8 text-right">{m.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.orphanKeys.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-800 mb-2">
            <KeyRound size={14} /> Orphan permissions
            <span className="text-gray-400 font-normal">(granted to no role — {stats.orphanKeys.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.orphanKeys.map((k) => (
              <span key={k} className="font-mono text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── shared bits ──────────────────────────────────────────────────────── */
function SummaryChip({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'slate' | 'emerald' | 'red' | 'amber' }) {
  const cls: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    slate: 'bg-gray-50 border-gray-200 text-gray-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border', cls[tone])}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function SubTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
