-- CreateEnum
CREATE TYPE "LmsCourseType" AS ENUM ('DOC_ACK', 'ELEARNING', 'CLASSROOM', 'BLENDED');

-- CreateEnum
CREATE TYPE "LmsCourseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "LmsContentKind" AS ENUM ('VIDEO', 'PPT', 'SLIDE_DECK', 'PDF', 'IMAGE', 'SCORM', 'EXTERNAL_LINK', 'DOCUMENT_REF', 'RICH_TEXT');

-- CreateEnum
CREATE TYPE "LmsQuestionType" AS ENUM ('SINGLE', 'MULTI', 'TRUE_FALSE', 'SHORT_TEXT', 'LONG_TEXT');

-- CreateEnum
CREATE TYPE "LmsAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "LmsEnrollmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "LmsEnrollmentSource" AS ENUM ('DIRECT', 'ROLE', 'DEPARTMENT', 'SITE', 'CURRICULUM', 'MATRIX', 'SELF');

-- CreateEnum
CREATE TYPE "LmsMatrixTargetType" AS ENUM ('ROLE', 'DEPARTMENT', 'SITE', 'JOB_FUNCTION');

-- CreateEnum
CREATE TYPE "LmsMatrixRequiresType" AS ENUM ('COURSE', 'CURRICULUM');

-- CreateEnum
CREATE TYPE "LmsSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LmsAttendanceStatus" AS ENUM ('REGISTERED', 'ATTENDED', 'ABSENT', 'EXCUSED');

