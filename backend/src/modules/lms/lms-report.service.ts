/**
 * LMS certificates + reporting service (Phase 6).
 *
 * Certificates are issued on exam pass (see lms-exam.service.ts). Here we expose
 * a learner's certificates, a public QR-verification endpoint (no auth), a
 * compliance dashboard (completion / overdue / expiring / by-department), and a
 * per-employee training transcript. PDFs are rendered client-side (print), so we
 * return structured data rather than binary files.
 */
import { prisma } from '../../lib/prisma';
import { Forbidden, NotFound } from '../../lib/httpError';
import type { ReportFilter } from './lms.schema';

const DAY = 24 * 3600 * 1000;

const resolveNames = async (userIds: string[]) => {
  const ids = [...new Set(userIds)];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, departmentId: true } })
    : [];
  return new Map(users.map((u) => [u.id, u]));
};

// ─────────────────────────── Certificates ───────────────────────────
export const listMyCertificates = async (userId: string) => {
  const rows = await prisma.lmsCertificate.findMany({
    where: { userId },
    include: { course: { select: { title: true, code: true } } },
    orderBy: { issuedAt: 'desc' },
  });
  const now = Date.now();
  return rows.map((c) => ({
    id: c.id,
    serial: c.serial,
    course_id: c.courseId,
    course_title: c.course.title,
    course_code: c.course.code,
    issued_at: c.issuedAt,
    expires_at: c.expiresAt,
    expired: !!c.expiresAt && c.expiresAt.getTime() < now,
    verify_token: c.verifyToken,
  }));
};

export const getCertificate = async (id: string, userId: string) => {
  const c = await prisma.lmsCertificate.findUnique({
    where: { id },
    include: { course: { select: { title: true, code: true } } },
  });
  if (!c) throw NotFound('Certificate not found');
  if (c.userId !== userId) throw Forbidden('This certificate belongs to another user');
  const names = await resolveNames([c.userId]);
  return {
    id: c.id,
    serial: c.serial,
    course_title: c.course.title,
    course_code: c.course.code,
    holder_name: names.get(c.userId)?.name ?? null,
    issued_at: c.issuedAt,
    expires_at: c.expiresAt,
    expired: !!c.expiresAt && c.expiresAt.getTime() < Date.now(),
    verify_token: c.verifyToken,
  };
};

// Public — no auth. Returns minimal validity info for a QR scan.
export const verifyCertificate = async (token: string) => {
  const c = await prisma.lmsCertificate.findFirst({
    where: { verifyToken: token },
    include: { course: { select: { title: true, code: true } } },
  });
  if (!c) return { valid: false as const };
  const names = await resolveNames([c.userId]);
  const expired = !!c.expiresAt && c.expiresAt.getTime() < Date.now();
  return {
    valid: !expired,
    expired,
    serial: c.serial,
    course_title: c.course.title,
    holder_name: names.get(c.userId)?.name ?? null,
    issued_at: c.issuedAt,
    expires_at: c.expiresAt,
  };
};

// ─────────────────────── Shared reporting data access ───────────────────────
// Enrolled users, resolved with their org dimensions (department / role / site)
// so the dashboard can break completion down along any of them.
type OrgUser = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  roleId: string | null;
  roleName: string | null;
  siteId: string | null;
  siteName: string | null;
};

// Turn the org filters (role/department/site) into the set of user IDs they
// match. Returns null when no org filter is set, meaning "don't restrict".
const resolveFilterUserIds = async (f: ReportFilter): Promise<string[] | null> => {
  const and: Record<string, string>[] = [];
  if (f.role_id) and.push({ roleId: f.role_id });
  if (f.department_id) and.push({ departmentId: f.department_id });
  if (f.site_id) and.push({ siteId: f.site_id });
  if (!and.length) return null;
  const users = await prisma.user.findMany({ where: { AND: and }, select: { id: true } });
  return users.map((u) => u.id);
};

