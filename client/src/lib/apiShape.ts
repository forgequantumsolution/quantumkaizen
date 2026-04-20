// Helpers that translate the backend wire format into the shape the UI expects.
//
// Backend always wraps successful responses as:
//   • List:   { data: [...], meta: { total, page, limit, totalPages } }
//   • Item:   { data: {...} }
//
// UI pages were originally written against flat mock data:
//   • List:   { data: [...], total, page, pageSize, totalPages }
//   • Item:   the entity directly
//
// These helpers bridge the two without touching every render site.

export interface PaginatedShape<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function unwrapList<T>(payload: unknown, mapItem?: (x: any) => T): PaginatedShape<T> {
  const p = payload as any;
  const raw = Array.isArray(p?.data) ? p.data : Array.isArray(p) ? p : [];
  const items = mapItem ? raw.map(mapItem) : (raw as T[]);
  const meta = p?.meta ?? {};
  return {
    data: items,
    total: meta.total ?? items.length,
    page: meta.page ?? 1,
    pageSize: meta.limit ?? meta.pageSize ?? items.length,
    totalPages: meta.totalPages ?? 1,
  };
}

export function unwrapItem<T = any>(payload: unknown, mapItem?: (x: any) => T): T {
  const p = payload as any;
  const item = p?.data ?? p;
  return (mapItem ? mapItem(item) : item) as T;
}

// Backend `include`s for user relations return { id, name, email }. UI
// fixtures / renderers expect a plain string. Flatten the listed fields
// in-place while keeping the `<field>Id` alias handy.
export function flattenUsers<T extends Record<string, unknown>>(
  obj: T,
  fields: string[],
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of fields) {
    const v = (obj as any)[f];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[f] = (v as any).name ?? (v as any).email ?? null;
      const idKey = `${f}Id`;
      if (out[idKey] == null && (v as any).id) out[idKey] = (v as any).id;
    }
  }
  return out as T;
}
