/**
 * Resolves the user ids carried by risk records into display names for the PDFs.
 *
 * Risk, control and review rows store `ownerId` / `reviewedById` / `verifiedById`
 * as plain columns with no foreign key (the self-contained-migration convention
 * used by Document and AuditScheduleRule), so the API cannot join a name onto
 * them. Without this, a report handed to an auditor would read "Assigned"
 * everywhere a person should be named.
 *
 * Deliberately imports nothing from reportShared — that module pulls in
 * @react-pdf/renderer, which must stay out of the assembler's import graph so
 * the engine remains code-split until a report is actually requested.
 */
import { api } from '@/lib/api';

type Bag = Record<string, any>;

/** Fetch the people directory as an id → name map. Never throws. */
export async function buildNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = (await api.get('/users/directory')).data;
    // The endpoint is enveloped inconsistently across the app; peel defensively.
    const payload = (raw?.data ?? raw) as Bag;
    const items: Bag[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
    for (const u of items) {
      if (u?.id && u?.name) map.set(String(u.id), String(u.name));
    }
  } catch {
    // Directory unreadable (permissions, network) — callers fall back to the
    // existing "Assigned" wording rather than losing the whole report.
  }
  return map;
}

/**
 * Stamp `<key>_name` onto a row for each `<key>_id` present, which is exactly
 * what the report documents' personName() helper looks for. Mutates and returns
 * the row; ids with no directory match are left alone.
 */
export function stampNames<T extends Bag | null | undefined>(
  row: T,
  names: Map<string, string>,
  keys: string[],
): T {
  if (!row) return row;
  for (const key of keys) {
    const id = row[`${key}_id`];
    if (!id) continue;
    const name = names.get(String(id));
    if (name && !row[`${key}_name`]) row[`${key}_name`] = name;
  }
  return row;
}

/** stampNames across a list. */
export function stampNamesAll(
  rows: Bag[] | null | undefined,
  names: Map<string, string>,
  keys: string[],
): Bag[] {
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) stampNames(r, names, keys);
  return list;
}
