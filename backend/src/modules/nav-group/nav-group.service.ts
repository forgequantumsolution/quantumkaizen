import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import {
  isStaticModuleKey,
  isWfModuleKey,
  workflowTypeIdFromKey,
} from '../../lib/nav-group-defaults';
import type { SaveNavGroupsInput } from './nav-group.schema';

const groupSelect = {
  id: true,
  key: true,
  title: true,
  icon: true,
  sortOrder: true,
  collapsible: true,
  defaultOpen: true,
  isFallback: true,
  isSystem: true,
  updatedAt: true,
  members: {
    select: { id: true, moduleKey: true, sortOrder: true, updatedAt: true },
    orderBy: { sortOrder: 'asc' },
  },
} as const;

/** Ids of every workflow type that still exists — used to prune orphan rows. */
const liveWorkflowTypeIds = async (): Promise<Set<string>> => {
  const types = await prisma.workflowType.findMany({
    where: { isDeleted: false },
    select: { id: true },
  });
  return new Set(types.map((t) => t.id));
};

/**
 * A `wf:<id>` row whose workflow type has since been soft-deleted is an orphan.
 * It is filtered out of reads and pruned (not rejected) on save — the editor
 * echoes back whatever it was given, so rejecting would make the whole document
 * un-saveable for reasons the admin can neither see nor fix.
 */
const isOrphan = (moduleKey: string, liveIds: Set<string>): boolean =>
  isWfModuleKey(moduleKey) && !liveIds.has(workflowTypeIdFromKey(moduleKey));

export const listNavGroups = async () => {
  const [groups, liveIds] = await Promise.all([
    prisma.navGroup.findMany({ orderBy: { sortOrder: 'asc' }, select: groupSelect }),
    liveWorkflowTypeIds(),
  ]);

  return groups.map((g) => ({
    ...g,
    members: g.members.filter((m) => !isOrphan(m.moduleKey, liveIds)),
  }));
};

/** Newest write across both tables — the client's optimistic-concurrency token. */
export const navGroupsUpdatedAt = async (): Promise<Date | null> => {
  const [group, member] = await Promise.all([
    prisma.navGroup.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    prisma.navGroupModule.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ]);
  const stamps = [group?.updatedAt, member?.updatedAt].filter((d): d is Date => !!d);
  if (!stamps.length) return null;
  return stamps.reduce((a, b) => (a > b ? a : b));
};

/**
 * Replace the whole navigation layout.
 *
 * Writes are deliberately singular (`create`/`update`/`delete` in loops) rather
 * than `createMany`/`deleteMany`: the audit interceptor does not wrap
 * `createMany`, so a bulk replace would log every DELETE and silently lose every
 * CREATE — a one-sided trail on a GxP config surface. Diffing also keeps the
 * trail readable ("moved CAPA to Compliance") instead of a full churn per save.
 */
