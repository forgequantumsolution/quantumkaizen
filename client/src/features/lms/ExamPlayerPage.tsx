import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Checkbox, Empty, Input, Radio, Spin, Tag } from 'antd';
import { ArrowLeft, ArrowRight, ShieldCheck, FileQuestion, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
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
  const [qIndex, setQIndex] = useState(0);
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
      setQIndex(0);
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
        /* Taking the exam — one question at a time */
        (() => {
          const total = attempt.questions.length;
          const q = attempt.questions[Math.min(qIndex, total - 1)];
          const isAnswered = (qq: typeof q) => {
            const a = answers[qq.id];
            return !!(a?.selected?.length || a?.text?.trim());
          };
          const answeredCount = attempt.questions.filter(isAnswered).length;
          const unanswered = total - answeredCount;
          const isLast = qIndex >= total - 1;
          const optionRow = 'w-full rounded-lg border border-gray-200 px-4 py-3 m-0 hover:border-gray-300 hover:bg-gray-50 transition-colors';
          const hint = q.type === 'MULTI' ? 'Select all that apply'
            : q.type === 'TRUE_FALSE' ? 'Select True or False'
            : q.type === 'SINGLE' ? 'Select one answer'
            : 'Write your answer below';
          return (
            <div className="flex flex-col lg:flex-row gap-5 lg:items-stretch">
              {/* Question panel */}
              <div className="flex-1 min-w-0 w-full">
                <div className="rounded-xl border border-gray-200 bg-white flex flex-col h-full min-h-[480px]">
                  <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Question {qIndex + 1} of {total}</span>
                    <span className="text-xs text-gray-400">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                  </div>
                  <div className="px-8 py-6 flex-1">
                    <p className="text-lg font-semibold text-gray-900 leading-snug">{q.prompt}</p>
                    <p className="text-xs text-gray-400 mt-1.5 mb-5">{hint}</p>
                    {q.type === 'SINGLE' || q.type === 'TRUE_FALSE' ? (
                      <Radio.Group
                        className="w-full"
                        value={answers[q.id]?.selected?.[0]}
                        onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { selected: [e.target.value] } }))}
                      >
                        <div className="flex flex-col gap-2">
                          {q.options.map((o) => (
                            <Radio key={o.id} value={o.id} className={cn(optionRow, answers[q.id]?.selected?.[0] === o.id && 'border-blue-400 bg-blue-50/60')}>
                              {o.text}
                            </Radio>
                          ))}
                        </div>
                      </Radio.Group>
                    ) : q.type === 'MULTI' ? (
                      <Checkbox.Group
                        className="w-full"
                        value={answers[q.id]?.selected ?? []}
                        onChange={(vals) => setAnswers((p) => ({ ...p, [q.id]: { selected: vals as string[] } }))}
                      >
                        <div className="flex flex-col gap-2 w-full">
                          {q.options.map((o) => (
                            <Checkbox key={o.id} value={o.id} className={cn(optionRow, (answers[q.id]?.selected ?? []).includes(o.id) && 'border-blue-400 bg-blue-50/60')}>
                              {o.text}
                            </Checkbox>
                          ))}
                        </div>
                      </Checkbox.Group>
                    ) : (
                      <Input.TextArea
                        rows={q.type === 'LONG_TEXT' ? 8 : 4}
                        value={answers[q.id]?.text ?? ''}
                        onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: { text: e.target.value } }))}
                        placeholder="Your answer"
                      />
                    )}
                  </div>
                  <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between">
                    <Button disabled={qIndex === 0} icon={<ArrowLeft size={14} />} onClick={() => setQIndex((i) => Math.max(0, i - 1))}>
                      Previous
                    </Button>
                    {isLast ? (
                      <span className="text-xs text-gray-400">End of exam — submit when ready</span>
                    ) : (
                      <Button type="primary" onClick={() => setQIndex((i) => Math.min(total - 1, i + 1))}>
                        Next <ArrowRight size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar: exam info, navigator, submit */}
              <aside className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-gray-900 leading-snug">{attempt.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">Passing score {attempt.passing_score}%{attempt.require_esign ? ' · e-sign on submit' : ''}</p>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium text-gray-700">{answeredCount} / {total} answered</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">Questions</p>
                  <div className="grid grid-cols-5 gap-2">
                    {attempt.questions.map((qq, i) => (
                      <button
                        key={qq.id}
                        onClick={() => setQIndex(i)}
                        className={cn(
                          'h-9 rounded-md text-xs font-medium border transition-colors',
                          i === qIndex
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : isAnswered(qq)
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  {unanswered > 0 && (
                    <p className="text-xs text-amber-600 mb-2 text-center">{unanswered} question{unanswered > 1 ? 's' : ''} unanswered</p>
                  )}
                  <Button type="primary" block loading={submitting} icon={attempt.require_esign ? <ShieldCheck size={14} /> : undefined} onClick={onSubmitClick}>
                    {attempt.require_esign ? 'Submit & sign' : 'Submit exam'}
                  </Button>
                </div>
              </aside>
            </div>
          );
        })()
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
