import { useState } from 'react';
import { App, Button, Empty, InputNumber, Modal, Spin, Table, Tag } from 'antd';
import { ClipboardCheck } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import {
  useGradingQueue, useGraderAttempt, useGradeAttempt,
  type GradingQueueItem,
} from '@/lib/api/lms';

function GradeModal({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { message } = App.useApp();
  const { data, isLoading } = useGraderAttempt(attemptId);
  const grade = useGradeAttempt();
  const [points, setPoints] = useState<Record<string, number>>({});

  const submit = async () => {
    if (!data) return;
    const needing = data.answers.filter((a) => a.needs_grading);
    const grades = needing.map((a) => ({ question_id: a.question_id, awarded_points: points[a.question_id] ?? 0 }));
    if (grades.length === 0) { message.info('Nothing to grade'); onClose(); return; }
    try {
      await grade.mutateAsync({ attemptId, grades });
      message.success('Graded');
      onClose();
    } catch { message.error('Grading failed'); }
  };

  return (
    <Modal title="Grade attempt" open onCancel={onClose} onOk={submit} okText="Submit grades" confirmLoading={grade.isPending} width={640}>
      {isLoading || !data ? (
        <div className="flex justify-center py-10"><Spin /></div>
      ) : (
        <div className="space-y-3 pt-1">
          {data.answers.map((a, i) => (
            <div key={a.question_id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">Q{i + 1}. {a.prompt}</span>
                <span className="text-xs text-gray-400">max {a.max_points}</span>
              </div>
              {a.needs_grading ? (
                <>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap bg-gray-50 rounded p-2">{a.text_answer || <span className="text-gray-400">No answer</span>}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Award points:</span>
                    <InputNumber min={0} max={a.max_points} value={points[a.question_id] ?? 0} onChange={(v) => setPoints((p) => ({ ...p, [a.question_id]: v ?? 0 }))} />
                  </div>
                </>
              ) : (
                <Tag color={a.awarded_points && a.max_points && a.awarded_points >= a.max_points ? 'green' : 'default'} className="mt-2">
                  Auto-graded: {a.awarded_points}/{a.max_points}
                </Tag>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function GradingPage() {
  const { data, isLoading } = useGradingQueue();
  const [grading, setGrading] = useState<string | null>(null);

  const columns = [
    { title: 'Exam', dataIndex: 'assessment_title' },
    { title: 'Learner', dataIndex: 'user_name', render: (n: string | null) => n ?? '—' },
    { title: 'Attempt', dataIndex: 'attempt_no', width: 90, render: (n: number) => `#${n}` },
    { title: 'Submitted', dataIndex: 'submitted_at', width: 160, render: (d: string | null) => d ? new Date(d).toLocaleString() : '—' },
    {
      title: '', width: 100,
      render: (_: unknown, r: GradingQueueItem) => <Button size="small" type="primary" onClick={() => setGrading(r.attempt_id)}>Grade</Button>,
    },
  ];

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={22} className="text-gray-500" /> Assessment Results
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Exam attempts with written answers awaiting manual grading.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spin /></div>
      ) : (data?.length ?? 0) === 0 ? (
        <Empty description="Nothing to grade 🎉" />
      ) : (
        <Table rowKey="attempt_id" dataSource={data} columns={columns} size="small" pagination={{ pageSize: 20 }} />
      )}

      {grading && <GradeModal attemptId={grading} onClose={() => setGrading(null)} />}
    </PageContainer>
  );
}
