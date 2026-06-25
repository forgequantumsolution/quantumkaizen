import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
// Workflows
import WorkflowsPage from '@/features/workflows/WorkflowsPage';
import WorkflowDetailPage from '@/features/workflows/WorkflowDetailPage';
import WorkflowBuilderPage from '@/features/workflows/builder/WorkflowBuilderPage';
import WorkflowLookupsPage from '@/features/admin/workflow-lookups/WorkflowLookupsPage';
import BusinessCalendarsPage from '@/features/admin/business-calendars/BusinessCalendarsPage';
// Tickets
import TicketsPage from '@/features/tickets/TicketsPage';
import TicketDetailPage from '@/features/tickets/TicketDetailPage';
// Modules (dynamic, per workflow type)
import ModulePage from '@/features/modules/ModulePage';
// Dynamic Forms
import FormCreatePage from '@/features/forms/FormCreatePage';
import FormBuilderPage from '@/features/forms/FormBuilderPage';
import FormFillPage from '@/features/forms/FormFillPage';
import FieldTypesPage from '@/features/forms/FieldTypesPage';
// Audit module
import AuditModuleLayout from '@/features/audit/AuditModuleLayout';
import AuditRegisterListPage from '@/features/audit/AuditRegisterListPage';
import AuditRegisterDetailPage from '@/features/audit/AuditRegisterDetailPage';
import AuditRegisterFormPage from '@/features/audit/AuditRegisterFormPage';
import AuditProgramListPage from '@/features/audit/AuditProgramListPage';
import AuditProgramExecutionPage from '@/features/audit/AuditProgramExecutionPage';
import NonConformanceTrackPage from '@/features/audit/NonConformanceTrackPage';
import AuditDashboardPage from '@/features/audit/AuditDashboardPage';
import AuditWorkspacePage from '@/features/audit/AuditWorkspacePage';
import DocumentListPage from '@/features/dms/DocumentListPage';
import DocumentEditorPage from '@/features/dms/DocumentEditorPage';
import DocumentDetailPage from '@/features/dms/DocumentDetailPage';
import TrainingListPage from '@/features/training/TrainingListPage';
import TrainingDetailPage from '@/features/training/TrainingDetailPage';
import LabRegistryPage from '@/features/lims/LabRegistryPage';
import EquipmentListPage from '@/features/lims/EquipmentListPage';
import EquipmentDetailPage from '@/features/lims/EquipmentDetailPage';
import CertificationsPage from '@/features/lims/CertificationsPage';
import MethodsPage from '@/features/lims/MethodsPage';
import SpecListPage from '@/features/lims/SpecListPage';
import SpecDetailPage from '@/features/lims/SpecDetailPage';
import SampleListPage from '@/features/lims/SampleListPage';
import SampleDetailPage from '@/features/lims/SampleDetailPage';
import StorageLocationsPage from '@/features/lims/StorageLocationsPage';
import ProductsPage from '@/features/lims/ProductsPage';
import AnalytesPage from '@/features/lims/AnalytesPage';
import UnitsPage from '@/features/lims/UnitsPage';
import SamplingPointsPage from '@/features/lims/SamplingPointsPage';
import CustomersPage from '@/features/lims/CustomersPage';
import SuppliersPage from '@/features/lims/SuppliersPage';
import TestDefinitionsPage from '@/features/lims/TestDefinitionsPage';
import TestPanelsPage from '@/features/lims/TestPanelsPage';
import SpecVersionsPage from '@/features/lims/SpecVersionsPage';
import WorklistsPage from '@/features/lims/WorklistsPage';
import OosListPage from '@/features/lims/OosListPage';
import OosDetailPage from '@/features/lims/OosDetailPage';
import QcMaterialsPage from '@/features/lims/QcMaterialsPage';
import QcChartPage from '@/features/lims/QcChartPage';
import StabilityListPage from '@/features/lims/StabilityListPage';
import StabilityDetailPage from '@/features/lims/StabilityDetailPage';
import CoaListPage from '@/features/lims/CoaListPage';
import CoaDetailPage from '@/features/lims/CoaDetailPage';
import CoaVerifyPage from '@/features/lims/CoaVerifyPage';
import LimsDashboardPage from '@/features/lims/LimsDashboardPage';
import DataReviewPage from '@/features/lims/DataReviewPage';
import LimsConfigLayout from '@/features/lims/LimsConfigLayout';
import AuditReportPage from '@/features/audit/AuditReportPage';
import CapaListPage from '@/features/audit/CapaListPage';
import CapaDetailPage from '@/features/audit/CapaDetailPage';
import ActionItemsPage from '@/features/audit/ActionItemsPage';
import AuditConfigLayout from '@/features/audit/AuditConfigLayout';
import AuditMasterPage from '@/features/audit/AuditMasterPage';
import AuditMasterFormPage from '@/features/audit/AuditMasterFormPage';
import FocusAreaPage from '@/features/audit/FocusAreaPage';
import AuditTypePage from '@/features/audit/AuditTypePage';
import IsoStandardsPage from '@/features/audit/IsoStandardsPage';
// System
import SettingsPage from '@/pages/SettingsPage';
import AppearancePage from '@/pages/AppearancePage';
// Theme bridge — applies appearance store to the live document
import AppearanceProvider from '@/components/theme/AppearanceProvider';
import PageContainer from '@/components/layout/PageContainer';

