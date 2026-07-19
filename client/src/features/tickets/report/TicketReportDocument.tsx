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
import type { TicketReportData, ReportForm } from './reportTypes';

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

const titleCase = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();
const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingBottom: 54,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: REPORT.ink,
    lineHeight: 1.4,
  },

  // Header (fixed)
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
  reportKicker: { fontSize: 7.5, letterSpacing: 1, color: REPORT.gold, fontFamily: 'Helvetica-Bold' },
  reportId: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: REPORT.navy, marginTop: 2 },

  // Footer (fixed)
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

  // Cover band
  cover: {
    backgroundColor: REPORT.navy,
    borderRadius: 8,
    padding: 16,
    marginBottom: 4,
  },
  coverKicker: { fontSize: 7.5, letterSpacing: 1.2, color: REPORT.gold, fontFamily: 'Helvetica-Bold' },
  coverTitle: { fontFamily: 'Helvetica-Bold', fontSize: 17, color: REPORT.white, marginTop: 5, lineHeight: 1.25 },
  coverStrip: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 0 },
  coverStat: { width: '25%', paddingRight: 8, marginBottom: 4 },
  coverStatLabel: { fontSize: 6.5, letterSpacing: 0.5, color: '#8A8FA3', textTransform: 'uppercase' },
  coverStatValue: { fontSize: 9, color: REPORT.white, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 2.5,
    paddingHorizontal: 9,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: REPORT.white,
  },

  // Sections
  section: { marginTop: 15 },
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

  // Field grid
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: REPORT.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  field: {
    width: '50%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: REPORT.border,
  },
  fieldLabel: { fontSize: 7, color: REPORT.sub, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 9.5, color: REPORT.ink, marginTop: 2 },

  // Prose
  proseBox: {
    borderWidth: 1,
    borderColor: REPORT.border,
    borderRadius: 4,
    padding: 10,
  },
  proseLabel: { fontSize: 7, color: REPORT.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  prose: { fontSize: 9.5, color: REPORT.ink },
  proseDivider: { height: 1, backgroundColor: REPORT.border, marginVertical: 8 },

  // Table
  table: { borderWidth: 1, borderColor: REPORT.border, borderRadius: 4, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: REPORT.border },
  trLast: { flexDirection: 'row' },
  th: { backgroundColor: REPORT.navySoft, fontFamily: 'Helvetica-Bold', fontSize: 8, color: REPORT.navy, padding: 5 },
  td: { fontSize: 8.5, color: REPORT.ink, padding: 5 },
  rowAlt: { backgroundColor: REPORT.rowAlt },

  // Forms
  formCard: {
    borderWidth: 1,
    borderColor: REPORT.border,
    borderRadius: 5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  formHead: {
    backgroundColor: REPORT.navySoft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: REPORT.border,
  },
  formTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: REPORT.navy },
  formMeta: { fontSize: 7.5, color: REPORT.sub, marginTop: 2 },
  formBody: { padding: 10 },
  formSectionName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: REPORT.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 6,
  },
  kv: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  kvLabel: { width: '38%', paddingRight: 8, fontSize: 8.5, color: REPORT.sub },
  kvValue: { width: '62%', fontSize: 8.5, color: REPORT.ink, fontFamily: 'Helvetica-Bold' },
  tableCaption: { fontSize: 8.5, color: REPORT.sub, marginBottom: 3 },

  empty: { fontSize: 8.5, color: REPORT.faint, fontStyle: 'italic' },
});

// ─── Small components ─────────────────────────────────────────────────────────

const CoverStat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.coverStat}>
    <Text style={styles.coverStatLabel}>{label}</Text>
    <Text style={styles.coverStatValue}>{value}</Text>
  </View>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

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
          <Text key={i} style={[styles.td, { width: cols[i]?.width }, r % 2 === 1 ? styles.rowAlt : {}]}>
            {cell}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

