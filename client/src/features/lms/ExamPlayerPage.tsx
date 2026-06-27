import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Checkbox, Empty, Input, Radio, Result, Spin, Tag } from 'antd';
import { ArrowLeft, ShieldCheck, FileQuestion } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
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
        <Result
          status={result.status === 'SUBMITTED' ? 'info' : result.passed ? 'success' : 'error'}
          title={
            result.status === 'SUBMITTED'
              ? 'Submitted — awaiting grading'
              : result.passed ? `Passed — ${result.score}%` : `Not passed — ${result.score}%`
          }
          subTitle={
            result.status === 'SUBMITTED'
              ? 'Your written answers will be graded by a reviewer.'
              : `Passing score is ${result.passing_score}%.`
          }
          extra={[
            <Button key="back" onClick={() => nav(`/lms/learn/${id}`)}>Back to course</Button>,
            result.status === 'GRADED' && !result.passed && (info?.attempts_left ?? 0) > 0
              ? <Button key="retry" type="primary" onClick={() => { setResult(null); refetch(); }}>Try again</Button>
              : null,
          ]}
        >
          {result.review && (
            <div className="text-left max-w-xl mx-auto space-y-2">
              {result.review.map((r, i) => (
                <div key={r.question_id} className="text-sm border-b border-gray-100 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Q{i + 1}. {r.prompt}</span>
                    <Tag color={r.is_correct ? 'green' : 'red'}>{r.awarded_points}/{r.max_points}</Tag>
                  </div>
                  {r.explanation && <p className="text-xs text-gray-500 mt-1">{r.explanation}</p>}
                </div>
              ))}
            </div>
          )}
        </Result>
      ) : attempt ? (
        /* Taking the exam */
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{attempt.title}</h1>
          <p className="text-xs text-gray-500 mb-4">Answer all questions, then submit. Passing score {attempt.passing_score}%.</p>
          <div className="space-y-4">
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
        <div className="max-w-lg">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
              <FileQuestion size={20} className="text-gray-500" /> {info.title}
            </h1>
            {info.description && <p className="text-sm text-gray-600 mb-3">{info.description}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
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
