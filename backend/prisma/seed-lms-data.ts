/**
 * Demo data for the whole LMS module — so every LMS screen shows realistic data:
 *   • Courses (all statuses: DRAFT / IN_REVIEW / PUBLISHED / RETIRED, all types)
 *   • Course Builder content (modules → lessons: video, PDF, slide deck, text, doc-ack)
 *   • Exam Builder (assessments + questions: single / multi / true-false / short-text)
 *   • My Learning / Catalog / Player (enrollments across every status + lesson progress)
 *   • Grading queue (a submitted exam attempt with a written answer awaiting grading)
 *   • Curricula (a learning path) and Training Matrix (auto-assign rules)
 *   • Reports (enrollments spread across users/departments + issued & expiring certs)
 *
 *   npm run db:seed:lms   (from the backend workspace)
 *
 * Idempotent: rows are found-or-created by their natural keys, so re-running is
 * safe and never duplicates.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const MONTH = 30 * DAY;
const at = (ms: number) => new Date(Date.now() + ms);

// Public sample assets (fine for a demo).
const SAMPLE_VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';
const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

type ContentKind =
  | 'VIDEO' | 'PPT' | 'SLIDE_DECK' | 'PDF' | 'IMAGE' | 'SCORM' | 'EXTERNAL_LINK' | 'DOCUMENT_REF' | 'RICH_TEXT';

interface LessonSpec {
  title: string;
  contentType: ContentKind;
  url?: string;          // asset url (video/pdf/slide) — registers an asset
  bodyHtml?: string;     // RICH_TEXT
  externalUrl?: string;  // EXTERNAL_LINK
  minViewSeconds?: number;
}
interface ModuleSpec { title: string; description?: string; lessons: LessonSpec[] }
interface QuestionSpec {
  type: 'SINGLE' | 'MULTI' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'LONG_TEXT';
  prompt: string;
  points?: number;
  explanation?: string;
  options?: { text: string; correct?: boolean }[];
}
interface ExamSpec { title: string; passingScore: number; questions: QuestionSpec[] }
interface CourseSpec {
  code: string;
  title: string;
  description: string;
  category: string;
  type: 'DOC_ACK' | 'ELEARNING' | 'CLASSROOM' | 'BLENDED';
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'RETIRED';
  validityMonths?: number;
  passingScore?: number;
  estimatedMinutes?: number;
  catalog?: boolean;          // catalog-visible + self-enrol
  modules?: ModuleSpec[];
  exam?: ExamSpec;
}

const COURSES: CourseSpec[] = [
  {
    code: 'CRS-DEMO-001', title: 'GMP Annual Refresher', category: 'Quality',
    description: 'Annual good-manufacturing-practice refresher covering hygiene, documentation and contamination control.',
    type: 'ELEARNING', status: 'PUBLISHED', validityMonths: 12, passingScore: 70, estimatedMinutes: 45, catalog: true,
    modules: [
      { title: 'Introduction to GMP', lessons: [
        { title: 'What is GMP?', contentType: 'VIDEO', url: SAMPLE_VIDEO, minViewSeconds: 5 },
        { title: 'The 10 Principles of GMP', contentType: 'RICH_TEXT', bodyHtml: '<h3>The 10 Principles</h3><ol><li>Write procedures</li><li>Follow procedures</li><li>Document work</li><li>Validate</li><li>Use suitable equipment</li><li>Maintain equipment</li><li>Train staff</li><li>Practice hygiene</li><li>Build quality in</li><li>Audit regularly</li></ol>' },
      ] },
      { title: 'Documentation Practices', lessons: [
        { title: 'Good Documentation (slides)', contentType: 'SLIDE_DECK', url: SAMPLE_PDF },
        { title: 'ALCOA+ Reference Guide', contentType: 'PDF', url: SAMPLE_PDF },
      ] },
    ],
    exam: {
      title: 'GMP Annual Refresher — Final Exam', passingScore: 70,
      questions: [
        { type: 'SINGLE', prompt: 'GMP stands for…', points: 1, explanation: 'Good Manufacturing Practice.', options: [
          { text: 'Good Manufacturing Practice', correct: true }, { text: 'General Maintenance Plan' }, { text: 'Global Material Policy' } ] },
        { type: 'TRUE_FALSE', prompt: 'Procedures should be followed exactly as written.', points: 1, options: [
          { text: 'True', correct: true }, { text: 'False' } ] },
        { type: 'MULTI', prompt: 'Which are ALCOA+ attributes? (select all)', points: 2, options: [
          { text: 'Attributable', correct: true }, { text: 'Legible', correct: true }, { text: 'Colourful' }, { text: 'Contemporaneous', correct: true } ] },
      ],
    },
  },
  {
    code: 'CRS-DEMO-002', title: 'Data Integrity & ALCOA+', category: 'Quality',
    description: 'Principles of data integrity in regulated environments, with practical worked examples.',
    type: 'ELEARNING', status: 'PUBLISHED', validityMonths: 24, passingScore: 80, estimatedMinutes: 60, catalog: true,
    modules: [
      { title: 'Foundations', lessons: [
        { title: 'Why Data Integrity Matters', contentType: 'VIDEO', url: SAMPLE_VIDEO, minViewSeconds: 5 },
        { title: 'ALCOA+ Explained', contentType: 'SLIDE_DECK', url: SAMPLE_PDF },
      ] },
      { title: 'In Practice', lessons: [
        { title: 'Audit Trails', contentType: 'RICH_TEXT', bodyHtml: '<p>Audit trails must be <b>enabled, reviewed and protected</b> from alteration.</p>' },
        { title: 'Regulatory Guidance', contentType: 'EXTERNAL_LINK', externalUrl: 'https://www.fda.gov' },
      ] },
    ],
    exam: {
      title: 'Data Integrity — Final Exam', passingScore: 80,
      questions: [
        { type: 'SINGLE', prompt: 'The "O" in ALCOA stands for…', points: 1, options: [
          { text: 'Original', correct: true }, { text: 'Official' }, { text: 'Ordered' } ] },
        { type: 'TRUE_FALSE', prompt: 'Shared logins are acceptable for GMP systems.', points: 1, options: [
          { text: 'True' }, { text: 'False', correct: true } ] },
        // A written question → routes attempts to the grading queue.
        { type: 'SHORT_TEXT', prompt: 'In one sentence, explain why contemporaneous recording matters.', points: 2 },
      ],
    },
  },
  {
    code: 'CRS-DEMO-003', title: 'SOP: Gowning Procedure (Read & Understand)', category: 'SOP',
    description: 'Acknowledge that you have read and understood the cleanroom gowning SOP.',
    type: 'DOC_ACK', status: 'PUBLISHED', validityMonths: 12, catalog: false,
  },
  {
    code: 'CRS-DEMO-004', title: 'Cleanroom Behaviour', category: 'EHS',
    description: 'Blended course: e-learning plus a classroom practical on cleanroom conduct.',
    type: 'BLENDED', status: 'PUBLISHED', validityMonths: 12, estimatedMinutes: 30, catalog: true,
    modules: [
      { title: 'Behaviour Basics', lessons: [
        { title: 'Do’s and Don’ts', contentType: 'VIDEO', url: SAMPLE_VIDEO, minViewSeconds: 5 },
      ] },
    ],
  },
  {
    code: 'CRS-DEMO-005', title: 'Equipment Calibration Basics', category: 'Engineering',
    description: 'Draft course being authored — used to demo the course builder.',
    type: 'ELEARNING', status: 'DRAFT', estimatedMinutes: 40,
    modules: [
      { title: 'Calibration Fundamentals', lessons: [
        { title: 'Intro to Calibration', contentType: 'RICH_TEXT', bodyHtml: '<p>Calibration ensures measurement accuracy and traceability.</p>' },
      ] },
    ],
  },
  {
    code: 'CRS-DEMO-006', title: 'Deviation Handling', category: 'Quality',
    description: 'Submitted for review — used to demo the publish (e-sign) step.',
    type: 'ELEARNING', status: 'IN_REVIEW', passingScore: 70, estimatedMinutes: 35,
    modules: [
      { title: 'Deviation Lifecycle', lessons: [
        { title: 'Raising a Deviation', contentType: 'VIDEO', url: SAMPLE_VIDEO },
      ] },
    ],
  },
  {
    code: 'CRS-DEMO-007', title: 'Legacy Safety Induction', category: 'EHS',
    description: 'A retired course, retained for history.',
    type: 'ELEARNING', status: 'RETIRED', estimatedMinutes: 20,
  },
];

async function ensureCourse(spec: CourseSpec, ownerId: string | null) {
  const published = spec.status === 'PUBLISHED';
  const course = await prisma.lmsCourse.upsert({
    where: { code_version: { code: spec.code, version: 1 } },
    update: {},
    create: {
      code: spec.code, title: spec.title, description: spec.description, category: spec.category,
      type: spec.type, status: spec.status, version: 1,
      isLatestVersion: spec.status !== 'RETIRED',
      passingScore: spec.passingScore ?? null,
      validityMonths: spec.validityMonths ?? null,
      estimatedMinutes: spec.estimatedMinutes ?? null,
      effectiveDate: published ? new Date() : null,
      publishedAt: published ? new Date() : null,
      publishedById: published ? ownerId : null,
      isCatalogVisible: !!spec.catalog, allowSelfEnroll: !!spec.catalog,
      ownerId, createdById: ownerId,
    },
  });

  for (const [mi, m] of (spec.modules ?? []).entries()) {
    let mod = await prisma.lmsCourseModule.findFirst({ where: { courseId: course.id, title: m.title } });
    if (!mod) mod = await prisma.lmsCourseModule.create({ data: { courseId: course.id, title: m.title, description: m.description ?? null, order: mi } });
    for (const [li, l] of m.lessons.entries()) {
      const exists = await prisma.lmsLesson.findFirst({ where: { moduleId: mod.id, title: l.title } });
      if (exists) continue;
      let assetId: string | null = null;
      if (l.url && ['VIDEO', 'PDF', 'SLIDE_DECK', 'PPT', 'IMAGE'].includes(l.contentType)) {
        const asset = await prisma.lmsContentAsset.create({
          data: { kind: l.contentType as never, title: l.title, url: l.url, createdById: ownerId },
        });
        assetId = asset.id;
      }
      await prisma.lmsLesson.create({
        data: {
          moduleId: mod.id, title: l.title, order: li, contentType: l.contentType as never,
          assetId, bodyHtml: l.bodyHtml ?? null, externalUrl: l.externalUrl ?? null,
          minViewSeconds: l.minViewSeconds ?? null, isMandatory: true,
        },
      });
    }
  }

  if (spec.exam) {
    let exam = await prisma.lmsAssessment.findFirst({ where: { courseId: course.id, title: spec.exam.title } });
    if (!exam) {
      exam = await prisma.lmsAssessment.create({
        data: { courseId: course.id, title: spec.exam.title, passingScore: spec.exam.passingScore, maxAttempts: 3, requireESign: true, createdById: ownerId },
      });
    }
    const qCount = await prisma.lmsQuestion.count({ where: { assessmentId: exam.id } });
    if (qCount === 0) {
      for (const [qi, q] of spec.exam.questions.entries()) {
        await prisma.lmsQuestion.create({
          data: {
            assessmentId: exam.id, type: q.type as never, prompt: q.prompt, points: q.points ?? 1, order: qi,
            explanation: q.explanation ?? null,
            options: q.options ? { create: q.options.map((o, oi) => ({ text: o.text, isCorrect: !!o.correct, order: oi })) } : undefined,
          },
        });
      }
    }
  }

  return course;
}

async function ensureEnrollment(
  courseId: string, version: number, userId: string,
  data: { status: string; source?: string; dueDate?: Date | null; progressPct?: number; score?: number | null; completedAt?: Date | null; assignedAt?: Date | null },
) {
  return prisma.lmsEnrollment.upsert({
    where: { courseId_userId_courseVersion: { courseId, userId, courseVersion: version } },
    update: {},
    create: {
      courseId, courseVersion: version, userId,
      status: data.status as never, source: (data.source ?? 'DIRECT') as never,
      dueDate: data.dueDate ?? null, progressPct: data.progressPct ?? 0,
      score: data.score ?? null, completedAt: data.completedAt ?? null,
      startedAt: data.status === 'IN_PROGRESS' || data.status === 'COMPLETED' ? at(-3 * DAY) : null,
      assignedAt: data.assignedAt ?? at(-7 * DAY),
    },
  });
}

async function ensureCertificate(serial: string, courseId: string, userId: string, expiresAt: Date | null) {
  return prisma.lmsCertificate.upsert({
    where: { serial },
    update: {},
    create: { serial, courseId, userId, expiresAt, issuedAt: at(-2 * DAY), verifyToken: `demo-${serial.toLowerCase()}-${randomUUID().slice(0, 8)}` },
  });
}

async function main() {
  console.log('🌱  Seeding LMS demo data…');

  const admin =
    (await prisma.user.findUnique({ where: { email: 'info@forgequantumsolution.com' } })) ??
    (await prisma.user.findFirst({ where: { isActive: true } }));
  if (!admin) throw new Error('No users found — run the base seed first (npm run db:seed).');

  const allUsers = await prisma.user.findMany({ where: { isActive: true }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  const others = allUsers.filter((u) => u.id !== admin.id);

  // ── Courses (+ modules, lessons, exams) ──
  const byCode = new Map<string, { id: string; version: number }>();
  for (const spec of COURSES) {
    const c = await ensureCourse(spec, admin.id);
    byCode.set(spec.code, { id: c.id, version: c.version });
    console.log(`   ✓ course ${spec.code} (${spec.status})`);
  }

  const c001 = byCode.get('CRS-DEMO-001')!;
  const c002 = byCode.get('CRS-DEMO-002')!;
  const c003 = byCode.get('CRS-DEMO-003')!;
  const c004 = byCode.get('CRS-DEMO-004')!;

  // ── Admin enrollments (My Learning / Player / Certificates) ──
  // 001: completed + certificate.
  const e001 = await ensureEnrollment(c001.id, c001.version, admin.id, { status: 'COMPLETED', source: 'SELF', progressPct: 100, score: 88, completedAt: at(-2 * DAY) });
  const cert001 = await ensureCertificate('CERT-DEMO-0001', c001.id, admin.id, at(11 * MONTH));
  await prisma.lmsEnrollment.update({ where: { id: e001.id }, data: { certificateId: cert001.id } });

  // 002: in progress (partial lesson progress) + a submitted exam attempt for grading.
  const e002 = await ensureEnrollment(c002.id, c002.version, admin.id, { status: 'IN_PROGRESS', source: 'SELF', progressPct: 50 });
  const firstLesson002 = await prisma.lmsLesson.findFirst({ where: { module: { courseId: c002.id } }, orderBy: { order: 'asc' } });
  if (firstLesson002) {
    await prisma.lmsLessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: e002.id, lessonId: firstLesson002.id } },
      update: {}, create: { enrollmentId: e002.id, lessonId: firstLesson002.id, secondsViewed: 30, completed: true, completedAt: at(-1 * DAY) },
    });
  }

  // 003 (DOC_ACK): assigned, due soon.
  await ensureEnrollment(c003.id, c003.version, admin.id, { status: 'ASSIGNED', source: 'DIRECT', dueDate: at(5 * DAY) });
  // 004: assigned, overdue.
  await ensureEnrollment(c004.id, c004.version, admin.id, { status: 'ASSIGNED', source: 'MATRIX', dueDate: at(-3 * DAY) });

  // ── Submitted exam attempt (Grading queue) ──
  const exam002 = await prisma.lmsAssessment.findFirst({ where: { courseId: c002.id } });
  if (exam002) {
    const existingAttempt = await prisma.lmsAssessmentAttempt.findFirst({ where: { assessmentId: exam002.id, userId: admin.id } });
    if (!existingAttempt) {
      const questions = await prisma.lmsQuestion.findMany({ where: { assessmentId: exam002.id }, include: { options: true }, orderBy: { order: 'asc' } });
      const attempt = await prisma.lmsAssessmentAttempt.create({
        data: { assessmentId: exam002.id, enrollmentId: e002.id, userId: admin.id, attemptNo: 1, status: 'SUBMITTED', submittedAt: at(-1 * DAY) },
      });
      for (const q of questions) {
        const isText = q.type === 'SHORT_TEXT' || q.type === 'LONG_TEXT';
        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        await prisma.lmsAttemptAnswer.create({
          data: {
            attemptId: attempt.id, questionId: q.id,
            selectedOptionIds: isText ? [] : correctIds, // objective answered correctly
            textAnswer: isText ? 'Because recording at the time of the activity prevents recall errors and data loss.' : null,
            awardedPoints: isText ? null : q.points, // text answer awaits manual grading
            isCorrect: isText ? null : true,
          },
        });
      }
      console.log('   ✓ submitted exam attempt queued for grading');
    }
  }

  // ── Other users — spread enrollments for Reports (by-department, completion, overdue) ──
  let certSeq = 2;
  for (const [i, u] of others.slice(0, 12).entries()) {
    const mod = i % 4;
    if (mod === 0) {
      const e = await ensureEnrollment(c001.id, c001.version, u.id, { status: 'COMPLETED', source: 'MATRIX', progressPct: 100, score: 75 + (i % 20), completedAt: at(-((i % 5) + 1) * DAY) });
      // Some certificates expire within 60 days (populates the "expiring" report).
      const expires = i % 3 === 0 ? at(((i % 50) + 10) * DAY) : at(11 * MONTH);
      const cert = await ensureCertificate(`CERT-DEMO-${String(certSeq++).padStart(4, '0')}`, c001.id, u.id, expires);
      await prisma.lmsEnrollment.update({ where: { id: e.id }, data: { certificateId: cert.id } });
    } else if (mod === 1) {
      await ensureEnrollment(c002.id, c002.version, u.id, { status: 'IN_PROGRESS', source: 'MATRIX', progressPct: 40 });
    } else if (mod === 2) {
      await ensureEnrollment(c001.id, c001.version, u.id, { status: 'ASSIGNED', source: 'DEPARTMENT', dueDate: at(-((i % 4) + 1) * DAY) }); // overdue
    } else {
      await ensureEnrollment(c004.id, c004.version, u.id, { status: 'ASSIGNED', source: 'ROLE', dueDate: at(((i % 10) + 3) * DAY) });
    }
  }
  console.log(`   ✓ enrollments for admin + ${Math.min(others.length, 12)} other user(s)`);

  // ── Curriculum (learning path) ──
  const curriculum = await prisma.lmsCurriculum.upsert({
    where: { code: 'CUR-DEMO-0001' },
    update: {},
    create: {
      code: 'CUR-DEMO-0001', title: 'New QA Analyst Onboarding', category: 'Onboarding',
      description: 'Mandatory courses for newly joined QA analysts.', createdById: admin.id,
    },
  });
  for (const [i, code] of ['CRS-DEMO-001', 'CRS-DEMO-002', 'CRS-DEMO-003'].entries()) {
    const cc = byCode.get(code)!;
    await prisma.lmsCurriculumCourse.upsert({
      where: { curriculumId_courseId: { curriculumId: curriculum.id, courseId: cc.id } },
      update: {}, create: { curriculumId: curriculum.id, courseId: cc.id, order: i },
    });
  }
  console.log('   ✓ curriculum CUR-DEMO-0001');

  // ── Training matrix rules ──
  const role = await prisma.role.findFirst({ where: { name: { not: 'SUPER_ADMIN' } } }) ?? (await prisma.role.findFirst());
  const dept = await prisma.department.findFirst({ where: { isActive: true } });
  const rules: { targetType: string; targetId: string; requiresType: string; requiresId: string; dueWithinDays: number; recurring: boolean }[] = [];
  if (role) rules.push({ targetType: 'ROLE', targetId: role.id, requiresType: 'COURSE', requiresId: c001.id, dueWithinDays: 30, recurring: true });
  if (dept) rules.push({ targetType: 'DEPARTMENT', targetId: dept.id, requiresType: 'CURRICULUM', requiresId: curriculum.id, dueWithinDays: 60, recurring: false });
  for (const r of rules) {
    const exists = await prisma.lmsTrainingMatrixRule.findFirst({
      where: { targetType: r.targetType as never, targetId: r.targetId, requiresType: r.requiresType as never, requiresId: r.requiresId, isDeleted: false },
    });
    if (!exists) await prisma.lmsTrainingMatrixRule.create({ data: { ...(r as never) } });
  }
  console.log(`   ✓ ${rules.length} training-matrix rule(s)`);

  console.log('✅  LMS demo data seeded.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
