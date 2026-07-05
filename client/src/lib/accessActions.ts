/**
 * Action normalization — maps the non-uniform catalog verbs (create/read/update/
 * delete + legacy write/manage + the long tail: issue/execute/transition/close/
 * dispose/review/decide/publish/enter/result/grade/assign…) onto the fixed matrix
 * columns the Access Matrix renders:
 *
 *   View · Create · Edit · Delete · Approve · More⋯
 *
 * See ACCESS-CONTROL-enhancement-plan.md §4.5. This is intentionally the ONLY
 * place the mapping lives so the FE grid stays consistent as the catalog grows.
 */

export type MatrixColumn = 'view' | 'create' | 'edit' | 'delete' | 'approve';

/** The five fixed columns, in render order. `more` is handled separately. */
export const MATRIX_COLUMNS: MatrixColumn[] = ['view', 'create', 'edit', 'delete', 'approve'];

export const COLUMN_LABELS: Record<MatrixColumn, string> = {
  view: 'Read Access',
  create: 'Create Access',
  edit: 'Update Access',
  delete: 'Delete Access',
  approve: 'Approve Access',
};

/**
 * Verb (the last dot-segment of a permission key, lower-cased) → column.
 * `write` is intentionally absent — it is legacy and spans BOTH Create and Edit
 * (handled specially in bucketActionsForEntity). Any verb not listed here is
 * surfaced under the "More" popover so nothing is silently dropped.
 */
const VERB_COLUMN: Record<string, MatrixColumn> = {
  // View
  read: 'view',
  // Create
  create: 'create',
  enter: 'create',
  result: 'create',
  assign: 'create',
  // Edit
  update: 'edit',
  manage: 'edit',
  grade: 'edit',
  // Delete
  delete: 'delete',
  // Approve (and approve-adjacent verbs; extras overflow to More)
  approve: 'approve',
  issue: 'approve',
  decide: 'approve',
  close: 'approve',
  dispose: 'approve',
  review: 'approve',
  execute: 'approve',
  transition: 'approve',
  publish: 'approve',
};

export interface CatalogPerm {
  key: string;
  action: string;
  description?: string;
}

export interface BucketPerm {
  key: string;
  /** raw catalog action (uppercase, e.g. CREATE/APPROVE/WRITE). */
  action: string;
  /** the verb — last dot-segment of the key, e.g. 'read', 'issue', 'write'. */
  verb: string;
  description?: string;
}

export interface EntityBuckets {
  view?: BucketPerm;
  create?: BucketPerm;
  edit?: BucketPerm;
  delete?: BucketPerm;
  approve?: BucketPerm;
  /** Leftover keys (extra approve-ish verbs, unknown verbs) → "More" popover. */
  more: BucketPerm[];
  /**
   * When a legacy `write` key backs both Create and Edit, this is that key.
   * The matrix links the two columns (toggling either flips this one key) and
   * shows a small "W" affordance so admins know they move together.
   */
  writeKey?: string;
}

/**
 * Given an entity prefix (e.g. 'sample', 'document', 'workflow.lookups') and the
 * fetched flat catalog, return which permission-key backs each matrix column,
 * plus the leftover keys for the More popover.
 *
 * Matching rule: a key belongs to `entity` when it is exactly `${entity}.${verb}`
 * with NO further dots in `verb`. This keeps `workflow` (→ workflow.read/create/…)
 * distinct from `workflow.lookups` (→ workflow.lookups.read/manage) and avoids a
 * parent entity swallowing a child's keys.
 */
export function bucketActionsForEntity(entity: string, allPerms: CatalogPerm[]): EntityBuckets {
  const prefix = `${entity}.`;
  const buckets: EntityBuckets = { more: [] };
  const writePerms: BucketPerm[] = [];
  const owned: BucketPerm[] = [];

  for (const p of allPerms) {
    if (!p.key.startsWith(prefix)) continue;
    const remainder = p.key.slice(prefix.length);
    if (remainder.length === 0 || remainder.includes('.')) continue; // sub-entity, not ours
    owned.push({ key: p.key, action: p.action, verb: remainder, description: p.description });
  }

  // Deterministic order so "first wins / rest overflow" is stable.
  owned.sort((a, b) => a.key.localeCompare(b.key));

  // Pass 1 — place every non-write verb.
  for (const bp of owned) {
    if (bp.verb === 'write') {
      writePerms.push(bp);
      continue;
    }
    const col = VERB_COLUMN[bp.verb];
    if (col && !buckets[col]) buckets[col] = bp;
    else buckets.more.push(bp);
  }

  // Pass 2 — legacy `write` fills Create and/or Edit only where still empty.
  for (const wp of writePerms) {
    let used = false;
    if (!buckets.create) {
      buckets.create = wp;
      used = true;
    }
    if (!buckets.edit) {
      buckets.edit = wp;
      used = true;
    }
    if (used) buckets.writeKey = wp.key;
    else buckets.more.push(wp);
  }

  return buckets;
}

/** The permission-key backing a given column of an entity's buckets, if any. */
export function columnKey(buckets: EntityBuckets, col: MatrixColumn): string | undefined {
  return buckets[col]?.key;
}

/** Every permission-key an entity's buckets reference (columns + more), de-duped. */
export function allEntityKeys(buckets: EntityBuckets): string[] {
  const keys = new Set<string>();
  for (const col of MATRIX_COLUMNS) {
    const k = buckets[col]?.key;
    if (k) keys.add(k);
  }
  buckets.more.forEach((m) => keys.add(m.key));
  return [...keys];
}
