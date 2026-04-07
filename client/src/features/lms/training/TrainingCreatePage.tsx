import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTrainingProgram } from './hooks';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  FileText,
  Presentation,
  Video,
  ClipboardCheck,
  Check,
  GripVertical,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────────────

interface ContentBlock {
  id: string;
  title: string;
  type: 'DOCUMENT' | 'PRESENTATION' | 'VIDEO' | 'CHECKLIST';
  url: string;
  duration: string;
}

interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'OPEN_TEXT';
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
}

interface Assignment {
  departments: string[];
  roles: string[];
  individuals: string[];
  dueDate: string;
  mandatory: boolean;
}

// ── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Content' },
  { id: 3, label: 'Assessment' },
  { id: 4, label: 'Assignment' },
];

const CONTENT_TYPES: { value: ContentBlock['type']; label: string; icon: React.ElementType }[] = [
  { value: 'DOCUMENT', label: 'Document Link', icon: FileText },
  { value: 'PRESENTATION', label: 'Presentation', icon: Presentation },
  { value: 'VIDEO', label: 'Video URL', icon: Video },
  { value: 'CHECKLIST', label: 'Practical Checklist', icon: ClipboardCheck },
];

const PROGRAM_TYPES = ['INDUCTION', 'OJT', 'CLASSROOM', 'E_LEARNING', 'REGULATORY', 'REFRESHER'];
const DEPARTMENTS = ['Quality Assurance', 'Quality Control', 'Production', 'Engineering', 'HSE'];
const ROLES = ['Quality Manager', 'QA Inspector', 'Lab Analyst', 'Production Supervisor', 'Machine Operator', 'Welding Operator', 'Design Engineer', 'Process Engineer', 'HSE Officer', 'Document Controller'];
const MOCK_USERS = ['Priya Sharma', 'Rajesh Kumar', 'Vikram Patel', 'Anita Desai', 'Sunita Rao', 'Deepak Nair', 'Arun Mehta', 'Kavita Singh', 'Manoj Verma', 'Neha Gupta'];

let contentIdCounter = 0;
let questionIdCounter = 0;

