/**
 * DMS — controlled document service.
 *
 * Lifecycle (Phase 1): DRAFT → EFFECTIVE → (revise) DRAFT → EFFECTIVE …, plus
 * SUPERSEDED / RETIRED. Each document owns ordered DocumentVersions; the latest
 * unlocked version is the editable "working draft" authored in the online editor.
 * Issuing locks that version, marks the document EFFECTIVE, points currentVersionId
 * at it, and supersedes the previously-effective version. Approvals + e-sign +
 * periodic-review enforcement come in Phase 2.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/httpError';
import { writeTrail, recordSignature } from '../audit/compliance.service';
import { completeForDocument } from '../training/training.service';
import { completeDocAckForDocument } from '../lms/lms-learn.service';
import {
  assertDocumentRetirable,
  openReviewsForDocumentRevision,
} from '../risk/risk-control-effect.service';
import type {
  ApproveInput,
  AssignReadersInput,
  CreateDocumentInput,
  IssueInput,
  ListDocumentsQuery,
  MarkReviewedInput,
  RejectInput,
  ReviseInput,
  SaveContentInput,
  UpdateDocumentInput,
} from './dms.schema';

const nextDocNumber = async (year: number): Promise<string> => {
  const count = await prisma.document.count({
    where: { docNumber: { startsWith: `DOC-${year}-` } },
  });
  return `DOC-${year}-${String(count + 1).padStart(4, '0')}`;
};

// ── Name resolution (refs are plain id columns, no FK) ──────────────────────
const resolveNames = async (
  userIds: (string | null | undefined)[],
  deptIds: (string | null | undefined)[],
) => {
  const uIds = [...new Set(userIds.filter((x): x is string => !!x))];
  const dIds = [...new Set(deptIds.filter((x): x is string => !!x))];
  const [users, depts] = await Promise.all([
    uIds.length
      ? prisma.user.findMany({ where: { id: { in: uIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    dIds.length
      ? prisma.department.findMany({ where: { id: { in: dIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  return {
    userName: new Map(users.map((u) => [u.id, u.name])),
    deptName: new Map(depts.map((d) => [d.id, d.name])),
  };
};

type DocRow = Prisma.DocumentGetPayload<{ include: { versions: true } }>;

const serializeVersion = (
  v: DocRow['versions'][number],
  userName: Map<string, string>,
  withContent: boolean,
) => ({
  id: v.id,
  version: v.version,
  version_label: v.versionLabel,
  content_type: v.contentType,
  change_summary: v.changeSummary,
  author_id: v.authorId,
  author_name: v.authorId ? userName.get(v.authorId) ?? null : null,
  is_locked: v.isLocked,
  created_at: v.createdAt,
  file_name: v.fileName,
  file_mime: v.fileMime,
  file_size: v.fileSize,
  // Heavy base64 payload only on the full (single-document) read.
  ...(withContent ? { content: v.content, file_data: v.fileData } : {}),
});

const serializeDoc = (
  d: DocRow,
  userName: Map<string, string>,
  deptName: Map<string, string>,
  opts: { full?: boolean } = {},
) => {
  const versions = [...d.versions].sort((a, b) => b.version - a.version);
  const current = versions.find((v) => v.id === d.currentVersionId) ?? null;
  const working = versions.find((v) => !v.isLocked) ?? versions[0] ?? null;
  return {
    id: d.id,
    doc_number: d.docNumber,
    title: d.title,
    type: d.type,
    status: d.status,
    description: d.description,
    department_id: d.departmentId,
    department_name: d.departmentId ? deptName.get(d.departmentId) ?? null : null,
    owner_id: d.ownerId,
    owner_name: d.ownerId ? userName.get(d.ownerId) ?? null : null,
    current_version_id: d.currentVersionId,
    effective_date: d.effectiveDate,
    review_due_date: d.reviewDueDate,
    review_overdue: !!d.reviewOverdueAt,
    version_count: versions.length,
    latest_version_label: versions[0]?.versionLabel ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    ...(opts.full
      ? {
          working_version: working ? serializeVersion(working, userName, true) : null,
          current_version: current ? serializeVersion(current, userName, true) : null,
          versions: versions.map((v) => serializeVersion(v, userName, false)),
        }
      : {}),
  };
};

// ── Queries ─────────────────────────────────────────────────────────────────

export const listDocuments = async (q: ListDocumentsQuery) => {
  const where: Prisma.DocumentWhereInput = { isDeleted: false };
  if (q.review_due) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    where.status = 'EFFECTIVE';
    where.reviewDueDate = { lte: horizon };
  } else if (q.status) {
    where.status = q.status;
  }
  if (q.type) where.type = q.type;
  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { docNumber: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      include: { versions: true },
      orderBy: { updatedAt: 'desc' },
      skip: (q.page - 1) * q.page_size,
      take: q.page_size,
    }),
  ]);
  const names = await resolveNames(
    rows.flatMap((d) => [d.ownerId, d.createdById]),
    rows.map((d) => d.departmentId),
  );
  return {
    data: rows.map((d) => serializeDoc(d, names.userName, names.deptName)),
    total,
    page: q.page,
    page_size: q.page_size,
  };
};

const getDocRow = async (id: string): Promise<DocRow> => {
  const d = await prisma.document.findFirst({
    where: { id, isDeleted: false },
    include: { versions: true },
  });
  if (!d) throw NotFound('Document not found');
  return d;
};

export const getDocument = async (id: string) => {
  const d = await getDocRow(id);
  const names = await resolveNames(
    [d.ownerId, d.createdById, ...d.versions.map((v) => v.authorId)],
    [d.departmentId],
  );
  return serializeDoc(d, names.userName, names.deptName, { full: true });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const createDocument = async (input: CreateDocumentInput, userId?: string) => {
  const year = new Date().getFullYear();
  const docNumber = await nextDocNumber(year);
  const created = await prisma.document.create({
    data: {
      docNumber,
      title: input.title,
      type: input.type,
      status: 'DRAFT',
      description: input.description ?? null,
      departmentId: input.department_id ?? null,
      ownerId: input.owner_id ?? null,
      createdById: userId ?? null,
      versions: {
        create: {
          version: 1,
          versionLabel: '1.0',
          contentType: input.content_type,
          content: input.content_type === 'FILE' ? null : input.content ?? '',
          fileName: input.content_type === 'FILE' ? input.file_name ?? null : null,
          fileMime: input.content_type === 'FILE' ? input.file_mime ?? null : null,
          fileSize: input.content_type === 'FILE' ? input.file_size ?? null : null,
          fileData: input.content_type === 'FILE' ? input.file_data ?? null : null,
          authorId: userId ?? null,
        },
      },
    },
  });
  await writeTrail(
    { entityType: 'Document', entityId: created.id, action: 'CREATE', newValue: docNumber },
    userId,
  );
  return getDocument(created.id);
};

export const updateDocument = async (id: string, input: UpdateDocumentInput, userId?: string) => {
  const existing = await getDocRow(id);
  await prisma.document.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      type: input.type ?? existing.type,
      description: input.description ?? existing.description,
      departmentId: input.department_id ?? existing.departmentId,
      ownerId: input.owner_id ?? existing.ownerId,
    },
  });
  await writeTrail({ entityType: 'Document', entityId: id, action: 'UPDATE' }, userId);
  return getDocument(id);
};

// Save the working (unlocked) draft version — editor HTML or an uploaded file.
export const saveContent = async (id: string, input: SaveContentInput, userId?: string) => {
  const d = await getDocRow(id);
  const working = [...d.versions].sort((a, b) => b.version - a.version).find((v) => !v.isLocked);
  if (!working) {
    throw BadRequest('No editable draft version — revise the document to create a new draft');
  }
  const isFile = (input.content_type ?? working.contentType) === 'FILE';
  await prisma.documentVersion.update({
    where: { id: working.id },
    data: {
      contentType: input.content_type ?? working.contentType,
      content: isFile ? null : input.content ?? working.content,
      fileName: isFile ? input.file_name ?? working.fileName : null,
      fileMime: isFile ? input.file_mime ?? working.fileMime : null,
      fileSize: isFile ? input.file_size ?? working.fileSize : null,
      fileData: isFile ? input.file_data ?? working.fileData : null,
      changeSummary: input.change_summary ?? working.changeSummary,
      authorId: userId ?? working.authorId,
    },
  });
  return getDocument(id);
};

// Start a new draft revision (clones the current content into version N+1).
export const reviseDocument = async (id: string, input: ReviseInput, userId?: string) => {
  const d = await getDocRow(id);
  const hasOpenDraft = d.versions.some((v) => !v.isLocked);
  if (hasOpenDraft && d.status === 'DRAFT') {
    throw BadRequest('Document already has an open draft');
  }
  const maxVersion = d.versions.reduce((m, v) => Math.max(m, v.version), 0);
  const source = [...d.versions].sort((a, b) => b.version - a.version)[0];
  const next = maxVersion + 1;
  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId: id,
        version: next,
        versionLabel: `${next}.0`,
        content: source?.content ?? '',
        changeSummary: input.change_summary ?? null,
        authorId: userId ?? null,
      },
    }),
    prisma.document.update({ where: { id }, data: { status: 'DRAFT' } }),
  ]);
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'UPDATE', field: 'revision', newValue: `${next}.0` },
    userId,
  );
  // The revised document is not the one the control was verified against, so
  // every risk it controls goes back into review. Best-effort by design.
  await openReviewsForDocumentRevision(id, d.docNumber, userId);
  return getDocument(id);
};

// Make the working draft EFFECTIVE: lock it, supersede the prior effective version.
export const issueDocument = async (id: string, input: IssueInput, userId?: string) => {
  const d = await getDocRow(id);
  const working = [...d.versions].sort((a, b) => b.version - a.version).find((v) => !v.isLocked);
  if (!working) throw BadRequest('No draft version to issue');
  if (d.status === 'EFFECTIVE' && d.currentVersionId === working.id) {
    throw BadRequest('Document is already effective on this version');
  }
  const now = new Date();
  const reviewDue = new Date(now);
  reviewDue.setDate(reviewDue.getDate() + (input.review_period_days ?? 365));

  await prisma.$transaction([
    prisma.documentVersion.update({ where: { id: working.id }, data: { isLocked: true } }),
    prisma.document.update({
      where: { id },
      data: {
        status: 'EFFECTIVE',
        currentVersionId: working.id,
        effectiveDate: now,
        reviewDueDate: reviewDue,
      },
    }),
  ]);
  await writeTrail(
    {
      entityType: 'Document',
      entityId: id,
      action: 'TRANSITION',
      field: 'status',
      oldValue: d.status,
      newValue: 'EFFECTIVE',
    },
    userId,
  );
  return getDocument(id);
};

const workingHasContent = (v: DocRow['versions'][number]): boolean =>
  v.contentType === 'FILE' ? !!v.fileData : !!(v.content && v.content.replace(/<[^>]*>/g, '').trim());

// Route a draft into review (Phase 2 controlled approval path).
export const submitForReview = async (id: string, userId?: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'DRAFT') throw BadRequest('Only DRAFT documents can be submitted for review');
  const working = [...d.versions].sort((a, b) => b.version - a.version).find((v) => !v.isLocked);
  if (!working) throw BadRequest('No draft version to submit');
  if (!workingHasContent(working)) throw BadRequest('Add content or upload a file before submitting');
  await prisma.document.update({ where: { id }, data: { status: 'IN_REVIEW' } });
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'DRAFT', newValue: 'IN_REVIEW' },
    userId,
  );
  return getDocument(id);
};

// Approve an in-review document with a re-authenticated e-signature, then make it
// effective (lock the version, set effective + review dates). 21 CFR Part 11.
export const approveDocument = async (id: string, input: ApproveInput, userId?: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'IN_REVIEW') throw BadRequest('Only documents in review can be approved');
  const working = [...d.versions].sort((a, b) => b.version - a.version).find((v) => !v.isLocked);
  if (!working) throw BadRequest('No draft version to approve');

  // Re-auth + ESignature + SIGN audit-trail (throws on bad credential).
  await recordSignature(
    { entity_type: 'Document', entity_id: id, meaning: `Approved & made effective (v${working.versionLabel})`, credential: input.credential },
    userId,
  );

  const now = new Date();
  const reviewDue = new Date(now);
  reviewDue.setDate(reviewDue.getDate() + (input.review_period_days ?? 365));
  await prisma.$transaction([
    prisma.documentVersion.update({ where: { id: working.id }, data: { isLocked: true } }),
    prisma.document.update({
      where: { id },
      data: { status: 'EFFECTIVE', currentVersionId: working.id, effectiveDate: now, reviewDueDate: reviewDue, reviewOverdueAt: null },
    }),
  ]);
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'IN_REVIEW', newValue: 'EFFECTIVE' },
    userId,
  );
  return getDocument(id);
};

export const rejectDocument = async (id: string, input: RejectInput, userId?: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'IN_REVIEW') throw BadRequest('Only documents in review can be rejected');
  await prisma.document.update({ where: { id }, data: { status: 'DRAFT' } });
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'TRANSITION', field: 'status', oldValue: 'IN_REVIEW', newValue: 'DRAFT', reason: input.reason },
    userId,
  );
  return getDocument(id);
};

export const retireDocument = async (id: string, userId?: string) => {
  const d = await getDocRow(id);
  // A document that still executes a risk control cannot simply disappear: the
  // residual score of every risk it serves assumes it exists. Blocks with the
  // control and risk numbers named.
  await assertDocumentRetirable(id, d.docNumber);
  await prisma.document.update({ where: { id }, data: { status: 'RETIRED' } });
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'TRANSITION', field: 'status', oldValue: d.status, newValue: 'RETIRED' },
    userId,
  );
  return getDocument(id);
};

// ── Periodic review ─────────────────────────────────────────────────────────

export const markReviewed = async (id: string, input: MarkReviewedInput, userId?: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'EFFECTIVE') throw BadRequest('Only effective documents can be reviewed');
  const next = new Date();
  next.setDate(next.getDate() + (input.review_period_days ?? 365));
  await prisma.document.update({ where: { id }, data: { reviewDueDate: next, reviewOverdueAt: null } });
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'UPDATE', field: 'reviewDueDate', newValue: next.toISOString() },
    userId,
  );
  return getDocument(id);
};

/**
 * Periodic-review sweep: flag effective documents whose review due date has
 * passed and aren't yet flagged. Pure Prisma (no Redis) — runs on the worker
 * cron tick and via the audit-sweep CLI. The flag is the hook for future
 * notifications; it's cleared on re-review / re-issue.
 */
