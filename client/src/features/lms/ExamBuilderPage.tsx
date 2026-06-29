import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Empty, Input, InputNumber, Modal, Select, Spin, Switch, Tag } from 'antd';
import { ArrowLeft, Plus, Trash2, CheckCircle2, FileQuestion } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import { useCourse } from '@/lib/api/lms';
import {
  useCourseAssessments, useCreateCourseAssessment, useDeleteAssessment,
  useAddQuestion, useDeleteQuestion,
  type Assessment, type QuestionType, type CreateQuestionBody,
} from '@/lib/api/lms';

const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: 'Single choice', MULTI: 'Multiple choice', TRUE_FALSE: 'True / False',
  SHORT_TEXT: 'Short answer', LONG_TEXT: 'Long answer',
};
const CHOICE_TYPES: QuestionType[] = ['SINGLE', 'MULTI', 'TRUE_FALSE'];

function QuestionModal({ open, onClose, onSave, saving }: {
  open: boolean; onClose: () => void; saving: boolean;
  onSave: (body: CreateQuestionBody) => void;
}) {
  const { message } = App.useApp();
  const [type, setType] = useState<QuestionType>('SINGLE');
  const [prompt, setPrompt] = useState('');
  const [points, setPoints] = useState(1);
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<{ text: string; is_correct: boolean }[]>([
    { text: '', is_correct: true },
    { text: '', is_correct: false },
  ]);

  const reset = () => {
    setType('SINGLE'); setPrompt(''); setPoints(1); setExplanation('');
    setOptions([{ text: '', is_correct: true }, { text: '', is_correct: false }]);
  };

  const setCorrect = (idx: number, val: boolean) => {
    setOptions((prev) => prev.map((o, i) => {
      if (type === 'SINGLE' || type === 'TRUE_FALSE') return { ...o, is_correct: i === idx ? val : false };
      return i === idx ? { ...o, is_correct: val } : o;
    }));
  };

  const save = () => {
    if (!prompt.trim()) { message.error('Enter a question'); return; }
    const isChoice = CHOICE_TYPES.includes(type);
    let opts = options;
    if (type === 'TRUE_FALSE') {
      opts = [
        { text: 'True', is_correct: options[0]?.is_correct ?? true },
        { text: 'False', is_correct: !(options[0]?.is_correct ?? true) },
      ];
    }
    if (isChoice) {
      const clean = opts.filter((o) => o.text.trim());
      if (type !== 'TRUE_FALSE' && clean.length < 2) { message.error('Add at least two options'); return; }
      if (!clean.some((o) => o.is_correct)) { message.error('Mark a correct option'); return; }
    }
    onSave({
      type,
      prompt: prompt.trim(),
      points,
      explanation: explanation.trim() || null,
      options: isChoice ? opts.filter((o) => o.text.trim()) : undefined,
    });
    reset();
  };

  return (
    <Modal title="Add question" open={open} onCancel={() => { reset(); onClose(); }} onOk={save} okText="Add" confirmLoading={saving} width={580}>
      <div className="space-y-3 pt-1">
        <div>
          <label className="text-xs font-medium text-gray-600">Question type</label>
          <Select value={type} onChange={setType} style={{ width: '100%' }}
            options={(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Question *</label>
          <Input.TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
        </div>

        {type === 'TRUE_FALSE' && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Correct answer</label>
            <Select
              value={(options[0]?.is_correct ?? true) ? 'true' : 'false'}
              onChange={(v) => setOptions([{ text: 'True', is_correct: v === 'true' }])}
              style={{ width: 160 }}
              options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]}
            />
          </div>
        )}

        {(type === 'SINGLE' || type === 'MULTI') && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Options ({type === 'SINGLE' ? 'pick one correct' : 'tick all correct'})
            </label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Switch size="small" checked={o.is_correct} onChange={(v) => setCorrect(i, v)} />
                  <Input value={o.text} onChange={(e) => setOptions((prev) => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder={`Option ${i + 1}`} />
                  {options.length > 2 && <Trash2 size={15} className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} />}
                </div>
              ))}
            </div>
            <Button size="small" type="dashed" className="mt-2" icon={<Plus size={12} />} onClick={() => setOptions((prev) => [...prev, { text: '', is_correct: false }])}>Add option</Button>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block">Points</label>
            <InputNumber min={1} max={100} value={points} onChange={(v) => setPoints(v ?? 1)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Explanation (shown after grading)</label>
          <Input.TextArea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
        </div>
      </div>
    </Modal>
  );
}

