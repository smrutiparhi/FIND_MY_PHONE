import type { ReactElement } from 'react';
import type { SimStatus } from '@recoverai/shared';

const STATUS_STYLES: Record<SimStatus, string> = {
  ACTIVE: 'border-white/15 bg-white/5 text-slate-400',
  BLOCK_REQUESTED: 'border-amber-900 bg-amber-950 text-amber-300',
  BLOCKED: 'glass-panel-success text-emerald-300',
  REPLACEMENT_PENDING: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  REPLACED: 'glass-panel-success text-emerald-300',
  UNKNOWN: 'border-white/15 bg-white/5 text-slate-400',
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
