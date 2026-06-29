/**
 * LMS authoring service (Phase 2).
 *
 * Courses are versioned like controlled documents: a course lineage shares a
 * `code`; each version is an `LmsCourse` row. A version moves DRAFT → IN_REVIEW
 * → PUBLISHED (e-signed) → RETIRED. Only DRAFT versions are editable; publishing
 * a new version supersedes the previous latest one. Structure (modules → lessons
 * → assets) hangs off the course and is only editable while the course is DRAFT.
 *
 * Org/user refs are plain id columns (see schema note) — no FK joins here.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import type {
  CreateAssetInput,
  CreateCourseInput,
  CreateLessonInput,
  CreateModuleInput,
  ListCoursesQuery,
  PublishCourseInput,
  UpdateCourseInput,
  UpdateLessonInput,
  UpdateModuleInput,
} from './lms.schema';

const nextCourseCode = async (year: number): Promise<string> => {
  // Codes are shared across versions, so count distinct lineages by version=1.
  const count = await prisma.lmsCourse.count({
    where: { code: { startsWith: `CRS-${year}-` }, version: 1 },
  });
  return `CRS-${year}-${String(count + 1).padStart(4, '0')}`;
};

const courseInclude = {
  modules: {
    orderBy: { order: 'asc' as const },
    include: {
      lessons: {
        orderBy: { order: 'asc' as const },
        include: { asset: true },
      },
      assessments: { select: { id: true, title: true, passingScore: true } },
    },
  },
  assessments: {
    where: { moduleId: null },
    select: { id: true, title: true, passingScore: true, maxAttempts: true },
  },
} satisfies Prisma.LmsCourseInclude;

type CourseRow = Prisma.LmsCourseGetPayload<{ include: typeof courseInclude }>;

const serializeAsset = (a: NonNullable<CourseRow['modules'][number]['lessons'][number]['asset']>) => ({
  id: a.id,
  kind: a.kind,
  title: a.title,
  url: a.url,
  // file content (fileKey) is only sent on the dedicated asset GET, not inline.
  mime_type: a.mimeType,
  size_bytes: a.sizeBytes,
  duration_seconds: a.durationSeconds,
  page_count: a.pageCount,
  scorm_version: a.scormVersion,
  scorm_entry_point: a.scormEntryPoint,
});

const serializeCourse = (c: CourseRow, full = false) => ({
  id: c.id,
  code: c.code,
  title: c.title,
  description: c.description,
  category: c.category,
  type: c.type,
  status: c.status,
  version: c.version,
  is_latest_version: c.isLatestVersion,
  parent_course_id: c.parentCourseId,
  passing_score: c.passingScore,
  validity_months: c.validityMonths,
  estimated_minutes: c.estimatedMinutes,
  effective_date: c.effectiveDate,
  document_id: c.documentId,
  owner_id: c.ownerId,
  is_catalog_visible: c.isCatalogVisible,
  allow_self_enroll: c.allowSelfEnroll,
  published_at: c.publishedAt,
  module_count: c.modules.length,
  lesson_count: c.modules.reduce((n, m) => n + m.lessons.length, 0),
  created_at: c.createdAt,
  updated_at: c.updatedAt,
  ...(full
    ? {
        modules: c.modules.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          order: m.order,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            order: l.order,
            content_type: l.contentType,
            asset_id: l.assetId,
            asset: l.asset ? serializeAsset(l.asset) : null,
            document_id: l.documentId,
            body_html: l.bodyHtml,
            external_url: l.externalUrl,
            min_view_seconds: l.minViewSeconds,
            is_mandatory: l.isMandatory,
          })),
          assessments: m.assessments,
        })),
        final_assessments: c.assessments,
      }
    : {}),
});

// ─────────────────────────── Course queries ───────────────────────────
export const listCourses = async (q: ListCoursesQuery) => {
  const where: Prisma.LmsCourseWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  if (q.category) where.category = q.category;
  if (q.latest_only) where.isLatestVersion = true;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { code: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.lmsCourse.count({ where }),
    prisma.lmsCourse.findMany({
      where,
      include: courseInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);
  return {
    data: rows.map((r) => serializeCourse(r)),
    total,
    page: q.page,
    page_size: q.page_size,
  };
};

const getCourseRow = async (id: string): Promise<CourseRow> => {
  const c = await prisma.lmsCourse.findFirst({
    where: { id, isDeleted: false },
    include: courseInclude,
  });
  if (!c) throw NotFound('Course not found');
  return c;
};

export const getCourse = async (id: string) => serializeCourse(await getCourseRow(id), true);

const assertDraft = (c: CourseRow) => {
  if (c.status !== 'DRAFT') {
    throw Conflict('Only DRAFT courses can be edited; create a new version to change a published course');
  }
};

// ─────────────────────────── Course mutations ───────────────────────────
export const createCourse = async (input: CreateCourseInput, userId?: string) => {
  const code = await nextCourseCode(new Date().getFullYear());
  const created = await prisma.lmsCourse.create({
    data: {
      code,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      type: input.type,
      status: 'DRAFT',
      version: 1,
      isLatestVersion: true,
      passingScore: input.passing_score ?? null,
      validityMonths: input.validity_months ?? null,
      estimatedMinutes: input.estimated_minutes ?? null,
      effectiveDate: input.effective_date ? new Date(input.effective_date) : null,
      documentId: input.document_id ?? null,
      ownerId: input.owner_id ?? userId ?? null,
      isCatalogVisible: input.is_catalog_visible ?? false,
      allowSelfEnroll: input.allow_self_enroll ?? false,
      createdById: userId ?? null,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: created.id, action: 'CREATE', newValue: code }, userId);
  return getCourse(created.id);
};

export const updateCourse = async (id: string, input: UpdateCourseInput, userId?: string) => {
  const existing = await getCourseRow(id);
  assertDraft(existing);
  await prisma.lmsCourse.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      description: input.description === undefined ? undefined : input.description,
      category: input.category === undefined ? undefined : input.category,
      type: input.type ?? undefined,
      passingScore: input.passing_score === undefined ? undefined : input.passing_score,
      validityMonths: input.validity_months === undefined ? undefined : input.validity_months,
      estimatedMinutes: input.estimated_minutes === undefined ? undefined : input.estimated_minutes,
      effectiveDate: input.effective_date === undefined ? undefined : input.effective_date ? new Date(input.effective_date) : null,
      documentId: input.document_id === undefined ? undefined : input.document_id,
      ownerId: input.owner_id === undefined ? undefined : input.owner_id,
      isCatalogVisible: input.is_catalog_visible ?? undefined,
      allowSelfEnroll: input.allow_self_enroll ?? undefined,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: id, action: 'UPDATE' }, userId);
  return getCourse(id);
};

export const deleteCourse = async (id: string, userId?: string) => {
  const existing = await getCourseRow(id);
  if (existing.status === 'PUBLISHED') throw Conflict('Retire a published course instead of deleting it');
  await prisma.lmsCourse.update({ where: { id }, data: { isDeleted: true } });
  await writeTrail({ entityType: 'LmsCourse', entityId: id, action: 'DELETE' }, userId);
};

export const submitCourse = async (id: string, userId?: string) => {
  const c = await getCourseRow(id);
  if (c.status !== 'DRAFT') throw Conflict('Only DRAFT courses can be submitted for review');
  if (c.type !== 'DOC_ACK' && c.modules.length === 0) {
    throw BadRequest('Add at least one module before submitting for review');
  }
  await prisma.lmsCourse.update({ where: { id }, data: { status: 'IN_REVIEW' } });
  await writeTrail({ entityType: 'LmsCourse', entityId: id, action: 'UPDATE', field: 'status', newValue: 'IN_REVIEW' }, userId);
  return getCourse(id);
};

export const publishCourse = async (id: string, input: PublishCourseInput, userId?: string) => {
  const c = await getCourseRow(id);
  if (c.status !== 'IN_REVIEW') throw Conflict('Only courses IN_REVIEW can be published');

  // 21 CFR Part 11 e-signature — re-authenticates the publisher.
  const sig = await recordSignature(
    {
      entity_type: 'LmsCourse',
      entity_id: id,
      meaning: input.meaning ?? 'Approved & published this course version',
      credential: input.credential,
    },
    userId,
  );

  await prisma.$transaction(async (tx) => {
    // Supersede any prior latest version in this lineage.
    await tx.lmsCourse.updateMany({
      where: { code: c.code, isLatestVersion: true, id: { not: id } },
      data: { isLatestVersion: false },
    });
    await tx.lmsCourse.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        isLatestVersion: true,
        publishedById: userId ?? null,
        publishedAt: new Date(),
        effectiveDate: c.effectiveDate ?? new Date(),
      },
    });
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: id, action: 'UPDATE', field: 'status', newValue: 'PUBLISHED' }, userId);
  return { ...(await getCourse(id)), signature: sig };
};

export const retireCourse = async (id: string, userId?: string) => {
  const c = await getCourseRow(id);
  if (c.status !== 'PUBLISHED') throw Conflict('Only PUBLISHED courses can be retired');
  await prisma.lmsCourse.update({ where: { id }, data: { status: 'RETIRED', isLatestVersion: false } });
  await writeTrail({ entityType: 'LmsCourse', entityId: id, action: 'UPDATE', field: 'status', newValue: 'RETIRED' }, userId);
  return getCourse(id);
};

// Create a new editable DRAFT version cloning structure from a published course.
export const createVersion = async (id: string, userId?: string) => {
  const src = await getCourseRow(id);
  const maxVersion = await prisma.lmsCourse.aggregate({
    where: { code: src.code },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? src.version) + 1;
  const existingDraft = await prisma.lmsCourse.findFirst({
    where: { code: src.code, status: 'DRAFT', isDeleted: false },
  });
  if (existingDraft) throw Conflict('A draft version already exists for this course');

  const newId = await prisma.$transaction(async (tx) => {
    const created = await tx.lmsCourse.create({
      data: {
        code: src.code,
        title: src.title,
        description: src.description,
        category: src.category,
        type: src.type,
        status: 'DRAFT',
        version: nextVersion,
        isLatestVersion: false,
        parentCourseId: src.parentCourseId ?? src.id,
        passingScore: src.passingScore,
        validityMonths: src.validityMonths,
        estimatedMinutes: src.estimatedMinutes,
        documentId: src.documentId,
        ownerId: src.ownerId,
        isCatalogVisible: src.isCatalogVisible,
        allowSelfEnroll: src.allowSelfEnroll,
        createdById: userId ?? null,
      },
    });
    // Clone modules → lessons (assets are shared by reference).
    for (const m of src.modules) {
      const mod = await tx.lmsCourseModule.create({
        data: { courseId: created.id, title: m.title, description: m.description, order: m.order },
      });
      for (const l of m.lessons) {
        await tx.lmsLesson.create({
          data: {
            moduleId: mod.id,
            title: l.title,
            order: l.order,
            contentType: l.contentType,
            assetId: l.assetId,
            documentId: l.documentId,
            bodyHtml: l.bodyHtml,
            externalUrl: l.externalUrl,
            minViewSeconds: l.minViewSeconds,
            isMandatory: l.isMandatory,
          },
        });
      }
    }
    return created.id;
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: newId, action: 'CREATE', field: 'version', newValue: String(nextVersion) }, userId);
  return getCourse(newId);
};

// ─────────────────────────── Modules ───────────────────────────
export const addModule = async (courseId: string, input: CreateModuleInput, userId?: string) => {
  const c = await getCourseRow(courseId);
  assertDraft(c);
  const order = input.order ?? c.modules.length;
  await prisma.lmsCourseModule.create({
    data: { courseId, title: input.title, description: input.description ?? null, order },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'module', newValue: 'added' }, userId);
  return getCourse(courseId);
};

const getModuleCourse = async (moduleId: string) => {
  const m = await prisma.lmsCourseModule.findUnique({ where: { id: moduleId }, select: { courseId: true } });
  if (!m) throw NotFound('Module not found');
  const c = await getCourseRow(m.courseId);
  assertDraft(c);
  return c.id;
};

export const updateModule = async (moduleId: string, input: UpdateModuleInput, userId?: string) => {
  const courseId = await getModuleCourse(moduleId);
  await prisma.lmsCourseModule.update({
    where: { id: moduleId },
    data: {
      title: input.title ?? undefined,
      description: input.description === undefined ? undefined : input.description,
      order: input.order ?? undefined,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'module' }, userId);
  return getCourse(courseId);
};

export const deleteModule = async (moduleId: string, userId?: string) => {
  const courseId = await getModuleCourse(moduleId);
  await prisma.lmsCourseModule.delete({ where: { id: moduleId } });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'module', newValue: 'removed' }, userId);
  return getCourse(courseId);
};

// ─────────────────────────── Lessons ───────────────────────────
export const addLesson = async (moduleId: string, input: CreateLessonInput, userId?: string) => {
  const courseId = await getModuleCourse(moduleId);
  const count = await prisma.lmsLesson.count({ where: { moduleId } });
  await prisma.lmsLesson.create({
    data: {
      moduleId,
      title: input.title,
      order: input.order ?? count,
      contentType: input.content_type,
      assetId: input.asset_id ?? null,
      documentId: input.document_id ?? null,
      bodyHtml: input.body_html ?? null,
      externalUrl: input.external_url ?? null,
      minViewSeconds: input.min_view_seconds ?? null,
      isMandatory: input.is_mandatory ?? true,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'lesson', newValue: 'added' }, userId);
  return getCourse(courseId);
};

const getLessonCourse = async (lessonId: string) => {
  const l = await prisma.lmsLesson.findUnique({ where: { id: lessonId }, select: { moduleId: true } });
  if (!l) throw NotFound('Lesson not found');
  return getModuleCourse(l.moduleId);
};

export const updateLesson = async (lessonId: string, input: UpdateLessonInput, userId?: string) => {
  const courseId = await getLessonCourse(lessonId);
  await prisma.lmsLesson.update({
    where: { id: lessonId },
    data: {
      title: input.title ?? undefined,
      order: input.order ?? undefined,
      contentType: input.content_type ?? undefined,
      assetId: input.asset_id === undefined ? undefined : input.asset_id,
      documentId: input.document_id === undefined ? undefined : input.document_id,
      bodyHtml: input.body_html === undefined ? undefined : input.body_html,
      externalUrl: input.external_url === undefined ? undefined : input.external_url,
      minViewSeconds: input.min_view_seconds === undefined ? undefined : input.min_view_seconds,
      isMandatory: input.is_mandatory ?? undefined,
    },
  });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'lesson' }, userId);
  return getCourse(courseId);
};

export const deleteLesson = async (lessonId: string, userId?: string) => {
  const courseId = await getLessonCourse(lessonId);
  await prisma.lmsLesson.delete({ where: { id: lessonId } });
  await writeTrail({ entityType: 'LmsCourse', entityId: courseId, action: 'UPDATE', field: 'lesson', newValue: 'removed' }, userId);
  return getCourse(courseId);
};

// ─────────────────────────── Content assets ───────────────────────────
export const createAsset = async (input: CreateAssetInput, userId?: string) => {
  const created = await prisma.lmsContentAsset.create({
    data: {
      kind: input.kind,
      title: input.title ?? null,
      url: input.url ?? null,
      fileKey: input.file_data ?? null, // inline base64 data URL (mirrors DMS)
      mimeType: input.mime_type ?? null,
      sizeBytes: input.size_bytes ?? null,
      durationSeconds: input.duration_seconds ?? null,
      pageCount: input.page_count ?? null,
      scormVersion: input.scorm_version ?? null,
      scormEntryPoint: input.scorm_entry_point ?? null,
      createdById: userId ?? null,
    },
  });
  return {
    id: created.id,
    kind: created.kind,
    title: created.title,
    url: created.url,
    mime_type: created.mimeType,
    size_bytes: created.sizeBytes,
    duration_seconds: created.durationSeconds,
    page_count: created.pageCount,
    scorm_version: created.scormVersion,
    scorm_entry_point: created.scormEntryPoint,
  };
};

// Full asset incl. inline file content — for the player/preview.
export const getAsset = async (id: string) => {
  const a = await prisma.lmsContentAsset.findFirst({ where: { id, isDeleted: false } });
  if (!a) throw NotFound('Asset not found');
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    url: a.url,
    file_data: a.fileKey,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes,
    duration_seconds: a.durationSeconds,
    page_count: a.pageCount,
    scorm_version: a.scormVersion,
    scorm_entry_point: a.scormEntryPoint,
  };
};
