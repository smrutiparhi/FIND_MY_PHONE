import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { HealthCheckPage } from '../pages/HealthCheckPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        {/* /status is a diagnostics page from Parts 1 and 3 (API/DB/auth connectivity) - kept
            around unlisted (not in AppLayout's nav) since it's still useful for debugging. */}
        <Route path="/status" element={<HealthCheckPage />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/devices"
            element={
              <ComingSoonPage
                title="My Devices"
                description="Standalone device management is coming in a later part - for now, devices are added while reporting a lost or stolen phone."
              />
            }
          />
          <Route
            path="/recovery-cases"
            element={
              <ComingSoonPage
                title="Recovery Cases"
                description="A full case history view is coming in a later part - your active and recent cases are on the Dashboard for now."
              />
            }
          />
          <Route
            path="/evidence"
            element={
              <ComingSoonPage
                title="Evidence Vault"
                description="Secure evidence storage is coming in a later part of RecoverAI."
              />
            }
          />
          <Route
            path="/notifications"
            element={
              <ComingSoonPage
                title="Notifications"
                description="In-app notifications are coming in a later part of RecoverAI."
              />
            }
          />
          <Route
            path="/recovery/new"
            element={
              <ComingSoonPage
                title="Report Lost or Stolen Phone"
                description="The incident-reporting wizard is coming in the next part of RecoverAI."
              />
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
