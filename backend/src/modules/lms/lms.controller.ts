import type { Request, Response } from 'express';
import * as service from './lms.service';
import * as learn from './lms-learn.service';
import * as exam from './lms-assessment.service';
import * as attempt from './lms-exam.service';
import * as assign from './lms-assign.service';
import * as report from './lms-report.service';
import type {
  AssignCourseInput,
  CreateAssessmentInput,
  CreateAssetInput,
  CreateCourseInput,
  CreateCurriculumInput,
  CreateLessonInput,
  CreateMatrixRuleInput,
  CreateModuleInput,
  CreateQuestionInput,
  GradeAttemptInput,
  LessonProgressInput,
  ListCoursesQuery,
  PublishCourseInput,
  SubmitAttemptInput,
  UpdateAssessmentInput,
  UpdateCourseInput,
  UpdateCurriculumInput,
  UpdateLessonInput,
  UpdateMatrixRuleInput,
  UpdateModuleInput,
  UpdateQuestionInput,
} from './lms.schema';

const uid = (req: Request) => req.user?.userId;

const requireUid = (req: Request, res: Response): string | null => {
  const id = uid(req);
  if (!id) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return null;
  }
  return id;
};

// ── Courses ──
export const listCourses = async (req: Request, res: Response) => {
  res.json(await service.listCourses(req.query as unknown as ListCoursesQuery));
};
export const getCourse = async (req: Request, res: Response) => {
  res.json(await service.getCourse(req.params.id as string));
};
export const createCourse = async (req: Request, res: Response) => {
  res.status(201).json(await service.createCourse(req.body as CreateCourseInput, uid(req)));
};
export const updateCourse = async (req: Request, res: Response) => {
  res.json(await service.updateCourse(req.params.id as string, req.body as UpdateCourseInput, uid(req)));
};
export const deleteCourse = async (req: Request, res: Response) => {
  await service.deleteCourse(req.params.id as string, uid(req));
  res.status(204).send();
};
export const submitCourse = async (req: Request, res: Response) => {
  res.json(await service.submitCourse(req.params.id as string, uid(req)));
};
export const publishCourse = async (req: Request, res: Response) => {
  res.json(await service.publishCourse(req.params.id as string, req.body as PublishCourseInput, uid(req)));
};
export const retireCourse = async (req: Request, res: Response) => {
  res.json(await service.retireCourse(req.params.id as string, uid(req)));
};
export const createVersion = async (req: Request, res: Response) => {
  res.status(201).json(await service.createVersion(req.params.id as string, uid(req)));
};

// ── Modules ──
export const addModule = async (req: Request, res: Response) => {
  res.status(201).json(await service.addModule(req.params.id as string, req.body as CreateModuleInput, uid(req)));
};
export const updateModule = async (req: Request, res: Response) => {
  res.json(await service.updateModule(req.params.id as string, req.body as UpdateModuleInput, uid(req)));
};
export const deleteModule = async (req: Request, res: Response) => {
  res.json(await service.deleteModule(req.params.id as string, uid(req)));
};

// ── Lessons ──
export const addLesson = async (req: Request, res: Response) => {
  res.status(201).json(await service.addLesson(req.params.id as string, req.body as CreateLessonInput, uid(req)));
};
export const updateLesson = async (req: Request, res: Response) => {
  res.json(await service.updateLesson(req.params.id as string, req.body as UpdateLessonInput, uid(req)));
};
export const deleteLesson = async (req: Request, res: Response) => {
  res.json(await service.deleteLesson(req.params.id as string, uid(req)));
};

// ── Assets ──
export const createAsset = async (req: Request, res: Response) => {
  res.status(201).json(await service.createAsset(req.body as CreateAssetInput, uid(req)));
};
export const getAsset = async (req: Request, res: Response) => {
  res.json(await service.getAsset(req.params.id as string));
};

// ── Learner (Phase 3) ──
export const myLearning = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await learn.listMyEnrollments(id));
};
export const catalog = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await learn.listCatalog(id, req.query.search as string | undefined));
};
export const enroll = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.status(201).json(await learn.selfEnroll(req.params.id as string, id));
};
export const learnerCourse = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await learn.getLearnerCourse(req.params.id as string, id));
};
export const lessonProgress = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(
    await learn.updateLessonProgress(
      req.params.id as string,
      req.params.lessonId as string,
      req.body as LessonProgressInput,
      id,
    ),
  );
};

