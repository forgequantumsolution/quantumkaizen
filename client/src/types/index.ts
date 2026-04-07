// ── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'QUALITY_MANAGER'
  | 'DEPARTMENT_HEAD'
  | 'DOCUMENT_CONTROLLER'
  | 'AUDITOR'
  | 'INSPECTOR'
  | 'OPERATOR'
  | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  departmentId: string | null;
  employeeId: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string; code: string } | null;
  tenant?: { id: string; name: string; code: string } | null;
}

// ── DMS ──────────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'OBSOLETE'
  | 'ARCHIVED';

export type DocumentLevel =
  | 'POLICY'
  | 'PROCEDURE'
  | 'WORK_INSTRUCTION'
  | 'FORM'
  | 'EXTERNAL';

export interface Document {
  id: string;
  documentNumber: string;
  title: string;
  description: string | null;
  level: DocumentLevel;
  status: DocumentStatus;
  category: string | null;
  department: string;
  departmentId: string;
  version: string;
  owner: string;
  ownerId: string;
  effectiveDate: string | null;
  expiryDate: string | null;
  reviewDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  changeSummary?: string | null;
  filePath?: string | null;
}

export interface DocumentVersion {
  id: string;
  version: string;
  changedBy: string;
  changedAt: string;
  changeSummary: string;
  status: DocumentStatus;
}

export interface ApprovalStep {
  id: string;
  stepOrder: number;
  role: string;
  approverName: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  comment: string | null;
  completedAt: string | null;
}

// ── QMS — Non-Conformance ────────────────────────────────────────────────────

export type NCType =
  | 'DEVIATION'
  | 'PRODUCT_NC'
  | 'PROCESS_NC'
  | 'OOS'
  | 'COMPLAINT';

export type NCSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type NCStatus =
  | 'OPEN'
  | 'CONTAINMENT'
  | 'INVESTIGATION'
  | 'ROOT_CAUSE'
  | 'CAPA_PLANNING'
  | 'CAPA_IMPLEMENTATION'
  | 'CLOSED';

export interface ContainmentAction {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface NonConformance {
  id: string;
  ncNumber: string;
  title: string;
  description: string;
  type: NCType;
  severity: NCSeverity;
  status: NCStatus;
  source: string | null;
  department: string;
  departmentId: string;
  productProcess: string | null;
  batchLot: string | null;
  assignedTo: string | null;
  assignedToId: string | null;
  dueDate: string | null;
  priorityJustification: string | null;
  containmentActions: ContainmentAction[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: string;
}

export interface FiveWhyEntry {
  whyNumber: number;
  question: string;
  answer: string;
}

// ── CAPA ─────────────────────────────────────────────────────────────────────

export type CAPAType = 'CORRECTIVE' | 'PREVENTIVE';
export type CAPAStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFICATION' | 'CLOSED';

export interface CAPA {
  id: string;
  capaNumber: string;
  title: string;
  type: CAPAType;
  status: CAPAStatus;
  linkedNCId: string | null;
  linkedNCNumber: string | null;
  assignedTo: string;
  dueDate: string;
  createdAt: string;
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changedFields: Record<string, { before: unknown; after: unknown }> | null;
  ipAddress: string | null;
  details?: Record<string, unknown> | null;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  openNCs: number;
  openCAPAs: number;
  pendingApprovals: number;
  expiringDocuments: number;
  overdueActions: number;
  trainingCompliance: number;
}

export interface NCTrendPoint {
  month: string;
  count: number;
}

export interface NCByType {
  type: string;
  count: number;
}

// ── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
