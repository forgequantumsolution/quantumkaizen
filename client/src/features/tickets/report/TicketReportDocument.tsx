import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatDate, formatDateTime } from '@/lib/utils';
import { REPORT } from './reportTheme';
import type { TicketReportData } from './useTicketReportData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// @react-pdf's <Image> supports PNG/JPEG only. SVG data-URLs would throw, so we
// gate on a renderable source and fall back to a monogram otherwise.
const isRenderableLogo = (v: string | null | undefined): v is string =>
  !!v && (/^data:image\/(png|jpe?g);base64,/.test(v) || /^https?:\/\//.test(v));

const ticketStatus = (t: TicketReportData['ticket']): { label: string; color: string } => {
  if (t.isOnHold) return { label: 'On Hold', color: REPORT.warn };
  const flow = t.flows[0];
  if (flow?.isCompleted) return { label: 'Completed', color: REPORT.ok };
  return { label: 'Open', color: REPORT.info };
};

const titleCase = (v: string) =>
  v.charAt(0) + v.slice(1).toLowerCase();

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: REPORT.ink,
    lineHeight: 1.4,
  },

  // Header (fixed on every page)
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingHorizontal: 40,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: REPORT.gold,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', maxWidth: 320 },
  logo: { width: 40, height: 40, objectFit: 'contain', marginRight: 10 },
  logoFallback: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 6,
    backgroundColor: REPORT.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: { color: REPORT.gold, fontFamily: 'Helvetica-Bold', fontSize: 13 },
  orgName: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: REPORT.navy },
  orgMeta: { fontSize: 7.5, color: REPORT.sub, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  reportKicker: { fontSize: 7.5, letterSpacing: 1, color: REPORT.gold, fontFamily: 'Helvetica-Bold' },
  reportId: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: REPORT.navy, marginTop: 2 },

  // Footer (fixed on every page)
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

  // Title block
  docTitle: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: REPORT.navy },
  statusPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: REPORT.white,
  },

  // Sections
  section: { marginTop: 16 },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: REPORT.navy,
    backgroundColor: REPORT.goldSoft,
    borderLeftWidth: 3,
    borderLeftColor: REPORT.gold,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },

  // Field grid (2 columns)
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', paddingRight: 12, marginBottom: 7 },
  fieldLabel: { fontSize: 7.5, color: REPORT.sub, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 9.5, color: REPORT.ink, marginTop: 1 },

  // Prose
  prose: { fontSize: 9.5, color: REPORT.ink },
  proseLabel: { fontSize: 7.5, color: REPORT.sub, textTransform: 'uppercase', marginBottom: 2, marginTop: 6 },

  // Table
  table: { borderWidth: 1, borderColor: REPORT.border, borderRadius: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: REPORT.border },
  trLast: { flexDirection: 'row' },
  th: {
    backgroundColor: REPORT.navySoft,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: REPORT.navy,
    padding: 5,
  },
  td: { fontSize: 8.5, color: REPORT.ink, padding: 5 },
  rowAlt: { backgroundColor: REPORT.rowAlt },

  empty: { fontSize: 8.5, color: REPORT.faint, fontStyle: 'italic' },
});

// ─── Small components ─────────────────────────────────────────────────────────

const Field = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

// The section itself is wrappable so long tables flow onto following pages;
// `minPresenceAhead` on the title keeps it from being orphaned at a page foot.
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle} minPresenceAhead={60}>
      {title}
    </Text>
    {children}
  </View>
);

