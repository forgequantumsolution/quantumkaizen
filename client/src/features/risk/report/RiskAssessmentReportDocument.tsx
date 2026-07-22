/**
 * The signed analysis record: one risk assessment, its full worksheet, the
 * scales it was scored against and the approval that closed it.
 *
 * Two things govern this document.
 *
 *  1. THE COLUMNS ARE THE METHODOLOGY. An FMEA prints Item/Function → Failure
 *     Mode → Effect → S → Cause → O → Controls → D → RPN → AP; a matrix prints
 *     Hazard → Cause → Consequence → S → L → Score → Level. The factor columns
 *     are derived from the framework's own factors, exactly as the on-screen
 *     grid derives them, so the PDF and the workspace can never disagree.
 *  2. THE SCALES PRINTED ARE THE SCALES USED. An approved assessment carries an
 *     immutable `framework_snapshot`; that is what gets printed, and the
 *     document says so. Before approval there is no snapshot, so the live
 *     framework is printed — and the document says that too, alongside a
 *     "not an approved record" notice, so an unsigned worksheet can never be
 *     mistaken for a signed one.
 */
import { Document, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import {
  EmptyRow,
  KeyValues,
  LevelPill,
  ReportPage,
  Section,
  SignatureBlock,
  StatusPill,
  Table,
  dash,
  fmtDate,
  fmtDateTime,
  fmtFactors,
  styles,
} from './reportShared';
import { ACCEPTANCE_COLOR, REPORT } from './reportTheme';
import type { AssessmentReportData } from './reportTypes';

type Bag = Record<string, any>;

const FMEA_METHODOLOGIES = new Set(['FMEA', 'FMECA']);

const STATUS_COLOR: Record<string, string> = {
  APPROVED: REPORT.ok,
  REJECTED: REPORT.danger,
  CANCELLED: REPORT.danger,
  PENDING_APPROVAL: REPORT.warn,
  PENDING_REVIEW: REPORT.warn,
  PERIODIC_REVIEW: REPORT.warn,
  IN_ASSESSMENT: REPORT.info,
  DRAFT: REPORT.sub,
  SUPERSEDED: REPORT.sub,
  CLOSED: REPORT.sub,
};

/** Short column head for a factor — S/O/L/D/E is the language of the worksheet. */
const factorAbbr = (f: Bag): string => {
  switch (f?.kind) {
    case 'SEVERITY':
      return 'S';
    case 'OCCURRENCE':
      return 'O';
    case 'PROBABILITY':
      return 'L';
    case 'DETECTABILITY':
      return 'D';
    case 'EXPOSURE':
      return 'E';
    default:
      return String(f?.key || f?.label || '?')
        .slice(0, 2)
        .toUpperCase();
  }
};

interface FactorCol {
  key: string;
  header: string;
  label: string;
}

/**
 * Mirrors buildColumns() in RiskAssessmentDetailPage: severity first, then the
 * frequency factor, then detectability for FMEA, then anything else the
 * framework defines. Without a framework the factor keys are recovered from the
 * lines themselves so the worksheet still prints its recorded ranks.
 */
function buildFactorSlots(
  framework: Bag | null,
  lines: Bag[],
  isFmea: boolean,
): { severity: FactorCol[]; frequency: FactorCol[]; detect: FactorCol[]; rest: FactorCol[] } {
  const empty = { severity: [], frequency: [], detect: [], rest: [] as FactorCol[] };
  const factors: Bag[] = Array.isArray(framework?.factors)
    ? [...(framework!.factors as Bag[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  if (!factors.length) {
    const seen: string[] = [];
    for (const l of lines) {
      for (const k of Object.keys((l.initial_factors as Bag | null) ?? {})) {
        if (!seen.includes(k)) seen.push(k);
      }
    }
    return {
      ...empty,
      rest: seen.map((k) => ({ key: k, header: k.slice(0, 2).toUpperCase(), label: k })),
    };
  }

  const placed = new Set<string>();
  const toCol = (f: Bag): FactorCol => ({
    key: String(f.key),
    header: factorAbbr(f),
    label: String(f.label ?? f.key),
  });
  const take = (...kinds: string[]): FactorCol[] => {
    for (const k of kinds) {
      const f = factors.find((x) => x.kind === k && !placed.has(String(x.key)));
      if (f) {
        placed.add(String(f.key));
        return [toCol(f)];
      }
    }
    return [];
  };

  const severity = take('SEVERITY');
  const frequency = isFmea ? take('OCCURRENCE', 'PROBABILITY') : take('PROBABILITY', 'OCCURRENCE');
  const detect = isFmea ? take('DETECTABILITY') : [];
  const rest = factors
    .filter((f) => !placed.has(String(f.key)))
    .map((f) => {
      placed.add(String(f.key));
      return toCol(f);
    });

  return { severity, frequency, detect, rest };
}

/** The level a line resolved to — the embedded ref if present, else by id. */
function resolveLevel(line: Bag, framework: Bag | null, stage: 'initial' | 'residual'): Bag | null {
  const embedded = line[`${stage}_level`];
  if (embedded && typeof embedded === 'object' && (embedded.code || embedded.label)) return embedded;
  const id = line[`${stage}_level_id`] ?? embedded?.id;
  if (!id || !Array.isArray(framework?.levels)) return null;
  return (framework!.levels as Bag[]).find((l) => l.id === id) ?? null;
}

const band = (l: Bag): string => {
  const lo = l.min_score;
  const hi = l.max_score;
  if (lo === null || lo === undefined) return hi === null || hi === undefined ? '—' : `≤ ${hi}`;
  if (hi === null || hi === undefined) return `≥ ${lo}`;
  return `${lo} – ${hi}`;
};

// ── Worksheet cells ─────────────────────────────────────────────────────────

const Num = ({ v }: { v: unknown }) => (
  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
    {v === 0 || v ? String(v) : '—'}
  </Text>
);

/** Line number, with the critical flag called out where it applies. */
function LineNoCell({ line, index }: { line: Bag; index: number }) {
  return (
    <View>
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
        {line.line_number ?? index + 1}
      </Text>
      {line.is_critical ? (
        <Text style={{ fontSize: 6, color: REPORT.danger, fontFamily: 'Helvetica-Bold' }}>
          CRIT
        </Text>
      ) : null}
    </View>
  );
}

/** Score cell: the computed score, the band it fell in, and any residual score. */
function ScoreCell({
  score,
  level,
  residual,
  withPill,
}: {
  score: unknown;
  level: Bag | null;
  residual: unknown;
  withPill: boolean;
}) {
  return (
    <View>
      <Num v={score} />
      {withPill && level ? (
        <View style={{ marginTop: 2 }}>
          <LevelPill code={level.code} label={level.label} color={level.color} />
        </View>
      ) : null}
      {residual === 0 || residual ? (
        <Text style={{ fontSize: 6.8, color: REPORT.sub, marginTop: 2 }}>
          Residual {String(residual)}
        </Text>
      ) : null}
    </View>
  );
}

function Worksheet({ data }: { data: AssessmentReportData }) {
  const { assessment, lines, framework } = data;
  const methodology = String(assessment.methodology ?? framework?.methodology ?? 'MATRIX');
  const isFmea = FMEA_METHODOLOGIES.has(methodology);
  const slots = buildFactorSlots(framework, lines, isFmea);

  const factorCols = isFmea
    ? [...slots.severity, ...slots.frequency, ...slots.detect, ...slots.rest]
    : [...slots.severity, ...slots.frequency, ...slots.rest];

  const rank = (line: Bag, key: string) => (line.initial_factors ?? {})[key];

  const columns: string[] = [];
  const widths: number[] = [];
  const cells: ((line: Bag, index: number) => string | ReactNode)[] = [];

  const col = (
    header: string,
    width: number,
    render: (line: Bag, index: number) => string | ReactNode,
  ) => {
    columns.push(header);
    widths.push(width);
    cells.push(render);
  };

  col('#', 0.34, (l, i) => <LineNoCell line={l} index={i} />);

  if (isFmea) {
    col('Item & Function', 1.45, (l) => dash(l.item_function));
    col('Failure Mode', 1.35, (l) => dash(l.failure_mode));
    col('Effect', 1.3, (l) => dash(l.effect));
    for (const f of slots.severity) col(f.header, 0.3, (l) => <Num v={rank(l, f.key)} />);
    col('Cause', 1.3, (l) => dash(l.cause));
    for (const f of slots.frequency) col(f.header, 0.3, (l) => <Num v={rank(l, f.key)} />);
    col('Current Controls', 1.35, (l) => dash(l.current_controls));
    for (const f of slots.detect) col(f.header, 0.3, (l) => <Num v={rank(l, f.key)} />);
    for (const f of slots.rest) col(f.header, 0.3, (l) => <Num v={rank(l, f.key)} />);
    col('RPN', 0.85, (l) => (
      <ScoreCell
        score={l.initial_score}
        level={resolveLevel(l, framework, 'initial')}
        residual={l.residual_score}
        withPill
      />
    ));
    col('AP', 0.5, (l) => dash(l.action_priority));
  } else {
    col('Hazard', 1.5, (l) => dash(l.hazard));
    col('Cause', 1.3, (l) => dash(l.cause));
    col('Consequence', 1.45, (l) => dash(l.consequence));
    for (const f of factorCols) col(f.header, 0.3, (l) => <Num v={rank(l, f.key)} />);
    col('Score', 0.7, (l) => (
      <ScoreCell
        score={l.initial_score}
        level={null}
        residual={l.residual_score}
        withPill={false}
      />
    ));
    col('Level', 0.9, (l) => {
      const lvl = resolveLevel(l, framework, 'initial');
      return lvl ? <LevelPill code={lvl.code} label={lvl.label} color={lvl.color} /> : '—';
    });
  }

  col('Recommended Action', 1.5, (l) => dash(l.recommended_action));
  col('Owner', 0.75, (l) => dash(l.owner_name));
  col('Due', 0.62, (l) => fmtDate(l.due_date));

  const criticalCount = lines.filter((l) => l.is_critical).length;
  const note =
    `${lines.length} line${lines.length === 1 ? '' : 's'}` +
    (criticalCount ? ` · ${criticalCount} flagged critical (marked CRIT)` : '') +
    ' · scores, levels and action priorities are computed and stored by the server from the ranks recorded here.';

  return (
    <Section title={isFmea ? `${methodology} worksheet` : 'Risk matrix worksheet'} note={note}>
      <Table
        columns={columns}
        widths={widths}
        rows={lines.map((line, i) => cells.map((render) => render(line, i)))}
      />
    </Section>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

function PromotedRisks({ data }: { data: AssessmentReportData }) {
  const promoted = data.lines.filter((l) => l.risk_id || l.risk?.risk_number);
  return (
    <Section
      title="Risks promoted to the register"
      note="The audit link between this analysis and the tracked risk register."
    >
      {promoted.length ? (
        <Table
          columns={['Line', 'Subject', 'Risk number', 'Owner', 'Due']}
          widths={[0.4, 2.4, 1, 1, 0.8]}
          rows={promoted.map((l) => [
            String(l.line_number ?? '—'),
            dash(l.failure_mode || l.hazard || l.item_function),
            dash(l.risk?.risk_number ?? l.risk?.riskNumber),
            dash(l.owner_name),
            fmtDate(l.due_date),
          ])}
        />
      ) : (
        <EmptyRow label="No worksheet line has been promoted to a tracked risk." />
      )}
    </Section>
  );
}

function ScoringBasis({ data }: { data: AssessmentReportData }) {
  const { framework, assessment } = data;
  const usedSnapshot = !!assessment.framework_snapshot;
  const note = usedSnapshot
    ? 'Scales as frozen at approval — this assessment carries an immutable framework snapshot, and the scores below were computed against it. Later changes to the live framework do not apply to this record.'
    : 'Live framework — assessment not yet approved. No snapshot has been taken, so the scales below are the framework as it stands today and may change until this assessment is approved.';

  if (!framework) {
    return (
      <Section title="Scoring basis" note={note}>
        <EmptyRow label="No scoring framework resolved for this assessment." />
      </Section>
    );
  }

  const factors: Bag[] = Array.isArray(framework.factors)
    ? [...(framework.factors as Bag[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const levels: Bag[] = Array.isArray(framework.levels)
    ? [...(framework.levels as Bag[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  return (
    <Section title="Scoring basis" note={note}>
      <KeyValues
        items={[
          { label: 'Framework', value: dash(framework.name) },
          { label: 'Standard', value: dash(framework.standard) },
          { label: 'Methodology', value: dash(framework.methodology) },
          { label: 'Formula', value: dash(framework.formula) },
        ]}
      />

      {factors.map((f) => {
        const fLevels: Bag[] = Array.isArray(f.levels)
          ? [...(f.levels as Bag[])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
          : [];
        return (
          <View key={String(f.key ?? f.id)} style={{ marginTop: 10 }} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 4 }}>
              {`${factorAbbr(f)} · ${dash(f.label)}`}
              <Text style={{ fontFamily: 'Helvetica', color: REPORT.sub }}>
                {`  (${dash(f.key)})`}
              </Text>
            </Text>
            <Table
              columns={['Rank', 'Label', 'Definition']}
              widths={[0.35, 1, 2.6]}
              rows={fLevels.map((l) => [String(l.rank ?? '—'), dash(l.label), dash(l.definition)])}
            />
          </View>
        );
      })}

      <View style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 4 }}>
          Risk level bands
        </Text>
        <Table
          columns={['Level', 'Band', 'Acceptance', 'CAPA required', 'Review']}
          widths={[1.1, 0.7, 0.9, 0.8, 0.7]}
          rows={levels.map((l) => [
            <LevelPill code={l.code} label={l.label} color={l.color} />,
            band(l),
            <Text
              style={{
                color: ACCEPTANCE_COLOR[String(l.acceptance ?? '')] ?? REPORT.sub,
                fontFamily: 'Helvetica-Bold',
                fontSize: 8,
              }}
            >
              {dash(l.acceptance)}
            </Text>,
            l.requires_capa ? 'Yes' : 'No',
            l.review_months ? `${l.review_months} mo` : '—',
          ])}
        />
      </View>
    </Section>
  );
}

/**
 * Residual scoring is optional and only recorded on some lines, so it gets its
 * own short table rather than widening the worksheet for every assessment.
 */
function ResidualScoring({ data }: { data: AssessmentReportData }) {
  const scored = data.lines.filter(
    (l) => l.residual_factors || l.residual_score === 0 || l.residual_score,
  );
  if (!scored.length) return null;
  return (
    <Section
      title="Residual scoring"
      note="Where the worksheet records a score after the recommended action is in place."
    >
      <Table
        columns={['Line', 'Subject', 'Residual ranks', 'Residual score', 'Residual level']}
        widths={[0.4, 1.9, 1.1, 0.8, 1]}
        rows={scored.map((l) => {
          const lvl = resolveLevel(l, data.framework, 'residual');
          return [
            String(l.line_number ?? '—'),
            dash(l.failure_mode || l.hazard || l.item_function),
            fmtFactors(l.residual_factors),
            dash(l.residual_score),
            lvl ? <LevelPill code={lvl.code} label={lvl.label} color={lvl.color} /> : '—',
          ];
        })}
      />
    </Section>
  );
}

function ApprovalRecord({ data }: { data: AssessmentReportData }) {
  const a = data.assessment;
  const approved = a.status === 'APPROVED';
  return (
    <Section
      title="Approval record"
      note={
        approved
          ? 'This version is approved and locked. Its worksheet and framework snapshot are frozen; any change requires a new revision.'
          : 'This version is NOT approved. It carries no signature and must not be relied upon as a completed risk analysis.'
      }
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: approved ? REPORT.ok : REPORT.warn,
          borderRadius: 4,
          padding: 8,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: 'Helvetica-Bold',
            fontSize: 9,
            color: approved ? REPORT.ok : REPORT.warn,
          }}
        >
          {approved
            ? `APPROVED — ${dash(a.approved_by_name)} on ${fmtDateTime(a.approved_at)}`
            : `NOT APPROVED — current status ${dash(a.status)}`}
        </Text>
      </View>
      <KeyValues
        items={[
          { label: 'Status', value: dash(a.status) },
          { label: 'Version', value: `v${dash(a.version)}` },
          { label: 'Approved by', value: dash(a.approved_by_name) },
          { label: 'Approved at', value: fmtDateTime(a.approved_at) },
          {
            label: 'Supersedes',
            value: a.parent?.assessment_number
              ? `${a.parent.assessment_number} (v${dash(a.parent.version)})`
              : a.parent_id
                ? 'Earlier version of this assessment'
                : 'Initial version — supersedes nothing',
          },
          { label: 'Framework basis', value: a.framework_snapshot ? 'Snapshot frozen at approval' : 'Live framework (no snapshot)' },
          { label: 'Completed at', value: fmtDateTime(a.completed_at) },
          { label: 'Next review', value: fmtDate(a.next_review_at) },
        ]}
      />
      {Array.isArray(a.versions) && a.versions.length > 1 ? (
        <View style={{ marginTop: 8 }}>
          <Table
            columns={['Assessment', 'Version', 'Status', 'This document']}
            widths={[1.4, 0.6, 1, 0.9]}
            rows={(a.versions as Bag[]).map((v) => [
              dash(v.assessment_number),
              `v${dash(v.version)}`,
              dash(v.status),
              v.id === a.id ? 'Yes' : '—',
            ])}
          />
        </View>
      ) : null}
    </Section>
  );
}

function AuditTrail({ data }: { data: AssessmentReportData }) {
  return (
    <Section title="Audit trail" note="Every recorded change to this assessment, in order.">
      {data.trail.length ? (
        <Table
          columns={['When', 'Who', 'Action', 'Field', 'Change', 'Reason']}
          widths={[1, 0.9, 0.8, 0.8, 1.6, 1.2]}
          rows={data.trail.map((t) => [
            fmtDateTime(t.created_at),
            dash(t.user_name),
            dash(t.action),
            dash(t.field),
            t.old_value || t.new_value ? `${dash(t.old_value)} → ${dash(t.new_value)}` : '—',
            dash(t.reason),
          ])}
        />
      ) : (
        <EmptyRow label="No audit trail entries are available for this assessment." />
      )}
    </Section>
  );
}

// ── Document ────────────────────────────────────────────────────────────────

export default function RiskAssessmentReportDocument(data: AssessmentReportData) {
  const { org, generatedAt, assessment, lines, framework } = data;
  const recordId = String(assessment.assessment_number ?? '');
  const approved = assessment.status === 'APPROVED';
  const team: Bag[] = Array.isArray(assessment.team_members) ? assessment.team_members : [];
  const usedSnapshot = !!assessment.framework_snapshot;

  const page = { org, kicker: 'RISK ASSESSMENT', recordId, generatedAt };

  return (
    <Document
      title={`${recordId} — Risk assessment report`}
      author={org.name || 'Quantum Kaizen'}
      subject={String(assessment.title ?? '')}
    >
      {/* Page 1 — identity and particulars */}
      <ReportPage {...page}>
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>{recordId}</Text>
          <Text style={styles.coverTitle}>{dash(assessment.title)}</Text>
          <View style={styles.coverStrip}>
            {[
              { label: 'Methodology', value: dash(assessment.methodology) },
              { label: 'Status', value: dash(assessment.status) },
              { label: 'Version', value: `v${dash(assessment.version)}` },
              {
                label: 'Worksheet lines',
                value: `${lines.length}`,
              },
            ].map((s) => (
              <View key={s.label} style={styles.coverStat}>
                <Text style={styles.coverStatLabel}>{s.label}</Text>
                <Text style={styles.coverStatValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {!approved ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: REPORT.warn,
              backgroundColor: REPORT.goldSoft,
              borderRadius: 4,
              padding: 9,
              marginBottom: 6,
            }}
          >
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: REPORT.warn }}>
              DRAFT — not an approved record
            </Text>
            <Text style={{ fontSize: 8, color: REPORT.sub, marginTop: 3 }}>
              {`This assessment is at status ${dash(assessment.status)}. It has not been approved or electronically signed, no framework snapshot has been taken, and the worksheet below may still change. Do not treat this document as a completed risk analysis.`}
            </Text>
          </View>
        ) : null}

        <Section title="Assessment particulars">
          <KeyValues
            items={[
              { label: 'Objective', value: dash(assessment.objective), full: true },
              { label: 'Scope', value: dash(assessment.scope_text), full: true },
              { label: 'Register', value: assessment.register?.name
                  ? `${dash(assessment.register.registerNumber ?? assessment.register.register_number)} — ${assessment.register.name}`
                  : '—' },
              {
                label: 'Framework',
                value: framework?.name
                  ? `${framework.name}${framework.formula ? ` · ${framework.formula}` : ''}`
                  : dash(assessment.framework?.name),
              },
              { label: 'Assessment lead', value: dash(assessment.lead_name) },
              { label: 'Team members', value: team.length
                  ? team.map((m) => `${m.name}${m.role ? ` (${m.role})` : ''}`).join(', ')
                  : '—' },
              {
                label: 'Trigger',
                value: assessment.trigger_type
                  ? `${assessment.trigger_type}${assessment.trigger_id ? ` · ${assessment.trigger_id}` : ''}`
                  : '—',
              },
              { label: 'Created', value: fmtDateTime(assessment.created_at) },
              { label: 'Started', value: fmtDate(assessment.started_at) },
              { label: 'Completed', value: fmtDate(assessment.completed_at) },
              { label: 'Approved', value: fmtDateTime(assessment.approved_at) },
              { label: 'Next review', value: fmtDate(assessment.next_review_at) },
            ]}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <StatusPill
              value={String(assessment.status ?? '')}
              color={STATUS_COLOR[String(assessment.status ?? '')] ?? REPORT.sub}
            />
            <Text style={{ fontSize: 8, color: REPORT.sub, marginLeft: 8 }}>
              {usedSnapshot
                ? 'Scored against the framework snapshot frozen at approval.'
                : 'Scored against the live framework — no snapshot exists yet.'}
            </Text>
          </View>
        </Section>
      </ReportPage>

      {/* Page 2 — the worksheet, landscape because it will not fit portrait */}
      <ReportPage {...page} orientation="landscape">
        <Worksheet data={data} />
      </ReportPage>

      {/* Page 3 — links, scales, conclusion, approval, trail */}
      <ReportPage {...page}>
        <PromotedRisks data={data} />
        <ScoringBasis data={data} />

        <Section title="Conclusion">
          <Text style={{ fontSize: 9.5 }}>{dash(assessment.conclusion)}</Text>
          {assessment.rejection_reason ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ ...styles.kvLabel, color: REPORT.danger }}>Rejection reason</Text>
              <Text style={{ fontSize: 9.5, color: REPORT.danger }}>
                {String(assessment.rejection_reason)}
              </Text>
            </View>
          ) : null}
        </Section>

        <ResidualScoring data={data} />

        <ApprovalRecord data={data} />
        <AuditTrail data={data} />
        <SignatureBlock
          note={
            approved
              ? 'This assessment was electronically signed on approval; the block below is for the printed copy.'
              : 'This assessment is not approved. Signing below does not constitute approval of the record.'
          }
        />
      </ReportPage>
    </Document>
  );
}
