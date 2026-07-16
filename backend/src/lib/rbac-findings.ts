/**
 * Dynamic per-workflow-type FINDINGS RBAC keys.
 *
 * Mirrors rbac-workflow-types.ts, but for the generic findings capability. Every
 * workflow type that opts into findings (`WorkflowType.supportsFindings = true`
 * — inspection, change control, deviation, supplier quality, …) gets its own set
 * of finding permission keys so Access Control can grant/deny findings on each
 * module independently, instead of one shared global `finding.*` key gating them
 * all at once.
 *
 * Key scheme (keyed on the type's stable id, so renames never break grants):
 *   finding.<typeId>.read | create | update | delete
 *
 * These are the ONLY keys that gate finding routes (see middleware/permissions.ts
 * `requireFindingAction`); the global `finding.*` catalog keys were retired in
 * favour of this per-module model. A type that does NOT support findings gets no
 * keys at all (and its tickets never expose a Findings tab).
 *
 * Namespace note: keys live under `finding.` (NOT `wf_type.`), so none of the
 * per-type TICKET logic (rbac-ticket-migration, rbac-system-role-tickets,
 * ticketReadScope) — all of which filter on `wf_type.` / the wf_type regex —
 * ever picks them up.
 */
import { prisma } from './prisma';

const VERB_ACTION: Record<string, string> = {
  read: 'READ',
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
};

export const FINDING_TYPE_MODULE = 'FINDING_TYPE';
export const FINDING_TYPE_VERBS = Object.keys(VERB_ACTION);

export const findingTypeKey = (typeId: string, verb: string): string =>
  `finding.${typeId}.${verb}`;

/** Extract the workflow-type id from a `finding.<id>.<verb>` key (else null). */
export const typeIdFromFindingKey = (key: string): string | null => {
  const m = /^finding\.([^.]+)\.(read|create|update|delete)$/.exec(key);
  return m ? m[1]! : null;
};

/** The 4 permission-row definitions for one findings-enabled workflow type. */
export const findingTypePermsFor = (typeId: string, name: string) =>
  FINDING_TYPE_VERBS.map((verb) => ({
    key: findingTypeKey(typeId, verb),
    module: FINDING_TYPE_MODULE,
    action: VERB_ACTION[verb]!,
    description: `${name}: ${verb} findings`,
  }));

/** Upsert the finding permission rows for one workflow type. */
export const ensureFindingTypePermissions = async (
  typeId: string,
  name: string,
): Promise<void> => {
  for (const p of findingTypePermsFor(typeId, name)) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
};

/** Grant this type's finding keys to SUPER_ADMIN (invariant: it holds all). */
export const grantFindingTypePermissionsToSuperAdmin = async (
  typeId: string,
  name: string,
): Promise<void> => {
  const superAdmin = await prisma.role.findFirst({
    where: { name: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (!superAdmin) return;
  const perms = await prisma.permission.findMany({
    where: { key: { in: findingTypePermsFor(typeId, name).map((p) => p.key) } },
    select: { id: true },
  });
  await prisma.role.update({
    where: { id: superAdmin.id },
    data: { permissions: { connect: perms.map((p) => ({ id: p.id })) } },
  });
};

/** Delete this type's finding permission rows (grants cascade away). */
export const deleteFindingTypePermissions = async (typeId: string): Promise<void> => {
  await prisma.permission.deleteMany({
    where: { module: FINDING_TYPE_MODULE, key: { startsWith: `finding.${typeId}.` } },
  });
};

/**
 * Reconcile every per-type finding permission row against the current
 * WorkflowType table. Run at startup (after the static catalog upsert, before
 * the SUPER_ADMIN "hold everything" step) so existing findings-enabled types are
 * backfilled on deploy without a manual seed.
 *
 * - Upserts keys for every type with `supportsFindings = true` (soft-deleted
 *   ones included, so a restore keeps its grants).
 * - Prunes orphan `finding.<id>.*` rows whose type no longer exists OR has turned
 *   findings off.
 */
export const syncFindingTypePermissions = async (): Promise<void> => {
  const types = await prisma.workflowType.findMany({
    select: { id: true, name: true, supportsFindings: true },
  });
  const enabledIds = new Set(types.filter((t) => t.supportsFindings).map((t) => t.id));

  for (const t of types) {
    if (t.supportsFindings) await ensureFindingTypePermissions(t.id, t.name);
  }

  // Prune keys for types that no longer exist or no longer support findings.
  const existing = await prisma.permission.findMany({
    where: { module: FINDING_TYPE_MODULE },
    select: { key: true },
  });
  const orphanKeys = existing
    .map((p) => p.key)
    .filter((key) => {
      const id = typeIdFromFindingKey(key);
      return !id || !enabledIds.has(id);
    });
  if (orphanKeys.length > 0) {
    await prisma.permission.deleteMany({ where: { key: { in: orphanKeys } } });
  }
};