export const saveNavGroups = async (input: SaveNavGroupsInput) => {
  const liveIds = await liveWorkflowTypeIds();
  const storedKeys = new Set(
    (await prisma.navGroupModule.findMany({ select: { moduleKey: true } })).map((m) => m.moduleKey),
  );

  // ── Validate the document ────────────────────────────────────────────────
  const groupKeys = input.groups.map((g) => g.key);
  const dupGroup = groupKeys.find((k, i) => groupKeys.indexOf(k) !== i);
  if (dupGroup) throw BadRequest(`Duplicate group key: ${dupGroup}`);

  const fallbacks = input.groups.filter((g) => g.isFallback);
  if (fallbacks.length !== 1) {
    throw BadRequest('Exactly one group must be marked as the fallback group');
  }

  // Drop keys the app can no longer place, but ONLY the ones already stored —
  // a key the client invented still has to be rejected.
  //
  // Two ways a stored key goes stale: a workflow type was soft-deleted, or a
  // static module was retired from the registry. Either way the editor loads the
  // row and echoes it back, so rejecting would make the layout permanently
  // unsaveable for a reason the admin can neither see nor fix. They are pruned
  // from the payload here and deleted from the table in the sweep below.
  const isKnownShape = (k: string) => isStaticModuleKey(k) || isWfModuleKey(k);
  const groups = input.groups.map((g) => ({
    ...g,
    moduleKeys: g.moduleKeys.filter((k) => {
      if (isOrphan(k, liveIds)) return false;
      if (!isKnownShape(k) && storedKeys.has(k)) return false;
      return true;
    }),
  }));

  const seen = new Set<string>();
  for (const g of groups) {
    for (const key of g.moduleKeys) {
      if (seen.has(key)) throw BadRequest(`Module assigned to more than one group: ${key}`);
      seen.add(key);
      if (!isKnownShape(key)) {
        throw BadRequest(`Unknown module key: ${key}`);
      }
    }
  }

  const fallbackKey = fallbacks[0]!.key;

  return prisma.$transaction(async (tx) => {
    const existingGroups = await tx.navGroup.findMany({
      select: { id: true, key: true, title: true, icon: true, sortOrder: true, collapsible: true, defaultOpen: true, isFallback: true, isSystem: true, updatedAt: true },
    });
    const existingMembers = await tx.navGroupModule.findMany({
      select: { id: true, moduleKey: true, navGroupId: true, sortOrder: true, updatedAt: true },
    });

    // ── Optimistic concurrency ─────────────────────────────────────────────
    // Read inside the transaction, not via the shared client, so the check sees
    // exactly the snapshot the writes below are applied to.
    if (input.baseUpdatedAt !== undefined && input.baseUpdatedAt !== null) {
      const base = new Date(input.baseUpdatedAt).getTime();
      const newest = [...existingGroups, ...existingMembers].reduce(
        (max, row) => Math.max(max, row.updatedAt.getTime()),
        0,
      );
      if (newest > base) {
        throw Conflict(
          'Navigation groups were changed by someone else since you loaded them. Reload and reapply your changes.',
        );
      }
    }

    const byKey = new Map(existingGroups.map((g) => [g.key, g]));
    const payloadKeys = new Set(groups.map((g) => g.key));

    // A system group (the ungrouped Dashboard row) may never be dropped.
    const droppedSystem = existingGroups.find((g) => g.isSystem && !payloadKeys.has(g.key));
    if (droppedSystem) throw BadRequest(`Group "${droppedSystem.key}" cannot be deleted`);

    // ── Groups ─────────────────────────────────────────────────────────────
    // Clear the old fallback FIRST: the partial unique index allows at most one
    // row with isFallback = true, so setting the new one before clearing the old
    // would violate it mid-transaction.
    for (const g of existingGroups) {
      if (g.isFallback && g.key !== fallbackKey) {
        await tx.navGroup.update({ where: { id: g.id }, data: { isFallback: false } });
      }
    }

    const idByKey = new Map<string, string>();
    for (const [i, g] of groups.entries()) {
      const prev = byKey.get(g.key);
      if (!prev) {
        const created = await tx.navGroup.create({
          data: {
            key: g.key,
            title: g.title,
            icon: g.icon ?? null,
            sortOrder: i,
            collapsible: g.collapsible,
            defaultOpen: g.defaultOpen,
            // set below, once every stale flag is cleared
            isFallback: false,
          },
          select: { id: true },
        });
        idByKey.set(g.key, created.id);
        continue;
      }

      // Only write fields that actually changed, so the trail shows real edits.
      const data: Record<string, unknown> = {};
      if (prev.title !== g.title) data.title = g.title;
      if (prev.icon !== (g.icon ?? null)) data.icon = g.icon ?? null;
      if (prev.sortOrder !== i) data.sortOrder = i;
      if (prev.collapsible !== g.collapsible) data.collapsible = g.collapsible;
      if (prev.defaultOpen !== g.defaultOpen) data.defaultOpen = g.defaultOpen;
      if (Object.keys(data).length) {
        await tx.navGroup.update({ where: { id: prev.id }, data });
      }
      idByKey.set(g.key, prev.id);
    }

    const fallbackId = idByKey.get(fallbackKey)!;
    if (!byKey.get(fallbackKey)?.isFallback) {
      await tx.navGroup.update({ where: { id: fallbackId }, data: { isFallback: true } });
    }

    // ── Members ────────────────────────────────────────────────────────────
    const memberByKey = new Map(existingMembers.map((m) => [m.moduleKey, m]));
    const assigned = new Set<string>();

    for (const g of groups) {
      const navGroupId = idByKey.get(g.key)!;
      for (const [j, moduleKey] of g.moduleKeys.entries()) {
        assigned.add(moduleKey);
        const prev = memberByKey.get(moduleKey);
        if (!prev) {
          await tx.navGroupModule.create({ data: { navGroupId, moduleKey, sortOrder: j } });
          continue;
        }
        if (prev.navGroupId !== navGroupId || prev.sortOrder !== j) {
          await tx.navGroupModule.update({
            where: { id: prev.id },
            data: { navGroupId, sortOrder: j },
          });
        }
      }
    }

    // Anything the payload didn't mention (a stale client, or a module whose
    // group was deleted) is swept into the fallback group rather than dropped —
    // a real module must never lose its place in the sidebar.
    let tail = groups.find((g) => g.key === fallbackKey)!.moduleKeys.length;
    for (const m of existingMembers) {
      if (assigned.has(m.moduleKey)) continue;
      // Dead workflow type, or a static module retired from the registry —
      // there is nothing left to render, so the row goes rather than piling up
      // in the fallback group forever.
      if (isOrphan(m.moduleKey, liveIds) || !isKnownShape(m.moduleKey)) {
        await tx.navGroupModule.delete({ where: { id: m.id } });
        continue;
      }
      await tx.navGroupModule.update({
        where: { id: m.id },
        data: { navGroupId: fallbackId, sortOrder: tail++ },
      });
    }

    // ── Deleted groups ─────────────────────────────────────────────────────
    // Safe now: every surviving member was repointed above, so the FK cascade
    // has nothing left to take with it.
    for (const g of existingGroups) {
      if (!payloadKeys.has(g.key)) {
        await tx.navGroup.delete({ where: { id: g.id } });
      }
    }

    return tx.navGroup.findMany({ orderBy: { sortOrder: 'asc' }, select: groupSelect });
  });
};

