/**
 * Report 2 — the risk register, as handed to an auditor or client.
 *
 * Structure: cover band + register particulars, the risk profile (level and
 * status distribution drawn as proportional bars), the residual heat map
 * reconstructed from the analytics axes, the full risk table on a landscape
 * page, then the exceptions (overdue / unscored) and the signature block.
 *
 * Every figure printed here comes from the assembled API payload — nothing is
 * derived beyond counting, percentages and the row × column score used to
 * colour a matrix cell.
 */
import { Document, Text, View } from '@react-pdf/renderer';
import { REPORT, levelColor } from './reportTheme';
import type { RegisterReportData } from './reportTypes';
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
  styles,
  titleCase,
} from './reportShared';

const KICKER = 'RISK REGISTER';

type Level = {
  code: string;
  label: string;
  color: string | null;
  min_score: number | null;
  max_score: number | null;
  acceptance: string | null;
};

type AxisLevel = { rank: number; label: string; color?: string | null };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const pct = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);

/** Framework bands, normalised. Empty when no framework resolved. */
function levelsOf(framework: Record<string, any> | null): Level[] {
  const raw = framework?.levels;
  if (!Array.isArray(raw)) return [];
  return raw.map((l: Record<string, any>) => ({
    code: String(l.code ?? ''),
    label: String(l.label ?? titleCase(l.code)),
    color: l.color ?? null,
    min_score: typeof l.min_score === 'number' ? l.min_score : null,
    max_score: typeof l.max_score === 'number' ? l.max_score : null,
    acceptance: l.acceptance ?? null,
  }));
}

/** Match a score against the framework bands (inclusive, open-ended either side). */
function bandForScore(levels: Level[], score: number): Level | null {
  return (
    levels.find(
      (l) =>
        (l.min_score === null || score >= l.min_score) &&
        (l.max_score === null || score <= l.max_score),
    ) ?? null
  );
}

/* ── Risk profile ───────────────────────────────────────────────────────── */

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const share = pct(count, total);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
      <Text style={{ width: 92, fontSize: 8, color: REPORT.ink }}>{label}</Text>
      <View
        style={{
          flex: 1,
          height: 10,
          backgroundColor: REPORT.navySoft,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Bars are plain Views — @react-pdf has no chart primitive. */}
        <View
          style={{
            width: `${Math.max(share, count > 0 ? 1.5 : 0)}%`,
            height: 10,
            backgroundColor: color,
          }}
        />
      </View>
      <Text
        style={{
          width: 74,
          textAlign: 'right',
          fontSize: 8,
          fontFamily: 'Helvetica-Bold',
          color: REPORT.sub,
        }}
      >
        {`${count}  ·  ${share.toFixed(1)}%`}
      </Text>
    </View>
  );
}

