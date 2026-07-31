import type { ReactElement } from 'react';
import type { SimStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<SimStatus, string> = {
  ACTIVE: 'border-slate-700 bg-slate-800 text-slate-400',
  BLOCK_REQUESTED: 'border-amber-900 bg-amber-950 text-amber-300',
  BLOCKED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  REPLACEMENT_PENDING: 'border-sky-900 bg-sky-950 text-sky-300',
  REPLACED: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  UNKNOWN: 'border-slate-700 bg-slate-800 text-slate-400',
};

const STATUS_LABELS: Record<SimStatus, string> = {
  ACTIVE: 'Active (not yet protected)',
  BLOCK_REQUESTED: 'Block requested',
  BLOCKED: 'Blocked by carrier',
  REPLACEMENT_PENDING: 'Replacement pending',
  REPLACED: 'Replaced',
  UNKNOWN: 'Unknown',
};

export function SimStatusBadge({ status }: { status: SimStatus }): ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
