/**
 * Assembles everything the risk-assessment (FMEA / matrix) PDF needs.
 *
 * Composed from existing endpoints — no new backend surface. The one rule that
 * matters here is WHICH FRAMEWORK gets printed: an approved assessment carries
 * `framework_snapshot`, an immutable copy of the scales it was actually judged
 * against. Printing today's live framework on a historical signed record would
 * misrepresent the analysis, so the snapshot always wins and the live framework
 * is only fetched when no snapshot exists.
 *
 * Optional calls (trail, directory, live framework) are individually guarded so
 * one failing section degrades to "unavailable" instead of killing the report.
 */
import { api } from '@/lib/api';
import type { AssessmentReportData, ReportOrg, TrailEntry } from './reportTypes';

type Bag = Record<string, any>;

/** Backend wraps GETs in { status, data }; some in { status, data: { data } }. */
const unwrap = <T>(raw: unknown): T => {
  const r = raw as { data?: unknown };
  return (r && typeof r === 'object' && 'data' in r ? (r.data ?? raw) : raw) as T;
};

/** Pull a list out of either a bare array or a paginated { data, total } payload. */
const listOf = (raw: unknown): Bag[] => {
  const p = unwrap<unknown>(raw);
  if (Array.isArray(p)) return p as Bag[];
  const inner = (p as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as Bag[]) : [];
};

const toOrg = (raw: unknown): ReportOrg => {
  const o = unwrap<Bag>(raw) ?? {};
  return {
    name: typeof o.name === 'string' ? o.name : '',
    logoUrl: typeof o.logoUrl === 'string' ? o.logoUrl : null,
    reportFooterText: typeof o.reportFooterText === 'string' ? o.reportFooterText : null,
  };
};

const toTrail = (raw: unknown): TrailEntry[] =>
  listOf(raw).map((e) => ({
    action: String(e.action ?? ''),
    field: e.field ?? null,
    old_value: e.old_value ?? null,
    new_value: e.new_value ?? null,
    reason: e.reason ?? null,
    user_name: String(e.user_name ?? e.user?.name ?? 'System'),
    created_at: String(e.created_at ?? ''),
  }));

/** id -> display name, from the people directory plus the assessment's own team. */
async function buildNameMap(assessment: Bag): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const m of (assessment.team_members as Bag[] | null) ?? []) {
    if (m?.id && m?.name) map.set(String(m.id), String(m.name));
  }
  try {
    const payload = unwrap<Bag>((await api.get('/users/directory')).data);
    const items = Array.isArray(payload?.items) ? (payload.items as Bag[]) : [];
    for (const u of items) if (u?.id && u?.name) map.set(String(u.id), String(u.name));
  } catch {
    // Directory unreadable — ids fall back to '—' rather than blocking the PDF.
  }
  return map;
}

export async function assembleAssessmentReportData(
  assessmentId: string,
): Promise<AssessmentReportData> {
  const [org, assessment, lines, trail] = await Promise.all([
    api
      .get('/organization')
      .then((r) => toOrg(r.data))
      .catch(() => ({ name: '', logoUrl: null, reportFooterText: null }) as ReportOrg),
    api.get(`/risk/assessments/${assessmentId}`).then((r) => unwrap<Bag>(r.data)),
    api
      .get(`/risk/assessments/${assessmentId}/lines`)
      .then((r) => listOf(r.data))
      .catch(() => [] as Bag[]),
    api
      .get(`/audit/trail/RiskAssessment/${assessmentId}`)
      .then((r) => toTrail(r.data))
      .catch(() => [] as TrailEntry[]),
  ]);

  // The snapshot is the scale in force when the analysis was signed — it always
  // wins. Only reach for the live framework when there is no snapshot at all.
  let framework: Bag | null = (assessment?.framework_snapshot as Bag | null) ?? null;
  const frameworkId = assessment?.framework_id ?? assessment?.framework?.id ?? null;
  if (!framework && frameworkId) {
    framework = await api
      .get(`/risk/frameworks/${frameworkId}`)
      .then((r) => unwrap<Bag>(r.data))
      .catch(() => null);
  }

  // The lines endpoint is authoritative; the detail payload carries them too and
  // covers the case where the dedicated call is unavailable.
  const rawLines = lines.length ? lines : ((assessment?.lines as Bag[] | null) ?? []);

  const names = await buildNameMap(assessment ?? {});
  const nameOf = (id: unknown): string | null =>
    id ? (names.get(String(id)) ?? null) : null;

  return {
    org,
    generatedAt: new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    assessment: {
      ...assessment,
      lead_name: nameOf(assessment?.lead_id),
      approved_by_name: nameOf(assessment?.approved_by_id),
      created_by_name: nameOf(assessment?.created_by_id),
    },
    lines: [...rawLines]
      .sort((a, b) => (a.line_number ?? 0) - (b.line_number ?? 0))
      .map((l) => ({ ...l, owner_name: nameOf(l.owner_id) })),
    framework,
    trail,
  };
}
