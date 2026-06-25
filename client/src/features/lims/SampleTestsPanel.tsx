import { useState, useEffect } from 'react';
import { App, Button, Input, InputNumber, Modal, Table } from 'antd';
import { FlaskConical, Plus, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import {
  useSampleTestsForSample, useAssignTests, useEnterResults, useReviewTest, useDisposeSample,
  SAMPLE_TEST_STATUS_BADGE, SAMPLE_TEST_STATUS_LABELS, EVALUATION_BADGE, EVALUATION_LABELS,
  OVERALL_RESULT_BADGE, specLimitLabel,
  type SampleTest, type Result,
} from '@/lib/api/testing';

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function SampleTestsPanel({ sampleId, canRelease }: { sampleId: string; canRelease?: boolean }) {
  const canEnter = useHasPermission('result.enter');
  const canDispose = useHasPermission('sample.dispose');

  const { data, isLoading } = useSampleTestsForSample(sampleId);
  const tests = data?.data ?? [];

  const [assignOpen, setAssignOpen] = useState(false);
  const [disposeMode, setDisposeMode] = useState<'RELEASED' | 'REJECTED' | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <FlaskConical size={15} className="text-gray-500" />Tests &amp; Results ({tests.length})
        </h3>
        {canEnter && (
          <Button size="small" icon={<Plus size={13} />} onClick={() => setAssignOpen(true)}>Assign Tests</Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading tests…</div>
      ) : tests.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">No tests assigned yet.</div>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => <TestCard key={t.id} test={t} canEnter={canEnter} />)}
        </div>
      )}

      {canRelease && (
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-gray-400" />Disposition
          </div>
          {canDispose && (
            <div className="flex items-center gap-2">
              <Button type="primary" onClick={() => setDisposeMode('RELEASED')}>Release</Button>
              <Button danger onClick={() => setDisposeMode('REJECTED')}>Reject</Button>
            </div>
          )}
        </div>
      )}

      <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} sampleId={sampleId} />
      <DisposeModal sampleId={sampleId} mode={disposeMode} onClose={() => setDisposeMode(null)} />
    </div>
  );
}

function TestCard({ test, canEnter }: { test: SampleTest; canEnter: boolean }) {
  const { message } = App.useApp();
  const canReview = useHasPermission('result.review');
  const enterMut = useEnterResults(test.id);
  const [reviewOpen, setReviewOpen] = useState(false);

  // edited values keyed by result_id
  const [edits, setEdits] = useState<Record<string, { numeric_value?: number | null; text_value?: string | null }>>({});
  useEffect(() => { setEdits({}); }, [test.id, test.results.length]);

  const isText = (r: Result) => r.min_value == null && r.max_value == null;

  const save = async () => {
    const results = Object.entries(edits)
      .filter(([, v]) => v.numeric_value !== undefined || v.text_value !== undefined)
      .map(([result_id, v]) => ({ result_id, ...v }));
    if (results.length === 0) return message.info('No changes to save');
    try {
      await enterMut.mutateAsync({ results });
      message.success('Results saved');
      setEdits({});
    } catch (e) { message.error(extractErr(e)); }
  };

  const editable = canEnter && test.status !== 'REVIEWED' && test.status !== 'CANCELLED';

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-900">{test.test_name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${SAMPLE_TEST_STATUS_BADGE[test.status]}`}>{SAMPLE_TEST_STATUS_LABELS[test.status]}</span>
          {test.overall_result && (
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${OVERALL_RESULT_BADGE[test.overall_result]}`}>{test.overall_result}</span>
          )}
          {test.analyst_name && <span className="text-[11px] text-gray-500">· {test.analyst_name}</span>}
        </div>
        <div className="flex items-center gap-2">
          {editable && (
            <Button size="small" type="primary" loading={enterMut.isPending} onClick={save}>Save Results</Button>
          )}
          {canReview && test.status === 'COMPLETED' && (
            <Button size="small" icon={<ClipboardCheck size={13} />} onClick={() => setReviewOpen(true)}>Review</Button>
          )}
        </div>
      </div>

      <Table<Result>
        size="small" rowKey="id" dataSource={test.results} pagination={false}
        locale={{ emptyText: 'No analytes.' }}
        columns={[
          { title: 'Analyte', dataIndex: 'analyte_name', ellipsis: true },
          { title: 'Spec Limit', width: 120, render: (_: unknown, r) => specLimitLabel(r) },
          { title: 'Unit', dataIndex: 'unit', width: 80, render: (v: string | null) => v ?? '—' },
          {
            title: 'Result', width: 160,
            render: (_: unknown, r) => {
              if (!editable) {
                return <span className="text-sm text-gray-900">{r.numeric_value ?? r.text_value ?? '—'}</span>;
              }
              if (isText(r)) {
                const val = edits[r.id]?.text_value ?? r.text_value ?? '';
                return <Input size="small" value={val} onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { text_value: e.target.value } }))} />;
              }
              const val = edits[r.id]?.numeric_value ?? r.numeric_value ?? undefined;
              return <InputNumber size="small" className="w-full" value={val ?? undefined} onChange={(v) => setEdits((p) => ({ ...p, [r.id]: { numeric_value: v ?? null } }))} />;
            },
          },
          {
            title: 'Evaluation', width: 110,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${EVALUATION_BADGE[r.evaluation]}`}>{EVALUATION_LABELS[r.evaluation]}</span>,
          },
        ]}
      />

      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} testId={test.id} />
    </div>
  );
}

