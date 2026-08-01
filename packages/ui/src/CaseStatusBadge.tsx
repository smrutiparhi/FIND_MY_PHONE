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
  RECOVERED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  CLOSED: 'border-white/15 bg-white/5 text-slate-400',
  ERASED: 'border-white/15 bg-white/5 text-slate-400',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }): ReactElement {
  const styles = TERMINAL_STYLES[status] ?? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${styles}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
