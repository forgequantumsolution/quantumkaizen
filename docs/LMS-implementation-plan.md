# Quantum Kaizen — LMS (Learning Management System) Implementation Plan

> Status: PLAN (v1, 2026-06-26) · Owner: shriyansh
> Supersedes the minimal "Training & Competency" module (`TrainingItem` + `TrainingAssignment`).
> Sidebar entry already renamed **Training → LMS**.

This plan turns the current thin training module into a proper, GxP-grade **Learning
Management System**: authored **courses** built from **video / PPT / slide / PDF / document**
content, structured **lessons**, **examinations** (quizzes with auto-grading), **certificates**,
and **assignment** to individual **employees, roles, departments, and sites** via a
**training matrix**. It is written to be executed phase-by-phase and reuses the existing
platform primitives instead of rebuilding them.

---

## A. Current State — what exists today (reuse, don't rebuild)

| Capability | Where | Reuse for LMS |
|---|---|---|
| Training items + assignments | `TrainingItem`, `TrainingAssignment`, `backend/src/modules/training/*` | Migrate forward → becomes the simplest "document-acknowledgement" course type |
| DMS document acknowledge → auto-complete | `training.service.ts › completeForDocument()` | Keep: a "read & understand SOP" course auto-completes on DMS ack |
| Org + RBAC | `User`, `Role`, `Department`, `Site`, `Permission` (catalog in `src/lib/rbac-catalog.ts`) | Assign courses by user / role / department / site; gate LMS by permission keys |
| Controlled documents | `Document` + DMS feature | A lesson can embed a controlled SOP/PDF as content |
| Compliance (Part 11) | `ESignature`, `AuditTrailEntry`, `writeTrail()` | E-sign exam submission & training completion; append-only trail on every record |
| Approvals engine | `ApprovalPolicy`, `ApprovalInstance`, `ApprovalRecord` | Course publish/version approval (QA sign-off before a course goes live) |
| SLA + calendars | `SlaPolicy`, `SlaTimer`, `BusinessCalendar` | Due-date / overdue tracking for assigned training |
| Workflow engine | `Workflow`, `Ticket`, stages | (Optional) drive course authoring lifecycle: Draft → Review → Approved → Published |
| File storage | existing DMS upload/storage path | Store video/PPT/slide/PDF assets the same way |

**Architectural decisions**
- **Course = typed Prisma models** (queried/aggregated, reportable), not free-form forms.
- **Versioning is first-class**: courses and exams are versioned like documents; a published
  version is immutable. Re-training is triggered when a new version is published.
- **Every completion is auditable**: trail entry + optional e-signature with bound meaning
  ("I confirm I completed and understood this training").
- **Assignment is rule-based**, not just manual: a **training matrix** says "Role X / Dept Y
  must hold Course Z" and the system auto-enrolls + re-enrolls on version change.

---

## B. Target Domain Model (new Prisma models)

```
Course ──< CourseModule ──< Lesson ──> ContentAsset (video/ppt/slide/pdf/document/scorm/link)
  │            │
  │            └──< Assessment(module-level)  ┐
  ├──> Assessment(course-final) ──< Question ──< QuestionOption
  │                                   ▲
  │              AssessmentAttempt ──< AttemptAnswer
  │
  ├──< Enrollment ──> (User)         (assignment + status + due date + source)
  ├──< LessonProgress (per user, per lesson: % / completed)
  └──> Certificate (issued on pass)

Curriculum ──< CurriculumCourse ──> Course        (ordered learning path / job-role bundle)
TrainingMatrixRule ─ targets Role|Department|Site|JobFunction → requires Course|Curriculum
```

### B1. Authoring models
| Model | Key fields | Notes |
|---|---|---|
| `Course` | `code`, `title`, `description`, `category`, `type` (DOC_ACK \| ELEARNING \| CLASSROOM \| BLENDED), `version`, `isLatestVersion`, `status` (DRAFT \| IN_REVIEW \| PUBLISHED \| RETIRED), `ownerId`, `passingScore`, `validityMonths` (recert period), `estimatedMinutes`, `effectiveDate` | Versioned like `Document`. `validityMonths` drives recurring re-training. |
| `CourseModule` | `courseId`, `title`, `order`, `description` | Section/chapter grouping of lessons. |
| `Lesson` | `moduleId`, `title`, `order`, `contentType`, `assetId?`, `documentId?`, `bodyHtml?`, `minViewSeconds?`, `isMandatory` | A lesson points to one content asset (or rich-text / embedded SOP). |
| `ContentAsset` | `kind` (VIDEO \| PPT \| SLIDE_DECK \| PDF \| IMAGE \| SCORM \| EXTERNAL_LINK \| DOCUMENT_REF), `fileKey`/`url`, `mimeType`, `sizeBytes`, `durationSeconds?`, `pageCount?` | Reuse DMS storage. SCORM optional (Phase 6). |

