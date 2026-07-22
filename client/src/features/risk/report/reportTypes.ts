/**
 * Payload shapes for the three Risk PDF reports.
 *
 * Each is assembled imperatively (outside React hooks) because the fan-out is
 * dynamic — a risk's controls, reviews, links and trail are separate calls, and
 * a register report pulls every risk it holds. Fields are snake_case because
 * they come straight off the API without remapping.
 */

/** The subset of the organisation record the branded chrome needs. */
export interface ReportOrg {
  name: string;
  logoUrl: string | null;
  reportFooterText: string | null;
}

export interface TrailEntry {
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  user_name: string;
  created_at: string;
}

export interface ScoreSnapshot {
  stage: string;
  factors: Record<string, number> | null;
  score: number;
  level_code: string;
  level_label: string;
  reason: string | null;
  user_name: string;
  created_at: string;
}

/** Report 1 — one risk, full detail. Downloaded from the risk workspace. */
export interface RiskReportData {
  org: ReportOrg;
  generatedAt: string;
  risk: Record<string, any>;
  history: ScoreSnapshot[];
  controls: Record<string, any>[];
  reviews: Record<string, any>[];
  acceptances: Record<string, any>[];
  trail: TrailEntry[];
  /** Framework in force, for printing the scale definitions behind the score. */
  framework: Record<string, any> | null;
}

/** Report 2 — a whole register: summary, heat map and every risk it holds. */
export interface RegisterReportData {
  org: ReportOrg;
  generatedAt: string;
  register: Record<string, any>;
  risks: Record<string, any>[];
  framework: Record<string, any> | null;
  heatmap: Record<string, any> | null;
  summary: Record<string, any> | null;
}

/** Report 3 — one assessment and its full worksheet. */
export interface AssessmentReportData {
  org: ReportOrg;
  generatedAt: string;
  assessment: Record<string, any>;
  lines: Record<string, any>[];
  /** Snapshot when approved, else the live framework — whichever the scores used. */
  framework: Record<string, any> | null;
  trail: TrailEntry[];
}
