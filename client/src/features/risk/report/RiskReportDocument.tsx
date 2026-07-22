/**
 * Single-risk PDF report — the inspection-facing record of one risk.
 *
 * The order of the sections is the order an assessor reads them in: what the
 * risk is, how it is classified, what it scored, WHY that score means what it
 * means (the framework scales — the section that makes the number defensible),
 * then the evidence trail of controls, links, reviews, acceptance and audit.
 *
 * All chrome comes from reportShared so this document cannot drift away from
 * the register/assessment reports or the ticket report.
 */
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
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
  titleCase,
} from './reportShared';
import { ACCEPTANCE_COLOR, REPORT, levelColor } from './reportTheme';
import type { RiskReportData } from './reportTypes';

// ── Local styles (everything else is shared chrome) ─────────────────────────

const local = StyleSheet.create({
  prose: { fontSize: 9.5, color: REPORT.ink, marginBottom: 8 },
  proseLabel: {
    fontSize: 6.5,
    letterSpacing: 0.5,
    color: REPORT.faint,
    textTransform: 'uppercase',
    marginBottom: 1.5,
  },
  subHead: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: REPORT.navy,
    marginTop: 10,
    marginBottom: 4,
  },
  subHeadNote: { fontFamily: 'Helvetica', fontSize: 7.5, color: REPORT.sub },
  acceptBox: {
    borderWidth: 1,
    borderColor: REPORT.goldLine,
    backgroundColor: REPORT.goldSoft,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  acceptHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  acceptWho: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: REPORT.navy },
  acceptWhen: { fontSize: 8, color: REPORT.sub },
  cell: { fontSize: 8.2, color: REPORT.ink },
  cellMuted: { fontSize: 7.6, color: REPORT.sub },
  changeOld: { fontSize: 7.8, color: REPORT.sub, textDecoration: 'line-through' },
  changeNew: { fontSize: 7.8, color: REPORT.ink },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

type Rec = Record<string, any>;

const has = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * People arrive as ids on most risk payloads. Print a name when the serializer
 * gave one; never print a raw UUID, which means nothing on paper.
 */
const personName = (row: Rec | null | undefined, key: string): string => {
  if (!row) return '—';
  const rel = row[key];
  if (rel && typeof rel === 'object' && has(rel.name)) return rel.name as string;
  if (has(row[`${key}_name`])) return row[`${key}_name`] as string;
  if (has(row[`${key}Name`])) return row[`${key}Name`] as string;
  return row[`${key}_id`] ? 'Assigned' : '—';
};

const refName = (row: Rec | null | undefined, key: string): string => {
  const rel = row?.[key];
  if (rel && typeof rel === 'object' && has(rel.name)) return rel.name as string;
  if (has(row?.[`${key}_name`])) return row?.[`${key}_name`] as string;
  return row?.[`${key}_id`] ? 'Assigned' : '—';
};

const scoreRange = (lv: Rec): string => {
  const lo = lv.min_score;
  const hi = lv.max_score;
  if (lo === null || lo === undefined) return hi === null || hi === undefined ? '—' : `≤ ${hi}`;
  if (hi === null || hi === undefined) return `≥ ${lo}`;
  return lo === hi ? String(lo) : `${lo} – ${hi}`;
};

const effectivenessText = (c: Rec): string => {
  const verdict =
    c.is_effective === true ? 'Effective' : c.is_effective === false ? 'Not effective' : null;
  const note = has(c.effectiveness) ? (c.effectiveness as string) : null;
  if (verdict && note) return `${verdict} — ${note}`;
  return verdict ?? note ?? (c.verified_at ? 'Verified' : '—');
};

const controlRequirements = (lv: Rec): string => {
  const flags = [
    lv.requires_capa ? 'CAPA' : null,
    lv.requires_control ? 'Control' : null,
    lv.requires_approval ? 'Approval' : null,
  ].filter(Boolean);
  return flags.length ? flags.join(', ') : 'None';
};

// ── Document ────────────────────────────────────────────────────────────────

export default function RiskReportDocument({
  org,
  generatedAt,
  risk,
  history,
  controls,
  reviews,
  acceptances,
  trail,
  framework,
}: RiskReportData) {
  const links: Rec[] = Array.isArray(risk?.links) ? risk.links : [];
  const factors: Rec[] = Array.isArray(framework?.factors)
    ? [...(framework!.factors as Rec[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const levelDefs: Rec[] = Array.isArray(framework?.levels)
    ? [...(framework!.levels as Rec[])].sort(
        (a, b) => (a.order ?? a.min_score ?? 0) - (b.order ?? b.min_score ?? 0),
      )
    : [];

  const stages: { stage: string; note: string; factors: any; score: any; level: Rec | null }[] = [
    {
      stage: 'Initial',
      note: 'before controls',
      factors: risk?.initial_factors,
      score: risk?.initial_score,
      level: risk?.initial_level ?? null,
    },
    {
      stage: 'Residual',
      note: 'after controls',
      factors: risk?.residual_factors,
      score: risk?.residual_score,
      level: risk?.residual_level ?? null,
    },
    {
      stage: 'Target',
      note: 'treatment goal',
      factors: risk?.target_factors,
      score: risk?.target_score,
      level: risk?.target_level ?? null,
    },
  ];

  const reduction =
    typeof risk?.initial_score === 'number' && typeof risk?.residual_score === 'number'
      ? `Initial ${risk.initial_score} → residual ${risk.residual_score}` +
        (risk.initial_score > 0
          ? ` (${Math.round(((risk.initial_score - risk.residual_score) / risk.initial_score) * 100)}% reduction)`
          : '')
      : undefined;

  return (
    <Document
      title={`${dash(risk?.risk_number)} — Risk Report`}
      author={org?.name || 'Quantum Kaizen'}
      subject={dash(risk?.title)}
    >
      <ReportPage
        org={org}
        kicker="RISK REPORT"
        recordId={dash(risk?.risk_number)}
        generatedAt={generatedAt}
      >
        {/* 1 — Cover band */}
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>{dash(risk?.risk_number)}</Text>
          <Text style={styles.coverTitle}>{dash(risk?.title)}</Text>
          <View style={styles.coverStrip}>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>Status</Text>
              <Text style={styles.coverStatValue}>{titleCase(risk?.status)}</Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>Initial risk</Text>
              <Text
                style={[
                  styles.coverStatValue,
                  { color: levelColor(risk?.initial_level?.code, risk?.initial_level?.color) },
                ]}
              >
                {risk?.initial_level
                  ? `${risk.initial_level.label || titleCase(risk.initial_level.code)}${
                      risk.initial_score !== null && risk.initial_score !== undefined
                        ? `  ·  ${risk.initial_score}`
                        : ''
                    }`
                  : 'Unscored'}
              </Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>Residual risk</Text>
              <Text
                style={[
                  styles.coverStatValue,
                  { color: levelColor(risk?.residual_level?.code, risk?.residual_level?.color) },
                ]}
              >
                {risk?.residual_level
                  ? `${risk.residual_level.label || titleCase(risk.residual_level.code)}${
                      risk.residual_score !== null && risk.residual_score !== undefined
                        ? `  ·  ${risk.residual_score}`
                        : ''
                    }`
                  : 'Unscored'}
              </Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>Next review</Text>
              <Text style={styles.coverStatValue}>
                {fmtDate(risk?.next_review_at)}
                {risk?.is_review_overdue ? '  (overdue)' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* 2 — Identification */}
        <Section title="Risk identification">
          <View>
            <Text style={local.proseLabel}>Description</Text>
            <Text style={local.prose}>{dash(risk?.description)}</Text>
          </View>
          {has(risk?.hazard) ? (
            <View>
              <Text style={local.proseLabel}>Hazard</Text>
              <Text style={local.prose}>{risk.hazard}</Text>
            </View>
          ) : null}
          {has(risk?.hazardous_situation) ? (
            <View>
              <Text style={local.proseLabel}>Hazardous situation</Text>
              <Text style={local.prose}>{risk.hazardous_situation}</Text>
            </View>
          ) : null}
          {has(risk?.harm) ? (
            <View>
              <Text style={local.proseLabel}>Harm</Text>
              <Text style={local.prose}>{risk.harm}</Text>
            </View>
          ) : null}
          {has(risk?.cause) ? (
            <View>
              <Text style={local.proseLabel}>Cause</Text>
              <Text style={local.prose}>{risk.cause}</Text>
            </View>
          ) : null}
          {has(risk?.consequence) ? (
            <View>
              <Text style={local.proseLabel}>Consequence</Text>
              <Text style={local.prose}>{risk.consequence}</Text>
            </View>
          ) : null}
        </Section>

        {/* 3 — Classification */}
        <Section title="Classification & ownership">
          <KeyValues
            items={[
              {
                label: 'Register',
                value: risk?.register
                  ? `${dash(risk.register.registerNumber)} · ${dash(risk.register.name)}`
                  : '—',
              },
              {
                label: 'Category',
                value: risk?.category
                  ? `${dash(risk.category.name)}${risk.category.code ? ` (${risk.category.code})` : ''}`
                  : '—',
              },
              { label: 'Framework', value: dash(risk?.framework?.name ?? framework?.name) },
              {
                label: 'Methodology / formula',
                value: `${titleCase(risk?.framework?.methodology ?? framework?.methodology)} · ${titleCase(
                  risk?.framework?.formula ?? framework?.formula,
                )}`,
              },
              { label: 'Treatment strategy', value: titleCase(risk?.treatment) },
              { label: 'Risk owner', value: personName(risk, 'owner') },
              { label: 'Department', value: refName(risk, 'department') },
              { label: 'Site', value: refName(risk, 'site') },
              { label: 'Identified on', value: fmtDate(risk?.identified_at) },
              { label: 'Accepted on', value: fmtDate(risk?.accepted_at) },
              { label: 'Closed on', value: fmtDate(risk?.closed_at) },
              { label: 'Next review due', value: fmtDate(risk?.next_review_at) },
            ]}
          />
        </Section>

        {/* 4 — Risk evaluation */}
        <Section
          title="Risk evaluation"
          note={
            reduction ??
            'Factor ranks and the resulting score at each stage of the risk lifecycle.'
          }
        >
          <Table
            columns={['Stage', 'Factor ranks', 'Score', 'Risk level', 'Acceptance']}
            widths={[1.3, 2, 0.7, 1.7, 1.2]}
            rows={stages.map((s) => [
              <View>
                <Text style={{ fontSize: 8.2, fontFamily: 'Helvetica-Bold', color: REPORT.ink }}>
                  {s.stage}
                </Text>
                <Text style={local.cellMuted}>{s.note}</Text>
              </View>,
              fmtFactors(s.factors),
              s.score === null || s.score === undefined ? '—' : String(s.score),
              <LevelPill code={s.level?.code} label={s.level?.label} color={s.level?.color} />,
              s.level?.acceptance ? (
                <StatusPill
                  value={s.level.acceptance}
                  color={ACCEPTANCE_COLOR[String(s.level.acceptance).toUpperCase()]}
                />
              ) : (
                '—'
              ),
            ])}
          />
        </Section>

        {/* 5 — Scoring basis */}
        {framework ? (
          <Section
            title="Scoring basis"
            note={`${dash(framework.name)}${framework.standard ? ` · ${framework.standard}` : ''} — the scales the scores above were taken from.`}
          >
            {factors.length ? (
              factors.map((f, i) => {
                const levels: Rec[] = Array.isArray(f.levels)
                  ? [...(f.levels as Rec[])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
                  : [];
                return (
                  <View key={`${f.key ?? 'factor'}-${i}`}>
                    <Text style={local.subHead}>
                      {dash(f.label)}{' '}
                      <Text style={local.subHeadNote}>
                        ({dash(f.key)}
                        {f.kind ? ` · ${titleCase(f.kind)}` : ''})
                      </Text>
                    </Text>
                    <Table
                      columns={['Rank', 'Level', 'Definition']}
                      widths={[0.5, 1.4, 4.1]}
                      rows={levels.map((lv) => [
                        lv.rank === null || lv.rank === undefined ? '—' : String(lv.rank),
                        dash(lv.label),
                        dash(lv.definition ?? lv.guidance),
                      ])}
                    />
                  </View>
                );
              })
            ) : (
              <EmptyRow label="This framework publishes no factor scales." />
            )}

            <Text style={local.subHead}>Risk level bands</Text>
            <Table
              columns={['Level', 'Score band', 'Acceptance', 'Mandatory', 'Review']}
              widths={[1.6, 1, 1.2, 1.4, 0.9]}
              rows={levelDefs.map((lv) => [
                <LevelPill code={lv.code} label={lv.label} color={lv.color} />,
                scoreRange(lv),
                lv.acceptance ? (
                  <StatusPill
                    value={lv.acceptance}
                    color={ACCEPTANCE_COLOR[String(lv.acceptance).toUpperCase()]}
                  />
                ) : (
                  '—'
                ),
                controlRequirements(lv),
                lv.review_months ? `${lv.review_months} mo` : '—',
              ])}
            />
          </Section>
        ) : null}

        {/* 6 — Score history */}
        <Section title="Score history" note="Every re-score recorded against this risk.">
          <Table
            columns={['Date', 'Stage', 'Factors', 'Score', 'Level', 'By', 'Reason']}
            widths={[1.3, 0.9, 1.3, 0.6, 1.3, 1.1, 2]}
            rows={history.map((h) => [
              fmtDateTime(h.created_at),
              titleCase(h.stage),
              fmtFactors(h.factors),
              h.score === null || h.score === undefined ? '—' : String(h.score),
              <LevelPill code={h.level_code} label={h.level_label} />,
              dash(h.user_name),
              dash(h.reason),
            ])}
          />
        </Section>

        {/* 7 — Controls */}
        <Section title="Risk controls" note="Measures implemented to reduce this risk.">
          <Table
            columns={['Control', 'Title', 'Type', 'Hierarchy', 'Status', 'Owner', 'Due', 'Effectiveness']}
            widths={[1.1, 2.2, 1, 1.3, 1.1, 1, 1, 1.9]}
            rows={controls.map((c) => [
              dash(c.control_number),
              <View>
                <Text style={local.cell}>{dash(c.title)}</Text>
                {has(c.description) ? <Text style={local.cellMuted}>{c.description}</Text> : null}
              </View>,
              titleCase(c.type),
              titleCase(c.hierarchy),
              <StatusPill
                value={c.status}
                color={
                  c.status === 'VERIFIED' || c.status === 'IMPLEMENTED'
                    ? REPORT.ok
                    : c.status === 'INEFFECTIVE'
                      ? REPORT.danger
                      : c.status === 'CANCELLED'
                        ? REPORT.faint
                        : REPORT.info
                }
              />,
              personName(c, 'owner'),
              <View>
                <Text style={local.cell}>{fmtDate(c.due_date)}</Text>
                {c.is_overdue ? (
                  <Text style={[local.cellMuted, { color: REPORT.danger }]}>Overdue</Text>
                ) : null}
              </View>,
              <View>
                <Text style={local.cell}>{effectivenessText(c)}</Text>
                {c.verified_at ? (
                  <Text style={local.cellMuted}>Verified {fmtDate(c.verified_at)}</Text>
                ) : null}
              </View>,
            ])}
          />
        </Section>

        {/* 8 — Linked records */}
        <Section
          title="Linked records"
          note="Other quality records tied to this risk, including any automatically raised CAPA."
        >
          <Table
            columns={['Entity', 'Reference', 'Relation', 'Linked on']}
            widths={[1.4, 2.6, 1.5, 1.3]}
            rows={links.map((l) => [
              titleCase(l.entity_type),
              dash(l.label ?? l.entity_id),
              titleCase(l.relation),
              fmtDate(l.created_at),
            ])}
          />
        </Section>

        {/* 9 — Periodic reviews */}
        <Section title="Periodic reviews" note="Scheduled re-evaluations of this risk.">
          <Table
            columns={['Due', 'Completed', 'Outcome', 'Reviewer', 'Findings']}
            widths={[1, 1, 1.3, 1.2, 3.5]}
            rows={reviews.map((rv) => [
              <View>
                <Text style={local.cell}>{fmtDate(rv.due_at)}</Text>
                {rv.is_overdue && !rv.reviewed_at ? (
                  <Text style={[local.cellMuted, { color: REPORT.danger }]}>Overdue</Text>
                ) : null}
              </View>,
              fmtDate(rv.reviewed_at),
              rv.outcome ? <StatusPill value={rv.outcome} color={REPORT.info} /> : 'Pending',
              personName(rv, 'reviewed_by'),
              dash(rv.findings),
            ])}
          />
        </Section>

        {/* 10 — Residual risk acceptance */}
        <Section
          title="Residual risk acceptance"
          note="The formal, signed decision to accept the residual risk."
        >
          {acceptances.length ? (
            acceptances.map((a, i) => (
              <View key={a.id ?? i} style={local.acceptBox} wrap={false}>
                <View style={local.acceptHead}>
                  <Text style={local.acceptWho}>
                    Accepted by {personName(a, 'accepted_by')}
                  </Text>
                  <Text style={local.acceptWhen}>{fmtDateTime(a.accepted_at)}</Text>
                </View>
                <KeyValues
                  items={[
                    {
                      label: 'Residual risk at acceptance',
                      value:
                        a.residual_level_code || a.residual_score !== null
                          ? `${titleCase(a.residual_level_code)}${
                              a.residual_score === null || a.residual_score === undefined
                                ? ''
                                : `  ·  ${a.residual_score}`
                            }`
                          : '—',
                    },
                    {
                      label: 'Electronic signature',
                      value: a.e_signature_id ? 'Applied' : 'Not recorded',
                    },
                    { label: 'Justification', value: dash(a.justification), full: true },
                    {
                      label: 'Benefit–risk rationale',
                      value: dash(a.benefit_risk_rationale),
                      full: true,
                    },
                  ]}
                />
              </View>
            ))
          ) : (
            <EmptyRow label="No residual risk acceptance has been recorded." />
          )}
        </Section>

        {/* 11 — Audit trail */}
        <Section title="Audit trail" note="Every change made to this risk record.">
          <Table
            columns={['When', 'Action', 'Field', 'Change', 'Reason', 'User']}
            widths={[1.4, 1.2, 1.2, 2.6, 1.9, 1.2]}
            rows={trail.map((t) => [
              fmtDateTime(t.created_at),
              titleCase(t.action),
              dash(t.field),
              t.old_value || t.new_value ? (
                <View>
                  {t.old_value ? <Text style={local.changeOld}>{t.old_value}</Text> : null}
                  <Text style={local.changeNew}>{dash(t.new_value)}</Text>
                </View>
              ) : (
                '—'
              ),
              dash(t.reason),
              dash(t.user_name),
            ])}
          />
        </Section>

        {/* 12 — Signatures */}
        <SignatureBlock note="This risk record, its scores and its controls have been reviewed and are accepted by:" />
      </ReportPage>
    </Document>
  );
}
