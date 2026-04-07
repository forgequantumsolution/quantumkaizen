import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  BookOpen,
  Users,
  FileText,
  Presentation,
  Video,
  ClipboardCheck,
  CheckCircle2,
  Award,
  Download,
  BarChart3,
  Target,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Badge, StatusBadge, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import Tabs from '@/components/ui/Tabs';
import { cn, formatDate } from '@/lib/utils';
import {
  useTrainingProgram,
  useTrainingContent,
  useAssessmentQuestions,
  useParticipants,
} from './hooks';
import type { Participant, ContentBlock, AssessmentQuestion } from './hooks';

const typeVariantMap: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'danger' | 'default'> = {
  INDUCTION: 'info',
  OJT: 'warning',
  CLASSROOM: 'purple',
  E_LEARNING: 'success',
  REGULATORY: 'danger',
  REFRESHER: 'default',
};

const contentIcons: Record<string, React.ElementType> = {
  DOCUMENT: FileText,
  PRESENTATION: Presentation,
  VIDEO: Video,
  CHECKLIST: ClipboardCheck,
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'participants', label: 'Participants' },
  { id: 'analytics', label: 'Analytics' },
];

export default function TrainingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: program, isLoading } = useTrainingProgram(id!);
  const { data: content } = useTrainingContent(id!);
  const { data: questions } = useAssessmentQuestions(id!);
  const { data: participants } = useParticipants(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="py-32 text-center">
        <p className="text-slate-500">Training program not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/lms/training')}>
          Back to Programs
        </Button>
      </div>
    );
  }

  // Analytics calculations
  const completedCount = participants.filter((p) => p.status === 'COMPLETED').length;
  const inProgressCount = participants.filter((p) => p.status === 'IN_PROGRESS').length;
  const notStartedCount = participants.filter((p) => p.status === 'NOT_STARTED').length;
  const expiredCount = participants.filter((p) => p.status === 'EXPIRED').length;
  const passedCount = participants.filter((p) => p.score !== null && p.score >= program.passingScore).length;
  const failedCount = participants.filter((p) => p.score !== null && p.score < program.passingScore).length;
  const avgScore =
    participants.filter((p) => p.score !== null).length > 0
      ? Math.round(
          participants.filter((p) => p.score !== null).reduce((s, p) => s + (p.score || 0), 0) /
            participants.filter((p) => p.score !== null).length,
        )
      : 0;

  const participantColumns: Column<Participant>[] = [
    {
      key: 'employeeId',
      header: 'Employee ID',
      render: (row) => <span className="font-mono text-xs font-semibold text-navy-700">{row.employeeId}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    { key: 'department', header: 'Department' },
    { key: 'role', header: 'Role' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) =>
        row.score !== null ? (
          <span
            className={cn(
              'font-semibold',
              row.score >= program.passingScore ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {row.score}%
          </span>
        ) : (
          <span className="text-slate-400">--</span>
        ),
    },
    {
      key: 'completionDate',
      header: 'Completed',
      render: (row) => <span className="text-slate-500">{formatDate(row.completionDate)}</span>,
    },
    {
      key: 'certificateId',
      header: 'Certificate',
      render: (row) =>
        row.certificateId ? (
          <button className="flex items-center gap-1 text-xs text-navy-600 hover:text-navy-700 transition-colors">
            <Award className="h-3.5 w-3.5" />
            {row.certificateId}
          </button>
        ) : (
          <span className="text-slate-400">--</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/lms/training')} className="hover:text-navy-700 transition-colors">
          Training Programs
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{program.programId}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{program.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={typeVariantMap[program.type] || 'default'}>
              {program.type.replace(/_/g, ' ')}
            </Badge>
            <StatusBadge status={program.status} />
            <Badge variant="outline">
              <Users className="mr-1 h-3 w-3" />
              {program.enrolled} enrolled
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={() => navigate(`/lms/training/${id}/edit`)}>
            Edit Program
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Overview Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <p className="text-sm leading-relaxed text-slate-600">{program.description}</p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning Objectives</CardTitle>
              </CardHeader>
              <ul className="space-y-2">
                {program.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {obj}
                  </li>
                ))}
              </ul>
            </Card>

            {program.prerequisites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Prerequisites</CardTitle>
                </CardHeader>
                <div className="flex flex-wrap gap-2">
                  {program.prerequisites.map((prereq) => (
                    <Badge key={prereq} variant="outline">
                      <BookOpen className="mr-1 h-3 w-3" />
                      {prereq}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Program Details</CardTitle>
              </CardHeader>
              <dl className="space-y-3 text-sm">
                {[
                  ['Program ID', program.programId],
                  ['Type', program.type.replace(/_/g, ' ')],
                  ['Department', program.department],
                  ['Duration', program.duration],
                  ['Validity Period', program.validityPeriod],
                  ['Passing Score', `${program.passingScore}%`],
                  ['Created', formatDate(program.createdAt)],
                  ['Last Updated', formatDate(program.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-900 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Enrolled</span>
                  <span className="font-medium text-slate-900">{program.enrolled}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Completed</span>
                  <span className="font-medium text-emerald-600">{completedCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">In Progress</span>
                  <span className="font-medium text-sky-600">{inProgressCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Not Started</span>
                  <span className="font-medium text-slate-500">{notStartedCount}</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${program.completionRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-right">{program.completionRate}% completion rate</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Content Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'content' && (
        <Card>
          <CardHeader>
            <CardTitle>Training Content</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {content.map((block, idx) => {
              const Icon = contentIcons[block.type] || FileText;
              return (
                <div
                  key={block.id}
                  className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{block.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <Badge variant="outline">{block.type.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {block.duration}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Section {idx + 1}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Assessment Tab ────────────────────────────────────────────────── */}
      {activeTab === 'assessment' && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment Questions</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="text-sm text-slate-500">
                Total questions: <strong className="text-slate-700">{questions.length}</strong>
              </div>
              <div className="text-sm text-slate-500">
                Total points:{' '}
                <strong className="text-slate-700">
                  {questions.reduce((s, q) => s + q.points, 0)}
                </strong>
              </div>
              <div className="text-sm text-slate-500">
                Passing score: <strong className="text-slate-700">{program.passingScore}%</strong>
              </div>
            </div>

            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">
                      {idx + 1}
                    </span>
                    <Badge variant="outline">{q.type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <Badge variant="info">{q.points} pts</Badge>
                </div>

                <p className="text-sm font-medium text-slate-800 mb-3">{q.question}</p>

                {q.type !== 'OPEN_TEXT' && (
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = opt === q.correctAnswer;
                      return (
                        <div
                          key={optIdx}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                            isCorrect
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-100 text-slate-600',
                          )}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                          )}
                          {opt}
                          {isCorrect && (
                            <span className="ml-auto text-xs font-medium text-emerald-600">Correct</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === 'OPEN_TEXT' && (
                  <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 p-3">
                    <p className="text-xs text-slate-400 italic">Open text response - manually graded</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Participants Tab ──────────────────────────────────────────────── */}
      {activeTab === 'participants' && (
        <Card noPadding>
          <DataTable
            columns={participantColumns}
            data={participants}
            emptyMessage="No participants enrolled"
          />
        </Card>
      )}

      {/* ── Analytics Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Completion Rate</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{program.completionRate}%</p>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${program.completionRate}%` }} />
              </div>
            </Card>
            <Card>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Average Score</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{avgScore}%</p>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className={cn('h-2 rounded-full', avgScore >= program.passingScore ? 'bg-emerald-500' : 'bg-amber-500')}
                  style={{ width: `${avgScore}%` }}
                />
              </div>
            </Card>
            <Card>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pass Rate</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{passedCount}</p>
              <p className="mt-0.5 text-xs text-slate-400">out of {passedCount + failedCount} assessed</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fail Rate</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="mt-0.5 text-xs text-slate-400">below {program.passingScore}% passing score</p>
            </Card>
          </div>

          {/* Completion donut chart (CSS-based) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-8">
                {/* Donut chart */}
                <div className="relative h-36 w-36 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    {/* Background */}
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    {/* Completed */}
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke="#10b981" strokeWidth="3"
                      strokeDasharray={`${(completedCount / participants.length) * 97.4} 97.4`}
                      strokeDashoffset="0"
                    />
                    {/* In Progress */}
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke="#3b82f6" strokeWidth="3"
                      strokeDasharray={`${(inProgressCount / participants.length) * 97.4} 97.4`}
                      strokeDashoffset={`${-((completedCount / participants.length) * 97.4)}`}
                    />
                    {/* Not Started */}
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke="#94a3b8" strokeWidth="3"
                      strokeDasharray={`${(notStartedCount / participants.length) * 97.4} 97.4`}
                      strokeDashoffset={`${-(((completedCount + inProgressCount) / participants.length) * 97.4)}`}
                    />
                    {/* Expired */}
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke="#ef4444" strokeWidth="3"
                      strokeDasharray={`${(expiredCount / participants.length) * 97.4} 97.4`}
                      strokeDashoffset={`${-(((completedCount + inProgressCount + notStartedCount) / participants.length) * 97.4)}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-900">{participants.length}</span>
                    <span className="text-[10px] text-slate-400">Total</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2.5">
                  {[
                    { label: 'Completed', count: completedCount, color: 'bg-emerald-500' },
                    { label: 'In Progress', count: inProgressCount, color: 'bg-blue-500' },
                    { label: 'Not Started', count: notStartedCount, color: 'bg-slate-400' },
                    { label: 'Expired', count: expiredCount, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                      <div className={cn('h-3 w-3 rounded-full', item.color)} />
                      <span className="text-slate-600">{item.label}</span>
                      <span className="ml-auto font-semibold text-slate-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Pass/Fail bar */}
            <Card>
              <CardHeader>
                <CardTitle>Pass / Fail Ratio</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">Passed</span>
                    <span className="text-sm font-semibold text-emerald-600">{passedCount}</span>
                  </div>
                  <div className="h-4 w-full rounded-full bg-slate-100">
                    <div
                      className="h-4 rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${passedCount + failedCount > 0 ? (passedCount / (passedCount + failedCount)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">Failed</span>
                    <span className="text-sm font-semibold text-red-600">{failedCount}</span>
                  </div>
                  <div className="h-4 w-full rounded-full bg-slate-100">
                    <div
                      className="h-4 rounded-full bg-red-500 transition-all"
                      style={{
                        width: `${passedCount + failedCount > 0 ? (failedCount / (passedCount + failedCount)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mt-4">
                  <p className="text-xs text-slate-500">
                    Average score: <strong className="text-slate-700">{avgScore}%</strong> | Passing threshold:{' '}
                    <strong className="text-slate-700">{program.passingScore}%</strong>
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Kirkpatrick Evaluation Levels */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Kirkpatrick Evaluation Framework</h3>
            <div className="space-y-4">
              {[
                {
                  level: 'L1', name: 'Reaction', color: 'bg-blue-50 border-blue-200',
                  description: 'Did participants find the training valuable?',
                  metric: 'Satisfaction Score',
                  value: '4.2 / 5.0',
                  items: ['Training content was relevant', 'Instructor was knowledgeable', 'Pace was appropriate', 'Would recommend to colleagues'],
                  scores: [4.5, 4.2, 3.9, 4.3],
                },
                {
                  level: 'L2', name: 'Learning', color: 'bg-green-50 border-green-200',
                  description: 'Did participants acquire knowledge and skills?',
                  metric: 'Assessment Pass Rate',
                  value: '89%',
                  items: ['Pre-test score', 'Post-test score', 'Knowledge gain', 'Skills demonstrated'],
                  scores: [52, 89, 37, 78],
                },
                {
                  level: 'L3', name: 'Behavior', color: 'bg-amber-50 border-amber-200',
                  description: 'Are participants applying learning on the job?',
                  metric: '90-Day Follow-up',
                  value: '76%',
                  items: ['Applying new skills at work', 'Sharing knowledge with team', 'Behavior change observed by manager'],
                  scores: [76, 68, 82],
                },
                {
                  level: 'L4', name: 'Results', color: 'bg-purple-50 border-purple-200',
                  description: 'What business impact has the training created?',
                  metric: 'ROI Indicator',
                  value: 'Positive',
                  items: ['NC reduction linked to training', 'Process improvement observed', 'Customer complaints reduced'],
                  scores: [null, null, null],
                },
              ].map(({ level, name, color, description, metric, value, items, scores }) => (
                <div key={level} className={cn('rounded-xl border p-4', color)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-gray-700 border">{level}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{metric}</p>
                      <p className="text-sm font-bold text-gray-900">{value}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{item}</span>
                        {scores[idx] !== null && scores[idx] !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-white/60 rounded-full overflow-hidden">
                              <div className="h-full bg-current rounded-full opacity-60" style={{ width: `${Math.min(100, scores[idx] as number)}%` }} />
                            </div>
                            <span className="font-medium w-8 text-right">{scores[idx]}{level === 'L1' ? '' : '%'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Pending assessment</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