-- CreateTable
CREATE TABLE "LmsCourse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "type" "LmsCourseType" NOT NULL DEFAULT 'ELEARNING',
    "status" "LmsCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
    "parentCourseId" TEXT,
    "passingScore" INTEGER,
    "validityMonths" INTEGER,
    "estimatedMinutes" INTEGER,
    "effectiveDate" TIMESTAMP(3),
    "documentId" TEXT,
    "isCatalogVisible" BOOLEAN NOT NULL DEFAULT false,
    "allowSelfEnroll" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsCourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsCourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsLesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "contentType" "LmsContentKind" NOT NULL DEFAULT 'VIDEO',
    "assetId" TEXT,
    "documentId" TEXT,
    "bodyHtml" TEXT,
    "externalUrl" TEXT,
    "minViewSeconds" INTEGER,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsContentAsset" (
    "id" TEXT NOT NULL,
    "kind" "LmsContentKind" NOT NULL,
    "title" TEXT,
    "fileKey" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationSeconds" INTEGER,
    "pageCount" INTEGER,
    "scormVersion" TEXT,
    "scormEntryPoint" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsAssessment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "timeLimitMinutes" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "randomizeFrom" INTEGER,
    "requireESign" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "LmsQuestionType" NOT NULL DEFAULT 'SINGLE',
    "prompt" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LmsQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsAssessmentAttempt" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "userId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "status" "LmsAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "esignatureId" TEXT,

    CONSTRAINT "LmsAssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsAttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" TEXT[],
    "textAnswer" TEXT,
    "awardedPoints" DOUBLE PRECISION,
    "isCorrect" BOOLEAN,
    "gradedById" TEXT,

    CONSTRAINT "LmsAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseVersion" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "status" "LmsEnrollmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "source" "LmsEnrollmentSource" NOT NULL DEFAULT 'DIRECT',
    "sourceRef" TEXT,
    "dueDate" TIMESTAMP(3),
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "esignatureId" TEXT,
    "waivedById" TEXT,
    "waiverReason" TEXT,
    "certificateId" TEXT,

    CONSTRAINT "LmsEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsLessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "secondsViewed" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsCertificate" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pdfKey" TEXT,
    "verifyToken" TEXT,

    CONSTRAINT "LmsCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsCurriculum" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsCurriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsCurriculumCourse" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LmsCurriculumCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsTrainingMatrixRule" (
    "id" TEXT NOT NULL,
    "targetType" "LmsMatrixTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "requiresType" "LmsMatrixRequiresType" NOT NULL,
    "requiresId" TEXT NOT NULL,
    "dueWithinDays" INTEGER,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsTrainingMatrixRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsClassroomSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructorId" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "status" "LmsSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsClassroomSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsSessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "status" "LmsAttendanceStatus" NOT NULL DEFAULT 'REGISTERED',
    "markedById" TEXT,
    "markedAt" TIMESTAMP(3),

    CONSTRAINT "LmsSessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LmsCourse_status_idx" ON "LmsCourse"("status");

-- CreateIndex
CREATE INDEX "LmsCourse_type_idx" ON "LmsCourse"("type");

-- CreateIndex
CREATE INDEX "LmsCourse_isLatestVersion_idx" ON "LmsCourse"("isLatestVersion");

-- CreateIndex
CREATE INDEX "LmsCourse_documentId_idx" ON "LmsCourse"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsCourse_code_version_key" ON "LmsCourse"("code", "version");

-- CreateIndex
CREATE INDEX "LmsCourseModule_courseId_idx" ON "LmsCourseModule"("courseId");

-- CreateIndex
CREATE INDEX "LmsLesson_moduleId_idx" ON "LmsLesson"("moduleId");

-- CreateIndex
CREATE INDEX "LmsLesson_assetId_idx" ON "LmsLesson"("assetId");

-- CreateIndex
CREATE INDEX "LmsContentAsset_kind_idx" ON "LmsContentAsset"("kind");

-- CreateIndex
CREATE INDEX "LmsAssessment_courseId_idx" ON "LmsAssessment"("courseId");

-- CreateIndex
CREATE INDEX "LmsAssessment_moduleId_idx" ON "LmsAssessment"("moduleId");

-- CreateIndex
CREATE INDEX "LmsQuestion_assessmentId_idx" ON "LmsQuestion"("assessmentId");

-- CreateIndex
CREATE INDEX "LmsQuestionOption_questionId_idx" ON "LmsQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "LmsAssessmentAttempt_assessmentId_userId_idx" ON "LmsAssessmentAttempt"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "LmsAssessmentAttempt_enrollmentId_idx" ON "LmsAssessmentAttempt"("enrollmentId");

-- CreateIndex
CREATE INDEX "LmsAttemptAnswer_questionId_idx" ON "LmsAttemptAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsAttemptAnswer_attemptId_questionId_key" ON "LmsAttemptAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsEnrollment_certificateId_key" ON "LmsEnrollment"("certificateId");

-- CreateIndex
CREATE INDEX "LmsEnrollment_userId_status_idx" ON "LmsEnrollment"("userId", "status");

-- CreateIndex
CREATE INDEX "LmsEnrollment_courseId_idx" ON "LmsEnrollment"("courseId");

-- CreateIndex
CREATE INDEX "LmsEnrollment_dueDate_idx" ON "LmsEnrollment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "LmsEnrollment_courseId_userId_courseVersion_key" ON "LmsEnrollment"("courseId", "userId", "courseVersion");

-- CreateIndex
CREATE INDEX "LmsLessonProgress_lessonId_idx" ON "LmsLessonProgress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsLessonProgress_enrollmentId_lessonId_key" ON "LmsLessonProgress"("enrollmentId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsCertificate_serial_key" ON "LmsCertificate"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "LmsCertificate_verifyToken_key" ON "LmsCertificate"("verifyToken");

-- CreateIndex
CREATE INDEX "LmsCertificate_userId_idx" ON "LmsCertificate"("userId");

-- CreateIndex
CREATE INDEX "LmsCertificate_courseId_idx" ON "LmsCertificate"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsCurriculum_code_key" ON "LmsCurriculum"("code");

-- CreateIndex
CREATE INDEX "LmsCurriculum_isActive_idx" ON "LmsCurriculum"("isActive");

-- CreateIndex
CREATE INDEX "LmsCurriculumCourse_courseId_idx" ON "LmsCurriculumCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsCurriculumCourse_curriculumId_courseId_key" ON "LmsCurriculumCourse"("curriculumId", "courseId");

-- CreateIndex
CREATE INDEX "LmsTrainingMatrixRule_targetType_targetId_idx" ON "LmsTrainingMatrixRule"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "LmsTrainingMatrixRule_requiresType_requiresId_idx" ON "LmsTrainingMatrixRule"("requiresType", "requiresId");

-- CreateIndex
CREATE INDEX "LmsTrainingMatrixRule_isActive_idx" ON "LmsTrainingMatrixRule"("isActive");

-- CreateIndex
CREATE INDEX "LmsClassroomSession_courseId_idx" ON "LmsClassroomSession"("courseId");

-- CreateIndex
CREATE INDEX "LmsClassroomSession_startsAt_idx" ON "LmsClassroomSession"("startsAt");

-- CreateIndex
CREATE INDEX "LmsSessionAttendance_userId_idx" ON "LmsSessionAttendance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsSessionAttendance_sessionId_userId_key" ON "LmsSessionAttendance"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "LmsCourseModule" ADD CONSTRAINT "LmsCourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LmsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsLesson" ADD CONSTRAINT "LmsLesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LmsCourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsLesson" ADD CONSTRAINT "LmsLesson_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "LmsContentAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAssessment" ADD CONSTRAINT "LmsAssessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LmsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAssessment" ADD CONSTRAINT "LmsAssessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LmsCourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsQuestion" ADD CONSTRAINT "LmsQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "LmsAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsQuestionOption" ADD CONSTRAINT "LmsQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LmsQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAssessmentAttempt" ADD CONSTRAINT "LmsAssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "LmsAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAssessmentAttempt" ADD CONSTRAINT "LmsAssessmentAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LmsEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAttemptAnswer" ADD CONSTRAINT "LmsAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "LmsAssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsAttemptAnswer" ADD CONSTRAINT "LmsAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LmsQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsEnrollment" ADD CONSTRAINT "LmsEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LmsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsEnrollment" ADD CONSTRAINT "LmsEnrollment_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "LmsCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsLessonProgress" ADD CONSTRAINT "LmsLessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LmsEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsLessonProgress" ADD CONSTRAINT "LmsLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "LmsLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsCertificate" ADD CONSTRAINT "LmsCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LmsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsCurriculumCourse" ADD CONSTRAINT "LmsCurriculumCourse_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "LmsCurriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsCurriculumCourse" ADD CONSTRAINT "LmsCurriculumCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LmsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsClassroomSession" ADD CONSTRAINT "LmsClassroomSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LmsCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsSessionAttendance" ADD CONSTRAINT "LmsSessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LmsClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsSessionAttendance" ADD CONSTRAINT "LmsSessionAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LmsEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
