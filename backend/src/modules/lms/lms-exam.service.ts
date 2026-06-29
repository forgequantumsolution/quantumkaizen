/**
 * LMS exam engine (Phase 4) — attempts, grading, certificates.
 *
 * A learner starts an attempt (resume if one is open), answers, and submits.
 * Objective questions (SINGLE/MULTI/TRUE_FALSE) auto-grade; text questions wait
 * for a manual grade (P4b). Submitting an exam that requires it is e-signed.
 * Passing a course-level (final) exam completes the enrollment and issues a
 * certificate; module quizzes do not gate course completion.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import type { GradeAttemptInput, SubmitAttemptInput } from './lms.schema';

const TEXT_TYPES = ['SHORT_TEXT', 'LONG_TEXT'];

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const assessmentWithQuestions = {
  questions: { orderBy: { order: 'asc' as const }, include: { options: { orderBy: { order: 'asc' as const } } } },
} satisfies Prisma.LmsAssessmentInclude;

type AssessmentFull = Prisma.LmsAssessmentGetPayload<{ include: typeof assessmentWithQuestions }>;

const resolveEnrollment = async (assessment: AssessmentFull, userId: string) => {
  let courseId = assessment.courseId;
  if (!courseId && assessment.moduleId) {
    const m = await prisma.lmsCourseModule.findUnique({ where: { id: assessment.moduleId }, select: { courseId: true } });
    courseId = m?.courseId ?? null;
  }
  if (!courseId) throw NotFound('Course not found for assessment');
  const enr = await prisma.lmsEnrollment.findFirst({
    where: { courseId, userId },
    orderBy: { courseVersion: 'desc' },
  });
  if (!enr) throw Forbidden('You must be enrolled in this course to take the exam');
  return { enr, courseId, isFinal: !!assessment.courseId };
};

// Learner-safe question shape (no is_correct).
const toLearnerQuestion = (q: AssessmentFull['questions'][number]) => ({
  id: q.id,
  type: q.type,
  prompt: q.prompt,
  points: q.points,
  options: TEXT_TYPES.includes(q.type) ? [] : q.options.map((o) => ({ id: o.id, text: o.text })),
});

// ─────────────────────────── Exam info (pre-start) ───────────────────────────
export const getExamForEnrollment = async (enrollmentId: string, userId: string) => {
  const enr = await prisma.lmsEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!enr) throw NotFound('Enrollment not found');
  if (enr.userId !== userId) throw Forbidden('This enrollment belongs to another user');
  const assessment = await prisma.lmsAssessment.findFirst({
    where: { courseId: enr.courseId, isDeleted: false },
    include: assessmentWithQuestions,
  });
  if (!assessment) return { has_exam: false };

  const attempts = await prisma.lmsAssessmentAttempt.findMany({
    where: { assessmentId: assessment.id, userId, status: { in: ['SUBMITTED', 'GRADED'] } },
    orderBy: { attemptNo: 'desc' },
  });
  const inProgress = await prisma.lmsAssessmentAttempt.findFirst({
    where: { assessmentId: assessment.id, userId, status: 'IN_PROGRESS' },
  });
  const best = attempts.reduce<number | null>((m, a) => (a.score != null ? Math.max(m ?? 0, a.score) : m), null);
  return {
    has_exam: true,
    enrollment_id: enr.id,
    assessment_id: assessment.id,
    title: assessment.title,
    description: assessment.description,
    passing_score: assessment.passingScore,
    max_attempts: assessment.maxAttempts,
    time_limit_minutes: assessment.timeLimitMinutes,
    require_esign: assessment.requireESign,
    question_count: assessment.randomizeFrom ?? assessment.questions.length,
    attempts_used: attempts.length,
    attempts_left: Math.max(0, assessment.maxAttempts - attempts.length),
    best_score: best,
    passed: attempts.some((a) => a.passed),
    in_progress_attempt_id: inProgress?.id ?? null,
  };
};

// ─────────────────────────── Start / resume an attempt ───────────────────────────
export const startAttempt = async (assessmentId: string, userId: string) => {
  const assessment = await prisma.lmsAssessment.findFirst({
    where: { id: assessmentId, isDeleted: false },
    include: assessmentWithQuestions,
  });
  if (!assessment) throw NotFound('Assessment not found');
  if (assessment.questions.length === 0) throw BadRequest('This exam has no questions');
  const { enr } = await resolveEnrollment(assessment, userId);

  // Resume an open attempt rather than starting a new one.
  const open = await prisma.lmsAssessmentAttempt.findFirst({
    where: { assessmentId, userId, status: 'IN_PROGRESS' },
    include: { answers: true },
  });
  if (open) {
    const presented = assessment.questions.filter((q) => open.answers.some((a) => a.questionId === q.id));
    return serializeAttemptForTaking(open.id, assessment, presented, open.startedAt);
  }

  const used = await prisma.lmsAssessmentAttempt.count({
    where: { assessmentId, userId, status: { in: ['SUBMITTED', 'GRADED'] } },
  });
  if (used >= assessment.maxAttempts) throw Conflict('No attempts remaining for this exam');

  // Select questions: optional shuffle / random subset.
  let presented = assessment.shuffleQuestions ? shuffle(assessment.questions) : assessment.questions;
  if (assessment.randomizeFrom && assessment.randomizeFrom < presented.length) {
    presented = shuffle(presented).slice(0, assessment.randomizeFrom);
  }

  const attemptId = await prisma.$transaction(async (tx) => {
    const attempt = await tx.lmsAssessmentAttempt.create({
      data: { assessmentId, enrollmentId: enr.id, userId, attemptNo: used + 1, status: 'IN_PROGRESS' },
    });
    // Persist the presented set as empty answer rows so grading is deterministic.
    await tx.lmsAttemptAnswer.createMany({
      data: presented.map((q) => ({ attemptId: attempt.id, questionId: q.id, selectedOptionIds: [] })),
    });
    return attempt.id;
  });
  await writeTrail({ entityType: 'LmsAssessmentAttempt', entityId: attemptId, action: 'CREATE', newValue: `attempt ${used + 1}` }, userId);
  return serializeAttemptForTaking(attemptId, assessment, presented, new Date());
};

const serializeAttemptForTaking = (
  attemptId: string,
  assessment: AssessmentFull,
  presented: AssessmentFull['questions'],
  startedAt: Date,
) => ({
  attempt_id: attemptId,
  assessment_id: assessment.id,
  title: assessment.title,
  passing_score: assessment.passingScore,
  time_limit_minutes: assessment.timeLimitMinutes,
  require_esign: assessment.requireESign,
  started_at: startedAt,
  questions: presented.map(toLearnerQuestion),
});

// ─────────────────────────── Submit + auto-grade ───────────────────────────
const gradeObjective = (
  type: string,
  selected: string[],
  correctIds: string[],
  points: number,
): { awarded: number; correct: boolean } | null => {
  if (TEXT_TYPES.includes(type)) return null; // manual
  const sel = new Set(selected);
  const cor = new Set(correctIds);
  const correct = sel.size === cor.size && [...cor].every((id) => sel.has(id));
  return { awarded: correct ? points : 0, correct };
};

export const submitAttempt = async (attemptId: string, input: SubmitAttemptInput, userId: string) => {
  const attempt = await prisma.lmsAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, assessment: { include: assessmentWithQuestions } },
  });
  if (!attempt) throw NotFound('Attempt not found');
  if (attempt.userId !== userId) throw Forbidden('This attempt belongs to another user');
  if (attempt.status !== 'IN_PROGRESS') throw Conflict('This attempt has already been submitted');

  const assessment = attempt.assessment;
  const qById = new Map(assessment.questions.map((q) => [q.id, q]));
  const submittedById = new Map(input.answers.map((a) => [a.question_id, a]));

  let hasUngradedText = false;
  let autoPoints = 0;
  let totalPoints = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of attempt.answers) {
      const q = qById.get(row.questionId);
      if (!q) continue;
      totalPoints += q.points;
      const submitted = submittedById.get(row.questionId);
      const selected = submitted?.selected_option_ids ?? [];
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const graded = gradeObjective(q.type, selected, correctIds, q.points);
      if (graded) autoPoints += graded.awarded;
      else hasUngradedText = true;

      await tx.lmsAttemptAnswer.update({
        where: { attemptId_questionId: { attemptId, questionId: row.questionId } },
        data: {
          selectedOptionIds: selected,
          textAnswer: submitted?.text_answer ?? null,
          awardedPoints: graded ? graded.awarded : null,
          isCorrect: graded ? graded.correct : null,
        },
      });
    }
  });

  // E-signature on submission when the assessment demands it.
  let esignatureId: string | null = null;
  if (assessment.requireESign) {
    if (!input.credential) throw BadRequest('An e-signature credential is required to submit this exam');
    const sig = await recordSignature(
      { entity_type: 'LmsAssessmentAttempt', entity_id: attemptId, meaning: input.meaning ?? 'Submitted and attest these are my own answers', credential: input.credential },
      userId,
    );
    esignatureId = sig.id;
  }

  if (hasUngradedText) {
    await prisma.lmsAssessmentAttempt.update({
      where: { id: attemptId },
      data: { status: 'SUBMITTED', submittedAt: new Date(), esignatureId },
    });
    await writeTrail({ entityType: 'LmsAssessmentAttempt', entityId: attemptId, action: 'UPDATE', field: 'status', newValue: 'SUBMITTED' }, userId);
    return getAttemptResult(attemptId, userId);
  }

  const score = totalPoints === 0 ? 0 : Math.round((autoPoints / totalPoints) * 100);
  const passed = score >= assessment.passingScore;
  await prisma.lmsAssessmentAttempt.update({
    where: { id: attemptId },
    data: { status: 'GRADED', submittedAt: new Date(), gradedAt: new Date(), score, passed, esignatureId },
  });
  await writeTrail({ entityType: 'LmsAssessmentAttempt', entityId: attemptId, action: 'UPDATE', field: 'score', newValue: `${score}% ${passed ? 'PASS' : 'FAIL'}` }, userId);
  await finalizeOutcome(attemptId);
  return getAttemptResult(attemptId, userId);
};

// ─────────────────────────── Manual grading (P4b) ───────────────────────────
export const gradeAttempt = async (attemptId: string, input: GradeAttemptInput, graderId?: string) => {
  const attempt = await prisma.lmsAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, assessment: { include: { questions: true } } },
  });
  if (!attempt) throw NotFound('Attempt not found');
  if (attempt.status !== 'SUBMITTED') throw Conflict('Only submitted attempts awaiting grading can be graded');

  const pointsById = new Map(attempt.assessment.questions.map((q) => [q.id, q.points]));
  const gradeById = new Map(input.grades.map((g) => [g.question_id, g.awarded_points]));

  await prisma.$transaction(async (tx) => {
    for (const [questionId, awarded] of gradeById) {
      const max = pointsById.get(questionId) ?? 0;
      const clamped = Math.min(Math.max(0, awarded), max);
      await tx.lmsAttemptAnswer.update({
        where: { attemptId_questionId: { attemptId, questionId } },
        data: { awardedPoints: clamped, isCorrect: clamped >= max, gradedById: graderId ?? null },
      });
    }
  });

  // Recompute total from all presented answers.
  const answers = await prisma.lmsAttemptAnswer.findMany({ where: { attemptId } });
  const totalPoints = answers.reduce((n, a) => n + (pointsById.get(a.questionId) ?? 0), 0);
  const awarded = answers.reduce((n, a) => n + (a.awardedPoints ?? 0), 0);
  const score = totalPoints === 0 ? 0 : Math.round((awarded / totalPoints) * 100);
  const passed = score >= attempt.assessment.passingScore;

  await prisma.lmsAssessmentAttempt.update({
    where: { id: attemptId },
    data: { status: 'GRADED', gradedAt: new Date(), gradedById: graderId ?? null, score, passed },
  });
  await writeTrail({ entityType: 'LmsAssessmentAttempt', entityId: attemptId, action: 'UPDATE', field: 'graded', newValue: `${score}% ${passed ? 'PASS' : 'FAIL'}` }, graderId);
  await finalizeOutcome(attemptId);
  return getAttemptResultForGrader(attemptId);
};

// ─────────────────────────── Outcome → enrollment + certificate ───────────────────────────
const nextCertSerial = async (year: number): Promise<string> => {
  const count = await prisma.lmsCertificate.count({ where: { serial: { startsWith: `CERT-${year}-` } } });
  return `CERT-${year}-${String(count + 1).padStart(4, '0')}`;
};

const finalizeOutcome = async (attemptId: string) => {
  const attempt = await prisma.lmsAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { assessment: true, enrollment: true },
  });
  if (!attempt || !attempt.enrollment) return;
  // Only the course-level (final) exam gates completion.
  if (!attempt.assessment.courseId) return;
  const enr = attempt.enrollment;

  if (attempt.passed) {
    const course = await prisma.lmsCourse.findUnique({ where: { id: enr.courseId } });
    let certificateId = enr.certificateId;
    if (!certificateId) {
      const serial = await nextCertSerial(new Date().getFullYear());
      const expiresAt = course?.validityMonths
        ? new Date(Date.now() + course.validityMonths * 30 * 24 * 3600 * 1000)
        : null;
      const cert = await prisma.lmsCertificate.create({
        data: { serial, courseId: enr.courseId, userId: enr.userId, expiresAt, verifyToken: randomUUID() },
      });
      certificateId = cert.id;
    }
    await prisma.lmsEnrollment.update({
      where: { id: enr.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        score: attempt.score,
        esignatureId: attempt.esignatureId ?? enr.esignatureId,
        certificateId,
        progressPct: 100,
      },
    });
    await writeTrail({ entityType: 'LmsEnrollment', entityId: enr.id, action: 'UPDATE', field: 'status', newValue: 'COMPLETED (exam passed)' }, enr.userId);
  } else {
    // Out of attempts and not passed → mark failed.
    const used = await prisma.lmsAssessmentAttempt.count({
      where: { assessmentId: attempt.assessmentId, userId: enr.userId, status: { in: ['SUBMITTED', 'GRADED'] } },
    });
    if (used >= attempt.assessment.maxAttempts) {
      await prisma.lmsEnrollment.update({ where: { id: enr.id }, data: { status: 'FAILED', score: attempt.score } });
      await writeTrail({ entityType: 'LmsEnrollment', entityId: enr.id, action: 'UPDATE', field: 'status', newValue: 'FAILED (attempts exhausted)' }, enr.userId);
    }
  }
};

// ─────────────────────────── Result views ───────────────────────────
export const getAttemptResult = async (attemptId: string, userId: string) => {
  const a = await prisma.lmsAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, assessment: { include: { questions: { include: { options: true } } } } },
  });
  if (!a) throw NotFound('Attempt not found');
  if (a.userId !== userId) throw Forbidden('This attempt belongs to another user');
  const qById = new Map(a.assessment.questions.map((q) => [q.id, q]));
  return {
    attempt_id: a.id,
    assessment_id: a.assessmentId,
    status: a.status,
    score: a.score,
    passed: a.passed,
    attempt_no: a.attemptNo,
    submitted_at: a.submittedAt,
    passing_score: a.assessment.passingScore,
    // Reveal correctness + explanation only once the attempt is fully graded.
    review:
      a.status === 'GRADED'
        ? a.answers.map((ans) => {
            const q = qById.get(ans.questionId);
            return {
              question_id: ans.questionId,
              prompt: q?.prompt,
              type: q?.type,
              awarded_points: ans.awardedPoints,
              max_points: q?.points,
              is_correct: ans.isCorrect,
              explanation: q?.explanation ?? null,
            };
          })
        : null,
  };
};

// ─────────────────────────── Grading queue (graders) ───────────────────────────
export const listGradingQueue = async () => {
  const rows = await prisma.lmsAssessmentAttempt.findMany({
    where: { status: 'SUBMITTED' },
    include: { assessment: { select: { title: true, courseId: true } } },
    orderBy: { submittedAt: 'asc' },
  });
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    attempt_id: r.id,
    assessment_title: r.assessment.title,
    user_id: r.userId,
    user_name: nameById.get(r.userId) ?? null,
    attempt_no: r.attemptNo,
    submitted_at: r.submittedAt,
  }));
};

export const getAttemptResultForGrader = async (attemptId: string) => {
  const a = await prisma.lmsAssessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true, assessment: { include: { questions: { include: { options: true } } } } },
  });
  if (!a) throw NotFound('Attempt not found');
  const qById = new Map(a.assessment.questions.map((q) => [q.id, q]));
  return {
    attempt_id: a.id,
    status: a.status,
    score: a.score,
    passed: a.passed,
    user_id: a.userId,
    answers: a.answers.map((ans) => {
      const q = qById.get(ans.questionId);
      return {
        question_id: ans.questionId,
        prompt: q?.prompt,
        type: q?.type,
        max_points: q?.points,
        awarded_points: ans.awardedPoints,
        text_answer: ans.textAnswer,
        selected_option_ids: ans.selectedOptionIds,
        needs_grading: !!q && TEXT_TYPES.includes(q.type) && ans.awardedPoints == null,
      };
    }),
  };
};