interface Col {
  header: string;
  width: string;
}
const Table = ({ cols, rows }: { cols: Col[]; rows: string[][] }) => (
  <View style={styles.table}>
    <View style={styles.tr}>
      {cols.map((c, i) => (
        <Text key={i} style={[styles.th, { width: c.width }]}>
          {c.header}
        </Text>
      ))}
    </View>
    {rows.map((row, r) => (
      <View key={r} style={r === rows.length - 1 ? styles.trLast : styles.tr} wrap={false}>
        {row.map((cell, i) => (
          <Text key={i} style={[styles.td, { width: cols[i].width }, r % 2 === 1 ? styles.rowAlt : {}]}>
            {cell}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

// ─── Document ─────────────────────────────────────────────────────────────────

export default function TicketReportDocument({ org, ticket, timeline, comments, docs, forms }: TicketReportData) {
  const status = ticketStatus(ticket);
  const flow = ticket.flows[0];
  const currentStages = flow?.currentStages?.map((s) => s.name).join(', ') || '—';
  const generatedAt = formatDateTime(new Date());

  const timelineRows: string[][] = timeline.map((e) => {
    if (e.kind === 'stage_entered')
      return [formatDateTime(e.at), 'Entered stage', `${e.stageName}${e.performedBy ? ` · ${e.performedBy.name}` : ''}`];
    if (e.kind === 'stage_exited')
      return [
        formatDateTime(e.at),
        e.actionName ? `Action: ${e.actionName}` : 'Left stage',
        `${e.stageName}${e.performedBy ? ` · ${e.performedBy.name}` : ''}`,
      ];
    return [formatDateTime(e.at), 'Comment', `${e.author ? `${e.author.name}: ` : ''}${e.body}`];
  });

  const formRows: string[][] = forms.map((f) => [
    dash(f.formTitle),
    dash(f.stageName),
    titleCase(f.status),
    f.submittedBy?.name ?? '—',
    formatDateTime(f.submittedAt),
  ]);

  const commentRows: string[][] = comments.map((c) => [
    c.author?.name ?? '—',
    formatDateTime(c.createdAt),
    c.body,
  ]);

  const docRows: string[][] = docs.map((d) => [
    dash(d.fileName),
    titleCase(d.docType),
    d.uploadedBy?.name ?? '—',
    formatDate(d.createdAt),
  ]);

  const customEntries = ticket.customFields
    ? Object.entries(ticket.customFields).filter(([, v]) => v !== null && v !== undefined && v !== '')
    : [];

  return (
    <Document title={`Ticket Report ${ticket.uniqueId}`} author={org.name}>
      <Page size="A4" style={styles.page}>
        {/* Fixed header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            {isRenderableLogo(org.logoUrl) ? (
              <Image style={styles.logo} src={org.logoUrl} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>
                  {(org.name || 'Q').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.orgName}>{org.name}</Text>
              {!!org.address && <Text style={styles.orgMeta}>{org.address}</Text>}
              {!!org.website && <Text style={styles.orgMeta}>{org.website}</Text>}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.reportKicker}>TICKET REPORT</Text>
            <Text style={styles.reportId}>{ticket.uniqueId}</Text>
          </View>
        </View>

        {/* Fixed footer */}
        <View style={styles.footer} fixed>
          <Text>{org.reportFooterText || `${org.name} · Generated ${generatedAt}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        {/* Title */}
        <View>
          <Text style={styles.docTitle}>{ticket.title}</Text>
          <Text style={[styles.statusPill, { backgroundColor: status.color }]}>{status.label}</Text>
        </View>

        {/* Summary */}
        <Section title="Summary">
          <View style={styles.fieldGrid}>
            <Field label="Ticket ID" value={ticket.uniqueId} />
            <Field label="Status" value={status.label} />
            <Field label="Priority" value={dash(ticket.priority?.name)} />
            <Field label="Severity" value={dash(ticket.severity?.name)} />
            <Field label="Classification" value={ticket.classification ? titleCase(ticket.classification) : '—'} />
            <Field label="Department" value={dash(ticket.department?.name)} />
            <Field label="Site" value={dash(ticket.site?.name)} />
            <Field label="Due Date" value={ticket.dueDate ? formatDate(ticket.dueDate) : '—'} />
            <Field label="Raised By" value={dash(ticket.createdBy?.name)} />
            <Field label="Raised On" value={formatDateTime(ticket.createdAt)} />
            {ticket.parentTicket && (
              <Field label="Parent Ticket" value={`${ticket.parentTicket.uniqueId} — ${ticket.parentTicket.title}`} />
            )}
            {ticket.isOnHold && <Field label="Hold Reason" value={dash(ticket.holdReason)} />}
          </View>
        </Section>

        {/* Description & Reason */}
        <Section title="Description & Reason">
          <Text style={styles.proseLabel}>Description</Text>
          <Text style={styles.prose}>{dash(ticket.description)}</Text>
          <Text style={styles.proseLabel}>Reason</Text>
          <Text style={styles.prose}>{dash(ticket.ticketReason)}</Text>
        </Section>

        {/* Workflow */}
        <Section title="Workflow">
          <View style={styles.fieldGrid}>
            <Field label="Workflow" value={dash(flow?.workflowName)} />
            <Field label="Version" value={flow ? `v${flow.workflowVersion}` : '—'} />
            <Field label="Current Stage(s)" value={currentStages} />
            <Field label="Completed" value={flow?.isCompleted ? 'Yes' : 'No'} />
          </View>
        </Section>

        {/* Timeline */}
        <Section title="Activity Timeline">
          {timelineRows.length ? (
            <Table
              cols={[
                { header: 'When', width: '24%' },
                { header: 'Event', width: '24%' },
                { header: 'Details', width: '52%' },
              ]}
              rows={timelineRows}
            />
          ) : (
            <Text style={styles.empty}>No activity recorded.</Text>
          )}
        </Section>

        {/* Stage forms */}
        <Section title="Submitted Forms">
          {formRows.length ? (
            <Table
              cols={[
                { header: 'Form', width: '30%' },
                { header: 'Stage', width: '22%' },
                { header: 'Status', width: '14%' },
                { header: 'Submitted By', width: '18%' },
                { header: 'Submitted', width: '16%' },
              ]}
              rows={formRows}
            />
          ) : (
            <Text style={styles.empty}>No forms submitted.</Text>
          )}
        </Section>

        {/* Comments */}
        <Section title="Comments">
          {commentRows.length ? (
            <Table
              cols={[
                { header: 'Author', width: '20%' },
                { header: 'When', width: '22%' },
                { header: 'Comment', width: '58%' },
              ]}
              rows={commentRows}
            />
          ) : (
            <Text style={styles.empty}>No comments.</Text>
          )}
        </Section>

        {/* Attachments */}
        <Section title="Attachments">
          {docRows.length ? (
            <Table
              cols={[
                { header: 'File', width: '40%' },
                { header: 'Type', width: '20%' },
                { header: 'Uploaded By', width: '22%' },
                { header: 'Date', width: '18%' },
              ]}
              rows={docRows}
            />
          ) : (
            <Text style={styles.empty}>No attachments.</Text>
          )}
        </Section>

        {/* Custom fields */}
        {customEntries.length > 0 && (
          <Section title="Custom Fields">
            <Table
              cols={[
                { header: 'Field', width: '35%' },
                { header: 'Value', width: '65%' },
              ]}
              rows={customEntries.map(([k, v]) => [k, String(v)])}
            />
          </Section>
        )}
      </Page>
    </Document>
  );
}
