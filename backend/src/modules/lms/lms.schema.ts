import { z } from 'zod';

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const UserIdParamSchema = z.object({ userId: z.string().uuid() });
export const TokenParamSchema = z.object({ token: z.string().min(8).max(100) });

// ─────────────────────────── Courses ───────────────────────────
export const ListCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED']).optional(),
  type: z.enum(['DOC_ACK', 'ELEARNING', 'CLASSROOM', 'BLENDED']).optional(),
  category: z.string().optional(),
  latest_only: z.coerce.boolean().optional(),
});

export const CreateCourseSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  type: z.enum(['DOC_ACK', 'ELEARNING', 'CLASSROOM', 'BLENDED']).default('ELEARNING'),
  passing_score: z.number().int().min(0).max(100).optional().nullable(),
  validity_months: z.number().int().min(1).max(120).optional().nullable(),
  estimated_minutes: z.number().int().min(0).optional().nullable(),
  effective_date: z.string().optional().nullable(),
  document_id: z.string().optional().nullable(),
  owner_id: z.string().optional().nullable(),
  is_catalog_visible: z.boolean().optional(),
  allow_self_enroll: z.boolean().optional(),
});

export const UpdateCourseSchema = CreateCourseSchema.partial();

// Publish requires an e-signature credential (PIN or password).
export const PublishCourseSchema = z.object({
  credential: z.string().min(1),
  meaning: z.string().max(300).optional(),
});

// ─────────────────────────── Modules ───────────────────────────
export const CreateModuleSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  order: z.number().int().min(0).optional(),
});
export const UpdateModuleSchema = CreateModuleSchema.partial();

// ─────────────────────────── Lessons ───────────────────────────
const ContentKind = z.enum([
  'VIDEO',
  'PPT',
  'SLIDE_DECK',
  'PDF',
  'IMAGE',
  'SCORM',
  'EXTERNAL_LINK',
  'DOCUMENT_REF',
  'RICH_TEXT',
]);

export const CreateLessonSchema = z.object({
  title: z.string().min(1).max(300),
  order: z.number().int().min(0).optional(),
  content_type: ContentKind.default('VIDEO'),
  asset_id: z.string().uuid().optional().nullable(),
  document_id: z.string().optional().nullable(),
  body_html: z.string().max(100_000).optional().nullable(),
  external_url: z.string().url().max(2000).optional().nullable(),
  min_view_seconds: z.number().int().min(0).optional().nullable(),
  is_mandatory: z.boolean().optional(),
});
export const UpdateLessonSchema = CreateLessonSchema.partial();

// ─────────────────────────── Content assets ───────────────────────────
// Either an external URL (recommended for VIDEO) or an inline base64 data URL
// (for smaller PDF/PPT/slide/image files) — mirrors the DMS inline storage.
const MAX_FILE_DATA = 20_000_000; // base64 chars ≈ ~15MB binary

export const CreateAssetSchema = z
  .object({
    kind: ContentKind,
    title: z.string().max(300).optional().nullable(),
    url: z.string().url().max(2000).optional().nullable(),
    file_data: z.string().max(MAX_FILE_DATA).optional().nullable(), // base64 data URL
    mime_type: z.string().max(200).optional().nullable(),
    size_bytes: z.number().int().min(0).optional().nullable(),
    duration_seconds: z.number().int().min(0).optional().nullable(),
    page_count: z.number().int().min(0).optional().nullable(),
    scorm_version: z.string().max(20).optional().nullable(),
    scorm_entry_point: z.string().max(500).optional().nullable(),
  })
  .refine((d) => !!d.url || !!d.file_data, {
    message: 'Provide either a url or file_data',
  });

// ─────────────────────────── Learner (Phase 3) ───────────────────────────
export const CatalogQuerySchema = z.object({ search: z.string().optional() });

