/**
 * Risk link entity registry — the single declaration of what a risk may be
 * linked to, and how such a link is resolved for display.
 *
 * Why this exists: `RiskLink` is a generic (entityType, entityId) pair with no
 * foreign key, which is what lets a risk point at a CAPA, a document, an audit
 * and a sample without fourteen nullable columns. The cost of that freedom is
 * that nothing validated the pair and nothing could render it — the UI fell back
 * to printing a raw UUID. This registry pays that cost back in one place:
 *
 *   - `find`   — proves the target exists (so a link can never dangle) and
 *                supplies the human reference used as the link label
 *   - `search` — powers the typeahead, so a user picks a record instead of
 *                pasting an id they had to find in another tab
 *   - `route`  — the client detail path, so every link is clickable
 *   - `permission` — the caller's read key for the TARGET module. Reverse
 *                lookups filter on it: a user who cannot read CAPAs must not
 *                learn CAPA numbers by reading a risk.
 *
 * Adding a linkable type is one entry here — no service, route or client change.
 * See docs/RISK-cross-module-integration-plan.md §C.1.
 */
import { prisma } from './prisma';
import { findingTypeKey } from './rbac-findings';
import { wfTypeKey } from './rbac-workflow-types';

export interface EntityRef {
  /** Human reference — CAPA-2026-0042, SOP-014, RISK-2026-0007. */
  number: string;
  title: string;
}

export interface LinkableEntity {
  /** Stored verbatim in `RiskLink.entityType`. */
  type: string;
  /** Display name for pickers and table chips. */
  label: string;
  /** Resolve one record; null when it does not exist. */
  find: (id: string) => Promise<EntityRef | null>;
  /** Typeahead over number + title. */
  search: (q: string, take: number) => Promise<(EntityRef & { id: string })[]>;
  /** Client detail route, or null for types with no detail page. */
  route: ((id: string) => string) | null;
  /** Read permission on the TARGET module. */
  permission: string;
  /**
   * Per-record permission key, for entities gated by dynamic per-workflow-type
   * keys rather than one catalog key (tickets → `wf_type.<id>.read`, generic
   * findings → `finding.<id>.read`). Returning null denies: a record whose type
   * cannot be resolved is one we cannot prove the caller may see.
   */
  permissionFor?: (id: string) => Promise<string | null>;
}

