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
import AuditProgramListPage from '@/features/audit/AuditProgramListPage';
import AuditProgramExecutionPage from '@/features/audit/AuditProgramExecutionPage';
import NonConformanceTrackPage from '@/features/audit/NonConformanceTrackPage';
import AuditConfigLayout from '@/features/audit/AuditConfigLayout';
import AuditMasterPage from '@/features/audit/AuditMasterPage';
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

          {/* Audit module — Register → Approval → Program → Non-Conformance */}
          <Route path="/audit" element={<Navigate to="/audit/register" replace />} />
          <Route element={<AuditModuleLayout />}>
            <Route path="/audit/register" element={<AuditRegisterListPage />} />
            <Route path="/audit/program" element={<AuditProgramListPage />} />
            <Route path="/audit/non-conformance" element={<NonConformanceTrackPage />} />
          </Route>
          <Route path="/audit/register/:id" element={<AuditRegisterDetailPage />} />
          <Route path="/audit/program/:id" element={<AuditProgramExecutionPage />} />
          <Route element={<AuditConfigLayout />}>
            <Route path="/audit/master" element={<AuditMasterPage />} />
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
