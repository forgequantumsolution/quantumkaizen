/**
 * LMS routes — mounted at /api/lms (Phase 2: authoring + content).
 * Permission keys: lms_course.read / .write / .publish (see rbac-catalog.ts).
 */
import { Router } from 'express';
import * as ctrl from './lms.controller';
import {
  AssignCourseSchema,
  CatalogQuerySchema,
  CreateAssessmentSchema,
  CreateAssetSchema,
  CreateCourseSchema,
  CreateCurriculumSchema,
  CreateLessonSchema,
  CreateMatrixRuleSchema,
  CreateModuleSchema,
  CreateQuestionSchema,
  EnrollmentLessonParamSchema,
  GradeAttemptSchema,
  IdParamSchema,
  LessonProgressSchema,
  ListCoursesQuerySchema,
  PublishCourseSchema,
  SubmitAttemptSchema,
  UpdateAssessmentSchema,
  UpdateCourseSchema,
  UpdateCurriculumSchema,
  UpdateLessonSchema,
  UpdateMatrixRuleSchema,
  UpdateModuleSchema,
  UpdateQuestionSchema,
  UserIdParamSchema,
} from './lms.schema';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();
router.use(requireAuth);

// ── Learner (Phase 3) — declared before /courses/:id to avoid param capture ──
router.get('/my', requirePermission('lms_my.read'), asyncHandler(ctrl.myLearning));
router.get('/catalog', requirePermission('lms_my.read'), validate(CatalogQuerySchema, 'query'), asyncHandler(ctrl.catalog));
router.get('/learn/:id', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.learnerCourse));
router.get('/my/certificates', requirePermission('lms_my.read'), asyncHandler(ctrl.myCertificates));
router.get('/certificates/:id', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getCertificate));
router.post('/enrollments/:id/lessons/:lessonId/progress', requirePermission('lms_my.read'), validate(EnrollmentLessonParamSchema, 'params'), validate(LessonProgressSchema), asyncHandler(ctrl.lessonProgress));

