/**
 * Shared chrome for every Risk PDF report.
 *
 * The three risk reports (single risk, register, assessment) differ only in
 * their body; the branded header/footer, cover band, section headings, tables
 * and pills all live here so the documents cannot drift apart visually. Styles
 * mirror features/tickets/report/TicketReportDocument.tsx so a risk report and a
 * ticket report look like they came from the same system.
 */
import type { ReactNode } from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { REPORT, levelColor } from './reportTheme';
import type { ReportOrg } from './reportTypes';

// @react-pdf's <Image> supports PNG/JPEG only — an SVG data-URL throws, so gate
// on a renderable source and fall back to a monogram.
export const isRenderableLogo = (v: string | null | undefined): v is string =>
  !!v && (/^data:image\/(png|jpe?g);base64,/.test(v) || /^https?:\/\//.test(v));

export const dash = (v: string | number | null | undefined): string =>
  v === 0 ? '0' : v !== null && v !== undefined && String(v).trim() !== '' ? String(v) : '—';

/** SCREAMING_SNAKE → Title Case, for enum values printed in the document. */
export const titleCase = (v: string | null | undefined): string =>
  !v ? '—' : v.replace(/_/g, ' ').replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());

export const fmtDate = (v: string | Date | null | undefined): string => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (v: string | Date | null | undefined): string => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${fmtDate(d)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Render a factor bag ({ S: 4, P: 3 }) as "S 4 · P 3" in a stable key order. */
export const fmtFactors = (factors: Record<string, number> | null | undefined): string => {
  if (!factors || typeof factors !== 'object') return '—';
  const entries = Object.entries(factors);
  if (!entries.length) return '—';
  return entries.map(([k, v]) => `${k} ${v}`).join('  ·  ');
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingBottom: 54,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: REPORT.ink,
    lineHeight: 1.4,
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 22,
    paddingHorizontal: 40,
    paddingBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: REPORT.gold,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', maxWidth: 340 },
  logo: { width: 38, height: 38, objectFit: 'contain', marginRight: 10 },
  logoFallback: {
    width: 38,
    height: 38,
    marginRight: 10,
    borderRadius: 6,
    backgroundColor: REPORT.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: { color: REPORT.gold, fontFamily: 'Helvetica-Bold', fontSize: 12 },
  orgName: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: REPORT.navy },
  orgMeta: { fontSize: 7.5, color: REPORT.sub, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  reportKicker: {
    fontSize: 7.5,
    letterSpacing: 1,
    color: REPORT.gold,
    fontFamily: 'Helvetica-Bold',
  },
  reportId: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: REPORT.navy, marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: REPORT.border,
    paddingTop: 6,
    fontSize: 7.5,
    color: REPORT.faint,
  },

  cover: { backgroundColor: REPORT.navy, borderRadius: 8, padding: 16, marginBottom: 14 },
  coverKicker: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: REPORT.gold,
    fontFamily: 'Helvetica-Bold',
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 17,
    color: REPORT.white,
    marginTop: 5,
    lineHeight: 1.25,
  },
  coverStrip: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  coverStat: { width: '25%', paddingRight: 8, marginBottom: 6 },
  coverStatLabel: {
    fontSize: 6.5,
    letterSpacing: 0.5,
    color: '#8A8FA3',
    textTransform: 'uppercase',
  },
  coverStatValue: {
    fontSize: 9,
    color: REPORT.white,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },

  section: { marginTop: 14 },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: REPORT.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: REPORT.goldLine,
    marginBottom: 8,
  },
  sectionNote: { fontSize: 8, color: REPORT.sub, marginBottom: 6 },

  kvGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kvItem: { width: '50%', paddingRight: 12, marginBottom: 7 },
  kvItemFull: { width: '100%', paddingRight: 0, marginBottom: 7 },
  kvLabel: {
    fontSize: 6.5,
    letterSpacing: 0.5,
    color: REPORT.faint,
    textTransform: 'uppercase',
    marginBottom: 1.5,
  },
  kvValue: { fontSize: 9.5, color: REPORT.ink },

  table: { borderWidth: 1, borderColor: REPORT.border, borderRadius: 4, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: REPORT.border },
  trLast: { flexDirection: 'row' },
  th: {
    backgroundColor: REPORT.navySoft,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 6.8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    color: REPORT.sub,
  },
  td: { paddingVertical: 4.5, paddingHorizontal: 6, fontSize: 8.2, color: REPORT.ink },
  tdAlt: { backgroundColor: REPORT.rowAlt },

  pill: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 3,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: REPORT.white,
  },
  pillOutline: {
    alignSelf: 'flex-start',
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },

  empty: {
    fontSize: 8.5,
    color: REPORT.faint,
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center',
  },
  signBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: REPORT.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: REPORT.rowAlt,
  },
  signRow: { flexDirection: 'row', marginTop: 10 },
  signCell: { flex: 1, paddingRight: 14 },
  signLine: { borderBottomWidth: 1, borderBottomColor: REPORT.faint, height: 22 },
  signLabel: { fontSize: 6.8, color: REPORT.sub, marginTop: 3, textTransform: 'uppercase' },
});