// ── Assessment authoring (Phase 4) ──
export const listAssessments = async (req: Request, res: Response) => {
  res.json(await exam.listForCourse(req.params.id as string));
};
export const getAssessment = async (req: Request, res: Response) => {
  res.json(await exam.getAssessment(req.params.id as string));
};
export const createCourseAssessment = async (req: Request, res: Response) => {
  res.status(201).json(await exam.createAssessment({ courseId: req.params.id as string }, req.body as CreateAssessmentInput, uid(req)));
};
export const createModuleAssessment = async (req: Request, res: Response) => {
  res.status(201).json(await exam.createAssessment({ moduleId: req.params.id as string }, req.body as CreateAssessmentInput, uid(req)));
};
export const updateAssessment = async (req: Request, res: Response) => {
  res.json(await exam.updateAssessment(req.params.id as string, req.body as UpdateAssessmentInput, uid(req)));
};
export const deleteAssessment = async (req: Request, res: Response) => {
  await exam.deleteAssessment(req.params.id as string, uid(req));
  res.status(204).send();
};
export const addQuestion = async (req: Request, res: Response) => {
  res.status(201).json(await exam.addQuestion(req.params.id as string, req.body as CreateQuestionInput, uid(req)));
};
export const updateQuestion = async (req: Request, res: Response) => {
  res.json(await exam.updateQuestion(req.params.id as string, req.body as UpdateQuestionInput, uid(req)));
};
export const deleteQuestion = async (req: Request, res: Response) => {
  res.json(await exam.deleteQuestion(req.params.id as string, uid(req)));
};

// ── Exam taking (Phase 4) ──
export const examInfo = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await attempt.getExamForEnrollment(req.params.id as string, id));
};
export const startAttempt = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.status(201).json(await attempt.startAttempt(req.params.id as string, id));
};
export const submitAttempt = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await attempt.submitAttempt(req.params.id as string, req.body as SubmitAttemptInput, id));
};
export const attemptResult = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await attempt.getAttemptResult(req.params.id as string, id));
};

// ── Grading (Phase 4b) ──
export const gradingQueue = async (_req: Request, res: Response) => {
  res.json(await attempt.listGradingQueue());
};
export const attemptForGrader = async (req: Request, res: Response) => {
  res.json(await attempt.getAttemptResultForGrader(req.params.id as string));
};
export const gradeAttempt = async (req: Request, res: Response) => {
  res.json(await attempt.gradeAttempt(req.params.id as string, req.body as GradeAttemptInput, uid(req)));
};

// ── Assignment + Matrix (Phase 5) ──
export const assignCourse = async (req: Request, res: Response) => {
  res.json(await assign.assignCourse(req.params.id as string, req.body as AssignCourseInput, uid(req)));
};
export const listCurricula = async (_req: Request, res: Response) => {
  res.json(await assign.listCurricula());
};
export const getCurriculum = async (req: Request, res: Response) => {
  res.json(await assign.getCurriculum(req.params.id as string));
};
export const createCurriculum = async (req: Request, res: Response) => {
  res.status(201).json(await assign.createCurriculum(req.body as CreateCurriculumInput, uid(req)));
};
export const updateCurriculum = async (req: Request, res: Response) => {
  res.json(await assign.updateCurriculum(req.params.id as string, req.body as UpdateCurriculumInput, uid(req)));
};
export const deleteCurriculum = async (req: Request, res: Response) => {
  await assign.deleteCurriculum(req.params.id as string, uid(req));
  res.status(204).send();
};
export const assignCurriculum = async (req: Request, res: Response) => {
  res.json(await assign.assignCurriculum(req.params.id as string, req.body as AssignCourseInput, uid(req)));
};
export const listMatrixRules = async (_req: Request, res: Response) => {
  res.json(await assign.listMatrixRules());
};
export const createMatrixRule = async (req: Request, res: Response) => {
  res.status(201).json(await assign.createMatrixRule(req.body as CreateMatrixRuleInput, uid(req)));
};
export const updateMatrixRule = async (req: Request, res: Response) => {
  res.json(await assign.updateMatrixRule(req.params.id as string, req.body as UpdateMatrixRuleInput, uid(req)));
};
export const deleteMatrixRule = async (req: Request, res: Response) => {
  await assign.deleteMatrixRule(req.params.id as string, uid(req));
  res.status(204).send();
};
export const syncMatrix = async (req: Request, res: Response) => {
  res.json(await assign.syncMatrix(uid(req)));
};

// ── Certificates + Reporting (Phase 6) ──
export const myCertificates = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await report.listMyCertificates(id));
};
export const getCertificate = async (req: Request, res: Response) => {
  const id = requireUid(req, res);
  if (!id) return;
  res.json(await report.getCertificate(req.params.id as string, id));
};
export const verifyCertificate = async (req: Request, res: Response) => {
  res.json(await report.verifyCertificate(req.params.token as string));
};
export const complianceReport = async (_req: Request, res: Response) => {
  res.json(await report.complianceReport());
};
export const transcript = async (req: Request, res: Response) => {
  res.json(await report.transcript(req.params.userId as string));
};