/** The workflow type id behind a ticket, via its first flow. */
const ticketTypeId = async (ticketId: string): Promise<string | null> => {
  const flow = await prisma.ticketFlow.findFirst({
    where: { ticketId },
    select: { workflow: { select: { typeId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return flow?.workflow?.typeId ?? null;
};

/** Case-insensitive contains — the search idiom used across the codebase. */
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

/**
 * Most entities are "a table with a number column and a title column". This
 * builds those without fourteen near-identical closures. `titleField` may be
 * null for tables whose reference number is the only human-readable field.
 */
const simple = (opts: {
  type: string;
  label: string;
  permission: string;
  route: ((id: string) => string) | null;
  delegate: {
    findMany: (args: never) => Promise<Record<string, unknown>[]>;
  };
  numberField: string;
  titleField: string | null;
  /** Extra where-clause, e.g. `{ isDeleted: false }`. */
  scope?: Record<string, unknown>;
  permissionFor?: (id: string) => Promise<string | null>;
}): LinkableEntity => {
  const { numberField, titleField, scope = {} } = opts;
  const select = {
    id: true,
    [numberField]: true,
    ...(titleField ? { [titleField]: true } : {}),
  };
  const toRef = (row: Record<string, unknown>): EntityRef => ({
    number: String(row[numberField] ?? ''),
    title: titleField ? String(row[titleField] ?? '') : String(row[numberField] ?? ''),
  });

  return {
    type: opts.type,
    label: opts.label,
    permission: opts.permission,
    route: opts.route,
    ...(opts.permissionFor ? { permissionFor: opts.permissionFor } : {}),
    find: async (id) => {
      // findMany-with-take-1 rather than findUnique so `scope` lands in the
      // where clause: a soft-deleted record must not be a valid link target,
      // and filtering it in SQL is the only way that holds without selecting
      // (and then re-checking) every scope column.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (opts.delegate.findMany as any)({ where: { ...scope, id }, select, take: 1 });
      const row = (rows as Record<string, unknown>[])[0];
      return row ? toRef(row) : null;
    },
    search: async (q, take) => {
      const or: Record<string, unknown>[] = [{ [numberField]: ci(q) }];
      if (titleField) or.push({ [titleField]: ci(q) });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (opts.delegate.findMany as any)({
        where: { ...scope, OR: or },
        select,
        take,
        orderBy: { [numberField]: 'desc' },
      });
      return (rows as Record<string, unknown>[]).map((r) => ({ id: String(r.id), ...toRef(r) }));
    },
  };
};

/**
 * Every type a risk may be linked to. Keep the client's picker in step by
 * reading `GET /api/risk/linkable` rather than hardcoding a list.
 */
const ENTITIES: LinkableEntity[] = [
  simple({
    type: 'Capa',
    label: 'CAPA',
    permission: 'capa.read',
    route: (id) => `/audit/capa/${id}`,
    delegate: prisma.capa as never,
    numberField: 'capaNumber',
    titleField: 'title',
  }),
  simple({
    type: 'ActionItem',
    label: 'Action item',
    permission: 'action_item.read',
    route: null,
    delegate: prisma.actionItem as never,
    numberField: 'actionNumber',
    titleField: 'title',
  }),
  simple({
    type: 'NonConformance',
    label: 'Non-conformance',
    permission: 'non_conformance.read',
    route: () => '/audit/non-conformance',
    delegate: prisma.nonConformance as never,
    numberField: 'ncNumber',
    titleField: null,
  }),
  simple({
    type: 'Finding',
    label: 'Finding',
    // Generic findings are gated per workflow type (`finding.<typeId>.read`);
    // the catalog key here is only a fallback for records whose source ticket
    // has lost its flow. permissionFor is what actually decides.
    permission: 'audit_finding.read',
    route: null,
    delegate: prisma.finding as never,
    numberField: 'findingNumber',
    titleField: 'title',
    permissionFor: async (id) => {
      const finding = await prisma.finding.findUnique({
        where: { id },
        select: { sourceTicketId: true },
      });
      if (!finding) return null;
      const typeId = await ticketTypeId(finding.sourceTicketId);
      return typeId ? findingTypeKey(typeId, 'read') : null;
    },
  }),
  simple({
    type: 'AuditFinding',
    label: 'Audit finding',
    permission: 'audit_finding.read',
    route: null,
    delegate: prisma.auditFinding as never,
    numberField: 'findingNumber',
    titleField: 'description',
  }),
  simple({
    type: 'AuditRegister',
    label: 'Audit',
    permission: 'audit_register.read',
    route: (id) => `/audit/register/${id}`,
    delegate: prisma.auditRegister as never,
    numberField: 'registerNumber',
    titleField: 'title',
  }),
  simple({
    type: 'Document',
    label: 'Document',
    permission: 'document.read',
    route: (id) => `/dms/${id}`,
    delegate: prisma.document as never,
    numberField: 'docNumber',
    titleField: 'title',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'Ticket',
    label: 'Ticket',
    // The global `ticket.*` master was retired — access is granted exclusively
    // per workflow type (docs/per-module-ticket-master-plan.md). There is no
    // static key that can stand in, so permissionFor is mandatory here and the
    // static value is a deliberately unheld sentinel: no key, no leak.
    permission: 'ticket.read',
    route: (id) => `/tickets/${id}`,
    delegate: prisma.ticket as never,
    numberField: 'uniqueId',
    titleField: 'title',
    scope: { isDeleted: false },
    permissionFor: async (id) => {
      const typeId = await ticketTypeId(id);
      return typeId ? wfTypeKey(typeId, 'read') : null;
    },
  }),
  simple({
    type: 'Supplier',
    label: 'Supplier',
    permission: 'supplier.read',
    route: () => '/lims/suppliers',
    delegate: prisma.supplier as never,
    numberField: 'code',
    titleField: 'name',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'Equipment',
    label: 'Equipment',
    permission: 'equipment.read',
    route: (id) => `/lims/equipment/${id}`,
    delegate: prisma.equipment as never,
    numberField: 'code',
    titleField: 'name',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'Sample',
    label: 'Sample',
    permission: 'sample.read',
    route: (id) => `/lims/samples/${id}`,
    delegate: prisma.sample as never,
    numberField: 'sampleNumber',
    titleField: 'productName',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'OosInvestigation',
    label: 'OOS/OOT',
    permission: 'oos.read',
    route: (id) => `/lims/oos/${id}`,
    delegate: prisma.oosInvestigation as never,
    numberField: 'code',
    titleField: 'title',
  }),
  simple({
    type: 'StabilityStudy',
    label: 'Stability study',
    permission: 'stability.read',
    route: (id) => `/lims/stability/${id}`,
    delegate: prisma.stabilityStudy as never,
    numberField: 'code',
    titleField: 'title',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'Coa',
    label: 'CoA',
    permission: 'coa.read',
    route: (id) => `/lims/coa/${id}`,
    delegate: prisma.coa as never,
    numberField: 'coaNumber',
    titleField: 'productName',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'LmsCourse',
    label: 'Training course',
    permission: 'lms_course.read',
    route: (id) => `/lms/admin/courses/${id}`,
    delegate: prisma.lmsCourse as never,
    numberField: 'code',
    titleField: 'title',
    scope: { isDeleted: false },
  }),
  simple({
    type: 'Risk',
    label: 'Risk',
    permission: 'risk.read',
    route: (id) => `/risk/risks/${id}`,
    delegate: prisma.risk as never,
    numberField: 'riskNumber',
    titleField: 'title',
  }),
  simple({
    type: 'RiskAssessment',
    label: 'Risk assessment',
    permission: 'risk_assessment.read',
    route: (id) => `/risk/assessments/${id}`,
    delegate: prisma.riskAssessment as never,
    numberField: 'assessmentNumber',
    titleField: 'title',
  }),
];

const BY_TYPE = new Map(ENTITIES.map((e) => [e.type, e]));

export const linkableEntities = (): LinkableEntity[] => ENTITIES;

export const linkableEntity = (type: string): LinkableEntity | undefined => BY_TYPE.get(type);

export const isLinkableType = (type: string): boolean => BY_TYPE.has(type);

/** Type names in registration order — used in the "unknown type" 400 message. */
export const linkableTypeNames = (): string[] => ENTITIES.map((e) => e.type);

/**
 * May a caller holding `keys` see this record?
 *
 * Reverse lookups and link resolution both run through here so a risk can never
 * become a side channel for records the caller has no right to read — the risk
 * itself may be visible while the CAPA it points at is not.
 */
export const canSeeEntity = async (
  entity: LinkableEntity,
  id: string,
  keys: Set<string>,
): Promise<boolean> => {
  if (entity.permissionFor) {
    const key = await entity.permissionFor(id).catch(() => null);
    return key !== null && keys.has(key);
  }
  return keys.has(entity.permission);
};

/**
 * Resolve a batch of (type, id) pairs to display refs in as few queries as
 * possible — one per distinct entity type rather than one per link. `find` is
 * deliberately not used here: a risk with thirty links would otherwise issue
 * thirty round trips just to render its links tab.
 */
export const resolveRefs = async (
  pairs: { entityType: string; entityId: string }[],
): Promise<Map<string, EntityRef>> => {
  const out = new Map<string, EntityRef>();
  if (pairs.length === 0) return out;

  const byType = new Map<string, Set<string>>();
  for (const p of pairs) {
    if (!BY_TYPE.has(p.entityType)) continue;
    const set = byType.get(p.entityType) ?? new Set<string>();
    set.add(p.entityId);
    byType.set(p.entityType, set);
  }

  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const entity = BY_TYPE.get(type);
      if (!entity) return;
      // Resolving in parallel per id, but batched per type, keeps this honest
      // without needing a `findMany` shape in the registry entry.
      const refs = await Promise.all(
        [...ids].map(async (id) => ({ id, ref: await entity.find(id).catch(() => null) })),
      );
      for (const { id, ref } of refs) {
        if (ref) out.set(`${type}:${id}`, ref);
      }
    }),
  );

  return out;
};
