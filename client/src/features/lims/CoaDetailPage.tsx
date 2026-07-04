import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, Input, Modal, Spin, Table } from 'antd';
import { ArrowLeft, Printer, BadgeCheck, Ban } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import DOMPurify from 'dompurify';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCoa, useIssueCoa, useRevokeCoa,
  COA_STATUS_BADGE, type CoaResultLine, type CoaTestBlock,
} from '@/lib/api/coa';

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

// Template header/footer are author-supplied HTML — always sanitize before render (W-2).
const clean = (html: string) => ({ __html: DOMPurify.sanitize(html) });

function evalBadge(evaluation: string): string {
  const e = evaluation?.toUpperCase();
  if (e === 'PASS' || e === 'WITHIN' || e === 'COMPLIES') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (e === 'FAIL' || e === 'OOS' || e === 'OUT') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

export default function CoaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const canIssue = useHasPermission('coa.issue');
  const { data: coa, isLoading } = useCoa(id);
  const issueMut = useIssueCoa(id ?? '');
  const revokeMut = useRevokeCoa(id ?? '');
  const [issueOpen, setIssueOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (isLoading || !coa) {
    return <PageContainer><div className="flex items-center justify-center py-32"><Spin /></div></PageContainer>;
  }

  const verifyUrl = coa.verify_token ? `${window.location.origin}/verify/coa/${coa.verify_token}` : '';

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap print:hidden">
        <Link to="/lims/coa" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={14} /> Back</Link>
        <div className="flex items-center gap-2 flex-wrap">
          {coa.status === 'DRAFT' && canIssue && (
            <Button type="primary" icon={<BadgeCheck size={14} />} onClick={() => setIssueOpen(true)}>Issue</Button>
          )}
          {coa.status === 'ISSUED' && canIssue && (
            <Button danger icon={<Ban size={14} />} onClick={() => setRevokeOpen(true)}>Revoke</Button>
          )}
          <Button icon={<Printer size={14} />} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-4xl mx-auto">
        {coa.template?.header_html && (
          <div className="mb-5 pb-5 border-b border-gray-200 text-sm text-gray-800" dangerouslySetInnerHTML={clean(coa.template.header_html)} />
        )}
        {/* Masthead */}
        <div className="flex items-start justify-between gap-6 border-b border-gray-200 pb-5 mb-5">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{coa.template?.title || 'Certificate of Analysis'}</h1>
            <div className="font-mono text-sm text-blue-600 mt-1">{coa.coa_number}</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
              <Field label="Product" value={coa.product_name} />
              <Field label="Batch" value={coa.batch_no ?? '—'} />
              {coa.customer_name && <Field label="Customer" value={coa.customer_name} />}
              <Field label="Issued" value={coa.issued_at ? new Date(coa.issued_at).toLocaleString() : '—'} />
              <Field label="Status" valueNode={<span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${COA_STATUS_BADGE[coa.status]}`}>{coa.status}</span>} />
            </div>
          </div>
          {coa.status === 'ISSUED' && coa.verify_token && (
            <div className="flex flex-col items-center text-center shrink-0">
              <QRCodeSVG value={verifyUrl} size={104} />
              <div className="font-mono text-[11px] text-gray-600 mt-1.5">{coa.coa_number}</div>
              <div className="text-[10px] text-gray-400">Scan to verify</div>
            </div>
          )}
        </div>

        {/* Body sections — rendered in the template's order (or a sensible default) */}
        {(coa.template?.sections?.length ? coa.template.sections : ['results', 'conclusion', 'signatures']).map((section) => {
          if (section === 'results') {
            return (
              <div key="results" className="space-y-6">
                {(coa.results ?? []).map((block: CoaTestBlock, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">{block.test_name}</h3>
                      {block.overall_result && (
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${evalBadge(block.overall_result)}`}>{block.overall_result}</span>
                      )}
                    </div>
                    <Table<CoaResultLine>
                      size="small" rowKey={(r) => r.analyte_name} dataSource={block.results} pagination={false}
                      locale={{ emptyText: 'No results.' }}
                      columns={[
                        { title: 'Analyte', dataIndex: 'analyte_name', ellipsis: true },
                        { title: 'Result', width: 140, render: (_: unknown, r) => (r.value != null && r.value !== '' ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : '—') },
                        { title: 'Specification', width: 160, render: (_: unknown, r) => specText(r) },
                        {
                          title: 'Evaluation', width: 120,
                          render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${evalBadge(r.evaluation)}`}>{r.evaluation || '—'}</span>,
                        },
                      ]}
                    />
                  </div>
                ))}
                {(!coa.results || coa.results.length === 0) && <p className="text-sm text-gray-400">No result snapshot on this certificate.</p>}
              </div>
            );
          }
          if (section === 'conclusion') {
            return coa.conclusion ? (
              <div key="conclusion" className="mt-6 pt-5 border-t border-gray-200">
                <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Conclusion</div>
                <p className="text-sm text-gray-800">{coa.conclusion}</p>
              </div>
            ) : null;
          }
          if (section === 'signatures') {
            return (
              <div key="signatures" className="mt-8 pt-5 border-t border-gray-200 grid grid-cols-2 gap-8 text-sm">
                <div>
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-8">Authorised by</div>
                  <div className="border-t border-gray-300 pt-1 text-xs text-gray-500">Signature &amp; date</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Issued</div>
                  <div className="text-sm text-gray-900">{coa.issued_at ? new Date(coa.issued_at).toLocaleString() : 'Not yet issued'}</div>
                  {coa.customer_name && <div className="text-xs text-gray-500 mt-2">Prepared for {coa.customer_name}</div>}
                </div>
              </div>
            );
          }
          return null; // 'description' has no dedicated field; identity is shown in the masthead
        })}

        {coa.status === 'REVOKED' && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This certificate was revoked{coa.revoked_at ? ` on ${new Date(coa.revoked_at).toLocaleString()}` : ''} and is no longer valid.
          </div>
        )}

        {coa.template?.footer_html && (
          <div className="mt-6 pt-5 border-t border-gray-200 text-xs text-gray-600" dangerouslySetInnerHTML={clean(coa.template.footer_html)} />
        )}
      </div>

      <IssueModal
        open={issueOpen} onClose={() => setIssueOpen(false)}
        onConfirm={async (credential) => {
          try { await issueMut.mutateAsync({ credential }); message.success('Certificate issued'); setIssueOpen(false); }
          catch (e) { message.error(extractErr(e)); }
        }}
        loading={issueMut.isPending}
      />
      <RevokeModal
        open={revokeOpen} onClose={() => setRevokeOpen(false)}
        onConfirm={async (reason, credential) => {
          try { await revokeMut.mutateAsync({ reason, credential }); message.success('Certificate revoked'); setRevokeOpen(false); }
          catch (e) { message.error(extractErr(e)); }
        }}
        loading={revokeMut.isPending}
      />
    </PageContainer>
  );
}

function specText(r: CoaResultLine): string {
  const { min_value, max_value } = r;
  if (min_value == null && max_value == null) return '—';
  return `${min_value ?? '−∞'} .. ${max_value ?? '+∞'}`;
}

function IssueModal({ open, onClose, onConfirm, loading }: { open: boolean; onClose: () => void; onConfirm: (credential: string | null) => void; loading: boolean }) {
  const [credential, setCredential] = useState('');
  return (
    <Modal title="Issue Certificate" open={open} onCancel={onClose} okText="Sign & Issue" onOk={() => onConfirm(credential || null)} okButtonProps={{ loading }} centered destroyOnClose afterClose={() => setCredential('')}>
      <p className="text-sm text-gray-600 mb-3">Issuing locks the result snapshot and produces a verifiable QR certificate.</p>
      <F label="Credential (e-signature)"><Input.Password value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="Optional" /></F>
    </Modal>
  );
}

function RevokeModal({ open, onClose, onConfirm, loading }: { open: boolean; onClose: () => void; onConfirm: (reason: string | null, credential: string | null) => void; loading: boolean }) {
  const [reason, setReason] = useState('');
  const [credential, setCredential] = useState('');
  return (
    <Modal title="Revoke Certificate" open={open} onCancel={onClose} okText="Revoke" okButtonProps={{ danger: true, loading }} onOk={() => onConfirm(reason || null, credential || null)} centered destroyOnClose afterClose={() => { setReason(''); setCredential(''); }}>
      <div className="space-y-3">
        <F label="Reason"><Input.TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this certificate being revoked?" /></F>
        <F label="Credential (e-signature)"><Input.Password value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="Optional" /></F>
      </div>
    </Modal>
  );
}

function Field({ label, value, valueNode }: { label: string; value?: string; valueNode?: React.ReactNode }) {
  return <div><div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div><div className="text-sm text-gray-900 mt-0.5">{valueNode ?? value}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
