import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Checkbox, Empty, Input, Radio, Spin, Tag } from 'antd';
import { ArrowLeft, ShieldCheck, FileQuestion, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import ESignatureModal from '@/components/shared/ESignatureModal';
import {
  useExamInfo, startAttempt, submitAttempt,
  type ActiveAttempt, type AttemptResult,
} from '@/lib/api/lms';

type AnswerMap = Record<string, { selected?: string[]; text?: string }>;

export default function ExamPlayerPage() {
  const { id = '' } = useParams(); // enrollment id
  const nav = useNavigate();
  const { message } = App.useApp();
  const { data: info, isLoading, refetch } = useExamInfo(id);

  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eSignOpen, setESignOpen] = useState(false);

  const begin = async () => {
    if (!info?.assessment_id) return;
    setStarting(true);
    try {
      const a = await startAttempt(info.assessment_id);
      setAttempt(a);
      setAnswers({});
      setResult(null);
    } catch (e) {
      message.error('Could not start the exam (no attempts left?)');
    } finally {
      setStarting(false);
    }
  };

  const doSubmit = async (credential?: string, meaning?: string) => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: attempt.questions.map((q) => ({
          question_id: q.id,
          selected_option_ids: answers[q.id]?.selected ?? [],
          text_answer: answers[q.id]?.text ?? null,
        })),
        credential,
        meaning,
      };
      const res = await submitAttempt(attempt.attempt_id, payload);
      setResult(res);
      setAttempt(null);
      setESignOpen(false);
      refetch();
    } catch {
      message.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitClick = () => {
    if (attempt?.require_esign) setESignOpen(true);
    else doSubmit();
  };

  if (isLoading) return <PageContainer><div className="flex justify-center py-20"><Spin /></div></PageContainer>;
  if (!info?.has_exam) return <PageContainer><Empty description="This course has no exam." /></PageContainer>;

  return (
    <PageContainer>
      <button onClick={() => nav(`/lms/learn/${id}`)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to course
      </button>

      {/* Result view */}
      {result ? (
        (() => {
          const submitted = result.status === 'SUBMITTED';
          const passed = !!result.passed;
          const tone = submitted ? 'info' : passed ? 'pass' : 'fail';
          const correct = result.review?.filter((r) => r.is_correct).length ?? 0;
          const totalQ = result.review?.length ?? 0;
          const canRetry = result.status === 'GRADED' && !passed && (info?.attempts_left ?? 0) > 0;
          return (
            <div className="max-w-3xl mx-auto">
              {/* Status hero */}
              <div className="text-center pt-6 pb-8">
                <div
                  className={cn(
                    'w-16 h-16 rounded-full mx-auto flex items-center justify-center shadow-sm',
                    tone === 'pass' && 'bg-emerald-500',
                    tone === 'fail' && 'bg-red-500',
                    tone === 'info' && 'bg-blue-500',
                  )}
                >
                  {tone === 'pass' ? <CheckCircle2 size={34} className="text-white" />
                    : tone === 'info' ? <Clock3 size={32} className="text-white" />
                    : <XCircle size={34} className="text-white" />}
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mt-4">
                  {submitted ? 'Submitted — awaiting grading' : passed ? 'Passed' : 'Not passed'}
                </h1>
                {!submitted && (
                  <p className={cn('text-lg font-semibold mt-1', passed ? 'text-emerald-600' : 'text-red-600')}>
                    Your score: {result.score}%
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {submitted
                    ? 'Your written answers will be graded by a reviewer.'
                    : `Passing score is ${result.passing_score}%.`}
                </p>
                <div className="flex items-center justify-center gap-2 mt-5">
                  <Button onClick={() => nav(`/lms/learn/${id}`)}>Back to course</Button>
                  {canRetry && (
                    <Button type="primary" onClick={() => { setResult(null); refetch(); }}>Try again</Button>
                  )}
                </div>
              </div>

              {/* Question review */}
              {result.review && result.review.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Question review</h3>
                    <span className="text-xs text-gray-500">{correct} / {totalQ} correct</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {result.review.map((r, i) => (
                      <div key={r.question_id} className="px-4 py-3 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          {r.is_correct
                            ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                            : <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800">Q{i + 1}. {r.prompt}</p>
                            {r.explanation && <p className="text-xs text-gray-500 mt-1">{r.explanation}</p>}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md border',
                            r.is_correct
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-red-700 bg-red-50 border-red-200',
                          )}
                        >
                          {r.awarded_points}/{r.max_points} pt{(r.max_points ?? 0) > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : attempt ? (
        /* Taking the exam */
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{attempt.title}</h1>
          <p className="text-xs text-gray-500 mb-4">Answer all questions, then submit. Passing score {attempt.passing_score}%.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {attempt.questions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-medium text-gray-800 mb-2">Q{i + 1}. {q.prompt} <span className="text-xs text-gray-400">({q.points} pt{q.points > 1 ? 's' : ''})</span></p>
                {q.type === 'SINGLE' || q.type === 'TRUE_FALSE' ? (
                  <Radio.Group
                    value={answers[q.id]?.selected?.[0]}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { selected: [e.target.value] } }))}
                  >
                    <div className="flex flex-col gap-1.5">
                      {q.options.map((o) => <Radio key={o.id} value={o.id}>{o.text}</Radio>)}
                    </div>
                  </Radio.Group>
                ) : q.type === 'MULTI' ? (
                  <Checkbox.Group
                    value={answers[q.id]?.selected ?? []}
                    onChange={(vals) => setAnswers((p) => ({ ...p, [q.id]: { selected: vals as string[] } }))}
                  >
                    <div className="flex flex-col gap-1.5">
                      {q.options.map((o) => <Checkbox key={o.id} value={o.id}>{o.text}</Checkbox>)}
                    </div>
                  </Checkbox.Group>
                ) : (
                  <Input.TextArea
                    rows={q.type === 'LONG_TEXT' ? 5 : 2}
                    value={answers[q.id]?.text ?? ''}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { text: e.target.value } }))}
                    placeholder="Your answer"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="primary" loading={submitting} icon={attempt.require_esign ? <ShieldCheck size={14} /> : undefined} onClick={onSubmitClick}>
              {attempt.require_esign ? 'Submit & sign' : 'Submit exam'}
            </Button>
          </div>
        </div>
      ) : (
        /* Intro / start screen */
        <div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
              <FileQuestion size={20} className="text-gray-500" /> {info.title}
            </h1>
            {info.description && <p className="text-sm text-gray-600 mb-3">{info.description}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
              <Stat label="Questions" value={String(info.question_count ?? '—')} />
              <Stat label="Passing score" value={`${info.passing_score}%`} />
              <Stat label="Attempts left" value={`${info.attempts_left} / ${info.max_attempts}`} />
              <Stat label="Time limit" value={info.time_limit_minutes ? `${info.time_limit_minutes} min` : 'None'} />
            </div>
            {info.passed && <Tag color="green" className="mb-3">Already passed{info.best_score != null ? ` (${info.best_score}%)` : ''}</Tag>}
            {info.require_esign && <p className="text-xs text-amber-700 mb-3 flex items-center gap-1"><ShieldCheck size={12} /> An e-signature is required on submission.</p>}
            <Button type="primary" block loading={starting} disabled={(info.attempts_left ?? 0) <= 0 && !info.in_progress_attempt_id} onClick={begin}>
              {info.in_progress_attempt_id ? 'Resume exam' : 'Start exam'}
            </Button>
            {(info.attempts_left ?? 0) <= 0 && !info.in_progress_attempt_id && (
              <p className="text-xs text-gray-400 mt-2 text-center">No attempts remaining.</p>
            )}
          </div>
        </div>
      )}

      <ESignatureModal
        isOpen={eSignOpen}
        onClose={() => setESignOpen(false)}
        onSign={(password, meaning) => doSubmit(password, meaning)}
        entityType="LmsAssessmentAttempt"
        entityId={attempt?.attempt_id ?? ''}
        isLoading={submitting}
      />
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