### B2. Assessment / examination models
| Model | Key fields | Notes |
|---|---|---|
| `Assessment` | `courseId?`, `moduleId?`, `title`, `passingScore`, `maxAttempts`, `timeLimitMinutes?`, `shuffleQuestions`, `randomizeFrom` (pool size), `requireESign` | Final exam (course-level) or module quiz. |
| `Question` | `assessmentId`, `type` (SINGLE \| MULTI \| TRUE_FALSE \| SHORT_TEXT \| LONG_TEXT), `prompt`, `points`, `order`, `explanation?` | Descriptive types need manual grading (Phase 4b). |
| `QuestionOption` | `questionId`, `text`, `isCorrect`, `order` | For SINGLE/MULTI/TRUE_FALSE. |
| `AssessmentAttempt` | `assessmentId`, `enrollmentId`, `userId`, `startedAt`, `submittedAt`, `score`, `passed`, `attemptNo`, `esignatureId?` | One row per attempt; enforces `maxAttempts`. |
| `AttemptAnswer` | `attemptId`, `questionId`, `selectedOptionIds[]`, `textAnswer?`, `awardedPoints`, `gradedById?` | Auto-graded for objective types; manual for text. |

### B3. Assignment / progress / completion models
| Model | Key fields | Notes |
|---|---|---|
| `Enrollment` | `courseId`, `userId`, `status` (ASSIGNED \| IN_PROGRESS \| COMPLETED \| FAILED \| OVERDUE \| WAIVED), `source` (DIRECT \| ROLE \| DEPARTMENT \| SITE \| CURRICULUM \| MATRIX), `dueDate`, `assignedById`, `startedAt`, `completedAt`, `score`, `certificateId?`, `courseVersion` | Replaces `TrainingAssignment`. `courseVersion` lets re-training fire on new versions. |
| `LessonProgress` | `enrollmentId`, `lessonId`, `secondsViewed`, `completed`, `completedAt` | Drives "video must be 90% watched" gating. |
| `Certificate` | `enrollmentId`, `userId`, `courseId`, `serial`, `issuedAt`, `expiresAt`, `pdfKey` | Auto-issued on pass; QR-verifiable (reuse CoA verify pattern). |
| `Curriculum` | `code`, `title`, `description`, `category` | Learning path / job-role bundle. |
| `CurriculumCourse` | `curriculumId`, `courseId`, `order`, `isMandatory` | Ordered courses in a curriculum. |
| `TrainingMatrixRule` | `targetType` (ROLE \| DEPARTMENT \| SITE \| JOB_FUNCTION), `targetId`, `requiresType` (COURSE \| CURRICULUM), `requiresId`, `dueWithinDays`, `recurring` | The engine that auto-assigns by org structure. |

> **Migration note:** keep `TrainingItem`/`TrainingAssignment` during transition. Phase 1
> creates the new models; a data migration maps each `TrainingItem` → a `DOC_ACK` `Course`
> and each `TrainingAssignment` → an `Enrollment`. Old tables dropped after cutover.

---

## C. Permissions (add to `rbac-catalog.ts`)

| Key | Meaning |
|---|---|
| `lms_course.read` / `.write` / `.publish` | View / author / publish-approve courses |
| `lms_assessment.read` / `.write` / `.grade` | Manage exams / grade descriptive answers |
| `lms_enrollment.read` / `.assign` | View assignments / assign to users-roles-depts |
| `lms_matrix.read` / `.write` | View / configure training matrix |
| `lms_report.read` | Compliance dashboards & exports |
| `lms_my.read` | "My Learning" (every employee) |

Sidebar gates the LMS parent on these (mirrors how DMS/LIMS entries are gated today).

---

## D. API surface (REST, mirrors existing module conventions)

```
# Authoring
GET/POST            /api/lms/courses                 list/create (Draft)
GET/PATCH/DELETE    /api/lms/courses/:id
POST                /api/lms/courses/:id/versions    create new version
POST                /api/lms/courses/:id/submit      → IN_REVIEW (approval)
POST                /api/lms/courses/:id/publish      → PUBLISHED (e-sign)
GET/POST            /api/lms/courses/:id/modules
GET/POST            /api/lms/modules/:id/lessons
POST                /api/lms/assets                  upload video/ppt/slide/pdf
# Assessment
GET/POST            /api/lms/courses/:id/assessments
GET/POST            /api/lms/assessments/:id/questions
POST                /api/lms/assessments/:id/attempts          start attempt
POST                /api/lms/attempts/:id/submit               submit + auto-grade (+e-sign)
POST                /api/lms/attempts/:id/grade                manual grade text answers
# Assignment / matrix
POST                /api/lms/courses/:id/assign      users[] | roleId | departmentId | siteId
GET/POST            /api/lms/curricula
GET/POST            /api/lms/matrix                  matrix rules
POST                /api/lms/matrix/sync             (re)run auto-assignment
# Learner
GET                 /api/lms/my                      my enrollments + progress
POST                /api/lms/enrollments/:id/lessons/:lessonId/progress
GET                 /api/lms/my/certificates
GET                 /api/lms/certificates/:serial/verify   (public QR verify)
# Reporting
GET                 /api/lms/reports/compliance      matrix coverage, overdue, expiring
```