export default function ExamBuilderPage() {
  const { id = '' } = useParams(); // course id
  const nav = useNavigate();
  const { message } = App.useApp();
  const canWrite = useHasPermission('lms_assessment.write');

  const { data: course } = useCourse(id);
  const { data: assessments, isLoading } = useCourseAssessments(id);
  const createAssessment = useCreateCourseAssessment(id);
  const deleteAssessment = useDeleteAssessment(id);
  const addQuestion = useAddQuestion(id);
  const deleteQuestion = useDeleteQuestion(id);

  const [qModalFor, setQModalFor] = useState<string | null>(null);

  const editable = course?.status === 'DRAFT';
  const exam: Assessment | undefined = assessments?.[0];

  const onCreate = async () => {
    try {
      await createAssessment.mutateAsync({ title: `${course?.title ?? 'Course'} — Final Exam`, passing_score: course?.passing_score ?? 70 });
      message.success('Exam created');
    } catch { message.error('Could not create exam'); }
  };

  return (
    <PageContainer>
      <button onClick={() => nav(`/lms/admin/courses/${id}`)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Back to course
      </button>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileQuestion size={22} className="text-gray-500" /> Exam Builder
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">{course?.title}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spin /></div>
      ) : !exam ? (
        <Empty description={editable ? 'No final exam yet.' : 'No exam for this course.'}>
          {editable && canWrite && <Button type="primary" icon={<Plus size={14} />} loading={createAssessment.isPending} onClick={onCreate}>Create final exam</Button>}
        </Empty>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">{exam.title}</span>
              <Tag color="blue">Pass ≥ {exam.passing_score}%</Tag>
              <span className="text-gray-500">{exam.max_attempts} attempts</span>
              <span className="text-gray-500">{exam.total_points} pts</span>
              {exam.require_esign && <Tag color="gold">e-sign</Tag>}
            </div>
            {editable && canWrite && (
              <Button danger size="small" icon={<Trash2 size={13} />} onClick={() => deleteAssessment.mutate(exam.id)}>Delete exam</Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Questions ({exam.questions.length})</h3>
            {editable && canWrite && <Button size="small" icon={<Plus size={13} />} onClick={() => setQModalFor(exam.id)}>Add question</Button>}
          </div>

          {exam.questions.length === 0 ? (
            <Empty description="No questions yet." />
          ) : (
            <div className="space-y-2">
              {exam.questions.map((q, i) => (
                <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">Q{i + 1}</span>
                        <Tag>{TYPE_LABEL[q.type]}</Tag>
                        <span className="text-[11px] text-gray-400">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-sm text-gray-800">{q.prompt}</p>
                      {q.options.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {q.options.map((o) => (
                            <li key={o.id} className="text-xs flex items-center gap-1.5">
                              {o.is_correct
                                ? <CheckCircle2 size={12} className="text-green-600" />
                                : <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" />}
                              <span className={o.is_correct ? 'text-green-700' : 'text-gray-600'}>{o.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {editable && canWrite && (
                      <Trash2 size={14} className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => deleteQuestion.mutate(q.id)} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <QuestionModal
        open={!!qModalFor}
        onClose={() => setQModalFor(null)}
        saving={addQuestion.isPending}
        onSave={async (body) => {
          if (!qModalFor) return;
          try {
            await addQuestion.mutateAsync({ assessmentId: qModalFor, body });
            message.success('Question added');
            setQModalFor(null);
          } catch { message.error('Could not add question'); }
        }}
      />
    </PageContainer>
  );
}
