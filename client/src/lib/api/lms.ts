/**
 * LMS API client (Phase 2 — authoring + content). Backend: /api/lms.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CourseType = 'DOC_ACK' | 'ELEARNING' | 'CLASSROOM' | 'BLENDED';
export type CourseStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'RETIRED';
export type ContentKind =
  | 'VIDEO'
  | 'PPT'
  | 'SLIDE_DECK'
  | 'PDF'
  | 'IMAGE'
  | 'SCORM'
  | 'EXTERNAL_LINK'
  | 'DOCUMENT_REF'
  | 'RICH_TEXT';

export interface AssetSummary {
  id: string;
  kind: ContentKind;
  title: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  page_count: number | null;
  scorm_version: string | null;
  scorm_entry_point: string | null;
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  content_type: ContentKind;
  asset_id: string | null;
  asset: AssetSummary | null;
  document_id: string | null;
  body_html: string | null;
  external_url: string | null;
  min_view_seconds: number | null;
  is_mandatory: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
  assessments: { id: string; title: string; passingScore: number }[];
}

export interface CourseSummary {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  type: CourseType;
  status: CourseStatus;
  version: number;
  is_latest_version: boolean;
  parent_course_id: string | null;
  passing_score: number | null;
  validity_months: number | null;
  estimated_minutes: number | null;
  effective_date: string | null;
  document_id: string | null;
  owner_id: string | null;
  is_catalog_visible: boolean;
  allow_self_enroll: boolean;
  published_at: string | null;
  module_count: number;
  lesson_count: number;
  created_at: string;
  updated_at: string;
}

export interface CourseDetail extends CourseSummary {
  modules: CourseModule[];
  final_assessments: { id: string; title: string; passingScore: number; maxAttempts: number }[];
}

export interface ListCoursesResponse {
  data: CourseSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateCourseBody {
  title: string;
  description?: string | null;
  category?: string | null;
  type?: CourseType;
  passing_score?: number | null;
  validity_months?: number | null;
  estimated_minutes?: number | null;
  effective_date?: string | null;
  document_id?: string | null;
  owner_id?: string | null;
  is_catalog_visible?: boolean;
  allow_self_enroll?: boolean;
}

export interface CreateLessonBody {
  title: string;
  order?: number;
  content_type?: ContentKind;
  asset_id?: string | null;
  document_id?: string | null;
  body_html?: string | null;
  external_url?: string | null;
  min_view_seconds?: number | null;
  is_mandatory?: boolean;
}

export interface CreateAssetBody {
  kind: ContentKind;
  title?: string | null;
  url?: string | null;
  file_data?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_seconds?: number | null;
  page_count?: number | null;
  scorm_version?: string | null;
  scorm_entry_point?: string | null;
}

const keys = {
  all: ['lms'] as const,
  courses: (p: Record<string, unknown>) => ['lms', 'courses', p] as const,
  course: (id: string) => ['lms', 'course', id] as const,
};

export const useCourses = (params: { search?: string; status?: CourseStatus; latest_only?: boolean } = {}) =>
  useQuery<ListCoursesResponse>({
    queryKey: keys.courses(params),
    queryFn: () => api.get('/lms/courses', { params: { ...params, page_size: 200 } }).then((r) => r.data),
  });

export const useCourse = (id: string | undefined) =>
  useQuery<CourseDetail>({
    queryKey: keys.course(id ?? ''),
    queryFn: () => api.get(`/lms/courses/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateCourse = () => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, CreateCourseBody>({
    mutationFn: (body) => api.post('/lms/courses', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateCourse = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, Partial<CreateCourseBody>>({
    mutationFn: (body) => api.patch(`/lms/courses/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteCourse = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/courses/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useSubmitCourse = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, void>({
    mutationFn: () => api.post(`/lms/courses/${id}/submit`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const usePublishCourse = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, { credential: string; meaning?: string }>({
    mutationFn: (body) => api.post(`/lms/courses/${id}/publish`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useRetireCourse = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, void>({
    mutationFn: () => api.post(`/lms/courses/${id}/retire`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useCreateVersion = (id: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, void>({
    mutationFn: () => api.post(`/lms/courses/${id}/versions`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useAddModule = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, { title: string; description?: string | null }>({
    mutationFn: (body) => api.post(`/lms/courses/${courseId}/modules`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.course(courseId) }),
  });
};

export const useUpdateModule = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, { id: string; title?: string; description?: string | null; order?: number }>({
    mutationFn: ({ id, ...body }) => api.patch(`/lms/modules/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.course(courseId) }),
  });
};

export const useDeleteModule = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/modules/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.course(courseId) }),
  });
};

export const useAddLesson = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, { moduleId: string; body: CreateLessonBody }>({
    mutationFn: ({ moduleId, body }) => api.post(`/lms/modules/${moduleId}/lessons`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.course(courseId) }),
  });
};

export const useUpdateLesson = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, { id: string; body: Partial<CreateLessonBody> }>({
    mutationFn: ({ id, body }) => api.patch(`/lms/lessons/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.course(courseId) }),
  });
};

export const useDeleteLesson = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<CourseDetail, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/lessons/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.course(courseId) }),
  });
};

export const createAsset = (body: CreateAssetBody): Promise<AssetSummary> =>
  api.post('/lms/assets', body).then((r) => r.data);

export const getAssetContent = (id: string): Promise<AssetSummary & { file_data: string | null }> =>
  api.get(`/lms/assets/${id}`).then((r) => r.data);

// ─────────────────────────── Learner (Phase 3) ───────────────────────────
export type EnrollmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'OVERDUE' | 'WAIVED';

export interface MyEnrollment {
  enrollment_id: string;
  course_id: string;
  course_version: number;
  code: string;
  title: string;
  type: CourseType;
  status: EnrollmentStatus;
  source: string;
  progress_pct: number;
  due_date: string | null;
  assigned_at: string;
  completed_at: string | null;
  score: number | null;
  certificate_id: string | null;
  estimated_minutes: number | null;
}

export interface MyLearningResponse {
  pending: number;
  overdue: number;
  items: MyEnrollment[];
}

export interface CatalogItem {
  course_id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  type: CourseType;
  estimated_minutes: number | null;
  lesson_count: number;
  enrolled: boolean;
  enrollment_status: EnrollmentStatus | null;
}

export interface LearnerLesson {
  id: string;
  title: string;
  order: number;
  content_type: ContentKind;
  asset_id: string | null;
  asset_kind: ContentKind | null;
  asset_url: string | null;
  asset_duration_seconds: number | null;
  document_id: string | null;
  body_html: string | null;
  external_url: string | null;
  min_view_seconds: number | null;
  is_mandatory: boolean;
  completed: boolean;
  seconds_viewed: number;
}

export interface LearnerCourse {
  enrollment_id: string;
  status: EnrollmentStatus;
  progress_pct: number;
  has_final_exam: boolean;
  course: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    type: CourseType;
    passing_score: number | null;
    modules: {
      id: string;
      title: string;
      description: string | null;
      order: number;
      lessons: LearnerLesson[];
    }[];
  };
}

const learnKeys = {
  my: ['lms', 'my'] as const,
  catalog: (search?: string) => ['lms', 'catalog', search] as const,
  learn: (id: string) => ['lms', 'learn', id] as const,
};

export const useMyLearning = () =>
  useQuery<MyLearningResponse>({
    queryKey: learnKeys.my,
    queryFn: () => api.get('/lms/my').then((r) => r.data),
  });

export const useCatalog = (search?: string) =>
  useQuery<{ items: CatalogItem[] }>({
    queryKey: learnKeys.catalog(search),
    queryFn: () => api.get('/lms/catalog', { params: { search } }).then((r) => r.data),
  });

export const useLearnerCourse = (enrollmentId: string | undefined) =>
  useQuery<LearnerCourse>({
    queryKey: learnKeys.learn(enrollmentId ?? ''),
    queryFn: () => api.get(`/lms/learn/${enrollmentId}`).then((r) => r.data),
    enabled: !!enrollmentId,
  });

export const useSelfEnroll = () => {
  const qc = useQueryClient();
  return useMutation<{ enrollment_id: string; already: boolean }, unknown, string>({
    mutationFn: (courseId) => api.post(`/lms/courses/${courseId}/enroll`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: learnKeys.my });
      qc.invalidateQueries({ queryKey: ['lms', 'catalog'] });
    },
  });
};

export const useLessonProgress = (enrollmentId: string) => {
  const qc = useQueryClient();
  return useMutation<LearnerCourse, unknown, { lessonId: string; seconds_viewed?: number; completed?: boolean }>({
    mutationFn: ({ lessonId, ...body }) =>
      api.post(`/lms/enrollments/${enrollmentId}/lessons/${lessonId}/progress`, body).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(learnKeys.learn(enrollmentId), data);
      qc.invalidateQueries({ queryKey: learnKeys.my });
    },
  });
};

// ─────────────────────────── Assessments / Exams (Phase 4) ───────────────────────────
export type QuestionType = 'SINGLE' | 'MULTI' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'LONG_TEXT';

export interface AuthorOption { id: string; text: string; is_correct: boolean; order: number }
export interface AuthorQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  order: number;
  explanation: string | null;
  options: AuthorOption[];
}
export interface Assessment {
  id: string;
  course_id: string | null;
  module_id: string | null;
  title: string;
  description: string | null;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  randomize_from: number | null;
  require_esign: boolean;
  total_points: number;
  questions: AuthorQuestion[];
}

export interface CreateAssessmentBody {
  title: string;
  description?: string | null;
  passing_score?: number;
  max_attempts?: number;
  time_limit_minutes?: number | null;
  shuffle_questions?: boolean;
  randomize_from?: number | null;
  require_esign?: boolean;
}
export interface CreateQuestionBody {
  type: QuestionType;
  prompt: string;
  points?: number;
  order?: number;
  explanation?: string | null;
  options?: { text: string; is_correct?: boolean; order?: number }[];
}

// Learner-facing exam shapes
export interface ExamInfo {
  has_exam: boolean;
  enrollment_id?: string;
  assessment_id?: string;
  title?: string;
  description?: string | null;
  passing_score?: number;
  max_attempts?: number;
  time_limit_minutes?: number | null;
  require_esign?: boolean;
  question_count?: number;
  attempts_used?: number;
  attempts_left?: number;
  best_score?: number | null;
  passed?: boolean;
  in_progress_attempt_id?: string | null;
}
export interface AttemptQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
}
export interface ActiveAttempt {
  attempt_id: string;
  assessment_id: string;
  title: string;
  passing_score: number;
  time_limit_minutes: number | null;
  require_esign: boolean;
  started_at: string;
  questions: AttemptQuestion[];
}
export interface AttemptResult {
  attempt_id: string;
  assessment_id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  score: number | null;
  passed: boolean | null;
  attempt_no: number;
  submitted_at: string | null;
  passing_score: number;
  review:
    | {
        question_id: string;
        prompt?: string;
        type?: QuestionType;
        awarded_points: number | null;
        max_points?: number;
        is_correct: boolean | null;
        explanation: string | null;
      }[]
    | null;
}
export interface GradingQueueItem {
  attempt_id: string;
  assessment_title: string;
  user_id: string;
  user_name: string | null;
  attempt_no: number;
  submitted_at: string | null;
}
export interface GraderAttempt {
  attempt_id: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  user_id: string;
  answers: {
    question_id: string;
    prompt?: string;
    type?: QuestionType;
    max_points?: number;
    awarded_points: number | null;
    text_answer: string | null;
    selected_option_ids: string[];
    needs_grading: boolean;
  }[];
}

const examKeys = {
  forCourse: (courseId: string) => ['lms', 'assessments', courseId] as const,
  assessment: (id: string) => ['lms', 'assessment', id] as const,
  examInfo: (enrollmentId: string) => ['lms', 'exam', enrollmentId] as const,
  gradingQueue: ['lms', 'grading', 'queue'] as const,
  graderAttempt: (id: string) => ['lms', 'grading', id] as const,
};

export const useCourseAssessments = (courseId: string | undefined) =>
  useQuery<Assessment[]>({
    queryKey: examKeys.forCourse(courseId ?? ''),
    queryFn: () => api.get(`/lms/courses/${courseId}/assessments`).then((r) => r.data),
    enabled: !!courseId,
  });

export const useCreateCourseAssessment = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<Assessment, unknown, CreateAssessmentBody>({
    mutationFn: (body) => api.post(`/lms/courses/${courseId}/assessments`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.forCourse(courseId) }),
  });
};

export const useDeleteAssessment = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/assessments/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.forCourse(courseId) }),
  });
};

export const useAddQuestion = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<Assessment, unknown, { assessmentId: string; body: CreateQuestionBody }>({
    mutationFn: ({ assessmentId, body }) => api.post(`/lms/assessments/${assessmentId}/questions`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.forCourse(courseId) }),
  });
};

export const useDeleteQuestion = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation<Assessment, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/questions/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.forCourse(courseId) }),
  });
};

export const useExamInfo = (enrollmentId: string | undefined) =>
  useQuery<ExamInfo>({
    queryKey: examKeys.examInfo(enrollmentId ?? ''),
    queryFn: () => api.get(`/lms/enrollments/${enrollmentId}/exam`).then((r) => r.data),
    enabled: !!enrollmentId,
  });

export const startAttempt = (assessmentId: string): Promise<ActiveAttempt> =>
  api.post(`/lms/assessments/${assessmentId}/attempts`, {}).then((r) => r.data);

export const submitAttempt = (
  attemptId: string,
  body: { answers: { question_id: string; selected_option_ids?: string[]; text_answer?: string | null }[]; credential?: string; meaning?: string },
): Promise<AttemptResult> => api.post(`/lms/attempts/${attemptId}/submit`, body).then((r) => r.data);

export const useGradingQueue = () =>
  useQuery<GradingQueueItem[]>({
    queryKey: examKeys.gradingQueue,
    queryFn: () => api.get('/lms/grading/queue').then((r) => r.data),
  });

export const useGraderAttempt = (id: string | undefined) =>
  useQuery<GraderAttempt>({
    queryKey: examKeys.graderAttempt(id ?? ''),
    queryFn: () => api.get(`/lms/grading/attempts/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useGradeAttempt = () => {
  const qc = useQueryClient();
  return useMutation<GraderAttempt, unknown, { attemptId: string; grades: { question_id: string; awarded_points: number }[] }>({
    mutationFn: ({ attemptId, grades }) => api.post(`/lms/grading/attempts/${attemptId}`, { grades }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.gradingQueue }),
  });
};

// ─────────────────────────── Assignment + Matrix (Phase 5) ───────────────────────────
export interface AssignBody {
  user_ids?: string[];
  role_id?: string;
  department_id?: string;
  site_id?: string;
  due_date?: string | null;
}

export interface Curriculum {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  courses: { id: string; course_id: string; order: number; is_mandatory: boolean; title: string; code: string; status: CourseStatus }[];
}

export type MatrixTargetType = 'ROLE' | 'DEPARTMENT' | 'SITE' | 'JOB_FUNCTION';
export type MatrixRequiresType = 'COURSE' | 'CURRICULUM';

export interface MatrixRule {
  id: string;
  target_type: MatrixTargetType;
  target_id: string;
  requires_type: MatrixRequiresType;
  requires_id: string;
  due_within_days: number | null;
  recurring: boolean;
  is_active: boolean;
}

const assignKeys = {
  curricula: ['lms', 'curricula'] as const,
  matrix: ['lms', 'matrix'] as const,
};

export const useAssignCourse = () =>
  useMutation<{ assigned: number; targeted: number }, unknown, { courseId: string; body: AssignBody }>({
    mutationFn: ({ courseId, body }) => api.post(`/lms/courses/${courseId}/assign`, body).then((r) => r.data),
  });

export const useCurricula = () =>
  useQuery<Curriculum[]>({
    queryKey: assignKeys.curricula,
    queryFn: () => api.get('/lms/curricula').then((r) => r.data),
  });

export const useCreateCurriculum = () => {
  const qc = useQueryClient();
  return useMutation<Curriculum, unknown, { title: string; description?: string | null; category?: string | null; course_ids?: string[] }>({
    mutationFn: (body) => api.post('/lms/curricula', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignKeys.curricula }),
  });
};

export const useUpdateCurriculum = () => {
  const qc = useQueryClient();
  return useMutation<Curriculum, unknown, { id: string; body: Partial<{ title: string; description: string | null; category: string | null; is_active: boolean; course_ids: string[] }> }>({
    mutationFn: ({ id, body }) => api.patch(`/lms/curricula/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignKeys.curricula }),
  });
};

export const useDeleteCurriculum = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/curricula/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignKeys.curricula }),
  });
};

export const useAssignCurriculum = () =>
  useMutation<{ assigned: number; targeted: number }, unknown, { id: string; body: AssignBody }>({
    mutationFn: ({ id, body }) => api.post(`/lms/curricula/${id}/assign`, body).then((r) => r.data),
  });

export const useMatrixRules = () =>
  useQuery<MatrixRule[]>({
    queryKey: assignKeys.matrix,
    queryFn: () => api.get('/lms/matrix').then((r) => r.data),
  });

export const useCreateMatrixRule = () => {
  const qc = useQueryClient();
  return useMutation<MatrixRule, unknown, Omit<MatrixRule, 'id'>>({
    mutationFn: (body) => api.post('/lms/matrix', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignKeys.matrix }),
  });
};

export const useDeleteMatrixRule = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/lms/matrix/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignKeys.matrix }),
  });
};

export const useSyncMatrix = () => {
  const qc = useQueryClient();
  return useMutation<{ rules: number; created: number; reopened: number }, unknown, void>({
    mutationFn: () => api.post('/lms/matrix/sync', {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lms', 'my'] }),
  });
};

// ─────────────────────────── Certificates + Reporting (Phase 6) ───────────────────────────
export interface MyCertificate {
  id: string;
  serial: string;
  course_id: string;
  course_title: string;
  course_code: string;
  issued_at: string;
  expires_at: string | null;
  expired: boolean;
  verify_token: string | null;
}
export interface CertificateDetail {
  id: string;
  serial: string;
  course_title: string;
  course_code: string;
  holder_name: string | null;
  issued_at: string;
  expires_at: string | null;
  expired: boolean;
  verify_token: string | null;
}
export interface CertVerifyResult {
  valid: boolean;
  expired?: boolean;
  serial?: string;
  course_title?: string;
  holder_name?: string | null;
  issued_at?: string;
  expires_at?: string | null;
}
export interface ReportBreakdownRow {
  key: string;
  name: string;
  total: number;
  completed: number;
  overdue: number;
  completion_rate: number;
}
export interface ComplianceReport {
  summary: {
    total: number;
    completed: number;
    in_progress: number;
    failed: number;
    overdue: number;
    completion_rate: number;
    matrix_total: number;
    matrix_coverage: number;
  };
  by_department: ReportBreakdownRow[];
  by_role: ReportBreakdownRow[];
  by_site: ReportBreakdownRow[];
  assessment: {
    attempts: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_score: number;
    learners: number;
  };
  expiring_certificates: { id: string; serial: string; course_title: string; holder_name: string | null; expires_at: string | null }[];
}
// Optional filters for the compliance dashboard + CSV export (all AND-ed).
export interface ReportFilter {
  department_id?: string;
  role_id?: string;
  site_id?: string;
  course_id?: string;
  from?: string;
  to?: string;
}
export interface Transcript {
  user_id: string;
  user_name: string | null;
  items: {
    enrollment_id: string;
    course_code: string;
    course_title: string;
    course_type: CourseType;
    course_version: number;
    status: EnrollmentStatus;
    source: string;
    progress_pct: number;
    score: number | null;
    due_date: string | null;
    assigned_at: string;
    completed_at: string | null;
    certificate_serial: string | null;
    certificate_expires_at: string | null;
    certificate_expired: boolean;
  }[];
}

export const useMyCertificates = () =>
  useQuery<MyCertificate[]>({
    queryKey: ['lms', 'my-certs'],
    queryFn: () => api.get('/lms/my/certificates').then((r) => r.data),
  });

export const useCertificate = (id: string | undefined) =>
  useQuery<CertificateDetail>({
    queryKey: ['lms', 'cert', id ?? ''],
    queryFn: () => api.get(`/lms/certificates/${id}`).then((r) => r.data),
    enabled: !!id,
  });

// Strip empty filter values so the query key + request params stay stable.
const cleanFilter = (f: ReportFilter = {}) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v !== ''));

export const useComplianceReport = (filter: ReportFilter = {}) =>
  useQuery<ComplianceReport>({
    queryKey: ['lms', 'report', 'compliance', cleanFilter(filter)],
    queryFn: () => api.get('/lms/reports/compliance', { params: cleanFilter(filter) }).then((r) => r.data),
  });

// Download the enrollment-level training-records CSV for the current filter.
export const downloadEnrollmentsCsv = async (filter: ReportFilter = {}) => {
  const res = await api.get('/lms/reports/enrollments.csv', {
    params: cleanFilter(filter),
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lms-training-records.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export const useTranscript = (userId: string | undefined) =>
  useQuery<Transcript>({
    queryKey: ['lms', 'report', 'transcript', userId ?? ''],
    queryFn: () => api.get(`/lms/reports/transcript/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });

// Public verify (no auth) — used by the standalone verify page.
export const verifyCertificate = (token: string): Promise<CertVerifyResult> =>
  api.get(`/public/lms/certificates/verify/${token}`).then((r) => r.data);