export const LessonProgressSchema = z.object({
  seconds_viewed: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export const EnrollmentLessonParamSchema = z.object({
  id: z.string().uuid(), // enrollment id
  lessonId: z.string().uuid(),
});

export type LessonProgressInput = z.infer<typeof LessonProgressSchema>;

// ─────────────────────────── Assessments / Exams (Phase 4) ───────────────────────────
export const CreateAssessmentSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  passing_score: z.number().int().min(0).max(100).optional(),
  max_attempts: z.number().int().min(1).max(20).optional(),
  time_limit_minutes: z.number().int().min(1).max(600).optional().nullable(),
  shuffle_questions: z.boolean().optional(),
  randomize_from: z.number().int().min(1).optional().nullable(),
  require_esign: z.boolean().optional(),
});
export const UpdateAssessmentSchema = CreateAssessmentSchema.partial();

const QuestionType = z.enum(['SINGLE', 'MULTI', 'TRUE_FALSE', 'SHORT_TEXT', 'LONG_TEXT']);

const QuestionOptionInput = z.object({
  text: z.string().min(1).max(1000),
  is_correct: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export const CreateQuestionSchema = z
  .object({
    type: QuestionType,
    prompt: z.string().min(1).max(4000),
    points: z.number().int().min(1).max(100).optional(),
    order: z.number().int().min(0).optional(),
    explanation: z.string().max(2000).optional().nullable(),
    options: z.array(QuestionOptionInput).optional(),
  })
  .refine(
    (q) =>
      ['SHORT_TEXT', 'LONG_TEXT'].includes(q.type) ||
      (q.options && q.options.length >= 2 && q.options.some((o) => o.is_correct)),
    { message: 'Choice questions need at least two options with one marked correct' },
  );

export const UpdateQuestionSchema = z.object({
  prompt: z.string().min(1).max(4000).optional(),
  points: z.number().int().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  explanation: z.string().max(2000).optional().nullable(),
  options: z.array(QuestionOptionInput).optional(), // replaces the option set
});

export const SubmitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        selected_option_ids: z.array(z.string().uuid()).optional(),
        text_answer: z.string().max(10000).optional().nullable(),
      }),
    )
    .default([]),
  credential: z.string().optional(), // required when the assessment requires an e-sign
  meaning: z.string().max(300).optional(),
});

export const GradeAttemptSchema = z.object({
  grades: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        awarded_points: z.number().min(0),
      }),
    )
    .min(1),
});

export const AttemptIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof UpdateAssessmentSchema>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;
export type GradeAttemptInput = z.infer<typeof GradeAttemptSchema>;

// ─────────────────────────── Assignment + Matrix (Phase 5) ───────────────────────────
export const AssignCourseSchema = z
  .object({
    user_ids: z.array(z.string().uuid()).optional(),
    role_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    site_id: z.string().uuid().optional(),
    due_date: z.string().optional().nullable(),
  })
  .refine(
    (d) => (d.user_ids && d.user_ids.length) || d.role_id || d.department_id || d.site_id,
    { message: 'Provide at least one target (users, role, department or site)' },
  );

export const CreateCurriculumSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  course_ids: z.array(z.string().uuid()).optional(),
});
export const UpdateCurriculumSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  is_active: z.boolean().optional(),
  course_ids: z.array(z.string().uuid()).optional(),
});

const MatrixTargetType = z.enum(['ROLE', 'DEPARTMENT', 'SITE', 'JOB_FUNCTION']);
const MatrixRequiresType = z.enum(['COURSE', 'CURRICULUM']);

export const CreateMatrixRuleSchema = z.object({
  target_type: MatrixTargetType,
  target_id: z.string().min(1),
  requires_type: MatrixRequiresType,
  requires_id: z.string().uuid(),
  due_within_days: z.number().int().min(1).max(365).optional().nullable(),
  recurring: z.boolean().optional(),
  is_active: z.boolean().optional(),
});
export const UpdateMatrixRuleSchema = CreateMatrixRuleSchema.partial();

export type AssignCourseInput = z.infer<typeof AssignCourseSchema>;
export type CreateCurriculumInput = z.infer<typeof CreateCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof UpdateCurriculumSchema>;
export type CreateMatrixRuleInput = z.infer<typeof CreateMatrixRuleSchema>;
export type UpdateMatrixRuleInput = z.infer<typeof UpdateMatrixRuleSchema>;

export type ListCoursesQuery = z.infer<typeof ListCoursesQuerySchema>;
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;
export type PublishCourseInput = z.infer<typeof PublishCourseSchema>;
export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>;
export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
