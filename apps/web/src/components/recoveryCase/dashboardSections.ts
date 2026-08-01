import type { RecoveryActionType, RecoveryCaseId } from '@recoverai/shared';

/**
 * The master spec's Part 17 main-section list (LOCATION/SECURITY/SIM/
 * ACCOUNTS/FINANCIAL PROTECTION/POLICE/CEIR/EVIDENCE/TIMELINE), mapped onto
 * the Recovery Decision Engine's own action types wherever one exists - so a
 * section's status is read directly from `RecoveryPlanAction.status`, never
 * recomputed. SECURITY (SECURE_DEVICE) has no dedicated in-app page - Part 8
 * only ever built device *finding*, not a device-securing flow - so `route`
 * is null and the card falls back to the action's own officialExternalAction
 * link instead of fabricating a page that doesn't exist. TIMELINE has no
 * backing action type at all; it's handled separately in the dashboard page.
 */
export interface DashboardSectionDefinition {
  key: string;
  label: string;
  actionType: RecoveryActionType;
  route: ((caseId: RecoveryCaseId) => string) | null;
}

export const DASHBOARD_SECTIONS: DashboardSectionDefinition[] = [
  { key: 'location', label: 'Location', actionType: 'LOCATE_DEVICE', route: (id) => `/recovery-cases/${id}/location` },
  { key: 'security', label: 'Security', actionType: 'SECURE_DEVICE', route: null },
  { key: 'sim', label: 'SIM', actionType: 'SIM_PROTECTION', route: (id) => `/recovery-cases/${id}/sim` },
  { key: 'accounts', label: 'Accounts', actionType: 'ACCOUNT_RECOVERY', route: (id) => `/recovery-cases/${id}/account-recovery` },
  {
    key: 'financial',
    label: 'Financial protection',
    actionType: 'FINANCIAL_PROTECTION',
    route: (id) => `/recovery-cases/${id}/financial-security`,
  },
  { key: 'police', label: 'Police', actionType: 'POLICE_REPORT', route: (id) => `/recovery-cases/${id}/police-report` },
  { key: 'ceir', label: 'CEIR', actionType: 'CEIR_SUBMISSION', route: (id) => `/recovery-cases/${id}/ceir` },
  { key: 'evidence', label: 'Evidence', actionType: 'EVIDENCE_COLLECTION', route: (id) => `/recovery-cases/${id}/evidence` },
];

/** Excluded from the Recovery Progress checklist - it's a perpetual catch-all, never a discrete milestone that "completes". */
export const PROGRESS_EXCLUDED_ACTION_TYPES: RecoveryActionType[] = ['MONITOR'];
