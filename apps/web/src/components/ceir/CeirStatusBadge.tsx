import type { ReactElement } from 'react';
import type { CeirStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<CeirStatus, string> = {
  NOT_READY: 'border-slate-700 bg-slate-800 text-slate-400',
  READY: 'border-sky-900 bg-sky-950 text-sky-300',
  SUBMITTED: 'border-amber-900 bg-amber-950 text-amber-300',
  PROCESSING: 'border-amber-900 bg-amber-950 text-amber-300',
  BLOCKED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  UNBLOCK_REQUESTED: 'border-sky-900 bg-sky-950 text-sky-300',
  UNBLOCKED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  UNKNOWN: 'border-slate-700 bg-slate-800 text-slate-400',
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
