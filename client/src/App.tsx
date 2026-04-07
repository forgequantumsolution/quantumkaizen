import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
// DMS
import DocumentListPage from '@/features/dms/DocumentListPage';
import DocumentCreatePage from '@/features/dms/DocumentCreatePage';
import DocumentDetailPage from '@/features/dms/DocumentDetailPage';
import TemplateListPage from '@/features/dms/TemplateListPage';
import TemplateCreatePage from '@/features/dms/TemplateCreatePage';
import TemplateDetailPage from '@/features/dms/TemplateDetailPage';
// QMS — Non-Conformance
import NCListPage from '@/features/qms/non-conformance/NCListPage';
import NCCreatePage from '@/features/qms/non-conformance/NCCreatePage';
import NCDetailPage from '@/features/qms/non-conformance/NCDetailPage';
// QMS — CAPA
import CAPAListPage from '@/features/qms/capa/CAPAListPage';
import CAPACreatePage from '@/features/qms/capa/CAPACreatePage';
import CAPADetailPage from '@/features/qms/capa/CAPADetailPage';
// QMS — Risk
import RiskListPage from '@/features/qms/risk/RiskListPage';
import RiskCreatePage from '@/features/qms/risk/RiskCreatePage';
import RiskDetailPage from '@/features/qms/risk/RiskDetailPage';
// QMS — Audit
import AuditListPage from '@/features/qms/audit/AuditListPage';
import AuditCreatePage from '@/features/qms/audit/AuditCreatePage';
import AuditDetailPage from '@/features/qms/audit/AuditDetailPage';
// QMS — FMEA
import FMEAListPage from '@/features/qms/fmea/FMEAListPage';
import FMEACreatePage from '@/features/qms/fmea/FMEACreatePage';
import FMEADetailPage from '@/features/qms/fmea/FMEADetailPage';
// QMS — Compliance
import ComplianceListPage from '@/features/qms/compliance/ComplianceListPage';
import ComplianceDetailPage from '@/features/qms/compliance/ComplianceDetailPage';
// QMS — Supplier
import SupplierListPage from '@/features/qms/supplier/SupplierListPage';
import SupplierCreatePage from '@/features/qms/supplier/SupplierCreatePage';
import SupplierDetailPage from '@/features/qms/supplier/SupplierDetailPage';
// QMS — Change Control
import ChangeControlListPage from '@/features/qms/change-control/ChangeControlListPage';
import ChangeControlCreatePage from '@/features/qms/change-control/ChangeControlCreatePage';
import ChangeControlDetailPage from '@/features/qms/change-control/ChangeControlDetailPage';
// QMS — Complaints
import ComplaintListPage from '@/features/qms/complaints/ComplaintListPage';
import ComplaintCreatePage from '@/features/qms/complaints/ComplaintCreatePage';
import ComplaintDetailPage from '@/features/qms/complaints/ComplaintDetailPage';
// QMS — Management Review
import ManagementReviewPage from '@/features/qms/management-review/ManagementReviewPage';
// Calibration
import CalibrationListPage from '@/features/calibration/CalibrationListPage';
import CalibrationCreatePage from '@/features/calibration/CalibrationCreatePage';
import CalibrationDetailPage from '@/features/calibration/CalibrationDetailPage';
// Inspection
import InspectionListPage from '@/features/inspection/InspectionListPage';
import InspectionCreatePage from '@/features/inspection/InspectionCreatePage';
import InspectionDetailPage from '@/features/inspection/InspectionDetailPage';
// LMS
import TrainingListPage from '@/features/lms/training/TrainingListPage';
import TrainingCreatePage from '@/features/lms/training/TrainingCreatePage';
import TrainingDetailPage from '@/features/lms/training/TrainingDetailPage';
import CompetencyMatrixPage from '@/features/lms/competency/CompetencyMatrixPage';
// Compliance Hub
import ComplianceHubPage from '@/features/compliance/ComplianceHubPage';
import InspectionReadinessPage from '@/features/compliance/InspectionReadinessPage';
import RegulatoryChangesPage from '@/features/compliance/RegulatoryChangesPage';
// LMS — Regulatory Training
import RegulatoryTrainingPage from '@/features/lms/regulatory/RegulatoryTrainingPage';
// Workflows
import WorkflowsPage from '@/features/workflows/WorkflowsPage';
import WorkflowDetailPage from '@/features/workflows/WorkflowDetailPage';
// System
import AuditLogPage from '@/pages/AuditLogPage';
import SettingsPage from '@/pages/SettingsPage';
import ApiDocsPage from '@/pages/ApiDocsPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/:id" element={<WorkflowDetailPage />} />

          {/* QMS — Non-Conformance */}
          <Route path="/qms/non-conformances" element={<NCListPage />} />
          <Route path="/qms/non-conformances/new" element={<NCCreatePage />} />
          <Route path="/qms/non-conformances/:id" element={<NCDetailPage />} />

          {/* QMS — CAPA */}
          <Route path="/qms/capa" element={<CAPAListPage />} />
          <Route path="/qms/capa/new" element={<CAPACreatePage />} />
          <Route path="/qms/capa/:id" element={<CAPADetailPage />} />

          {/* QMS — Risk */}
          <Route path="/qms/risks" element={<RiskListPage />} />
          <Route path="/qms/risks/new" element={<RiskCreatePage />} />
          <Route path="/qms/risks/:id" element={<RiskDetailPage />} />

          {/* QMS — Audit */}
          <Route path="/qms/audits" element={<AuditListPage />} />
          <Route path="/qms/audits/new" element={<AuditCreatePage />} />
          <Route path="/qms/audits/:id" element={<AuditDetailPage />} />

          {/* QMS — FMEA */}
          <Route path="/qms/fmea" element={<FMEAListPage />} />
          <Route path="/qms/fmea/new" element={<FMEACreatePage />} />
          <Route path="/qms/fmea/:id" element={<FMEADetailPage />} />

          {/* QMS — Compliance */}
          <Route path="/qms/compliance" element={<ComplianceListPage />} />
          <Route path="/qms/compliance/:id" element={<ComplianceDetailPage />} />

          {/* QMS — Supplier */}
          <Route path="/qms/suppliers" element={<SupplierListPage />} />
          <Route path="/qms/suppliers/new" element={<SupplierCreatePage />} />
          <Route path="/qms/suppliers/:id" element={<SupplierDetailPage />} />

          {/* QMS — Change Control */}
          <Route path="/qms/change-control" element={<ChangeControlListPage />} />
          <Route path="/qms/change-control/new" element={<ChangeControlCreatePage />} />
          <Route path="/qms/change-control/:id" element={<ChangeControlDetailPage />} />

          {/* QMS — Complaints */}
          <Route path="/qms/complaints" element={<ComplaintListPage />} />
          <Route path="/qms/complaints/new" element={<ComplaintCreatePage />} />
          <Route path="/qms/complaints/:id" element={<ComplaintDetailPage />} />

          {/* QMS — Management Review */}
          <Route path="/qms/management-review" element={<ManagementReviewPage />} />

          {/* DMS */}
          <Route path="/dms/documents" element={<DocumentListPage />} />
          <Route path="/dms/documents/new" element={<DocumentCreatePage />} />
          <Route path="/dms/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/dms/templates" element={<TemplateListPage />} />
          <Route path="/dms/templates/new" element={<TemplateCreatePage />} />
          <Route path="/dms/templates/:id" element={<TemplateDetailPage />} />

          {/* Calibration */}
          <Route path="/calibration" element={<CalibrationListPage />} />
          <Route path="/calibration/new" element={<CalibrationCreatePage />} />
          <Route path="/calibration/:id" element={<CalibrationDetailPage />} />

          {/* Inspection */}
          <Route path="/inspection" element={<InspectionListPage />} />
          <Route path="/inspection/new" element={<InspectionCreatePage />} />
          <Route path="/inspection/:id" element={<InspectionDetailPage />} />

          {/* LMS */}
          <Route path="/lms/training" element={<TrainingListPage />} />
          <Route path="/lms/training/new" element={<TrainingCreatePage />} />
          <Route path="/lms/training/:id" element={<TrainingDetailPage />} />
          <Route path="/lms/competency" element={<CompetencyMatrixPage />} />
          <Route path="/lms/regulatory-training" element={<RegulatoryTrainingPage />} />

          {/* Compliance Hub */}
          <Route path="/compliance/hub" element={<ComplianceHubPage />} />
          <Route path="/compliance/inspection-readiness" element={<InspectionReadinessPage />} />
          <Route path="/compliance/regulatory-changes" element={<RegulatoryChangesPage />} />

          {/* System */}
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