export const flagOverdueReviews = async (now = new Date()) => {
  const due = await prisma.document.findMany({
    where: { isDeleted: false, status: 'EFFECTIVE', reviewOverdueAt: null, reviewDueDate: { lt: now } },
    select: { id: true, docNumber: true, reviewDueDate: true },
  });
  for (const d of due) {
    await prisma.document.update({ where: { id: d.id }, data: { reviewOverdueAt: now } });
    await writeTrail(
      { entityType: 'Document', entityId: d.id, action: 'UPDATE', field: 'review_overdue', newValue: d.reviewDueDate?.toISOString() ?? null },
      undefined,
    );
  }
  return { flagged_count: due.length, flagged: due.map((d) => d.docNumber) };
};

// ── Controlled distribution — read & understood ─────────────────────────────

export const assignReaders = async (id: string, input: AssignReadersInput, userId?: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'EFFECTIVE' || !d.currentVersionId) {
    throw BadRequest('Only an effective document can be assigned for reading');
  }
  const versionId = d.currentVersionId;
  // Idempotent: skip users already holding a receipt for this version.
  const existing = await prisma.documentReadReceipt.findMany({
    where: { documentId: id, versionId, userId: { in: input.user_ids } },
    select: { userId: true },
  });
  const have = new Set(existing.map((r) => r.userId));
  const toCreate = input.user_ids.filter((u) => !have.has(u));
  if (toCreate.length) {
    await prisma.documentReadReceipt.createMany({
      data: toCreate.map((uid) => ({
        documentId: id,
        versionId,
        userId: uid,
        assignedById: userId ?? null,
      })),
    });
    await writeTrail(
      { entityType: 'Document', entityId: id, action: 'UPDATE', field: 'readers_assigned', newValue: String(toCreate.length) },
      userId,
    );
  }
  return listReceipts(id);
};

