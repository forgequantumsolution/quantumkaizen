/**
 * Dynamic per-workflow-type RBAC keys.
 *
 * Every workflow type (CAPA, Deviation, Complaints, …) gets its own set of
 * ticket permission keys so Access Control can grant/deny each module
 * independently — instead of the single shared `ticket.*` catalog keys that
 * gate every type at once.
 *
 * Key scheme (keyed on the type's stable id, so renames never break grants):
 *   wf_type.<typeId>.read | create | update | delete | transition
 *
 * Enforcement is an OR-bridge (see middleware/permissions.ts): a ticket action
 * is allowed when the user holds EITHER the per-type key OR the global
 * `ticket.<action>` key. The global key therefore acts as an "All Workflow
 * Types" master, which keeps every existing role working (backward-compatible).
 *
 * Audit was historically excluded (it has its own `audit_*` catalog + bespoke
 * sidebar/matrix treatment). As of the per-module-ticket-master work it now
 * ALSO gets per-type ticket keys like every other type, so audit tickets keep
 * working once the global `ticket.*` master is retired (see
 * docs/per-module-ticket-master-plan.md). `isAuditTypeName` stays exported for
 * callers that still need to detect the audit type for non-ticket reasons.
 */
import { prisma } from './prisma';

const VERB_ACTION: Record<string, string> = {
  read: 'READ',
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  transition: 'TRANSITION',
};

export const WF_TYPE_MODULE = 'WF_TYPE';
export const WF_TYPE_VERBS = Object.keys(VERB_ACTION);

/** Detect the Audit workflow type by name. Audit now gets per-type ticket keys
 *  like any other type; this stays for non-ticket callers that special-case it. */
export const isAuditTypeName = (name: string): boolean => /^audit$/i.test(name.trim());

export const wfTypeKey = (typeId: string, verb: string): string => `wf_type.${typeId}.${verb}`;

/** Extract the workflow-type id from a `wf_type.<id>.<verb>` key (else null). */
export const typeIdFromKey = (key: string): string | null => {
  const m = /^wf_type\.([^.]+)\./.exec(key);
  return m ? m[1]! : null;
};

/** The 5 permission-row definitions for one workflow type. */
export const wfTypePermsFor = (typeId: string, name: string) =>
  WF_TYPE_VERBS.map((verb) => ({
    key: wfTypeKey(typeId, verb),
    module: WF_TYPE_MODULE,
    action: VERB_ACTION[verb]!,
    description: `${name}: ${verb} tickets`,
  }));

/**
 * Upsert the permission rows for one workflow type (Audit included). Safe to
 * call from create / un-delete paths. Does NOT grant to any role — SUPER_ADMIN
 * is granted separately (rbac-sync at startup, or the create hook).
 */
export const ensureWorkflowTypePermissions = async (
  typeId: string,
  name: string,
): Promise<void> => {
  for (const p of wfTypePermsFor(typeId, name)) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
};

/** Grant this type's keys to the SUPER_ADMIN role (invariant: it holds all). */
export const grantWorkflowTypePermissionsToSuperAdmin = async (
  typeId: string,
  name: string,
): Promise<void> => {
  const superAdmin = await prisma.role.findFirst({
    where: { name: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (!superAdmin) return;
  const perms = await prisma.permission.findMany({
    where: { key: { in: wfTypePermsFor(typeId, name).map((p) => p.key) } },
    select: { id: true },
  });
  await prisma.role.update({
    where: { id: superAdmin.id },
    data: { permissions: { connect: perms.map((p) => ({ id: p.id })) } },
  });
};

/** Delete this type's permission rows (M2M grants cascade away). For hard-delete. */
export const deleteWorkflowTypePermissions = async (typeId: string): Promise<void> => {
  await prisma.permission.deleteMany({
    where: { module: WF_TYPE_MODULE, key: { startsWith: `wf_type.${typeId}.` } },
  });
};

/**
 * Reconcile every per-type permission row against the current WorkflowType
 * table. Run once at startup (after the static catalog upsert, before the
 * SUPER_ADMIN "hold everything" step) so existing types are backfilled on
 * deploy without a manual seed.
 *
 * - Upserts keys for every workflow type (Audit included), INCLUDING soft-deleted
 *   ones, so a soft-delete → restore keeps its role grants intact.
 * - Prunes orphan `wf_type.*` rows whose type no longer exists (hard-deleted).
 */
export const syncWorkflowTypePermissions = async (): Promise<void> => {
  const types = await prisma.workflowType.findMany({ select: { id: true, name: true } });
  const wantedIds = new Set(types.map((t) => t.id));

  for (const t of types) {
    await ensureWorkflowTypePermissions(t.id, t.name);
  }

  // Prune orphans (type hard-deleted, or now an Audit type).
  const existing = await prisma.permission.findMany({
    where: { module: WF_TYPE_MODULE },
    select: { key: true },
  });
  const orphanKeys = existing
    .map((p) => p.key)
    .filter((key) => {
      const id = typeIdFromKey(key);
      return !id || !wantedIds.has(id);
    });
  if (orphanKeys.length > 0) {
    await prisma.permission.deleteMany({ where: { key: { in: orphanKeys } } });
  }
};
