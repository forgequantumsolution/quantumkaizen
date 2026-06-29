/**
 * LMS assignment + training-matrix service (Phase 5).
 *
 * Assigns courses/curricula to users, roles, departments or sites; manages
 * curricula (learning paths); and runs the training-matrix engine that
 * auto-enrols by org structure. Re-training fires two ways: a new published
 * course version produces a fresh enrollment, and (for recurring rules) an
 * expired completion re-opens the existing enrollment.
 *
 * Assignments always target the LATEST PUBLISHED version of a course.
 */
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { writeTrail } from '../audit/compliance.service';
import type {
  AssignCourseInput,
  CreateCurriculumInput,
  CreateMatrixRuleInput,
  UpdateCurriculumInput,
  UpdateMatrixRuleInput,
} from './lms.schema';

const DAY = 24 * 3600 * 1000;

type PublishedCourse = { id: string; code: string; version: number; validityMonths: number | null };

// Resolve the latest published version in a course's lineage.
const latestPublished = async (courseId: string): Promise<PublishedCourse> => {
  const c = await prisma.lmsCourse.findUnique({ where: { id: courseId }, select: { code: true } });
  if (!c) throw NotFound('Course not found');
  const latest = await prisma.lmsCourse.findFirst({
    where: { code: c.code, status: 'PUBLISHED', isLatestVersion: true, isDeleted: false },
    select: { id: true, code: true, version: true, validityMonths: true },
  });
  if (!latest) throw BadRequest('Course has no published version to assign');
  return latest;
};

type Targets = { user_ids?: string[]; role_id?: string; department_id?: string; site_id?: string };

const resolveTargetUserIds = async (t: Targets): Promise<string[]> => {
  const ids = new Set(t.user_ids ?? []);
  const orFilters = [];
  if (t.role_id) orFilters.push({ roleId: t.role_id });
  if (t.department_id) orFilters.push({ departmentId: t.department_id });
  if (t.site_id) orFilters.push({ siteId: t.site_id });
  if (orFilters.length) {
    const users = await prisma.user.findMany({ where: { isActive: true, OR: orFilters }, select: { id: true } });
    users.forEach((u) => ids.add(u.id));
  }
  return [...ids];
};

const sourceFor = (t: Targets) =>
  t.role_id ? 'ROLE' : t.department_id ? 'DEPARTMENT' : t.site_id ? 'SITE' : 'DIRECT';

// Create an enrollment for the given published version unless one already exists.
const enrollIfAbsent = async (
  course: PublishedCourse,
  userId: string,
  source: 'DIRECT' | 'ROLE' | 'DEPARTMENT' | 'SITE' | 'CURRICULUM' | 'MATRIX',
  opts: { sourceRef?: string; dueDate?: Date | null; assignedById?: string },
): Promise<boolean> => {
  const existing = await prisma.lmsEnrollment.findUnique({
    where: { courseId_userId_courseVersion: { courseId: course.id, userId, courseVersion: course.version } },
  });
  if (existing) return false;
  await prisma.lmsEnrollment.create({
    data: {
      courseId: course.id,
      courseVersion: course.version,
      userId,
      status: 'ASSIGNED',
      source: source as never,
      sourceRef: opts.sourceRef ?? null,
      dueDate: opts.dueDate ?? null,
      assignedById: opts.assignedById ?? null,
    },
  });
  return true;
};

// ─────────────────────────── Direct assignment ───────────────────────────
export const assignCourse = async (courseId: string, input: AssignCourseInput, userId?: string) => {
  const course = await latestPublished(courseId);
  const targetIds = await resolveTargetUserIds(input);
  if (!targetIds.length) throw BadRequest('No target users resolved');
  const due = input.due_date ? new Date(input.due_date) : null;
  const source = sourceFor(input);

  let created = 0;
  for (const uid of targetIds) {
    if (await enrollIfAbsent(course, uid, source, { dueDate: due, assignedById: userId })) created++;
  }
  await writeTrail(
    { entityType: 'LmsCourse', entityId: course.id, action: 'UPDATE', field: 'assigned', newValue: String(created) },
    userId,
  );
  return { assigned: created, targeted: targetIds.length, course_version: course.version };
};

// ─────────────────────────── Curricula ───────────────────────────
const nextCurriculumCode = async (year: number) => {
  const count = await prisma.lmsCurriculum.count({ where: { code: { startsWith: `CUR-${year}-` } } });
  return `CUR-${year}-${String(count + 1).padStart(4, '0')}`;
};

