/**
 * LMS assessment authoring service (Phase 4).
 *
 * Assessments hang off a course (final exam, moduleId null) or a module (quiz).
 * Like lessons, they are only editable while the owning course is DRAFT. The
 * author serialization includes the correct answers; the learner never receives
 * `is_correct` (see lms-exam.service.ts).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  CreateAssessmentInput,
  CreateQuestionInput,
  UpdateAssessmentInput,
  UpdateQuestionInput,
} from './lms.schema';

const assessmentInclude = {
  questions: {
    orderBy: { order: 'asc' as const },
    include: { options: { orderBy: { order: 'asc' as const } } },
  },
} satisfies Prisma.LmsAssessmentInclude;

type AssessmentRow = Prisma.LmsAssessmentGetPayload<{ include: typeof assessmentInclude }>;

const serializeForAuthor = (a: AssessmentRow) => ({
  id: a.id,
  course_id: a.courseId,
  module_id: a.moduleId,
  title: a.title,
  description: a.description,
  passing_score: a.passingScore,
  max_attempts: a.maxAttempts,
  time_limit_minutes: a.timeLimitMinutes,
  shuffle_questions: a.shuffleQuestions,
  randomize_from: a.randomizeFrom,
  require_esign: a.requireESign,
  total_points: a.questions.reduce((n, q) => n + q.points, 0),
  questions: a.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    order: q.order,
    explanation: q.explanation,
    options: q.options.map((o) => ({ id: o.id, text: o.text, is_correct: o.isCorrect, order: o.order })),
  })),
});

// Resolve the owning course id for an assessment and ensure it's editable.
const courseOf = async (assessmentId: string): Promise<string> => {
  const a = await prisma.lmsAssessment.findFirst({
    where: { id: assessmentId, isDeleted: false },
    select: { courseId: true, moduleId: true },
  });
  if (!a) throw NotFound('Assessment not found');
  if (a.courseId) return a.courseId;
  const m = await prisma.lmsCourseModule.findUnique({ where: { id: a.moduleId! }, select: { courseId: true } });
  if (!m) throw NotFound('Module not found');
  return m.courseId;
};

const assertCourseDraft = async (courseId: string) => {
  const c = await prisma.lmsCourse.findUnique({ where: { id: courseId }, select: { status: true } });
  if (!c) throw NotFound('Course not found');
  if (c.status !== 'DRAFT') throw Conflict('Exams can only be edited while the course is DRAFT');
};

const getRow = async (id: string): Promise<AssessmentRow> => {
  const a = await prisma.lmsAssessment.findFirst({ where: { id, isDeleted: false }, include: assessmentInclude });
  if (!a) throw NotFound('Assessment not found');
  return a;
};

export const getAssessment = async (id: string) => serializeForAuthor(await getRow(id));

export const listForCourse = async (courseId: string) => {
  const rows = await prisma.lmsAssessment.findMany({
    where: { courseId, isDeleted: false },
    include: assessmentInclude,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(serializeForAuthor);
};

// ── Create (final exam on a course, or quiz on a module) ──
export const createAssessment = async (
  scope: { courseId?: string; moduleId?: string },
  input: CreateAssessmentInput,
  userId?: string,
) => {
  const courseId = scope.courseId ?? (await prisma.lmsCourseModule.findUnique({ where: { id: scope.moduleId! }, select: { courseId: true } }))?.courseId;
  if (!courseId) throw NotFound('Course not found');
  await assertCourseDraft(courseId);

  const created = await prisma.lmsAssessment.create({
    data: {
      courseId: scope.courseId ?? null,
      moduleId: scope.moduleId ?? null,
      title: input.title,
      description: input.description ?? null,
      passingScore: input.passing_score ?? 70,
      maxAttempts: input.max_attempts ?? 3,
      timeLimitMinutes: input.time_limit_minutes ?? null,
      shuffleQuestions: input.shuffle_questions ?? false,
      randomizeFrom: input.randomize_from ?? null,
      requireESign: input.require_esign ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'assessment', newValue: 'added' }, userId);
  return getAssessment(created.id);
};

export const updateAssessment = async (id: string, input: UpdateAssessmentInput, userId?: string) => {
  const courseId = await courseOf(id);
  await assertCourseDraft(courseId);
  await prisma.lmsAssessment.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      description: input.description === undefined ? undefined : input.description,
      passingScore: input.passing_score ?? undefined,
      maxAttempts: input.max_attempts ?? undefined,
      timeLimitMinutes: input.time_limit_minutes === undefined ? undefined : input.time_limit_minutes,
      shuffleQuestions: input.shuffle_questions ?? undefined,
      randomizeFrom: input.randomize_from === undefined ? undefined : input.randomize_from,
      requireESign: input.require_esign ?? undefined,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'assessment' }, userId);
  return getAssessment(id);
};

export const deleteAssessment = async (id: string, userId?: string) => {
  const courseId = await courseOf(id);
  await assertCourseDraft(courseId);
  await prisma.lmsAssessment.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'assessment', newValue: 'removed' }, userId);
};

// ── Questions ──
export const addQuestion = async (assessmentId: string, input: CreateQuestionInput, userId?: string) => {
  const courseId = await courseOf(assessmentId);
  await assertCourseDraft(courseId);
  const count = await prisma.lmsQuestion.count({ where: { assessmentId } });
  const isChoice = !['SHORT_TEXT', 'LONG_TEXT'].includes(input.type);
  await prisma.lmsQuestion.create({
    data: {
      assessmentId,
      type: input.type,
      prompt: input.prompt,
      points: input.points ?? 1,
      order: input.order ?? count,
      explanation: input.explanation ?? null,
      options: isChoice && input.options
        ? { create: input.options.map((o, i) => ({ text: o.text, isCorrect: o.is_correct ?? false, order: o.order ?? i })) }
        : undefined,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'question', newValue: 'added' }, userId);
  return getAssessment(assessmentId);
};

const questionAssessment = async (questionId: string) => {
  const q = await prisma.lmsQuestion.findUnique({ where: { id: questionId }, select: { assessmentId: true } });
  if (!q) throw NotFound('Question not found');
  return q.assessmentId;
};

export const updateQuestion = async (questionId: string, input: UpdateQuestionInput, userId?: string) => {
  const assessmentId = await questionAssessment(questionId);
  const courseId = await courseOf(assessmentId);
  await assertCourseDraft(courseId);
  await prisma.$transaction(async (tx) => {
    await tx.lmsQuestion.update({
      where: { id: questionId },
      data: {
        prompt: input.prompt ?? undefined,
        points: input.points ?? undefined,
        order: input.order ?? undefined,
        explanation: input.explanation === undefined ? undefined : input.explanation,
      },
    });
    if (input.options) {
      // Replace the option set wholesale.
      await tx.lmsQuestionOption.deleteMany({ where: { questionId } });
      await tx.lmsQuestionOption.createMany({
        data: input.options.map((o, i) => ({ questionId, text: o.text, isCorrect: o.is_correct ?? false, order: o.order ?? i })),
      });
    }
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'question' }, userId);
  return getAssessment(assessmentId);
};

export const deleteQuestion = async (questionId: string, userId?: string) => {
  const assessmentId = await questionAssessment(questionId);
  const courseId = await courseOf(assessmentId);
  await assertCourseDraft(courseId);
  await prisma.lmsQuestion.delete({ where: { id: questionId } });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'question', newValue: 'removed' }, userId);
  return getAssessment(assessmentId);
};