export default function TrainingCreatePage() {
  const navigate = useNavigate();
  const createTraining = useCreateTrainingProgram();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [programType, setProgramType] = useState('');
  const [duration, setDuration] = useState('');
  const [validityPeriod, setValidityPeriod] = useState('');
  const [passingScore, setPassingScore] = useState('80');

  // Step 2 state
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);

  // Step 3 state
  const [questions, setQuestions] = useState<Question[]>([]);

  // Step 4 state
  const [assignment, setAssignment] = useState<Assignment>({
    departments: [],
    roles: [],
    individuals: [],
    dueDate: '',
    mandatory: true,
  });

  // ── Content helpers ────────────────────────────────────────────────────────

  const addContentBlock = () => {
    setContentBlocks([
      ...contentBlocks,
      { id: `cb-${++contentIdCounter}`, title: '', type: 'DOCUMENT', url: '', duration: '' },
    ]);
  };

  const updateContentBlock = (id: string, field: keyof ContentBlock, value: string) => {
    setContentBlocks(contentBlocks.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeContentBlock = (id: string) => {
    setContentBlocks(contentBlocks.filter((b) => b.id !== id));
  };

  // ── Question helpers ───────────────────────────────────────────────────────

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q-${++questionIdCounter}`,
        type: 'MULTIPLE_CHOICE',
        question: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 10,
      },
    ]);
  };

  const updateQuestion = (id: string, field: keyof Question, value: unknown) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateOption = (questionId: string, optIndex: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id !== questionId) return q;
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }),
    );
  };

  // ── Assignment helpers ─────────────────────────────────────────────────────

  const toggleArrayItem = (key: 'departments' | 'roles' | 'individuals', item: string) => {
    setAssignment((prev) => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter((i) => i !== item) : [...prev[key], item],
    }));
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const canProceed = () => {
    if (currentStep === 1) return title.trim() && programType && duration.trim();
    return true;
  };

  const handleSubmit = async () => {
    try {
      await createTraining.mutateAsync({
        title, description, programType, duration,
        validityPeriod, passingScore, contentBlocks, questions, assignment,
      });
    } catch {
      // mock mode — silently succeed
    }
    navigate('/lms/training');
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/lms/training')} className="hover:text-navy-700 transition-colors">
          Training Programs
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Create Program</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create Training Program</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define the training content, assessment, and assign it to participants
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => step.id < currentStep && setCurrentStep(step.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                currentStep === step.id
                  ? 'bg-navy-600 text-white shadow-sm'
                  : step.id < currentStep
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-400',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  currentStep === step.id
                    ? 'bg-white/20 text-white'
                    : step.id < currentStep
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500',
                )}
              >
                {step.id < currentStep ? <Check className="h-3.5 w-3.5" /> : step.id}
              </span>
              {step.label}
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn('h-px w-8', step.id < currentStep ? 'bg-emerald-300' : 'bg-slate-200')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        {/* ── Step 1: Details ──────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
            </CardHeader>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., GMP Fundamentals Training"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the training program objectives and scope..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Program Type *</label>
                <select value={programType} onChange={(e) => setProgramType(e.target.value)} className={inputClass}>
                  <option value="">Select type...</option>
                  {PROGRAM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Duration *</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g., 16 hours"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Validity Period</label>
                <input
                  type="text"
                  value={validityPeriod}
                  onChange={(e) => setValidityPeriod(e.target.value)}
                  placeholder="e.g., 2 years"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Passing Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Content ──────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <CardHeader>
              <CardTitle>Content Sections</CardTitle>
            </CardHeader>

            {contentBlocks.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12">
                <FileText className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500 mb-4">No content sections added yet</p>
                <Button variant="outline" onClick={addContentBlock}>
                  <Plus className="h-4 w-4" />
                  Add Content Block
                </Button>
              </div>
            )}

            {contentBlocks.map((block, idx) => {
              const TypeIcon = CONTENT_TYPES.find((t) => t.value === block.type)?.icon || FileText;
              return (
                <div key={block.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-slate-300" />
                      <span className="text-xs font-semibold text-slate-500">Section {idx + 1}</span>
                    </div>
                    <button
                      onClick={() => removeContentBlock(block.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Section Title</label>
                      <input
                        type="text"
                        value={block.title}
                        onChange={(e) => updateContentBlock(block.id, 'title', e.target.value)}
                        placeholder="e.g., Introduction to GMP"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Content Type</label>
                      <select
                        value={block.type}
                        onChange={(e) => updateContentBlock(block.id, 'type', e.target.value)}
                        className={inputClass}
                      >
                        {CONTENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        {block.type === 'VIDEO' ? 'Video URL' : block.type === 'DOCUMENT' ? 'Document Link / Upload' : 'File Upload / Link'}
                      </label>
                      <input
                        type="text"
                        value={block.url}
                        onChange={(e) => updateContentBlock(block.id, 'url', e.target.value)}
                        placeholder={block.type === 'VIDEO' ? 'https://...' : '/path/to/file or upload'}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Duration</label>
                      <input
                        type="text"
                        value={block.duration}
                        onChange={(e) => updateContentBlock(block.id, 'duration', e.target.value)}
                        placeholder="e.g., 30 min"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {contentBlocks.length > 0 && (
              <Button variant="outline" onClick={addContentBlock}>
                <Plus className="h-4 w-4" />
                Add Content Block
              </Button>
            )}
          </div>
        )}

        {/* ── Step 3: Assessment ───────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <CardHeader>
              <CardTitle>Assessment Questions</CardTitle>
            </CardHeader>

            {questions.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12">
                <ClipboardCheck className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500 mb-4">No assessment questions added yet</p>
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="h-4 w-4" />
                  Add Question
                </Button>
              </div>
            )}

            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">
                      {idx + 1}
                    </span>
                    <Badge variant="outline">{q.type.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-slate-500">Points:</label>
                      <input
                        type="number"
                        min="1"
                        value={q.points}
                        onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))}
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs text-center outline-none focus:border-navy-500"
                      />
                    </div>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Question Type</label>
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const type = e.target.value as Question['type'];
                        const options =
                          type === 'MULTIPLE_CHOICE'
                            ? ['', '', '', '']
                            : type === 'TRUE_FALSE'
                              ? ['True', 'False']
                              : [];
                        updateQuestion(q.id, 'type', type);
                        updateQuestion(q.id, 'options', options);
                        updateQuestion(q.id, 'correctAnswer', '');
                      }}
                      className={inputClass}
                    >
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="OPEN_TEXT">Open Text</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Question Text</label>
                    <textarea
                      rows={2}
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                      placeholder="Enter the question..."
                      className={inputClass}
                    />
                  </div>

                  {q.type === 'MULTIPLE_CHOICE' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        Options (click to mark correct answer)
                      </label>
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuestion(q.id, 'correctAnswer', opt)}
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                q.correctAnswer === opt && opt
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-slate-300 hover:border-slate-400',
                              )}
                            >
                              {q.correctAnswer === opt && opt && <Check className="h-3 w-3" />}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              className={inputClass}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'TRUE_FALSE' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">Correct Answer</label>
                      <div className="flex gap-3">
                        {['True', 'False'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateQuestion(q.id, 'correctAnswer', val)}
                            className={cn(
                              'rounded-lg border px-6 py-2 text-sm font-medium transition-colors',
                              q.correctAnswer === val
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                            )}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'OPEN_TEXT' && (
                    <p className="text-xs text-slate-400 italic">Open text questions are graded manually by the trainer.</p>
                  )}
                </div>
              </div>
            ))}

            {questions.length > 0 && (
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="h-4 w-4" />
                  Add Question
                </Button>
                <p className="text-sm text-slate-500">
                  Total points: <span className="font-semibold text-slate-700">{questions.reduce((s, q) => s + q.points, 0)}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Assignment ───────────────────────────────────────────── */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <CardHeader>
              <CardTitle>Assign Training</CardTitle>
            </CardHeader>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Departments */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Departments</label>
                <div className="space-y-1.5">
                  {DEPARTMENTS.map((dept) => (
                    <label
                      key={dept}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors',
                        assignment.departments.includes(dept)
                          ? 'border-navy-500 bg-navy-50 text-navy-700'
                          : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={assignment.departments.includes(dept)}
                        onChange={() => toggleArrayItem('departments', dept)}
                        className="rounded border-slate-300"
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Roles</label>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {ROLES.map((role) => (
                    <label
                      key={role}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors',
                        assignment.roles.includes(role)
                          ? 'border-navy-500 bg-navy-50 text-navy-700'
                          : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={assignment.roles.includes(role)}
                        onChange={() => toggleArrayItem('roles', role)}
                        className="rounded border-slate-300"
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>

              {/* Individual users */}
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Individual Users</label>
                <div className="flex flex-wrap gap-2">
                  {MOCK_USERS.map((user) => (
                    <button
                      key={user}
                      type="button"
                      onClick={() => toggleArrayItem('individuals', user)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        assignment.individuals.includes(user)
                          ? 'border-navy-500 bg-navy-600 text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date and mandatory */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Due Date</label>
                <input
                  type="date"
                  value={assignment.dueDate}
                  onChange={(e) => setAssignment({ ...assignment, dueDate: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={assignment.mandatory}
                    onChange={(e) => setAssignment({ ...assignment, mandatory: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-700">Mandatory Training</span>
                </label>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Assignment Summary</p>
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <span>Departments: <strong className="text-slate-700">{assignment.departments.length || 'None'}</strong></span>
                <span>Roles: <strong className="text-slate-700">{assignment.roles.length || 'None'}</strong></span>
                <span>Individuals: <strong className="text-slate-700">{assignment.individuals.length || 'None'}</strong></span>
                <span>Due: <strong className="text-slate-700">{assignment.dueDate || 'Not set'}</strong></span>
                <span>Mandatory: <strong className="text-slate-700">{assignment.mandatory ? 'Yes' : 'No'}</strong></span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/lms/training'))}
        >
          <ChevronLeft className="h-4 w-4" />
          {currentStep > 1 ? 'Previous' : 'Cancel'}
        </Button>

        {currentStep < 4 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canProceed()}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            <Check className="h-4 w-4" />
            Create Program
          </Button>
        )}
      </div>
    </div>
  );
}