function AssignModal({ open, onClose, sampleId }: { open: boolean; onClose: () => void; sampleId: string }) {
  const { message } = App.useApp();
  const mut = useAssignTests(sampleId);
  const submit = async () => {
    try {
      const res = await mut.mutateAsync({ from_product: true });
      message.success(`Assigned ${res.assigned} test(s)${res.spec_version ? ` from ${res.spec_version.code}` : ''}`);
      onClose();
    } catch (e) { message.error(extractErr(e)); }
  };
  return (
    <Modal title="Assign Tests" open={open} onCancel={onClose} onOk={submit} okText="Auto-assign from product panel" okButtonProps={{ loading: mut.isPending }} centered>
      <p className="text-sm text-gray-600">Assign the tests from this product&apos;s default panel to the sample. The active specification version will be applied automatically.</p>
    </Modal>
  );
}

function ReviewModal({ open, onClose, testId }: { open: boolean; onClose: () => void; testId: string }) {
  const { message } = App.useApp();
  const mut = useReviewTest(testId);
  const [credential, setCredential] = useState('');
  const [remarks, setRemarks] = useState('');

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    try {
      await mut.mutateAsync({ decision, remarks: remarks || undefined, credential: credential || undefined });
      message.success(decision === 'APPROVED' ? 'Test approved' : 'Test rejected');
      onClose(); setCredential(''); setRemarks('');
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Modal title="Review Test" open={open} onCancel={onClose} centered destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="reject" danger loading={mut.isPending} onClick={() => decide('REJECTED')}>Reject</Button>,
        <Button key="approve" type="primary" loading={mut.isPending} onClick={() => decide('APPROVED')}>Approve</Button>,
      ]}>
      <div className="space-y-3">
        <F label="Credential (e-signature)"><Input.Password value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="Password" autoComplete="off" /></F>
        <F label="Remarks"><Input.TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></F>
      </div>
    </Modal>
  );
}

function DisposeModal({ sampleId, mode, onClose }: { sampleId: string; mode: 'RELEASED' | 'REJECTED' | null; onClose: () => void }) {
  const { message } = App.useApp();
  const mut = useDisposeSample(sampleId);
  const [credential, setCredential] = useState('');
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!mode) return;
    try {
      await mut.mutateAsync({ disposition: mode, reason: reason || undefined, credential: credential || undefined });
      message.success(mode === 'RELEASED' ? 'Sample released' : 'Sample rejected');
      onClose(); setCredential(''); setReason('');
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Modal title={mode === 'REJECTED' ? 'Reject Sample' : 'Release Sample'} open={mode != null} onCancel={onClose}
      onOk={submit} okText={mode === 'REJECTED' ? 'Reject' : 'Release'} okButtonProps={{ loading: mut.isPending, danger: mode === 'REJECTED' }} centered destroyOnClose>
      <div className="space-y-3">
        <F label="Credential (e-signature)"><Input.Password value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="Password" autoComplete="off" /></F>
        <F label="Reason"><Input.TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></F>
      </div>
    </Modal>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
