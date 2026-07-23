import { api } from '@/lib/api';
import { buildNameMap, stampNames, stampNamesAll } from './personDirectory';
import type { RegisterReportData, ReportOrg } from './reportTypes';

// Risk GETs are enveloped as { status, data } and list endpoints nest
// { data: [...], total } inside that. Unwrap defensively so the assembler works
// whether or not a given route is wrapped.
const unwrap = <T>(raw: unknown): T => {
  const r = raw as { data?: unknown };
  return (r?.data ?? raw) as T;
};

const listOf = (raw: unknown): Record<string, any>[] => {
  const payload = unwrap<unknown>(raw);
  if (Array.isArray(payload)) return payload as Record<string, any>[];
  const inner = (payload as { data?: unknown })?.data;
  return Array.isArray(inner) ? (inner as Record<string, any>[]) : [];
};

const toOrg = (raw: unknown): ReportOrg => {
  const o = unwrap<Record<string, any>>(raw) ?? {};
  return {
    name: o.name ?? o.orgName ?? 'Quantum Kaizen',
    logoUrl: o.logoUrl ?? o.logo_url ?? null,
    reportFooterText: o.reportFooterText ?? o.report_footer_text ?? null,
  };
};

/**
 * Fetches and assembles everything the register PDF prints: the register
 * record, every risk it holds, the residual heat map, the summary counters and
 * the governing framework (for the level bands behind the matrix colours).
 *
 * Only the register itself and its risks are required — each analytic call is
 * wrapped so a failing endpoint degrades that one section to empty rather than
 * failing the whole download.
 */
export async function assembleRegisterReportData(registerId: string): Promise<RegisterReportData> {
  const [org, register, risks, heatmap, summary] = await Promise.all([
    api
      .get('/organization')
      .then((r) => toOrg(r.data))
      .catch(() => ({ name: 'Quantum Kaizen', logoUrl: null, reportFooterText: null }) as ReportOrg),
    api.get(`/risk/registers/${registerId}`).then((r) => unwrap<Record<string, any>>(r.data)),
    api
      .get('/risk/risks', { params: { registerId, pageSize: 200 } })
      .then((r) => listOf(r.data))
      .catch(() => [] as Record<string, any>[]),
    api
      .get('/risk/analytics/heatmap', { params: { registerId, stage: 'RESIDUAL' } })
      .then((r) => unwrap<Record<string, any>>(r.data))
      .catch(() => null),
    api
      .get('/risk/analytics/summary', { params: { registerId } })
      .then((r) => unwrap<Record<string, any>>(r.data))
      .catch(() => null),
  ]);

  const frameworkId = register?.framework?.id ?? null;
  const framework = frameworkId
    ? await api
        .get(`/risk/frameworks/${frameworkId}`)
        .then((r) => unwrap<Record<string, any>>(r.data))
        .catch(() => null)
    : null;

  // Resolve owner ids to names once for the register and every risk in it.
  const names = await buildNameMap();
  stampNames(register as Record<string, any>, names, ['owner']);
  stampNamesAll(risks, names, ['owner']);

  return {
    org,
    generatedAt: new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    register: register ?? {},
    risks,
    framework,
    heatmap,
    summary,
  };
}
