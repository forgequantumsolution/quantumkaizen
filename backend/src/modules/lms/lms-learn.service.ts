/**
 * LMS learner service (Phase 3 — player + progress).
 *
 * Surfaces a learner's enrollments ("My Learning"), the self-enrol catalog, the
 * per-lesson content view, and progress tracking. Completion is computed from
 * mandatory-lesson progress: when every mandatory lesson is done and the course
 * has no final exam (exams arrive in Phase 4), the enrollment is COMPLETED.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';

// ─────────────────────────── My Learning ───────────────────────────
export const listMyEnrollments = async (userId: string) => {
  const rows = await prisma.lmsEnrollment.findMany({
    where: { userId },
    include: { course: true },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { assignedAt: 'desc' }],
  });
  const active = rows.filter((r) => !r.course.isDeleted);
  const now = new Date();
  return {
    pending: active.filter((r) => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS').length,
    overdue: active.filter(
      (r) => r.dueDate && r.dueDate < now && r.status !== 'COMPLETED' && r.status !== 'WAIVED',
    ).length,
    items: active.map((r) => ({
      enrollment_id: r.id,
      course_id: r.courseId,
      course_version: r.courseVersion,
      code: r.course.code,
      title: r.course.title,
      type: r.course.type,
      status: r.status,
      source: r.source,
      progress_pct: r.progressPct,
      due_date: r.dueDate,
      assigned_at: r.assignedAt,
      completed_at: r.completedAt,
      score: r.score,
      certificate_id: r.certificateId,
      estimated_minutes: r.course.estimatedMinutes,
    })),
  };
};

// ─────────────────────────── Catalog (self-enrol) ───────────────────────────
export const listCatalog = async (userId: string, search?: string) => {
  const where: Prisma.LmsCourseWhereInput = {
    isDeleted: false,
    status: 'PUBLISHED',
    isLatestVersion: true,
    isCatalogVisible: true,
    allowSelfEnroll: true,
  };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }
  const courses = await prisma.lmsCourse.findMany({
    where,
    include: { modules: { include: { lessons: true } } },
    orderBy: { title: 'asc' },
  });
  const myEnrollments = await prisma.lmsEnrollment.findMany({
    where: { userId, courseId: { in: courses.map((c) => c.id) } },
    select: { courseId: true, status: true },
  });
  const enrolledBy = new Map(myEnrollments.map((e) => [e.courseId, e.status]));
  return {
    items: courses.map((c) => ({
      course_id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      category: c.category,
      type: c.type,
      estimated_minutes: c.estimatedMinutes,
      lesson_count: c.modules.reduce((n, m) => n + m.lessons.length, 0),
      enrolled: enrolledBy.has(c.id),
      enrollment_status: enrolledBy.get(c.id) ?? null,
    })),
  };
};

export const selfEnroll = async (courseId: string, userId: string) => {
  const course = await prisma.lmsCourse.findFirst({
    where: { id: courseId, isDeleted: false },
  });
  if (!course) throw NotFound('Course not found');
  if (course.status !== 'PUBLISHED' || !course.isLatestVersion) {
    throw Conflict('Only the latest published version can be enrolled in');
  }
  if (!course.allowSelfEnroll) throw Forbidden('This course is not open for self-enrolment');

  const existing = await prisma.lmsEnrollment.findUnique({
    where: {
      courseId_userId_courseVersion: { courseId, userId, courseVersion: course.version },
    },
  });
  if (existing) return { enrollment_id: existing.id, already: true };

  const created = await prisma.lmsEnrollment.create({
    data: {
      courseId,
      courseVersion: course.version,
      userId,
      status: 'ASSIGNED',
      source: 'SELF',
      dueDate: course.validityMonths
        ? new Date(Date.now() + course.validityMonths * 30 * 24 * 3600 * 1000)
        : null,
    },
  });
  await writeTrail({ entityType: 'LmsEnrollment', entityId: created.id, action: 'CREATE', field: 'self_enroll', newValue: course.code }, userId);
  return { enrollment_id: created.id, already: false };
};

// ─────────────────────────── Learner course view ───────────────────────────
const learnerCourseInclude = {
  modules: {
    orderBy: { order: 'asc' as const },
    include: {
      lessons: { orderBy: { order: 'asc' as const }, include: { asset: true } },
    },
  },
  assessments: { where: { moduleId: null }, select: { id: true } },
} satisfies Prisma.LmsCourseInclude;

export const getLearnerCourse = async (enrollmentId: string, userId: string) => {
  const enr = await prisma.lmsEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { include: learnerCourseInclude }, lessonProgress: true },
  });
  if (!enr) throw NotFound('Enrollment not found');
  if (enr.userId !== userId) throw Forbidden('This enrollment belongs to another user');

  const progressByLesson = new Map(enr.lessonProgress.map((p) => [p.lessonId, p]));
  const c = enr.course;

  // First touch flips ASSIGNED → IN_PROGRESS.
  if (enr.status === 'ASSIGNED') {
    await prisma.lmsEnrollment.update({
      where: { id: enr.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    enr.status = 'IN_PROGRESS';
  }

  return {
    enrollment_id: enr.id,
    status: enr.status,
    progress_pct: enr.progressPct,
    has_final_exam: c.assessments.length > 0,
    course: {
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      type: c.type,
      passing_score: c.passingScore,
      modules: c.modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        lessons: m.lessons.map((l) => {
          const p = progressByLesson.get(l.id);
          return {
            id: l.id,
            title: l.title,
            order: l.order,
            content_type: l.contentType,
            asset_id: l.assetId,
            // Asset metadata only — heavy file content is fetched via /lms/assets/:id.
            asset_kind: l.asset?.kind ?? null,
            asset_url: l.asset?.url ?? null,
            asset_duration_seconds: l.asset?.durationSeconds ?? null,
            document_id: l.documentId,
            body_html: l.bodyHtml,
            external_url: l.externalUrl,
            min_view_seconds: l.minViewSeconds,
            is_mandatory: l.isMandatory,
            completed: p?.completed ?? false,
            seconds_viewed: p?.secondsViewed ?? 0,
          };
        }),
      })),
    },
  };
};

// ─────────────────────────── Progress ───────────────────────────
const recomputeEnrollment = async (enrollmentId: string, userId: string) => {
  const enr = await prisma.lmsEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: { include: { modules: { include: { lessons: true } }, assessments: { where: { moduleId: null }, select: { id: true } } } },
      lessonProgress: true,
    },
  });
  if (!enr) return;

  const mandatory = enr.course.modules.flatMap((m) => m.lessons).filter((l) => l.isMandatory);
  const doneIds = new Set(enr.lessonProgress.filter((p) => p.completed).map((p) => p.lessonId));
  const doneMandatory = mandatory.filter((l) => doneIds.has(l.id)).length;
  const pct = mandatory.length === 0 ? 100 : Math.round((doneMandatory / mandatory.length) * 100);

  const allLessonsDone = mandatory.length === 0 || doneMandatory === mandatory.length;
  const hasExam = enr.course.assessments.length > 0;
  // Lesson completion alone completes the course only when there's no exam gate;
  // otherwise the exam (Phase 4) is responsible for the final COMPLETED state.
  const shouldComplete = allLessonsDone && !hasExam && enr.status !== 'COMPLETED';

  await prisma.lmsEnrollment.update({
    where: { id: enrollmentId },
    data: {
      progressPct: pct,
      status: shouldComplete ? 'COMPLETED' : enr.status === 'ASSIGNED' ? 'IN_PROGRESS' : enr.status,
      completedAt: shouldComplete ? new Date() : enr.completedAt,
      score: shouldComplete && !hasExam ? 100 : enr.score,
    },
  });
  if (shouldComplete) {
    await writeTrail({ entityType: 'LmsEnrollment', entityId: enrollmentId, action: 'UPDATE', field: 'status', newValue: 'COMPLETED' }, userId);
  }
};

export const updateLessonProgress = async (
  enrollmentId: string,
  lessonId: string,
  input: { seconds_viewed?: number; completed?: boolean },
  userId: string,
) => {
  const enr = await prisma.lmsEnrollment.findUnique({ where: { id: enrollmentId }, select: { userId: true } });
  if (!enr) throw NotFound('Enrollment not found');
  if (enr.userId !== userId) throw Forbidden('This enrollment belongs to another user');

  const lesson = await prisma.lmsLesson.findUnique({ where: { id: lessonId }, select: { minViewSeconds: true } });
  if (!lesson) throw NotFound('Lesson not found');

  const existing = await prisma.lmsLessonProgress.findUnique({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
  });
  const seconds = Math.max(input.seconds_viewed ?? 0, existing?.secondsViewed ?? 0);
  // Auto-complete a video lesson once the minimum watch time is reached. Once a
  // lesson is complete it stays complete (sticky).
  const meetsWatch = lesson.minViewSeconds ? seconds >= lesson.minViewSeconds : false;
  const completed = input.completed === true || (existing?.completed ?? false) || meetsWatch;

  await prisma.lmsLessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    create: { enrollmentId, lessonId, secondsViewed: seconds, completed, completedAt: completed ? new Date() : null },
    update: { secondsViewed: seconds, completed, completedAt: completed ? new Date() : existing?.completedAt ?? null },
  });

  await recomputeEnrollment(enrollmentId, userId);
  return getLearnerCourse(enrollmentId, userId);
};

// Auto-complete a DOC_ACK course's enrollments when the linked document is
// acknowledged in the DMS — the LMS counterpart of the legacy training hook.
export const completeDocAckForDocument = async (documentId: string, userId: string): Promise<void> => {
  const courses = await prisma.lmsCourse.findMany({
    where: { documentId, type: 'DOC_ACK', isDeleted: false },
    select: { id: true },
  });
  if (!courses.length) return;
  await prisma.lmsEnrollment.updateMany({
    where: { courseId: { in: courses.map((c) => c.id) }, userId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    data: { status: 'COMPLETED', completedAt: new Date(), progressPct: 100, score: 100 },
  });
};
