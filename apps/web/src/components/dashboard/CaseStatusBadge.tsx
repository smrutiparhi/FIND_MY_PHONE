import type { ReactElement } from 'react';
import type { CaseStatus } from '@recoverai/shared';

const STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: 'New',
  ASSESSING: 'Assessing',
  LOCATING: 'Locating',
  DEVICE_FOUND: 'Device Found',
  DEVICE_OFFLINE: 'Device Offline',
  SECURING: 'Securing Device',
  SIM_PROTECTION: 'SIM Protection',
  ACCOUNT_RECOVERY: 'Account Recovery',
  FINANCIAL_PROTECTION: 'Financial Protection',
  POLICE_REPORT: 'Police Report',
  CEIR_PENDING: 'CEIR Pending',
  CEIR_SUBMITTED: 'CEIR Submitted',
  MONITORING: 'Monitoring',
  RECOVERED: 'Recovered',
  ERASED: 'Erased',
  CLOSED: 'Closed',
};

const TERMINAL_STYLES: Partial<Record<CaseStatus, string>> = {
  RECOVERED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  CLOSED: 'border-slate-700 bg-slate-800 text-slate-400',
  ERASED: 'border-slate-700 bg-slate-800 text-slate-400',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }): ReactElement {
  const styles = TERMINAL_STYLES[status] ?? 'border-sky-900 bg-sky-950 text-sky-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