---

## E. Frontend (under `client/src/features/lms/`, routes `/lms/...`)

Sidebar **LMS** becomes a parent group (like DMS) with children:

| Child | Route | Audience | Screen |
|---|---|---|---|
| My Learning | `/lms/my` | everyone | Assigned courses, progress bars, due/overdue, resume, certificates |
| Course Player | `/lms/courses/:id/play` | learners | Lesson sidebar; video/PPT/PDF/slide viewer; "mark complete"; take exam |
| Catalog | `/lms/catalog` | learners | Browse/self-enroll (if allowed) |
| Courses (Author) | `/lms/admin/courses` | authors | List + builder: modules → lessons → upload assets; versioning |
| Exam Builder | `/lms/admin/courses/:id/exam` | authors | Add questions, options, passing score, attempts, time limit |
| Assignments | `/lms/admin/assignments` | managers | Assign to users / roles / departments / sites; set due dates |
| Training Matrix | `/lms/admin/matrix` | QA/admin | Role×Course / Dept×Course requirement grid; sync |
| Reports | `/lms/admin/reports` | QA/mgmt | Compliance %, overdue, expiring certs, per-employee transcript; CSV/PDF export |

**Content viewers**: video player (track % watched → `LessonProgress`), PDF viewer (reuse DMS),
PPT/slide deck (render via PDF conversion or embedded viewer), rich-text lessons.

---

## F. Phased build sequence

| Phase | Scope | Deliverable / acceptance |
|---|---|---|
| **P1 — Data model + migration** | All Prisma models (B1–B3), enums, permissions (C). Migrate `TrainingItem`→`Course(DOC_ACK)`, `TrainingAssignment`→`Enrollment`. Keep DMS auto-complete hook. | `prisma migrate` clean; existing training data visible as courses; no regression in DMS ack flow. |
| **P2 — Course authoring + content** | Course/module/lesson CRUD; asset upload (video/PPT/slide/PDF/doc-ref); versioning; Draft→Review→Publish with approval + e-sign. | Author builds a 3-module course with mixed media and publishes it (QA e-sign). |
| **P3 — Course player + progress** | Learner player, content viewers, `LessonProgress`, view-gating (min watch %), "My Learning". | Learner completes lessons; progress persists; course marked complete when all mandatory lessons done. |
| **P4 — Examinations** | Assessment + question/option models; attempt engine; auto-grade objective types; pass/fail → completion; e-sign on submit; `maxAttempts`/`timeLimit`. | Learner takes exam, auto-scored, passes → enrollment COMPLETED + certificate issued. |
| **P4b — Manual grading** | Short/long-text questions; grader queue (`lms_assessment.grade`). | Reviewer grades descriptive answers; score finalized. |
| **P5 — Assignment + Training Matrix** | Assign by user/role/department/site; `Curriculum`; `TrainingMatrixRule` + `matrix/sync` engine; recurring re-training on new version & on `validityMonths` expiry; SLA due/overdue. | Adding a user to Dept Y auto-enrolls them in Dept Y's required courses; new course version re-assigns. |
| **P6 — Certificates + Reporting** | Certificate PDF + QR verify; compliance dashboard (matrix coverage %, overdue, expiring), per-employee training transcript; CSV/PDF export. | QA pulls "training compliance by department" and an individual transcript; certificate verifies via QR. |
| **P7 (optional) — Advanced** | SCORM/xAPI import; instructor-led/classroom sessions (roster, attendance, scheduling); AI-assisted quiz generation from a document/PPT; notifications/reminders (email + in-app). | As scoped per demand. |

---

## G. Compliance hooks (GxP / 21 CFR Part 11) — apply throughout

- **Audit trail** (`writeTrail`) on every create/update/publish/assign/complete/grade.
- **E-signature** (`ESignature`, meaning-bound) on: course publish, exam submission, training
  completion sign-off, manual grade finalization.
- **Immutable published versions**; changes require a new version → re-training.
- **Recurring re-qualification** via `validityMonths` (e.g. annual GMP refresher).
- **Certificates** carry serial + issue/expiry + QR verification.
- **Effectivity**: a course's `effectiveDate` controls when assignments become due.

---

## H. Scope decisions (confirmed 2026-06-26)

1. **Enrolment** — Assignment + training matrix **and** a self-enrol catalog (employees can self-enrol in non-mandatory courses). ✅
2. **Manual-graded questions** — IN scope (short/long descriptive answers + grader queue). ✅
3. **SCORM/xAPI import** — IN scope (`ContentAsset.kind = SCORM`; xAPI/LRS statements). ✅
4. **Classroom / instructor-led sessions** — IN scope (sessions, rosters, attendance). ✅
5. **Video** — IN scope, first-class content type with watch-% progress gating. ✅
6. **Notifications** — Email **and** in-app reminders for due/overdue training + expiring certificates. ✅
7. **AI quiz generation** — OUT for now (revisit later).
8. **PPT rendering** — convert to PDF on upload (default), viewer reuses DMS PDF viewer.
```