export default function App() {
  return (
    <AppearanceProvider>
    <Routes>
      {/* Public */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Public CoA QR verification — no auth */}
      <Route path="/verify/coa/:token" element={<CoaVerifyPage />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workflows" element={<PageContainer><WorkflowsPage /></PageContainer>} />
          <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="/workflows/:id/builder" element={<WorkflowBuilderPage />} />
          <Route path="/admin/workflow-lookups" element={<WorkflowLookupsPage />} />
          <Route path="/admin/business-calendars" element={<BusinessCalendarsPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/modules/:typeId" element={<ModulePage />} />

          {/* Dynamic Forms */}
          <Route path="/forms" element={<Navigate to="/settings?section=forms" replace />} />
          <Route path="/forms/new" element={<FormCreatePage />} />
          <Route path="/forms/field-types" element={<FieldTypesPage />} />
          <Route path="/forms/:id/builder" element={<FormBuilderPage />} />
          <Route path="/forms/:id/fill" element={<FormFillPage />} />

          {/* DMS — controlled documents (online editor) */}
          <Route path="/dms" element={<DocumentListPage />} />
          <Route path="/dms/new" element={<DocumentEditorPage />} />
          <Route path="/dms/:id" element={<DocumentDetailPage />} />
          <Route path="/dms/:id/edit" element={<DocumentEditorPage />} />

          {/* Training & Competency */}
          <Route path="/training" element={<TrainingListPage />} />
          <Route path="/training/:id" element={<TrainingDetailPage />} />

          {/* LIMS — operational (day-to-day) */}
          <Route path="/lims/samples" element={<SampleListPage />} />
          <Route path="/lims/samples/:id" element={<SampleDetailPage />} />

          {/* LIMS Configuration — all set-up-once master data under one grouped area */}
          <Route path="/lims/config" element={<Navigate to="/lims/labs" replace />} />
          <Route element={<LimsConfigLayout />}>
            <Route path="/lims/labs" element={<LabRegistryPage />} />
            <Route path="/lims/equipment" element={<EquipmentListPage />} />
            <Route path="/lims/storage" element={<StorageLocationsPage />} />
            <Route path="/lims/certifications" element={<CertificationsPage />} />
            <Route path="/lims/products" element={<ProductsPage />} />
            <Route path="/lims/analytes" element={<AnalytesPage />} />
            <Route path="/lims/units" element={<UnitsPage />} />
            <Route path="/lims/sampling-points" element={<SamplingPointsPage />} />
            <Route path="/lims/customers" element={<CustomersPage />} />
            <Route path="/lims/suppliers" element={<SuppliersPage />} />
            <Route path="/lims/methods" element={<MethodsPage />} />
            <Route path="/lims/tests" element={<TestDefinitionsPage />} />
            <Route path="/lims/panels" element={<TestPanelsPage />} />
            <Route path="/lims/specifications" element={<SpecListPage />} />
            <Route path="/lims/spec-versions" element={<SpecVersionsPage />} />
          </Route>
          {/* Config detail/editor pages (full-page, outside the config nav) */}
          <Route path="/lims/equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="/lims/specifications/new" element={<SpecDetailPage />} />
          <Route path="/lims/specifications/:id" element={<SpecDetailPage />} />

          {/* LIMS 2.0 — M-LIMS-B core testing */}
          <Route path="/lims/worklists" element={<WorklistsPage />} />
          <Route path="/lims/oos" element={<OosListPage />} />
          <Route path="/lims/oos/:id" element={<OosDetailPage />} />
          {/* LIMS 2.0 — M-LIMS-C: QC + Stability */}
          <Route path="/lims/qc" element={<QcMaterialsPage />} />
          <Route path="/lims/qc/:id" element={<QcChartPage />} />
          <Route path="/lims/stability" element={<StabilityListPage />} />
          <Route path="/lims/stability/:id" element={<StabilityDetailPage />} />
          {/* LIMS 2.0 — M-LIMS-D: CoA, dashboard, data review */}
          <Route path="/lims/coa" element={<CoaListPage />} />
          <Route path="/lims/coa/:id" element={<CoaDetailPage />} />
          <Route path="/lims/dashboard" element={<LimsDashboardPage />} />
          <Route path="/lims/data-review" element={<DataReviewPage />} />

          {/* Audit module — Register → Approval → Program → Non-Conformance */}
          <Route path="/audit" element={<Navigate to="/audit/dashboard" replace />} />
          <Route element={<AuditModuleLayout />}>
            <Route path="/audit/dashboard" element={<AuditDashboardPage />} />
            <Route path="/audit/workspace" element={<AuditWorkspacePage />} />
            {/* Schedule now lives as a section on the Audit Program page. */}
            <Route path="/audit/schedule" element={<Navigate to="/audit/program" replace />} />
            <Route path="/audit/register" element={<AuditRegisterListPage />} />
            <Route path="/audit/program" element={<AuditProgramListPage />} />
            <Route path="/audit/non-conformance" element={<NonConformanceTrackPage />} />
            <Route path="/audit/capa" element={<CapaListPage />} />
            <Route path="/audit/actions" element={<ActionItemsPage />} />
          </Route>
          <Route path="/audit/capa/:id" element={<CapaDetailPage />} />
          <Route path="/audit/register/new" element={<AuditRegisterFormPage />} />
          <Route path="/audit/register/:id/edit" element={<AuditRegisterFormPage />} />
          <Route path="/audit/register/:id" element={<AuditRegisterDetailPage />} />
          <Route path="/audit/register/:id/report" element={<AuditReportPage />} />
          <Route path="/audit/program/:id" element={<AuditProgramExecutionPage />} />
          <Route path="/audit/master/new" element={<AuditMasterFormPage />} />
          <Route path="/audit/master/:id/edit" element={<AuditMasterFormPage />} />
          <Route element={<AuditConfigLayout />}>
            <Route path="/audit/master" element={<AuditMasterPage />} />
            <Route path="/audit/focus-areas" element={<FocusAreaPage />} />
            <Route path="/audit/audit-types" element={<AuditTypePage />} />
            <Route path="/audit/iso-standards" element={<IsoStandardsPage />} />
          </Route>

          {/* System */}
          <Route path="/appearance" element={<AppearancePage />} />
          <Route path="/settings"   element={<SettingsPage />} />

          {/* Catch-all → dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
    </AppearanceProvider>
  );
}
