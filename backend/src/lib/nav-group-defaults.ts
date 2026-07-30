/**
 * Sidebar navigation-group defaults + idempotent bootstrap, run once at API
 * startup (docs/sidebar-module-grouping-plan.md §5.1).
 *
 * Why not `prisma/seed.ts`: the seed runs in development only. A deployed
 * environment would boot with an empty NavGroup table — no groups at all, and
 * every module falling through to a fallback group that also doesn't exist.
 * Same shape as ensureRbacCatalog() / ensureDefaultSiteAndBackfill().
 *
 * Two branches:
 *   1. empty table          → write the default layout (fresh deploy);
 *   2. no isFallback row    → re-flag the last group. The partial unique index
 *                             enforces AT MOST one fallback, not at least one,
 *                             so an out-of-band edit could leave zero and make
 *                             every unassigned module silently disappear.
 */
import { prisma } from './prisma';

/**
 * Every statically-defined (non-workflow-type) sidebar module that can be
 * assigned to a group. Must stay in sync with the client registry in
 * client/src/config/navModules.ts — these keys are permanent identifiers, so
 * renaming one orphans its NavGroupModule row.
 */
export const STATIC_MODULE_KEYS = [
  'dashboard',
  'lims',
  'lims-config',
  'calibration',
  'calibration-config',
  'dms',
  'training',
  'audit-trail',
  'configuration',
] as const;

export const isStaticModuleKey = (key: string): boolean =>
  (STATIC_MODULE_KEYS as readonly string[]).includes(key);

/** Workflow-type-driven modules are keyed by id, so a rename can't orphan them. */
export const WF_MODULE_PREFIX = 'wf:';
export const wfModuleKey = (workflowTypeId: string) => `${WF_MODULE_PREFIX}${workflowTypeId}`;
export const isWfModuleKey = (key: string) => key.startsWith(WF_MODULE_PREFIX);
export const workflowTypeIdFromKey = (key: string) => key.slice(WF_MODULE_PREFIX.length);

interface DefaultGroup {
  key: string;
  title: string;
  icon?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  isFallback?: boolean;
  isSystem?: boolean;
  /** Static module keys, in order. Workflow modules are placed by name below. */
  modules: string[];
}

/**
 * The layout the sidebar shipped with before grouping became configurable.
 * `Configuration` moves out of the old "LMS" section into Administration, which
 * is where it always belonged — it was mis-placed by hand-editing.
 */
export const DEFAULT_GROUPS: DefaultGroup[] = [
  // Ungrouped row at the top: no header, never collapsible, never deletable.
  { key: 'top', title: '', collapsible: false, defaultOpen: true, isSystem: true, modules: ['dashboard'] },
  { key: 'lab-operations', title: 'Lab Operations', defaultOpen: true, modules: ['lims', 'lims-config', 'calibration', 'calibration-config'] },
  { key: 'dms', title: 'DMS', defaultOpen: true, modules: ['dms'] },
  // Fallback: anything unassigned lands here, matching the old `groupForModule`
  // default of "Quality System".
  { key: 'quality-system', title: 'Quality System', defaultOpen: true, isFallback: true, modules: [] },
  { key: 'compliance', title: 'Compliance', defaultOpen: true, modules: ['audit-trail'] },
  { key: 'training', title: 'Training', defaultOpen: true, modules: ['training'] },
  { key: 'administration', title: 'Administration', defaultOpen: false, modules: ['configuration'] },
];

/**
 * Where each seeded workflow type starts out, mirroring the retired MODULE_GROUP
 * map in Sidebar.tsx. Matched on the normalised type name; anything unlisted is
 * left unassigned and renders in the fallback group.
 */
const WF_NAME_TO_GROUP: Record<string, string> = {
  capa: 'quality-system',
  deviation: 'quality-system',
  deviations: 'quality-system',
  complaints: 'quality-system',
  productcomplaints: 'quality-system',
  change: 'quality-system',
  changecontrol: 'quality-system',
  risk: 'quality-system',
  riskmanagement: 'quality-system',
  audit: 'compliance',
  calibration: 'compliance',
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Not a sidebar module — it renders as a tab inside /dms. */
const isDocReview = (name: string) => /^document\s*review$/i.test(name.trim());

export async function ensureNavGroups(): Promise<void> {
  const existing = await prisma.navGroup.count();

  if (existing > 0) {
    // Repair branch — guarantee a fallback exists.
    const fallback = await prisma.navGroup.findFirst({ where: { isFallback: true } });
    if (!fallback) {
      const last = await prisma.navGroup.findFirst({ orderBy: { sortOrder: 'desc' } });
      if (last) {
        await prisma.navGroup.update({ where: { id: last.id }, data: { isFallback: true } });
        console.log(`[nav-groups] no fallback group found — re-flagged "${last.key}"`);
      }
    }

    // Repair branch 2 — a static module added to the catalog AFTER this table
    // was bootstrapped has no NavGroupModule row, so it would fall through to
    // the fallback group rather than the group it declares. Place it where
    // DEFAULT_GROUPS says it belongs. Idempotent: only ever adds missing rows.
    const placed = new Set(
      (await prisma.navGroupModule.findMany({ select: { moduleKey: true } })).map((m) => m.moduleKey),
    );
    const missing = STATIC_MODULE_KEYS.filter((k) => !placed.has(k));
    for (const key of missing) {
      const home = DEFAULT_GROUPS.find((g) => g.modules.includes(key));
      const group = await prisma.navGroup.findUnique({ where: { key: home?.key ?? 'quality-system' } });
      if (!group) continue;
      const last = await prisma.navGroupModule.findFirst({
        where: { navGroupId: group.id },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      await prisma.navGroupModule.create({
        data: { navGroupId: group.id, moduleKey: key, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      console.log(`[nav-groups] placed new module "${key}" in group "${group.key}"`);
    }
    return;
  }

  const types = await prisma.workflowType.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true },
  });

  // Workflow modules to append to each group, in stable name order.
  const wfByGroup = new Map<string, string[]>();
  for (const t of types) {
    if (isDocReview(t.name)) continue;
    const groupKey = WF_NAME_TO_GROUP[normalise(t.name)];
    if (!groupKey) continue; // unassigned → renders in the fallback group
    const list = wfByGroup.get(groupKey) ?? [];
    list.push(wfModuleKey(t.id));
    wfByGroup.set(groupKey, list);
  }

  await prisma.$transaction(async (tx) => {
    for (const [i, g] of DEFAULT_GROUPS.entries()) {
      const group = await tx.navGroup.create({
        data: {
          key: g.key,
          title: g.title,
          icon: g.icon ?? null,
          sortOrder: i,
          collapsible: g.collapsible ?? true,
          defaultOpen: g.defaultOpen ?? false,
          isFallback: g.isFallback ?? false,
          isSystem: g.isSystem ?? false,
        },
      });

      const modules = [...g.modules, ...(wfByGroup.get(g.key) ?? [])];
      for (const [j, moduleKey] of modules.entries()) {
        await tx.navGroupModule.create({
          data: { navGroupId: group.id, moduleKey, sortOrder: j },
        });
      }
    }
  });

  console.log(`[nav-groups] bootstrapped ${DEFAULT_GROUPS.length} default navigation groups`);
}
