import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Workflow display name ───────────────────────────────────────────────────
// Workflows are user-named, but a few records in our data have UUID-shaped
// names (a paste error, or an incomplete migration). Surfacing the raw UUID in
// dropdowns and lists is unreadable, so render a friendly fallback whenever the
// stored name is blank or looks like a UUID. Use this everywhere a workflow
// name is shown to a user.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WorkflowLike {
  id: string;
  name?: string | null;
  type?: { name?: string | null } | null;
  version?: number;
}

export function displayWorkflowName(w: WorkflowLike): string {
  const name = (w.name ?? '').trim();
  if (name && !UUID_RE.test(name)) return name;
  const typeName = w.type?.name?.trim();
  const shortId = w.id.slice(0, 8);
  if (typeName) {
    return w.version
      ? `${typeName} workflow v${w.version}`
      : `${typeName} workflow`;
  }
  return w.version
    ? `Workflow v${w.version} (${shortId})`
    : `Workflow ${shortId}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysSince(date: string | Date | null | undefined): number {
  if (!date) return 0;
  const d = new Date(date);
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
