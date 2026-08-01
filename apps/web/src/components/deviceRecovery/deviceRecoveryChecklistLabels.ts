import type { DeviceRecoveryChecklistItem, RecoveryCaseId } from '@recoverai/shared';

interface ChecklistItemInfo {
  label: string;
  description: string;
  route: ((caseId: RecoveryCaseId) => string) | null;
}

/** Verbatim from the master spec's Part 18 guided-review list, minus "Close case" - that's the terminal action, not a review item. */
export const DEVICE_RECOVERY_CHECKLIST_INFO: Record<DeviceRecoveryChecklistItem, ChecklistItemInfo> = {
  CONFIRM_POSSESSION: {
    label: 'Confirm physical possession',
    description: 'You have the device back in your own hands.',
    route: null,
  },
  CHECK_UNEXPECTED_CHANGES: {
    label: 'Check for unexpected device or account changes',
    description: "Look for new apps, unfamiliar accounts, or settings you didn't change.",
    route: null,
  },
  RESTORE_SIM: {
    label: 'Restore your SIM (if it was blocked)',
    description: 'If you blocked or replaced your SIM, confirm it is active again.',
    route: (id) => `/recovery-cases/${id}/sim`,
  },
  REVIEW_ACCOUNT_SECURITY: {
    label: 'Review your Apple/Google account security',
    description: 'Check recent sign-ins and recovery settings on your device account.',
    route: (id) => `/recovery-cases/${id}/account-recovery`,
  },
  REVIEW_EMAIL_SESSIONS: {
    label: 'Review important email and account sessions',
    description: "Sign out of any sessions you don't recognize.",
    route: null,
  },
  REVIEW_FINANCIAL_APPS: {
    label: 'Review financial apps',
    description: 'Confirm your banking, UPI, and wallet apps look untouched.',
    route: (id) => `/recovery-cases/${id}/financial-security`,
  },
  CHANGE_CREDENTIALS: {
    label: 'Change credentials where warranted',
    description: "Update passwords for anything you're unsure about.",
    route: null,
  },
  HANDLE_CEIR_UNBLOCKING: {
    label: 'Handle CEIR unblocking (if it was previously blocked)',
    description: 'If you submitted a CEIR request, start the unblock process.',
    route: (id) => `/recovery-cases/${id}/ceir`,
  },
  RESTORE_DEVICE_SETTINGS: {
    label: 'Restore device settings',
    description: 'Undo Lost Mode, remote lock, or any other emergency settings you applied.',
    route: null,
  },
  PRESERVE_EVIDENCE: {
    label: 'Preserve incident evidence',
    description: 'Keep anything you uploaded - it stays in the Evidence Vault after the case closes.',
    route: (id) => `/recovery-cases/${id}/evidence`,
  },
};
