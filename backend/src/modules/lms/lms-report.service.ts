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

// ─────────────────────────── Compliance dashboard ───────────────────────────
export const complianceReport = async () => {
  const enrollments = await prisma.lmsEnrollment.findMany({
    where: { course: { isDeleted: false } },
    select: { userId: true, status: true, dueDate: true, source: true, completedAt: true },
  });
  const now = Date.now();

  const total = enrollments.length;
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const inProgress = enrollments.filter((e) => e.status === 'IN_PROGRESS' || e.status === 'ASSIGNED').length;
  const failed = enrollments.filter((e) => e.status === 'FAILED').length;
  const overdue = enrollments.filter(
    (e) => e.dueDate && e.dueDate.getTime() < now && e.status !== 'COMPLETED' && e.status !== 'WAIVED',
  ).length;

  const matrix = enrollments.filter((e) => e.source === 'MATRIX');
  const matrixCompleted = matrix.filter((e) => e.status === 'COMPLETED').length;

  // By department — group via the enrolled users' departments.
  const names = await resolveNames(enrollments.map((e) => e.userId));
  const deptIds = [...new Set([...names.values()].map((u) => u.departmentId).filter((x): x is string => !!x))];
  const depts = deptIds.length
    ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptName = new Map(depts.map((d) => [d.id, d.name]));

  const byDeptMap = new Map<string, { name: string; total: number; completed: number; overdue: number }>();
  for (const e of enrollments) {
    const did = names.get(e.userId)?.departmentId ?? 'none';
    const label = did === 'none' ? 'Unassigned' : deptName.get(did) ?? 'Unknown';
    const row = byDeptMap.get(did) ?? { name: label, total: 0, completed: 0, overdue: 0 };
    row.total++;
    if (e.status === 'COMPLETED') row.completed++;
    if (e.dueDate && e.dueDate.getTime() < now && e.status !== 'COMPLETED' && e.status !== 'WAIVED') row.overdue++;
    byDeptMap.set(did, row);
  }

  // Expiring certificates (next 60 days).
  const horizon = new Date(now + 60 * DAY);
  const expiringRows = await prisma.lmsCertificate.findMany({
    where: { expiresAt: { not: null, gte: new Date(now), lte: horizon } },
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
    by_department: [...byDeptMap.values()]
      .map((d) => ({ ...d, completion_rate: d.total ? Math.round((d.completed / d.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total),
    expiring_certificates: expiringRows.map((c) => ({
      id: c.id,
      serial: c.serial,
      course_title: c.course.title,
      holder_name: expCertNames.get(c.userId)?.name ?? null,
      expires_at: c.expiresAt,
    })),
  };
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