// ── Courses ──
router.get('/courses', requirePermission('lms_course.read'), validate(ListCoursesQuerySchema, 'query'), asyncHandler(ctrl.listCourses));
router.post('/courses', requirePermission('lms_course.write'), validate(CreateCourseSchema), asyncHandler(ctrl.createCourse));
router.get('/courses/:id', requirePermission('lms_course.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getCourse));
router.patch('/courses/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), validate(UpdateCourseSchema), asyncHandler(ctrl.updateCourse));
router.delete('/courses/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteCourse));
router.post('/courses/:id/submit', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.submitCourse));
router.post('/courses/:id/publish', requirePermission('lms_course.publish'), validate(IdParamSchema, 'params'), validate(PublishCourseSchema), asyncHandler(ctrl.publishCourse));
router.post('/courses/:id/retire', requirePermission('lms_course.publish'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.retireCourse));
router.post('/courses/:id/versions', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.createVersion));
router.post('/courses/:id/enroll', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.enroll));

// ── Modules (nested under a course for create; by id otherwise) ──
router.post('/courses/:id/modules', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), validate(CreateModuleSchema), asyncHandler(ctrl.addModule));
router.patch('/modules/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), validate(UpdateModuleSchema), asyncHandler(ctrl.updateModule));
router.delete('/modules/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteModule));

// ── Lessons (nested under a module for create; by id otherwise) ──
router.post('/modules/:id/lessons', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), validate(CreateLessonSchema), asyncHandler(ctrl.addLesson));
router.patch('/lessons/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), validate(UpdateLessonSchema), asyncHandler(ctrl.updateLesson));
router.delete('/lessons/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteLesson));

// ── Content assets ──
router.post('/assets', requirePermission('lms_course.write'), validate(CreateAssetSchema), asyncHandler(ctrl.createAsset));
router.get('/assets/:id', requirePermission('lms_course.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getAsset));

// ── Assessment authoring (Phase 4) ──
router.get('/courses/:id/assessments', requirePermission('lms_assessment.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.listAssessments));
router.post('/courses/:id/assessments', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), validate(CreateAssessmentSchema), asyncHandler(ctrl.createCourseAssessment));
router.post('/modules/:id/assessments', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), validate(CreateAssessmentSchema), asyncHandler(ctrl.createModuleAssessment));
router.get('/assessments/:id', requirePermission('lms_assessment.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getAssessment));
router.patch('/assessments/:id', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), validate(UpdateAssessmentSchema), asyncHandler(ctrl.updateAssessment));
router.delete('/assessments/:id', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteAssessment));
router.post('/assessments/:id/questions', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), validate(CreateQuestionSchema), asyncHandler(ctrl.addQuestion));
router.patch('/questions/:id', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), validate(UpdateQuestionSchema), asyncHandler(ctrl.updateQuestion));
router.delete('/questions/:id', requirePermission('lms_assessment.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteQuestion));

// ── Exam taking (Phase 4) ──
router.get('/enrollments/:id/exam', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.examInfo));
router.post('/assessments/:id/attempts', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.startAttempt));
router.post('/attempts/:id/submit', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), validate(SubmitAttemptSchema), asyncHandler(ctrl.submitAttempt));
router.get('/attempts/:id', requirePermission('lms_my.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.attemptResult));

// ── Grading (Phase 4b) ──
router.get('/grading/queue', requirePermission('lms_assessment.grade'), asyncHandler(ctrl.gradingQueue));
router.get('/grading/attempts/:id', requirePermission('lms_assessment.grade'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.attemptForGrader));
router.post('/grading/attempts/:id', requirePermission('lms_assessment.grade'), validate(IdParamSchema, 'params'), validate(GradeAttemptSchema), asyncHandler(ctrl.gradeAttempt));

// ── Assignment (Phase 5) ──
router.post('/courses/:id/assign', requirePermission('lms_enrollment.assign'), validate(IdParamSchema, 'params'), validate(AssignCourseSchema), asyncHandler(ctrl.assignCourse));

// ── Curricula (Phase 5) ──
router.get('/curricula', requirePermission('lms_enrollment.read'), asyncHandler(ctrl.listCurricula));
router.post('/curricula', requirePermission('lms_course.write'), validate(CreateCurriculumSchema), asyncHandler(ctrl.createCurriculum));
router.get('/curricula/:id', requirePermission('lms_enrollment.read'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.getCurriculum));
router.patch('/curricula/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), validate(UpdateCurriculumSchema), asyncHandler(ctrl.updateCurriculum));
router.delete('/curricula/:id', requirePermission('lms_course.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteCurriculum));
router.post('/curricula/:id/assign', requirePermission('lms_enrollment.assign'), validate(IdParamSchema, 'params'), validate(AssignCourseSchema), asyncHandler(ctrl.assignCurriculum));

// ── Training matrix (Phase 5) ──
router.get('/matrix', requirePermission('lms_matrix.read'), asyncHandler(ctrl.listMatrixRules));
router.post('/matrix', requirePermission('lms_matrix.write'), validate(CreateMatrixRuleSchema), asyncHandler(ctrl.createMatrixRule));
router.patch('/matrix/:id', requirePermission('lms_matrix.write'), validate(IdParamSchema, 'params'), validate(UpdateMatrixRuleSchema), asyncHandler(ctrl.updateMatrixRule));
router.delete('/matrix/:id', requirePermission('lms_matrix.write'), validate(IdParamSchema, 'params'), asyncHandler(ctrl.deleteMatrixRule));
router.post('/matrix/sync', requirePermission('lms_matrix.write'), asyncHandler(ctrl.syncMatrix));

// ── Reporting (Phase 6) ──
router.get('/reports/compliance', requirePermission('lms_report.read'), asyncHandler(ctrl.complianceReport));
router.get('/reports/transcript/:userId', requirePermission('lms_report.read'), validate(UserIdParamSchema, 'params'), asyncHandler(ctrl.transcript));

export default router;
