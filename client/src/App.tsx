import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
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
import AuditTrailPage from '@/features/admin/audit-trail/AuditTrailPage';
import OutOfOfficePage from '@/features/profile/OutOfOfficePage';
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
import CourseListPage from '@/features/lms/CourseListPage';
import CourseBuilderPage from '@/features/lms/CourseBuilderPage';
import MyLearningPage from '@/features/lms/MyLearningPage';
import CatalogPage from '@/features/lms/CatalogPage';
import CoursePlayerPage from '@/features/lms/CoursePlayerPage';
import ExamBuilderPage from '@/features/lms/ExamBuilderPage';
import ExamPlayerPage from '@/features/lms/ExamPlayerPage';
import GradingPage from '@/features/lms/GradingPage';
import AssignmentsPage from '@/features/lms/AssignmentsPage';
import CurriculaPage from '@/features/lms/CurriculaPage';
import TrainingMatrixPage from '@/features/lms/TrainingMatrixPage';
import CertificatePage from '@/features/lms/CertificatePage';
import ReportsPage from '@/features/lms/ReportsPage';
import CertificateVerifyPage from '@/features/lms/CertificateVerifyPage';
import LmsModuleLayout from '@/features/lms/LmsModuleLayout';
import LmsConfigLayout from '@/features/lms/LmsConfigLayout';
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
import LimsModuleLayout from '@/features/lims/LimsModuleLayout';
import CalibrationModuleLayout from '@/features/calibration/CalibrationModuleLayout';
import CalibrationDashboardPage from '@/features/calibration/CalibrationDashboardPage';
import InstrumentListPage from '@/features/calibration/InstrumentListPage';
import InstrumentDetailPage from '@/features/calibration/InstrumentDetailPage';
import CalibrationSchedulePage from '@/features/calibration/CalibrationSchedulePage';
import CalibrationEventsPage from '@/features/calibration/CalibrationEventsPage';
import CalibrationEventPage from '@/features/calibration/CalibrationEventPage';
import { OotListPage, OotDetailPage } from '@/features/calibration/OotPage';
import InUseChecksPage from '@/features/calibration/InUseChecksPage';
import ReferenceStandardsPage from '@/features/calibration/ReferenceStandardsPage';
import MsaStudiesPage from '@/features/calibration/MsaStudiesPage';
import ProvidersPage from '@/features/calibration/ProvidersPage';
import CalibrationConfigLayout from '@/features/calibration/CalibrationConfigLayout';
import InstrumentVerifyPage from '@/features/calibration/InstrumentVerifyPage';
import IndustryPacksPage from '@/features/calibration/IndustryPacksPage';
import CalibrationPolicyPage from '@/features/calibration/CalibrationPolicyPage';
import EquipmentCategoriesPage from '@/features/calibration/EquipmentCategoriesPage';
import AuditReportPage from '@/features/audit/AuditReportPage';
import CapaListPage from '@/features/audit/CapaListPage';
import CapaDetailPage from '@/features/audit/CapaDetailPage';
import AuditConfigLayout from '@/features/audit/AuditConfigLayout';
import AuditMasterPage from '@/features/audit/AuditMasterPage';
import AuditMasterFormPage from '@/features/audit/AuditMasterFormPage';
import FocusAreaPage from '@/features/audit/FocusAreaPage';
import AuditTypePage from '@/features/audit/AuditTypePage';
import IsoStandardsPage from '@/features/audit/IsoStandardsPage';
// Risk Management
import RiskModuleLayout from '@/features/risk/RiskModuleLayout';
import RiskConfigLayout from '@/features/risk/RiskConfigLayout';
import RiskDashboardPage from '@/features/risk/RiskDashboardPage';
import RiskAssessmentListPage from '@/features/risk/RiskAssessmentListPage';
import RiskAssessmentDetailPage from '@/features/risk/RiskAssessmentDetailPage';
import RiskRegisterListPage from '@/features/risk/RiskRegisterListPage';
import RiskListPage from '@/features/risk/RiskListPage';
import RiskDetailPage from '@/features/risk/RiskDetailPage';
import RiskControlListPage from '@/features/risk/RiskControlListPage';
import RiskReviewListPage from '@/features/risk/RiskReviewListPage';
import RiskFrameworkPage from '@/features/risk/RiskFrameworkPage';
import RiskCategoryPage from '@/features/risk/RiskCategoryPage';
import RiskLibraryPage from '@/features/risk/RiskLibraryPage';
// System
import SettingsPage from '@/pages/SettingsPage';
import AppearancePage from '@/pages/AppearancePage';
import IntegrationsPage from '@/pages/IntegrationsPage';
// Theme bridge — applies appearance store to the live document
import AppearanceProvider from '@/components/theme/AppearanceProvider';
import PageContainer from '@/components/layout/PageContainer';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  // On every full page load, reconcile the cached permissions with the server
  // (GET /auth/me). Without this a browser refresh only rehydrates the persisted
  // permissions from the last login, so access granted/revoked in Access Control
  // wouldn't show until a full re-login. refreshUser no-ops when unauthenticated.
  useEffect(() => {
    if (isAuthenticated) void refreshUser();
  }, [isAuthenticated, refreshUser]);

  return (
    <AppearanceProvider>
    <Routes>
      {/* Public */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Public CoA QR verification — no auth */}
      <Route path="/verify/coa/:token" element={<CoaVerifyPage />} />
      {/* Public LMS certificate QR verification — no auth */}
      <Route path="/verify/certificate/:token" element={<CertificateVerifyPage />} />
      {/* Public calibration-label QR verification — no auth */}
      <Route path="/verify/instrument/:token" element={<InstrumentVerifyPage />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workflows" element={<PageContainer><WorkflowsPage /></PageContainer>} />
          <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="/workflows/:id/builder" element={<WorkflowBuilderPage />} />
          <Route path="/admin/workflow-lookups" element={<WorkflowLookupsPage />} />
          <Route path="/admin/business-calendars" element={<BusinessCalendarsPage />} />
          <Route path="/admin/audit-trail" element={<AuditTrailPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/out-of-office" element={<OutOfOfficePage />} />
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

          {/* LMS — Learning Management System. List/overview pages share the
              LmsModuleLayout tab bar; player/builder/certificate pages stay
              full-page (drill-downs, like LIMS SampleDetailPage). */}
          <Route path="/lms" element={<Navigate to="/lms/my" replace />} />
          <Route element={<LmsModuleLayout />}>
            <Route path="/lms/my" element={<MyLearningPage />} />
            <Route path="/lms/catalog" element={<CatalogPage />} />
            <Route path="/lms/admin/assignments" element={<AssignmentsPage />} />
            <Route path="/lms/admin/grading" element={<GradingPage />} />
            <Route path="/lms/admin/reports" element={<ReportsPage />} />
            {/* Configuration — set-up-once authoring, nested sub-layout inside
                the LMS module (its own left sub-sidebar, not a separate entry). */}
            <Route element={<LmsConfigLayout />}>
              <Route path="/lms/admin/courses" element={<CourseListPage />} />
              <Route path="/lms/admin/curricula" element={<CurriculaPage />} />
              <Route path="/lms/admin/matrix" element={<TrainingMatrixPage />} />
            </Route>
          </Route>
          <Route path="/lms/learn/:id" element={<CoursePlayerPage />} />
          <Route path="/lms/learn/:id/exam" element={<ExamPlayerPage />} />
          <Route path="/lms/admin/courses/:id" element={<CourseBuilderPage />} />
          <Route path="/lms/admin/courses/:id/exam" element={<ExamBuilderPage />} />
          <Route path="/lms/certificate/:id" element={<CertificatePage />} />

          {/* LIMS — operational (day-to-day). List/overview pages share the
              LimsModuleLayout tab bar; detail/editor pages stay full-page. */}
          {/* ── Calibration & Measuring Equipment — independent module ──
              Own tables, own RBAC keys; LIMS is an optional soft link only. */}
          <Route path="/calibration" element={<Navigate to="/calibration/dashboard" replace />} />
          <Route element={<CalibrationModuleLayout />}>
            <Route path="/calibration/dashboard" element={<CalibrationDashboardPage />} />
            <Route path="/calibration/instruments" element={<InstrumentListPage />} />
            <Route path="/calibration/schedule" element={<CalibrationSchedulePage />} />
            <Route path="/calibration/events" element={<CalibrationEventsPage />} />
            <Route path="/calibration/oot" element={<OotListPage />} />
            <Route path="/calibration/checks" element={<InUseChecksPage />} />
          </Route>

          {/* Set-up-once master data lives in its own shell, mirroring
              "LIMS Configuration" (LimsConfigLayout). */}
          <Route path="/calibration/config" element={<Navigate to="/calibration/config/packs" replace />} />
          <Route element={<CalibrationConfigLayout />}>
            <Route path="/calibration/config/packs" element={<IndustryPacksPage />} />
            <Route path="/calibration/config/policy" element={<CalibrationPolicyPage />} />
            <Route path="/calibration/config/categories" element={<EquipmentCategoriesPage />} />
            <Route path="/calibration/config/standards" element={<ReferenceStandardsPage />} />
            <Route path="/calibration/config/providers" element={<ProvidersPage />} />
            <Route path="/calibration/config/msa" element={<MsaStudiesPage />} />
          </Route>
          {/* Old flat paths keep working. */}
          <Route path="/calibration/settings" element={<Navigate to="/calibration/config/policy" replace />} />
          <Route path="/calibration/providers" element={<Navigate to="/calibration/config/providers" replace />} />
          <Route path="/calibration/standards" element={<Navigate to="/calibration/config/standards" replace />} />
          <Route path="/calibration/msa" element={<Navigate to="/calibration/config/msa" replace />} />
          {/* Detail pages stay full-page, matching the LIMS pattern. */}
          <Route path="/calibration/instruments/:id" element={<InstrumentDetailPage />} />
          <Route path="/calibration/events/:id" element={<CalibrationEventPage />} />
          <Route path="/calibration/oot/:id" element={<OotDetailPage />} />

          <Route path="/lims" element={<Navigate to="/lims/dashboard" replace />} />
          <Route element={<LimsModuleLayout />}>
            <Route path="/lims/dashboard" element={<LimsDashboardPage />} />
            <Route path="/lims/samples" element={<SampleListPage />} />
            <Route path="/lims/worklists" element={<WorklistsPage />} />
            <Route path="/lims/qc" element={<QcMaterialsPage />} />
            <Route path="/lims/stability" element={<StabilityListPage />} />
            <Route path="/lims/oos" element={<OosListPage />} />
            <Route path="/lims/coa" element={<CoaListPage />} />
            <Route path="/lims/data-review" element={<DataReviewPage />} />
          </Route>
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

          {/* LIMS operational detail pages (full-page, no tab bar) */}
          <Route path="/lims/oos/:id" element={<OosDetailPage />} />
          <Route path="/lims/qc/:id" element={<QcChartPage />} />
          <Route path="/lims/stability/:id" element={<StabilityDetailPage />} />
          <Route path="/lims/coa/:id" element={<CoaDetailPage />} />

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

          {/* Risk Management — Overview → Assessments → Registers → Risks → Controls → Reviews.
              Shares the RiskModuleLayout tab bar; detail pages stay full-page. */}
          <Route path="/risk" element={<Navigate to="/risk/dashboard" replace />} />
          <Route element={<RiskModuleLayout />}>
            <Route path="/risk/dashboard" element={<RiskDashboardPage />} />
            <Route path="/risk/assessments" element={<RiskAssessmentListPage />} />
            <Route path="/risk/registers" element={<RiskRegisterListPage />} />
            <Route path="/risk/risks" element={<RiskListPage />} />
            <Route path="/risk/controls" element={<RiskControlListPage />} />
            <Route path="/risk/reviews" element={<RiskReviewListPage />} />
          </Route>
          {/* Risk detail pages (full-page, no tab bar) */}
          <Route path="/risk/risks/:id" element={<RiskDetailPage />} />
          <Route path="/risk/assessments/:id" element={<RiskAssessmentDetailPage />} />
          {/* Risk Configuration — frameworks / categories / libraries */}
          <Route path="/risk/config" element={<Navigate to="/risk/config/frameworks" replace />} />
          <Route element={<RiskConfigLayout />}>
            <Route path="/risk/config/frameworks" element={<RiskFrameworkPage />} />
            <Route path="/risk/config/categories" element={<RiskCategoryPage />} />
            <Route path="/risk/config/library" element={<RiskLibraryPage />} />
          </Route>

          {/* System */}
          <Route path="/appearance" element={<AppearancePage />} />
          <Route path="/settings"   element={<SettingsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />

          {/* Catch-all → dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
    </AppearanceProvider>
  );
}
