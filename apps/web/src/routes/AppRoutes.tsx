import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LandingPage } from '../pages/LandingPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { HealthCheckPage } from '../pages/HealthCheckPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { NewRecoveryCasePage } from '../pages/wizard/NewRecoveryCasePage';
import { RecoveryCaseDetailPage } from '../pages/RecoveryCaseDetailPage';
import { RecoveryLocationPage } from '../pages/RecoveryLocationPage';
import { AccountRecoveryPage } from '../pages/AccountRecoveryPage';
import { EmergencyModePage } from '../pages/EmergencyModePage';
import { SimProtectionPage } from '../pages/SimProtectionPage';
import { FinancialSecurityPage } from '../pages/FinancialSecurityPage';
import { PoliceReportPage } from '../pages/PoliceReportPage';
import { CeirPage } from '../pages/CeirPage';
import { EvidenceVaultPage } from '../pages/EvidenceVaultPage';
import { TimelinePage } from '../pages/TimelinePage';
import { DeviceRecoveredPage } from '../pages/DeviceRecoveredPage';
import { NotificationsPage } from '../pages/NotificationsPage';

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        {/* /status is a diagnostics page from Parts 1 and 3 (API/DB/auth connectivity) - kept
            around unlisted (not in AppLayout's nav) since it's still useful for debugging. */}
        <Route path="/status" element={<HealthCheckPage />} />

        {/* Standalone, full-screen (no nav chrome) - the master spec treats this as an
            emergency-onboarding flow, so it gets the same distraction-free focus as auth pages. */}
        <Route path="/recovery/new" element={<NewRecoveryCasePage />} />

        {/* Also standalone/no nav chrome - "Display a focused emergency interface... Do not
            display a huge checklist during emergency mode" (master spec Part 10). */}
        <Route path="/recovery-cases/:caseId/emergency" element={<EmergencyModePage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
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
          <Route path="/recovery-cases/:caseId" element={<RecoveryCaseDetailPage />} />
          <Route path="/recovery-cases/:caseId/location" element={<RecoveryLocationPage />} />
          <Route path="/recovery-cases/:caseId/account-recovery" element={<AccountRecoveryPage />} />
          <Route path="/recovery-cases/:caseId/sim" element={<SimProtectionPage />} />
          <Route path="/recovery-cases/:caseId/financial-security" element={<FinancialSecurityPage />} />
          <Route path="/recovery-cases/:caseId/police-report" element={<PoliceReportPage />} />
          <Route path="/recovery-cases/:caseId/ceir" element={<CeirPage />} />
          <Route path="/recovery-cases/:caseId/evidence" element={<EvidenceVaultPage />} />
          <Route path="/recovery-cases/:caseId/timeline" element={<TimelinePage />} />
          <Route path="/recovery-cases/:caseId/recovered" element={<DeviceRecoveredPage />} />
          <Route
            path="/evidence"
            element={
              <ComingSoonPage
                title="Evidence Vault"
                description="Secure evidence storage is coming in a later part of RecoverAI."
              />
            }
          />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