/** Fixed branded header — repeats on every page. */
export function ReportHeader({ org, kicker, recordId }: { org: ReportOrg; kicker: string; recordId: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        {isRenderableLogo(org.logoUrl) ? (
          <Image style={styles.logo} src={org.logoUrl} />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>{(org.name || 'Q')[0].toUpperCase()}</Text>
          </View>
        )}
        <View>
          <Text style={styles.orgName}>{org.name || 'Quantum Kaizen'}</Text>
          <Text style={styles.orgMeta}>Quality Risk Management</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.reportKicker}>{kicker}</Text>
        <Text style={styles.reportId}>{recordId}</Text>
      </View>
    </View>
  );
}

/** Fixed footer with the org's configured footer text and page numbering. */
export function ReportFooter({ org, generatedAt }: { org: ReportOrg; generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{org.reportFooterText || `${org.name || 'Quantum Kaizen'} · Generated ${generatedAt}`}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

/** A full page with the branded chrome already applied. */
export function ReportPage({
  org,
  kicker,
  recordId,
  generatedAt,
  children,
  orientation,
}: {
  org: ReportOrg;
  kicker: string;
  recordId: string;
  generatedAt: string;
  children: ReactNode;
  orientation?: 'portrait' | 'landscape';
}) {
  return (
    <Page size="A4" orientation={orientation ?? 'portrait'} style={styles.page}>
      <ReportHeader org={org} kicker={kicker} recordId={recordId} />
      {children}
      <ReportFooter org={org} generatedAt={generatedAt} />
    </Page>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      {children}
    </View>
  );
}

export function KeyValues({ items }: { items: { label: string; value: string; full?: boolean }[] }) {
  return (
    <View style={styles.kvGrid}>
      {items.map((it, i) => (
        <View key={`${it.label}-${i}`} style={it.full ? styles.kvItemFull : styles.kvItem}>
          <Text style={styles.kvLabel}>{it.label}</Text>
          <Text style={styles.kvValue}>{dash(it.value)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Risk-level pill — solid fill in the level's own colour. */
export function LevelPill({
  code,
  label,
  color,
  score,
}: {
  code: string | null | undefined;
  label?: string | null;
  color?: string | null;
  score?: number | null;
}) {
  if (!code) return <Text style={{ fontSize: 8, color: REPORT.faint }}>Unscored</Text>;
  const bg = levelColor(code, color);
  const text = `${label || titleCase(code)}${score !== null && score !== undefined ? `  ·  ${score}` : ''}`;
  return <Text style={[styles.pill, { backgroundColor: bg }]}>{text}</Text>;
}

/** Status pill — outlined, so it never competes with the risk-level colour. */
export function StatusPill({ value, color }: { value: string | null | undefined; color?: string }) {
  const c = color || REPORT.sub;
  return <Text style={[styles.pillOutline, { borderColor: c, color: c }]}>{titleCase(value)}</Text>;
}

export function EmptyRow({ label }: { label: string }) {
  return <Text style={styles.empty}>{label}</Text>;
}

/**
 * Fixed-column table. `widths` are flex weights, one per column. Header repeats
 * across page breaks so a long register stays readable.
 */
export function Table({
  columns,
  widths,
  rows,
}: {
  columns: string[];
  widths: number[];
  rows: (string | ReactNode)[][];
}) {
  if (!rows.length) return <EmptyRow label="Nothing recorded." />;
  return (
    <View style={styles.table}>
      <View style={styles.tr} fixed>
        {columns.map((c, i) => (
          <Text key={c + i} style={[styles.th, { flex: widths[i] ?? 1 }]}>
            {c}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={r === rows.length - 1 ? styles.trLast : styles.tr} wrap={false}>
          {row.map((cell, i) => (
            <View
              key={i}
              style={[styles.td, { flex: widths[i] ?? 1 }, r % 2 === 1 ? styles.tdAlt : {}]}
            >
              {typeof cell === 'string' || typeof cell === 'number' ? (
                <Text>{dash(cell as string)}</Text>
              ) : (
                cell
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Signature block for the hand-over copy an auditor signs. */
export function SignatureBlock({ note }: { note?: string }) {
  return (
    <View style={styles.signBox} wrap={false}>
      <Text style={{ fontSize: 8, color: REPORT.sub }}>
        {note || 'Reviewed and accepted by:'}
      </Text>
      <View style={styles.signRow}>
        {['Prepared by', 'Reviewed by', 'Approved by'].map((l) => (
          <View key={l} style={styles.signCell}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>{l} · name / signature / date</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
