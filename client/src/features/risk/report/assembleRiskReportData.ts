/**
 * Assembles the dataset behind the single-risk PDF report.
 *
 * The fan-out is imperative (no hooks) because a download can be triggered from
 * anywhere — a list row, a detail header — and must not depend on what a page
 * happens to have in cache. Everything except the risk itself is optional: a
 * permission-denied or 500 on one sub-resource degrades that section to empty
 * rather than losing the whole report, exactly as the ticket assembler does.
 *
 * No @react-pdf import may ever reach this module — it is loaded eagerly by the
 * download entry point, while the PDF engine stays code-split.
 */
import { api } from '@/lib/api';
import { buildNameMap, stampNames, stampNamesAll } from './personDirectory';
import type { ReportOrg, RiskReportData, ScoreSnapshot, TrailEntry } from './reportTypes';

/** GETs are enveloped as { status, data }. Unwrap one level, defensively. */
const unwrapOne = <T,>(raw: unknown): T => {
  const r = raw as { data?: unknown } | null | undefined;
  return (r && typeof r === 'object' && 'data' in r ? (r.data as T) : (raw as T));
};

/**
 * Rows can arrive as `[...]`, `{ data: [...] }` (envelope) or
 * `{ data: { data: [...], total } }` (envelope + pagination). Peel until array.
 */
const asArray = <T,>(raw: unknown): T[] => {
  let cur: unknown = raw;
  for (let i = 0; i < 3; i += 1) {
    if (Array.isArray(cur)) return cur as T[];
    if (cur && typeof cur === 'object' && 'data' in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>).data;
    } else {
      return [];
    }
  }
  return Array.isArray(cur) ? (cur as T[]) : [];
};

const EMPTY_ORG: ReportOrg = { name: 'Quantum Kaizen', logoUrl: null, reportFooterText: null };

/**
 * /organization is not consistently enveloped — the ticket assembler reads
 * `r.data` straight. Accept either shape by preferring whichever object
 * actually carries the org fields.
 */
const toOrg = (raw: unknown): ReportOrg => {
  const outer = (raw ?? {}) as Record<string, any>;
  const inner = (outer.data ?? {}) as Record<string, any>;
  const src = outer.name || outer.logoUrl || outer.reportFooterText ? outer : inner;
  return {
    name: typeof src.name === 'string' && src.name.trim() ? src.name : EMPTY_ORG.name,
    logoUrl: typeof src.logoUrl === 'string' ? src.logoUrl : null,
    reportFooterText:
      typeof src.reportFooterText === 'string' && src.reportFooterText.trim()
        ? src.reportFooterText
        : null,
  };
};

const generatedStamp = (): string => {
  const d = new Date();
  return `${d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export async function assembleRiskReportData(riskId: string): Promise<RiskReportData> {
  const [orgRaw, riskRaw, historyRaw, controlsRaw, reviewsRaw, acceptancesRaw, trailRaw] =
    await Promise.all([
      api
        .get('/organization')
        .then((r) => r.data)
        .catch(() => null),
      // The only hard dependency: without the risk there is no report.
      api.get(`/risk/risks/${riskId}`).then((r) => r.data),
      api
        .get(`/risk/risks/${riskId}/history`)
        .then((r) => r.data)
        .catch(() => null),
      api
        .get(`/risk/risks/${riskId}/controls`)
        .then((r) => r.data)
        .catch(() => null),
      api
        .get(`/risk/risks/${riskId}/reviews`)
        .then((r) => r.data)
        .catch(() => null),
      api
        .get(`/risk/risks/${riskId}/acceptances`)
        .then((r) => r.data)
        .catch(() => null),
      api
        .get(`/audit/trail/Risk/${riskId}`)
        .then((r) => r.data)
        .catch(() => null),
    ]);

  const risk = (unwrapOne<Record<string, any>>(riskRaw) ?? {}) as Record<string, any>;

  // The scoring scales are the most valuable page in the report, but a missing
  // or unreadable framework must never cost the reader the other eleven.
  const frameworkId: string | undefined = risk?.framework?.id;
  const framework = frameworkId
    ? await api
        .get(`/risk/frameworks/${frameworkId}`)
        .then((r) => unwrapOne<Record<string, any>>(r.data) ?? null)
        .catch(() => null)
    : null;

  const controls = asArray<Record<string, any>>(controlsRaw);
  const reviews = asArray<Record<string, any>>(reviewsRaw);
  const acceptances = asArray<Record<string, any>>(acceptancesRaw);

  // Owner/verifier ids carry no name on the wire, so resolve them once and stamp
  // the rows — a report that says "Assigned" instead of naming a person is not
  // something you hand to an auditor.
  const names = await buildNameMap();
  stampNames(risk, names, ['owner']);
  stampNamesAll(controls, names, ['owner', 'verified_by']);
  stampNamesAll(reviews, names, ['reviewed_by']);
  stampNamesAll(acceptances, names, ['accepted_by']);

  return {
    org: toOrg(orgRaw),
    generatedAt: generatedStamp(),
    risk,
    history: asArray<ScoreSnapshot>(historyRaw),
    controls,
    reviews,
    acceptances,
    trail: asArray<TrailEntry>(trailRaw),
    framework: framework && typeof framework === 'object' ? framework : null,
  };
}