export const acknowledgeRead = async (id: string, userId: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'EFFECTIVE' || !d.currentVersionId) {
    throw BadRequest('Only an effective document can be acknowledged');
  }
  const versionId = d.currentVersionId;
  // Assigned reader → satisfy the receipt; otherwise record a self-attestation.
  await prisma.documentReadReceipt.upsert({
    where: { documentId_versionId_userId: { documentId: id, versionId, userId } },
    update: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    create: { documentId: id, versionId, userId, status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
  });
  await writeTrail(
    { entityType: 'Document', entityId: id, action: 'UPDATE', field: 'read_acknowledged', newValue: versionId },
    userId,
  );
  // Close the loop: auto-complete any training / LMS DOC_ACK course tied to this
  // document (legacy training items + new LMS enrollments).
  await completeForDocument(id, userId).catch(() => undefined);
  await completeDocAckForDocument(id, userId).catch(() => undefined);
  return listReceipts(id, userId);
};

export const listReceipts = async (id: string, viewerId?: string) => {
  const d = await getDocRow(id);
  const versionId = d.currentVersionId;
  const rows = versionId
    ? await prisma.documentReadReceipt.findMany({
        where: { documentId: id, versionId },
        orderBy: { assignedAt: 'asc' },
      })
    : [];
  const names = await resolveNames(rows.flatMap((r) => [r.userId, r.assignedById]), []);
  const acknowledged = rows.filter((r) => r.status === 'ACKNOWLEDGED').length;
  const mine = viewerId ? rows.find((r) => r.userId === viewerId) ?? null : null;
  return {
    version_id: versionId,
    total: rows.length,
    acknowledged,
    pending: rows.length - acknowledged,
    my_status: mine?.status ?? null,
    receipts: rows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      user_name: names.userName.get(r.userId) ?? null,
      status: r.status,
      assigned_by_name: r.assignedById ? names.userName.get(r.assignedById) ?? null : null,
      assigned_at: r.assignedAt,
      acknowledged_at: r.acknowledgedAt,
    })),
  };
};

// "My pending reads" — effective documents the user must still acknowledge.
export const listMyPendingReads = async (userId: string) => {
  const rows = await prisma.documentReadReceipt.findMany({
    where: { userId, status: 'PENDING' },
    include: { document: true },
    orderBy: { assignedAt: 'asc' },
  });
  const pending = rows.filter(
    (r) => !r.document.isDeleted && r.document.status === 'EFFECTIVE' && r.document.currentVersionId === r.versionId,
  );
  return {
    count: pending.length,
    items: pending.map((r) => ({
      receipt_id: r.id,
      document_id: r.documentId,
      doc_number: r.document.docNumber,
      title: r.document.title,
      type: r.document.type,
      assigned_at: r.assignedAt,
    })),
  };
};

export const deleteDocument = async (id: string, userId?: string) => {
  const d = await getDocRow(id);
  if (d.status !== 'DRAFT') throw BadRequest('Only DRAFT documents can be deleted');
  await prisma.document.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
  await writeTrail({ entityType: 'Document', entityId: id, action: 'DELETE' }, userId);
};