const serializeCurriculum = (c: Awaited<ReturnType<typeof getCurriculumRow>>) => ({
  id: c.id,
  code: c.code,
  title: c.title,
  description: c.description,
  category: c.category,
  is_active: c.isActive,
  courses: c.courses
    .sort((a, b) => a.order - b.order)
    .map((cc) => ({
      id: cc.id,
      course_id: cc.courseId,
      order: cc.order,
      is_mandatory: cc.isMandatory,
      title: cc.course.title,
      code: cc.course.code,
      status: cc.course.status,
    })),
});

const getCurriculumRow = async (id: string) => {
  const c = await prisma.lmsCurriculum.findFirst({
    where: { id, isDeleted: false },
    include: { courses: { include: { course: { select: { title: true, code: true, status: true } } } } },
  });
  if (!c) throw NotFound('Curriculum not found');
  return c;
};

export const listCurricula = async () => {
  const rows = await prisma.lmsCurriculum.findMany({
    where: { isDeleted: false },
    include: { courses: { include: { course: { select: { title: true, code: true, status: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeCurriculum);
};

export const getCurriculum = async (id: string) => serializeCurriculum(await getCurriculumRow(id));

export const createCurriculum = async (input: CreateCurriculumInput, userId?: string) => {
  const code = await nextCurriculumCode(new Date().getFullYear());
  const created = await prisma.lmsCurriculum.create({
    data: {
      code,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      createdById: userId ?? null,
      courses: input.course_ids?.length
        ? { create: input.course_ids.map((cid, i) => ({ courseId: cid, order: i })) }
        : undefined,
    },
  });
  await writeTrail({ entityType: 'LmsCurriculum', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getCurriculum(created.id);
};

export const updateCurriculum = async (id: string, input: UpdateCurriculumInput, userId?: string) => {
  await getCurriculumRow(id);
  await prisma.$transaction(async (tx) => {
    await tx.lmsCurriculum.update({
      where: { id },
      data: {
        title: input.title ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        category: input.category === undefined ? undefined : input.category,
        isActive: input.is_active ?? undefined,
      },
    });
    if (input.course_ids) {
      await tx.lmsCurriculumCourse.deleteMany({ where: { curriculumId: id } });
      await tx.lmsCurriculumCourse.createMany({
        data: input.course_ids.map((cid, i) => ({ curriculumId: id, courseId: cid, order: i })),
      });
    }
  });
  await writeTrail({ entityType: 'LmsCurriculum', entityId: id, action: 'UPDATE' }, userId);
  return getCurriculum(id);
};

export const deleteCurriculum = async (id: string, userId?: string) => {
  await getCurriculumRow(id);
  await prisma.lmsCurriculum.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'LmsCurriculum', entityId: id, action: 'DELETE' }, userId);
};

export const assignCurriculum = async (id: string, input: AssignCourseInput, userId?: string) => {
  const cur = await getCurriculumRow(id);
  const targetIds = await resolveTargetUserIds(input);
  if (!targetIds.length) throw BadRequest('No target users resolved');
  const due = input.due_date ? new Date(input.due_date) : null;

  let created = 0;
  for (const cc of cur.courses) {
    let course: PublishedCourse;
    try {
      course = await latestPublished(cc.courseId);
    } catch {
      continue; // skip courses with no published version
    }
    for (const uid of targetIds) {
      if (await enrollIfAbsent(course, uid, 'CURRICULUM', { sourceRef: id, dueDate: due, assignedById: userId })) created++;
    }
  }
  await writeTrail({ entityType: 'LmsCurriculum', entityId: id, action: 'UPDATE', field: 'assigned', newValue: String(created) }, userId);
  return { assigned: created, targeted: targetIds.length };
};

// ─────────────────────────── Training matrix ───────────────────────────
const serializeRule = (r: Awaited<ReturnType<typeof prisma.lmsTrainingMatrixRule.findMany>>[number]) => ({
  id: r.id,
  target_type: r.targetType,
  target_id: r.targetId,
  requires_type: r.requiresType,
  requires_id: r.requiresId,
  due_within_days: r.dueWithinDays,
  recurring: r.recurring,
  is_active: r.isActive,
});

export const listMatrixRules = async () => {
  const rows = await prisma.lmsTrainingMatrixRule.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeRule);
};

export const createMatrixRule = async (input: CreateMatrixRuleInput, userId?: string) => {
  const created = await prisma.lmsTrainingMatrixRule.create({
    data: {
      targetType: input.target_type,
      targetId: input.target_id,
      requiresType: input.requires_type,
      requiresId: input.requires_id,
      dueWithinDays: input.due_within_days ?? null,
      recurring: input.recurring ?? false,
      isActive: input.is_active ?? true,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'LmsTrainingMatrixRule', entityId: created.id, action: 'CREATE' }, userId);
  return serializeRule(created);
};

export const updateMatrixRule = async (id: string, input: UpdateMatrixRuleInput, userId?: string) => {
  const existing = await prisma.lmsTrainingMatrixRule.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Matrix rule not found');
  const updated = await prisma.lmsTrainingMatrixRule.update({
    where: { id },
    data: {
      targetType: input.target_type ?? undefined,
      targetId: input.target_id ?? undefined,
      requiresType: input.requires_type ?? undefined,
      requiresId: input.requires_id ?? undefined,
      dueWithinDays: input.due_within_days === undefined ? undefined : input.due_within_days,
      recurring: input.recurring ?? undefined,
      isActive: input.is_active ?? undefined,
    },
  });
  await writeTrail({ entityType: 'LmsTrainingMatrixRule', entityId: id, action: 'UPDATE' }, userId);
  return serializeRule(updated);
};

export const deleteMatrixRule = async (id: string, userId?: string) => {
  const existing = await prisma.lmsTrainingMatrixRule.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw NotFound('Matrix rule not found');
  await prisma.lmsTrainingMatrixRule.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'LmsTrainingMatrixRule', entityId: id, action: 'DELETE' }, userId);
};

// Resolve the published courses a rule requires (a single course or a curriculum).
const requiredCourses = async (rule: { requiresType: string; requiresId: string }): Promise<PublishedCourse[]> => {
  if (rule.requiresType === 'COURSE') {
    try {
      return [await latestPublished(rule.requiresId)];
    } catch {
      return [];
    }
  }
  const cur = await prisma.lmsCurriculum.findFirst({
    where: { id: rule.requiresId, isDeleted: false },
    include: { courses: true },
  });
  if (!cur) return [];
  const out: PublishedCourse[] = [];
  for (const cc of cur.courses) {
    try {
      out.push(await latestPublished(cc.courseId));
    } catch {
      /* skip unpublished */
    }
  }
  return out;
};

export const syncMatrix = async (userId?: string) => {
  const rules = await prisma.lmsTrainingMatrixRule.findMany({ where: { isDeleted: false, isActive: true } });
  let created = 0;
  let reopened = 0;
  const now = Date.now();

  for (const rule of rules) {
    const users = await resolveTargetUserIds({
      role_id: rule.targetType === 'ROLE' ? rule.targetId : undefined,
      department_id: rule.targetType === 'DEPARTMENT' ? rule.targetId : undefined,
      site_id: rule.targetType === 'SITE' ? rule.targetId : undefined,
      // JOB_FUNCTION → match user.designation
      user_ids: undefined,
    });
    let targetUsers = users;
    if (rule.targetType === 'JOB_FUNCTION') {
      const jf = await prisma.user.findMany({ where: { isActive: true, designation: rule.targetId }, select: { id: true } });
      targetUsers = jf.map((u) => u.id);
    }

    const courses = await requiredCourses(rule);
    const due = rule.dueWithinDays ? new Date(now + rule.dueWithinDays * DAY) : null;

    for (const course of courses) {
      for (const uid of targetUsers) {
        const existing = await prisma.lmsEnrollment.findUnique({
          where: { courseId_userId_courseVersion: { courseId: course.id, userId: uid, courseVersion: course.version } },
        });
        if (!existing) {
          if (await enrollIfAbsent(course, uid, 'MATRIX', { sourceRef: rule.id, dueDate: due, assignedById: userId })) created++;
        } else if (
          rule.recurring &&
          existing.status === 'COMPLETED' &&
          existing.completedAt &&
          course.validityMonths &&
          existing.completedAt.getTime() + course.validityMonths * 30 * DAY < now
        ) {
          // Recert period elapsed → re-open the enrollment for retraining.
          await prisma.$transaction(async (tx) => {
            await tx.lmsLessonProgress.deleteMany({ where: { enrollmentId: existing.id } });
            await tx.lmsEnrollment.update({
              where: { id: existing.id },
              data: { status: 'ASSIGNED', progressPct: 0, completedAt: null, score: null, dueDate: due, certificateId: null },
            });
          });
          reopened++;
        }
      }
    }
  }
  await writeTrail({ entityType: 'LmsTrainingMatrixRule', entityId: 'sync', action: 'UPDATE', field: 'sync', newValue: `created ${created}, reopened ${reopened}` }, userId);
  return { rules: rules.length, created, reopened };
};