// One submitted form/checklist as a card with its resolved field values.
const FormCard = ({ form }: { form: ReportForm }) => (
  <View style={styles.formCard} wrap>
    <View style={styles.formHead}>
      <Text style={styles.formTitle}>{form.title}</Text>
      <Text style={styles.formMeta}>
        {[
          form.stageName ? `Stage: ${form.stageName}` : null,
          titleCase(form.status),
          form.submittedBy ? `By ${form.submittedBy}` : null,
          form.submittedAt ? formatDateTime(form.submittedAt) : null,
        ]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>
    </View>
    <View style={styles.formBody}>
      {form.sections.length === 0 ? (
        <Text style={styles.empty}>Submitted — no field detail available.</Text>
      ) : (
        form.sections.map((sec, si) => (
          <View key={si}>
            <Text style={styles.formSectionName}>{sec.name}</Text>
            {sec.fields.map((f, fi) =>
              f.table ? (
                <View key={fi} style={{ marginBottom: 6 }}>
                  <Text style={styles.tableCaption}>{f.label}</Text>
                  <View style={{ marginTop: 3 }}>
                    <Table
                      cols={f.table.columns.map((h) => ({
                        header: h,
                        width: `${100 / Math.max(f.table!.columns.length, 1)}%`,
                      }))}
                      rows={f.table.rows}
                    />
                  </View>
                </View>
              ) : (
                <View key={fi} style={styles.kv} wrap={false}>
                  <Text style={styles.kvLabel}>{f.label}</Text>
                  <Text style={styles.kvValue}>{f.text}</Text>
                </View>
              ),
            )}
          </View>
        ))
      )}
    </View>
  </View>
);

// ─── Document ─────────────────────────────────────────────────────────────────

export default function TicketReportDocument({
  org,
  ticket,
  timeline,
  comments,
  docs,
  forms,
  children,
}: TicketReportData) {
  const status = ticketStatus(ticket);
  const flow = ticket.flows[0];
  const currentStages = flow?.currentStages?.map((s) => s.name).join(', ') || (flow?.isCompleted ? 'Completed' : '—');
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

  const childRows: string[][] = children.map((c) => [
    c.unique_id,
    c.title,
    dash(c.module),
    dash(c.stage),
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
                <Text style={styles.logoFallbackText}>{(org.name || 'Q').slice(0, 2).toUpperCase()}</Text>
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

        {/* Cover band */}
        <View style={styles.cover}>
          <Text style={styles.coverKicker}>{dash(flow?.workflowName).toUpperCase()}</Text>
          <Text style={styles.coverTitle}>{ticket.title}</Text>
          <View style={styles.coverStrip}>
            <CoverStat label="Ticket ID" value={ticket.uniqueId} />
            <CoverStat label="Priority" value={dash(ticket.priority?.name)} />
            <CoverStat label="Severity" value={dash(ticket.severity?.name)} />
            <CoverStat label="Department" value={dash(ticket.department?.name)} />
            <CoverStat label="Site" value={dash(ticket.site?.name)} />
            <CoverStat label="Current Stage" value={currentStages} />
            <CoverStat label="Raised By" value={dash(ticket.createdBy?.name)} />
            <CoverStat label="Raised On" value={formatDate(ticket.createdAt)} />
          </View>
          <Text style={[styles.statusPill, { backgroundColor: status.color }]}>{status.label}</Text>
        </View>

        {/* Summary */}
        <Section title="Ticket Details">
          <View style={styles.fieldGrid}>
            <Field label="Ticket ID" value={ticket.uniqueId} />
            <Field label="Status" value={status.label} />
            <Field label="Process / Workflow" value={`${dash(flow?.workflowName)}${flow ? `  (v${flow.workflowVersion})` : ''}`} />
            <Field label="Current Stage" value={currentStages} />
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
          <View style={styles.proseBox}>
            <Text style={styles.proseLabel}>Description</Text>
            <Text style={styles.prose}>{dash(ticket.description)}</Text>
            <View style={styles.proseDivider} />
            <Text style={styles.proseLabel}>Reason</Text>
            <Text style={styles.prose}>{dash(ticket.ticketReason)}</Text>
          </View>
        </Section>

        {/* Child tickets */}
        {childRows.length > 0 && (
          <Section title={`Child Tickets (${childRows.length})`}>
            <Table
              cols={[
                { header: 'Ticket ID', width: '22%' },
                { header: 'Title', width: '44%' },
                { header: 'Type', width: '18%' },
                { header: 'Stage / Status', width: '16%' },
              ]}
              rows={childRows}
            />
          </Section>
        )}

        {/* Forms & checklists with field data */}
        <Section title={`Forms & Checklists${forms.length ? ` (${forms.length})` : ''}`}>
          {forms.length ? (
            forms.map((f) => <FormCard key={f.id} form={f} />)
          ) : (
            <Text style={styles.empty}>No forms submitted.</Text>
          )}
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