const loadOrgUsers = async (userIds: string[]): Promise<Map<string, OrgUser>> => {
  const ids = [...new Set(userIds)];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          department: { select: { id: true, name: true } },
          role: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
      })
    : [];
  return new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name,
        departmentId: u.department?.id ?? null,
        departmentName: u.department?.name ?? null,
        roleId: u.role?.id ?? null,
        roleName: u.role?.name ?? null,
        siteId: u.site?.id ?? null,
        siteName: u.site?.name ?? null,
      },
    ]),
  );
};

// Enrollments matching the filter, joined with course + certificate + org user.
const loadReportEnrollments = async (f: ReportFilter, userIds: string[] | null) => {
  const where: Record<string, unknown> = {
    course: f.course_id ? { isDeleted: false, id: f.course_id } : { isDeleted: false },
  };
  if (userIds) where.userId = { in: userIds };
  if (f.from || f.to) {
    where.assignedAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  }
  const enrollments = await prisma.lmsEnrollment.findMany({
    where,
    include: {
      course: { select: { code: true, title: true, type: true } },
      certificate: { select: { serial: true, expiresAt: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
  const orgUsers = await loadOrgUsers(enrollments.map((e) => e.userId));
  return { enrollments, orgUsers };
};

type ReportEnrollment = Awaited<ReturnType<typeof loadReportEnrollments>>['enrollments'][number];
const isOverdue = (e: ReportEnrollment, now: number) =>
  !!e.dueDate && e.dueDate.getTime() < now && e.status !== 'COMPLETED' && e.status !== 'WAIVED';

// ─────────────────────────── Compliance dashboard ───────────────────────────
// Filterable by department / role / site / course / assigned-date range. Returns
// a headline summary plus completion broken down by each org dimension, an
// assessment (exam) pass/fail rollup, and certificates expiring in the next 60d.
export const complianceReport = async (filter: ReportFilter = {}) => {
  const now = Date.now();
  const userIds = await resolveFilterUserIds(filter);
  const { enrollments, orgUsers } = await loadReportEnrollments(filter, userIds);

  const total = enrollments.length;
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const inProgress = enrollments.filter((e) => e.status === 'IN_PROGRESS' || e.status === 'ASSIGNED').length;
  const failed = enrollments.filter((e) => e.status === 'FAILED').length;
  const overdue = enrollments.filter((e) => isOverdue(e, now)).length;

  const matrix = enrollments.filter((e) => e.source === 'MATRIX');
  const matrixCompleted = matrix.filter((e) => e.status === 'COMPLETED').length;

  // Generic grouping over any org dimension, sharing the same completion/overdue
  // roll-up so by-department / by-role / by-site stay consistent.
  const groupBy = (keyOf: (u?: OrgUser) => string | null, labelOf: (u?: OrgUser) => string | null) => {
    const map = new Map<string, { key: string; name: string; total: number; completed: number; overdue: number }>();
    for (const e of enrollments) {
      const u = orgUsers.get(e.userId);
      const key = keyOf(u) ?? 'none';
      const label = key === 'none' ? 'Unassigned' : labelOf(u) ?? 'Unknown';
      const row = map.get(key) ?? { key, name: label, total: 0, completed: 0, overdue: 0 };
      row.total++;
      if (e.status === 'COMPLETED') row.completed++;
      if (isOverdue(e, now)) row.overdue++;
      map.set(key, row);
    }
    return [...map.values()]
      .map((d) => ({ ...d, completion_rate: d.total ? Math.round((d.completed / d.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  };

  // Assessment (exam) analytics — decided attempts only (pass/fail determined),
  // scoped by the same user/course/date filters.
  const attemptWhere: Record<string, unknown> = { passed: { not: null } };
  if (userIds) attemptWhere.userId = { in: userIds };
  if (filter.course_id) attemptWhere.assessment = { courseId: filter.course_id };
  if (filter.from || filter.to) {
    attemptWhere.submittedAt = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
  }
  const attempts = await prisma.lmsAssessmentAttempt.findMany({
    where: attemptWhere,
    select: { userId: true, score: true, passed: true },
  });
  const attScored = attempts.filter((a) => a.score !== null);
  const attPassed = attempts.filter((a) => a.passed === true).length;

  // Expiring certificates (next 60 days), scoped to the filtered users.
  const horizon = new Date(now + 60 * DAY);
  const certWhere: Record<string, unknown> = { expiresAt: { not: null, gte: new Date(now), lte: horizon } };
  if (userIds) certWhere.userId = { in: userIds };
  const expiringRows = await prisma.lmsCertificate.findMany({
    where: certWhere,
    include: { course: { select: { title: true } } },
    orderBy: { expiresAt: 'asc' },
  });
  const expCertNames = await resolveNames(expiringRows.map((c) => c.userId));

  return {
    summary: {
      total,
      completed,
      in_progress: inProgress,
      failed,
      overdue,
      completion_rate: total ? Math.round((completed / total) * 100) : 0,
      matrix_total: matrix.length,
      matrix_coverage: matrix.length ? Math.round((matrixCompleted / matrix.length) * 100) : 0,
    },
    by_department: groupBy((u) => u?.departmentId ?? null, (u) => u?.departmentName ?? null),
    by_role: groupBy((u) => u?.roleId ?? null, (u) => u?.roleName ?? null),
    by_site: groupBy((u) => u?.siteId ?? null, (u) => u?.siteName ?? null),
    assessment: {
      attempts: attempts.length,
      passed: attPassed,
      failed: attempts.length - attPassed,
      pass_rate: attempts.length ? Math.round((attPassed / attempts.length) * 100) : 0,
      avg_score: attScored.length
        ? Math.round(attScored.reduce((s, a) => s + (a.score ?? 0), 0) / attScored.length)
        : 0,
      learners: new Set(attempts.map((a) => a.userId)).size,
    },
    expiring_certificates: expiringRows.map((c) => ({
      id: c.id,
      serial: c.serial,
      course_title: c.course.title,
      holder_name: expCertNames.get(c.userId)?.name ?? null,
      expires_at: c.expiresAt,
    })),
  };
};

// ─────────────────────────── CSV export ───────────────────────────
const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

// Enrollment-level CSV of the (filtered) training records — one row per
// enrollment, with the learner's org context and completion/certificate state.
export const enrollmentsCsv = async (filter: ReportFilter = {}) => {
  const userIds = await resolveFilterUserIds(filter);
  const { enrollments, orgUsers } = await loadReportEnrollments(filter, userIds);
  const header = [
    'Employee', 'Department', 'Role', 'Site', 'Course Code', 'Course Title', 'Type',
    'Version', 'Status', 'Source', 'Progress %', 'Score', 'Due Date', 'Assigned',
    'Completed', 'Certificate', 'Cert Expires',
  ];
  const rows = enrollments.map((e) => {
    const u = orgUsers.get(e.userId);
    return [
      u?.name ?? e.userId, u?.departmentName ?? '', u?.roleName ?? '', u?.siteName ?? '',
      e.course.code, e.course.title, e.course.type, e.courseVersion, e.status, e.source,
      e.progressPct, e.score ?? '', day(e.dueDate), day(e.assignedAt), day(e.completedAt),
      e.certificate?.serial ?? '', day(e.certificate?.expiresAt),
    ];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
};

// ─────────────────────────── Per-employee transcript ───────────────────────────
export const transcript = async (userId: string) => {
  const enrollments = await prisma.lmsEnrollment.findMany({
    where: { userId, course: { isDeleted: false } },
    include: { course: { select: { title: true, code: true, type: true } }, certificate: true },
    orderBy: { assignedAt: 'desc' },
  });
  const names = await resolveNames([userId]);
  const now = Date.now();
  return {
    user_id: userId,
    user_name: names.get(userId)?.name ?? null,
    items: enrollments.map((e) => ({
      enrollment_id: e.id,
      course_code: e.course.code,
      course_title: e.course.title,
      course_type: e.course.type,
      course_version: e.courseVersion,
      status: e.status,
      source: e.source,
      progress_pct: e.progressPct,
      score: e.score,
      due_date: e.dueDate,
      assigned_at: e.assignedAt,
      completed_at: e.completedAt,
      certificate_serial: e.certificate?.serial ?? null,
      certificate_expires_at: e.certificate?.expiresAt ?? null,
      certificate_expired: !!e.certificate?.expiresAt && e.certificate.expiresAt.getTime() < now,
    })),
  };
};
