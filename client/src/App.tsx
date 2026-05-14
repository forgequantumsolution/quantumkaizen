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
// Dynamic Forms
import FormListPage from '@/features/forms/FormListPage';
import FormCreatePage from '@/features/forms/FormCreatePage';
import FormBuilderPage from '@/features/forms/FormBuilderPage';
import FormFillPage from '@/features/forms/FormFillPage';
import FieldTypesPage from '@/features/forms/FieldTypesPage';
// System
import SettingsPage from '@/pages/SettingsPage';
import AppearancePage from '@/pages/AppearancePage';
// Theme bridge — applies appearance store to the live document
import AppearanceProvider from '@/components/theme/AppearanceProvider';

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
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="/workflows/:id/builder" element={<WorkflowBuilderPage />} />
          <Route path="/admin/workflow-lookups" element={<WorkflowLookupsPage />} />
          <Route path="/admin/business-calendars" element={<BusinessCalendarsPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />

          {/* Dynamic Forms */}
          <Route path="/forms" element={<FormListPage />} />
          <Route path="/forms/new" element={<FormCreatePage />} />
          <Route path="/forms/field-types" element={<FieldTypesPage />} />
          <Route path="/forms/:id/builder" element={<FormBuilderPage />} />
          <Route path="/forms/:id/fill" element={<FormFillPage />} />

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