function RiskProfile({ data }: { data: RegisterReportData }) {
  const levels = levelsOf(data.framework);
  const byLevel = (data.heatmap?.by_level ?? {}) as Record<string, number>;
  const byStatus = (data.summary?.by_status ?? {}) as Record<string, number>;

  // Prefer the framework's own band order; fall back to whatever the analytics
  // endpoint reported.
  const levelCodes = levels.length ? levels.map((l) => l.code) : Object.keys(byLevel);
  const rows = levelCodes.map((code) => {
    const band = levels.find((l) => l.code === code);
    return {
      code,
      label: band?.label ?? titleCase(code),
      count: num(byLevel[code]),
      color: levelColor(code, band?.color),
    };
  });

  const unscored = num(data.heatmap?.unscored ?? data.summary?.unscored);
  const scored = rows.reduce((s, r) => s + r.count, 0);
  const levelTotal = scored + unscored;

  const statusRows = Object.entries(byStatus).map(([k, v]) => ({ code: k, count: num(v) }));
  const statusTotal = statusRows.reduce((s, r) => s + r.count, 0);

  return (
    <Section
      title="Risk profile"
      note="Distribution of the register's risks by residual level and by workflow status."
    >
      <Text style={{ fontSize: 7, color: REPORT.faint, textTransform: 'uppercase', marginBottom: 5 }}>
        By residual level
      </Text>
      {levelTotal === 0 ? (
        <EmptyRow label="No scored risks in this register." />
      ) : (
        <View>
          {rows.map((r) => (
            <DistributionBar
              key={r.code}
              label={r.label}
              count={r.count}
              total={levelTotal}
              color={r.color}
            />
          ))}
          {unscored > 0 ? (
            <DistributionBar
              label="Unscored"
              count={unscored}
              total={levelTotal}
              color={levelColor('UNSCORED')}
            />
          ) : null}
        </View>
      )}

      <Text
        style={{
          fontSize: 7,
          color: REPORT.faint,
          textTransform: 'uppercase',
          marginTop: 10,
          marginBottom: 5,
        }}
      >
        By status
      </Text>
      {statusTotal === 0 ? (
        <EmptyRow label="No status breakdown available." />
      ) : (
        <View>
          {statusRows.map((r) => (
            <DistributionBar
              key={r.code}
              label={titleCase(r.code)}
              count={r.count}
              total={statusTotal}
              color={REPORT.navy}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

/* ── Residual heat map ──────────────────────────────────────────────────── */

function HeatMap({ data }: { data: RegisterReportData }) {
  const hm = data.heatmap;
  const rowAxis = hm?.axes?.row as { key?: string; label?: string; levels?: AxisLevel[] } | undefined;
  const colAxis = hm?.axes?.col as { key?: string; label?: string; levels?: AxisLevel[] } | undefined;
  const rowLevels = Array.isArray(rowAxis?.levels) ? (rowAxis!.levels as AxisLevel[]) : [];
  const colLevels = Array.isArray(colAxis?.levels) ? (colAxis!.levels as AxisLevel[]) : [];

  const note = `Residual risk position of ${dash(num(hm?.total))} scored risk(s)${
    num(hm?.unscored) ? `; ${num(hm?.unscored)} unscored and therefore not plotted` : ''
  }.`;

  if (!rowLevels.length || !colLevels.length) {
    return (
      <Section title="Residual risk heat map" note="Matrix as defined by the governing framework.">
        <EmptyRow label="Heat map unavailable — no scoring matrix resolved for this register." />
      </Section>
    );
  }

  const levels = levelsOf(data.framework);
  const cells = (Array.isArray(hm?.cells) ? hm!.cells : []) as {
    row_rank: number;
    col_rank: number;
    count: number;
  }[];
  const countAt = (r: number, c: number) =>
    num(cells.find((x) => x.row_rank === r && x.col_rank === c)?.count);

  // Rows descend so the highest severity sits at the top, as in a real matrix.
  const rows = [...rowLevels].sort((a, b) => b.rank - a.rank);
  const cols = [...colLevels].sort((a, b) => a.rank - b.rank);

  const HEAD = 78; // width of the row-label column

  return (
    <Section title="Residual risk heat map" note={note}>
      <View style={{ flexDirection: 'row' }} wrap={false}>
        {/* Row-axis caption */}
        <View style={{ width: 12, justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: 6.5,
              color: REPORT.sub,
              fontFamily: 'Helvetica-Bold',
              textTransform: 'uppercase',
              transform: 'rotate(-90deg)',
              width: 90,
              marginLeft: -39,
              textAlign: 'center',
            }}
          >
            {dash(rowAxis?.label ?? rowAxis?.key)}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {/* Column headers */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: HEAD }} />
            {cols.map((c) => (
              <View key={`h-${c.rank}`} style={{ flex: 1, paddingHorizontal: 1, paddingBottom: 3 }}>
                <Text style={{ fontSize: 6.4, color: REPORT.sub, textAlign: 'center' }}>
                  {`${c.rank} · ${dash(c.label)}`}
                </Text>
              </View>
            ))}
          </View>

          {rows.map((r) => (
            <View key={`r-${r.rank}`} style={{ flexDirection: 'row', marginBottom: 2 }}>
              <View style={{ width: HEAD, justifyContent: 'center', paddingRight: 5 }}>
                <Text style={{ fontSize: 6.4, color: REPORT.sub, textAlign: 'right' }}>
                  {`${r.rank} · ${dash(r.label)}`}
                </Text>
              </View>
              {cols.map((c) => {
                const score = r.rank * c.rank;
                const band = bandForScore(levels, score);
                const bg = band ? levelColor(band.code, band.color) : REPORT.navySoft;
                const count = countAt(r.rank, c.rank);
                return (
                  <View
                    key={`c-${r.rank}-${c.rank}`}
                    style={{
                      flex: 1,
                      height: 30,
                      marginHorizontal: 1,
                      borderRadius: 2,
                      backgroundColor: bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {count > 0 ? (
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: 'Helvetica-Bold',
                          color: band ? REPORT.white : REPORT.sub,
                        }}
                      >
                        {String(count)}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 5.5,
                        color: band ? REPORT.white : REPORT.faint,
                        opacity: 0.85,
                      }}
                    >
                      {String(score)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Column-axis caption */}
          <View style={{ flexDirection: 'row', marginTop: 3 }}>
            <View style={{ width: HEAD }} />
            <Text
              style={{
                flex: 1,
                fontSize: 6.5,
                color: REPORT.sub,
                fontFamily: 'Helvetica-Bold',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {dash(colAxis?.label ?? colAxis?.key)}
            </Text>
          </View>
        </View>
      </View>

      {/* Band legend */}
      {levels.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {levels.map((l) => (
            <View
              key={l.code}
              style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  marginRight: 4,
                  backgroundColor: levelColor(l.code, l.color),
                }}
              />
              <Text style={{ fontSize: 7, color: REPORT.sub }}>
                {`${l.label}  ${dash(l.min_score)}–${dash(l.max_score)}${
                  l.acceptance ? `  ·  ${titleCase(l.acceptance)}` : ''
                }`}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 7.5, color: REPORT.faint, marginTop: 8 }}>
          No framework bands resolved — cells show the row × column score only.
        </Text>
      )}
    </Section>
  );
}

/* ── Risk rows ──────────────────────────────────────────────────────────── */

const ownerOf = (r: Record<string, any>): string =>
  r.owner_name ?? r.owner?.name ?? (r.owner_id ? 'Assigned' : '—');

const isUnscored = (r: Record<string, any>): boolean =>
  !r.residual_level?.code && !r.initial_level?.code;

function riskRow(r: Record<string, any>) {
  return [
    dash(r.risk_number),
    dash(r.title),
    dash(r.category?.name),
    <StatusPill key="s" value={r.status} />,
    <LevelPill
      key="i"
      code={r.initial_level?.code}
      label={r.initial_level?.label}
      color={r.initial_level?.color}
      score={typeof r.initial_score === 'number' ? r.initial_score : null}
    />,
    <LevelPill
      key="r"
      code={r.residual_level?.code}
      label={r.residual_level?.label}
      color={r.residual_level?.color}
      score={typeof r.residual_score === 'number' ? r.residual_score : null}
    />,
    ownerOf(r),
    <Text key="n" style={{ fontSize: 8.2, color: r.is_review_overdue ? REPORT.danger : REPORT.ink }}>
      {`${fmtDate(r.next_review_at)}${r.is_review_overdue ? '  (overdue)' : ''}`}
    </Text>,
  ];
}

/* ── Document ───────────────────────────────────────────────────────────── */

export default function RiskRegisterReportDocument(data: RegisterReportData) {
  const { org, generatedAt, register, risks, framework, summary, heatmap } = data;
  const recordId = dash(register?.register_number);

  const total = num(summary?.total ?? register?.risk_count ?? risks.length);
  const overdue = num(summary?.overdue_reviews);
  const unscored = num(summary?.unscored ?? heatmap?.unscored);

  const attention = risks.filter((r) => r.is_review_overdue || isUnscored(r));

  const page = { org, kicker: KICKER, recordId, generatedAt };

  return (
    <Document
      title={`${recordId} — Risk Register Report`}
      author={org.name || 'Quantum Kaizen'}
      subject={dash(register?.name)}
    >
      <ReportPage {...page}>
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>RISK REGISTER · {recordId}</Text>
          <Text style={styles.coverTitle}>{dash(register?.name)}</Text>
          <View style={styles.coverStrip}>
            {[
              { label: 'Total risks', value: String(total) },
              { label: 'Overdue reviews', value: String(overdue) },
              { label: 'Unscored', value: String(unscored) },
              { label: 'Framework', value: dash(framework?.name ?? register?.framework?.name) },
            ].map((s) => (
              <View key={s.label} style={styles.coverStat}>
                <Text style={styles.coverStatLabel}>{s.label}</Text>
                <Text style={styles.coverStatValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Section title="Register particulars">
          <KeyValues
            items={[
              { label: 'Register number', value: dash(register?.register_number) },
              { label: 'Status', value: register?.is_active === false ? 'Inactive' : 'Active' },
              { label: 'Scope', value: titleCase(register?.scope) },
              { label: 'Scope reference', value: dash(register?.scope_ref) },
              {
                label: 'Framework',
                value: dash(framework?.name ?? register?.framework?.name),
              },
              {
                label: 'Methodology',
                value: titleCase(framework?.methodology ?? register?.framework?.methodology),
              },
              { label: 'Standard', value: dash(framework?.standard) },
              {
                label: 'Scoring formula',
                value: dash(framework?.formula ?? register?.framework?.formula),
              },
              { label: 'Owner', value: ownerOf(register ?? {}) },
              {
                label: 'Site / department',
                value: `${register?.site_id ? 'Site assigned' : 'All sites'} · ${
                  register?.department_id ? 'Department assigned' : 'All departments'
                }`,
              },
              { label: 'Created', value: fmtDate(register?.created_at) },
              { label: 'Risks held', value: String(num(register?.risk_count ?? risks.length)) },
              { label: 'Description', value: dash(register?.description), full: true },
            ]}
          />
        </Section>

        <RiskProfile data={data} />
      </ReportPage>

      <ReportPage {...page}>
        <HeatMap data={data} />
      </ReportPage>

      <ReportPage {...page} orientation="landscape">
        <Section
          title="Risk register"
          note={`All ${risks.length} risk(s) held in this register, as at ${generatedAt}.`}
        >
          <Table
            columns={[
              'Risk #',
              'Title',
              'Category',
              'Status',
              'Initial',
              'Residual',
              'Owner',
              'Next review',
            ]}
            widths={[1.1, 3.4, 1.4, 1.2, 1.5, 1.5, 1.2, 1.4]}
            rows={risks.map(riskRow)}
          />
        </Section>
      </ReportPage>

      <ReportPage {...page}>
        <Section
          title="Attention required"
          note="Risks overdue for review or not yet scored, extracted so the exceptions are visible without reading the full register."
        >
          {attention.length ? (
            <Table
              columns={['Risk #', 'Title', 'Status', 'Residual', 'Next review', 'Exception']}
              widths={[1.1, 3, 1.2, 1.5, 1.3, 1.5]}
              rows={attention.map((r) => [
                dash(r.risk_number),
                dash(r.title),
                <StatusPill key="s" value={r.status} />,
                <LevelPill
                  key="l"
                  code={r.residual_level?.code}
                  label={r.residual_level?.label}
                  color={r.residual_level?.color}
                  score={typeof r.residual_score === 'number' ? r.residual_score : null}
                />,
                fmtDate(r.next_review_at),
                [r.is_review_overdue ? 'Review overdue' : null, isUnscored(r) ? 'Unscored' : null]
                  .filter(Boolean)
                  .join(' · '),
              ])}
            />
          ) : (
            <EmptyRow label="No overdue reviews and no unscored risks." />
          )}
        </Section>

        <SignatureBlock note="This register report was reviewed and accepted by:" />
      </ReportPage>
    </Document>
  );
}