/**
 * Delete one group, moving its members to the fallback group first. Exposed for
 * completeness; the editor normally deletes by omitting the group from the
 * full-document save above.
 */
export const deleteNavGroup = async (id: string) =>
  prisma.$transaction(async (tx) => {
    const group = await tx.navGroup.findUnique({
      where: { id },
      select: { id: true, key: true, isSystem: true, isFallback: true },
    });
    if (!group) throw NotFound('Navigation group not found');
    if (group.isSystem) throw BadRequest(`Group "${group.key}" cannot be deleted`);
    if (group.isFallback) throw BadRequest('The fallback group cannot be deleted');

    const fallback = await tx.navGroup.findFirst({
      where: { isFallback: true },
      select: { id: true },
    });
    if (!fallback) throw BadRequest('No fallback group configured');

    const tail = await tx.navGroupModule.count({ where: { navGroupId: fallback.id } });
    const members = await tx.navGroupModule.findMany({
      where: { navGroupId: id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });

    // Move members BEFORE the delete — the FK cascade would otherwise destroy them.
    for (const [i, m] of members.entries()) {
      await tx.navGroupModule.update({
        where: { id: m.id },
        data: { navGroupId: fallback.id, sortOrder: tail + i },
      });
    }

    await tx.navGroup.delete({ where: { id } });
  });
