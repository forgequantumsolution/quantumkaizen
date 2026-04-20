// Defensive lookup for status/severity badge maps.
//
// Every list page defines:
//   const map = { APPROVED: { variant: 'success', label: 'Approved' }, ... };
//   return <Badge variant={map[row.status].variant}>{map[row.status].label}</Badge>;
//
// …and crashes with "Cannot read properties of undefined (reading 'variant')"
// the moment the backend returns an enum value the map doesn't cover.
// This helper returns a safe fallback so the page keeps rendering.

export interface BadgeDef {
  variant: string;
  label: string;
}

export function lookupBadge(
  map: Record<string, BadgeDef>,
  key: unknown,
  fallback?: Partial<BadgeDef>,
): BadgeDef {
  const k = key == null ? '' : String(key);
  const hit = map[k];
  if (hit) return hit;
  return {
    variant: fallback?.variant ?? 'default',
    label: fallback?.label ?? (k ? k.replaceAll('_', ' ') : '—'),
  };
}
