import type { ReactElement } from 'react';
import type { CeirStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<CeirStatus, string> = {
  NOT_READY: 'border-white/15 bg-white/5 text-slate-400',
  READY: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  SUBMITTED: 'border-amber-900 bg-amber-950 text-amber-300',
  PROCESSING: 'border-amber-900 bg-amber-950 text-amber-300',
  BLOCKED: 'glass-panel-success text-emerald-300',
  UNBLOCK_REQUESTED: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  UNBLOCKED: 'glass-panel-success text-emerald-300',
  UNKNOWN: 'border-white/15 bg-white/5 text-slate-400',
};

const STATUS_LABELS: Record<CeirStatus, string> = {
  NOT_READY: 'Not ready',
  READY: 'Ready to submit',
  SUBMITTED: 'Submitted',
  PROCESSING: 'Processing',
  BLOCKED: 'IMEI blocked',
  UNBLOCK_REQUESTED: 'Unblock requested',
  UNBLOCKED: 'Unblocked',
  UNKNOWN: 'Unknown',
};

export function CeirStatusBadge({ status }: { status: CeirStatus }): ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
