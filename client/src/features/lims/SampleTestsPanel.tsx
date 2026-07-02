import { useState, useEffect, useRef } from 'react';
import { App, Button, Input, InputNumber, Modal, Radio, Select, Table, Tooltip } from 'antd';
import { FlaskConical, Plus, ClipboardCheck, ShieldCheck, Play, Upload, FlaskRound, Microscope, FileText } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import {
  useSampleTestsForSample, useAssignTests, useStartTest, useEnterResults, useReviewTest, useDisposeSample,
  SAMPLE_TEST_STATUS_BADGE, SAMPLE_TEST_STATUS_LABELS, EVALUATION_BADGE, EVALUATION_LABELS,
  OVERALL_RESULT_BADGE, acceptanceText, previewEvaluation,
  type SampleTest, type Result, type AssignTestsBody,
} from '@/lib/api/testing';
import { useTestPanels, useTestDefinitions } from '@/lib/api/testDefinition';

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function SampleTestsPanel({ sampleId, canRelease, status }: { sampleId: string; canRelease?: boolean; status?: string }) {
  const canEnter = useHasPermission('result.enter');
  const canDispose = useHasPermission('sample.dispose');

  const { data, isLoading } = useSampleTestsForSample(sampleId);
  const tests = data?.data ?? [];

  const [assignOpen, setAssignOpen] = useState(false);
  const [disposeMode, setDisposeMode] = useState<'RELEASED' | 'REJECTED' | null>(null);

  // Disposition only makes sense once there are tests to release against.
  const showDisposition = canRelease && tests.length > 0;
  const allReviewed = tests.length > 0 && tests.every((t) => t.review_status === 'APPROVED');
  const anyOos = tests.some((t) => t.overall_result === 'OOS' || t.overall_result === 'FAIL');
  // Release is gated (matches the backend): sample in review, every test approved, no OOS.
  const canReleaseNow = status === 'IN_REVIEW' && allReviewed && !anyOos;
  const releaseHint = anyOos ? 'Out-of-spec results present' : !allReviewed ? 'All tests must be review-approved' : status !== 'IN_REVIEW' ? 'Send the sample to review first' : '';

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

      {showDisposition && (
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-gray-400" />Disposition (e-signed)
            {!canReleaseNow && releaseHint && <span className="normal-case text-amber-600">· {releaseHint}</span>}
          </div>
          {canDispose && (
            <div className="flex items-center gap-2">
              <Button type="primary" disabled={!canReleaseNow} onClick={() => setDisposeMode('RELEASED')}>Release</Button>
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
  const startMut = useStartTest(test.id);
  const enterMut = useEnterResults(test.id);
  const [reviewOpen, setReviewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // edited (unsaved) values keyed by result_id
  const [edits, setEdits] = useState<Record<string, { numeric_value?: number | null; text_value?: string | null }>>({});
  useEffect(() => { setEdits({}); }, [test.id, test.results.length]);

  const isText = (r: Result) => r.min_value == null && r.max_value == null;
  const started = test.status !== 'PENDING';
  const editable = canEnter && started && test.status !== 'REVIEWED' && test.status !== 'CANCELLED';

  const start = async () => {
    try { await startMut.mutateAsync({}); message.success('Test started — enter the measured results'); }
    catch (e) { message.error(extractErr(e)); }
  };

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

  // #3 — instrument-style CSV import: lines of "Analyte,Value" fill the grid.
  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const byAnalyte = new Map<string, string>();
      String(reader.result ?? '').split(/\r?\n/).forEach((line) => {
        const [a, ...rest] = line.split(',');
        if (a && rest.length) byAnalyte.set(a.trim().toLowerCase(), rest.join(',').trim());
      });
      const next: typeof edits = {};
      let filled = 0;
      for (const r of test.results) {
        const v = byAnalyte.get(r.analyte_name.trim().toLowerCase());
        if (v == null || v === '') continue;
        if (isText(r)) { next[r.id] = { text_value: v }; filled++; }
        else { const n = Number(v); if (!Number.isNaN(n)) { next[r.id] = { numeric_value: n }; filled++; } }
      }
      if (!filled) return message.warning('No matching analytes found in the file (expected "Analyte,Value" lines)');
      setEdits((p) => ({ ...p, ...next }));
      message.success(`Imported ${filled} value(s) — review, then Save Results`);
    };
    reader.readAsText(file);
  };

  // method / execution context line
  const context = [
    test.technique,
    test.method_name ? `${test.method_name}${test.sop_ref ? ` (${test.sop_ref})` : ''}` : test.sop_ref,
    test.instrument_name,
  ].filter(Boolean);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-900">{test.test_name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${SAMPLE_TEST_STATUS_BADGE[test.status]}`}>{SAMPLE_TEST_STATUS_LABELS[test.status]}</span>
          {test.overall_result && (
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${OVERALL_RESULT_BADGE[test.overall_result]}`}>{test.overall_result}</span>
          )}
          {test.analyst_name && <span className="text-[11px] text-gray-500">· {test.analyst_name}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canEnter && !started && (
            <Button size="small" type="primary" icon={<Play size={13} />} loading={startMut.isPending} onClick={start}>Start Test</Button>
          )}
          {editable && (
            <>
              <Tooltip title='Import a CSV of "Analyte,Value" lines (e.g. an instrument export)'>
                <Button size="small" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>Import CSV</Button>
              </Tooltip>
              <Button size="small" type="primary" loading={enterMut.isPending} onClick={save}>Save Results</Button>
            </>
          )}
          {canReview && test.status === 'COMPLETED' && (
            <Button size="small" icon={<ClipboardCheck size={13} />} onClick={() => setReviewOpen(true)}>Review</Button>
          )}
        </div>
      </div>

      {/* #1 — what the test is + how it's run */}
      {context.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2 flex-wrap">
          {test.technique && <span className="inline-flex items-center gap-1"><Microscope size={12} />{test.technique}</span>}
          {(test.method_name || test.sop_ref) && <span className="inline-flex items-center gap-1"><FileText size={12} />{test.method_name}{test.sop_ref ? ` · ${test.sop_ref}` : ''}</span>}
          {test.instrument_name && <span className="inline-flex items-center gap-1"><FlaskRound size={12} />{test.instrument_name}</span>}
        </div>
      )}
      {/* #1 — guidance / state hint */}
      {!started ? (
        <div className="text-[11px] text-amber-600 mb-2">Not started. Click <b>Start Test</b> to begin and record the measured results.</div>
      ) : editable ? (
        <div className="text-[11px] text-gray-400 mb-2">Enter the value measured on the instrument for each analyte; a value outside the acceptance range is flagged <b>OOS</b> when you save.</div>
      ) : null}
      {test.guidance && <div className="text-[11px] text-gray-400 mb-2 italic">{test.guidance}</div>}

      <Table<Result>
        size="small" rowKey="id" dataSource={test.results} pagination={false}
        locale={{ emptyText: 'No analytes.' }}
        columns={[
          { title: 'Analyte', dataIndex: 'analyte_name', ellipsis: true },
          { title: 'Acceptance', width: 150, render: (_: unknown, r) => <span className="text-gray-600">{acceptanceText(r)}</span> },
          { title: 'Unit', dataIndex: 'unit', width: 70, render: (v: string | null) => v ?? '—' },
          {
            title: 'Result', width: 170,
            render: (_: unknown, r) => {
              if (!editable) {
                return <span className="text-sm text-gray-900">{r.numeric_value ?? r.text_value ?? '—'}</span>;
              }
              if (isText(r)) {
                const val = edits[r.id]?.text_value ?? r.text_value ?? '';
                return <Input size="small" value={val} onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { text_value: e.target.value } }))} />;
              }
              const val = edits[r.id]?.numeric_value ?? r.numeric_value ?? undefined;
              // #4 — live OOS preview as you type
              const preview = edits[r.id]?.numeric_value !== undefined ? previewEvaluation(r, edits[r.id]?.numeric_value ?? null) : null;
              return (
                <div>
                  <InputNumber size="small" className="w-full" value={val ?? undefined} status={preview === 'OOS' ? 'error' : undefined}
                    onChange={(v) => setEdits((p) => ({ ...p, [r.id]: { numeric_value: v ?? null } }))} />
                  {preview === 'OOS' && <div className="text-[10px] text-state-oos mt-0.5">⚠ Out of spec — will raise an investigation</div>}
                </div>
              );
            },
          },
          {
            title: 'Evaluation', width: 120,
            render: (_: unknown, r) => {
              const preview = edits[r.id]?.numeric_value !== undefined ? previewEvaluation(r, edits[r.id]?.numeric_value ?? null) : null;
              if (preview) {
                return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border border-dashed ${EVALUATION_BADGE[preview]}`}>{EVALUATION_LABELS[preview]} ?</span>;
              }
              return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${EVALUATION_BADGE[r.evaluation]}`}>{EVALUATION_LABELS[r.evaluation]}</span>;
            },
          },
        ]}
      />

      <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />

      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} testId={test.id} />
    </div>
  );
}

type AssignMode = 'product' | 'panel' | 'tests';

function AssignModal({ open, onClose, sampleId }: { open: boolean; onClose: () => void; sampleId: string }) {
  const { message } = App.useApp();
  const mut = useAssignTests(sampleId);
  const [mode, setMode] = useState<AssignMode>('product');
  const [panelId, setPanelId] = useState<string | undefined>();
  const [defIds, setDefIds] = useState<string[]>([]);

  const { data: panels } = useTestPanels();
  const { data: defs } = useTestDefinitions({ status: 'APPROVED' });

  useEffect(() => { if (open) { setMode('product'); setPanelId(undefined); setDefIds([]); } }, [open]);

  const submit = async () => {
    let body: AssignTestsBody;
    if (mode === 'product') body = { from_product: true };
    else if (mode === 'panel') { if (!panelId) return message.error('Select a panel'); body = { panel_id: panelId }; }
    else { if (!defIds.length) return message.error('Select at least one test'); body = { test_definition_ids: defIds }; }
    try {
      const res = await mut.mutateAsync(body);
      message.success(`Assigned ${res.assigned} test(s)${res.spec_version ? ` · spec ${res.spec_version.code}` : ' · no spec bound'}`);
      onClose();
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Modal title="Assign Tests" open={open} onCancel={onClose} onOk={submit} okText="Assign" okButtonProps={{ loading: mut.isPending }} centered destroyOnClose>
      <div className="space-y-3">
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} optionType="button" buttonStyle="solid" size="small"
          options={[{ value: 'product', label: 'Product panel' }, { value: 'panel', label: 'Pick a panel' }, { value: 'tests', label: 'Pick tests' }]} />
        {mode === 'product' && (
          <p className="text-sm text-gray-600">Assign the tests from this product&apos;s default panel. The active specification version is applied automatically. Requires the sample to be linked to a product that has a default panel.</p>
        )}
        {mode === 'panel' && (
          <div><label className="block text-[11px] font-medium text-gray-600 mb-1">Test panel</label>
            <Select value={panelId} onChange={setPanelId} showSearch optionFilterProp="label" className="w-full" placeholder="Select a panel"
              options={(panels?.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name} (${p.item_count} tests)` }))} /></div>
        )}
        {mode === 'tests' && (
          <div><label className="block text-[11px] font-medium text-gray-600 mb-1">Tests</label>
            <Select mode="multiple" value={defIds} onChange={setDefIds} showSearch optionFilterProp="label" className="w-full" placeholder="Select one or more tests"
              options={(defs?.data ?? []).map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))} /></div>
        )}
      </div>
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
