import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AdminDashboard } from './pages/dashboard/AdminDashboard';
import { StaffDashboard } from './pages/dashboard/StaffDashboard';
import { Phase1FoundationPage } from './pages/Phase1FoundationPage';
import { AppShell } from './layouts/AppShell';

// Phase 4 Master Data Management Pages
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { AdminStaffDetailPage } from './pages/admin/AdminStaffDetailPage';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage';
import { AdminClassesPage } from './pages/admin/AdminClassesPage';
import { AdminSubjectsPage } from './pages/admin/AdminSubjectsPage';
import { AdminAcademicYearsPage } from './pages/admin/AdminAcademicYearsPage';
import { AdminTimetablePage } from './pages/admin/AdminTimetablePage';
import { AdminClassCoveragePage } from './pages/admin/AdminClassCoveragePage';
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage';
import { AdminOperationsPage } from './pages/admin/AdminOperationsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { StaffReportsPage } from './pages/staff/StaffReportsPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminAiCopilotPage } from './pages/admin/AdminAiCopilotPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { StaffAiPage } from './pages/staff/StaffAiPage';
import { StaffWorkloadPage } from './pages/staff/StaffWorkloadPage';
import { StaffPerformancePage } from './pages/staff/StaffPerformancePage';

/**
 * Root Redirect Handler: Routes authenticated users to their role-specific dashboard,
 * or unauthenticated users to /login.
 */
const RootRedirect: React.FC = () => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/staff/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <ToastProvider>
          <AuthProvider>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminStaffPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/staff/:id"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminStaffDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/departments"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDepartmentsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/classes"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminClassesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/subjects"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminSubjectsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/academic-years"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAcademicYearsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/timetable"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminTimetablePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/coverage"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminClassCoveragePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/attendance"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAttendancePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/operations"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminOperationsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/alerts"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminOperationsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAuditLogsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/ai-copilot"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAiCopilotPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAnalyticsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/workload"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAnalyticsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/performance"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminAnalyticsPage />
                </ProtectedRoute>
              }
            />

            {/* Protected Staff Routes */}
            <Route
              path="/staff/dashboard"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/activity"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/attendance"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/workload"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffWorkloadPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/performance"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffPerformancePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/ai-assistant"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffAiPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/reports"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffReportsPage />
                </ProtectedRoute>
              }
            />

            {/* Phase 1 Foundation Infrastructure View (Preserved) */}
            <Route
              path="/foundation"
              element={
                <AppShell>
                  <Phase1FoundationPage />
                </AppShell>
              }
            />

            {/* Root & Fallback */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  </ErrorBoundary>
);
};

export default App;
