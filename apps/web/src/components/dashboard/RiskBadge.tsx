import type { ReactElement } from 'react';
import type { RiskLevel } from '@recoverai/shared';

const RISK_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'border-red-900 bg-red-950 text-red-300',
  HIGH: 'border-orange-900 bg-orange-950 text-orange-300',
  MEDIUM: 'border-amber-900 bg-amber-950 text-amber-300',
  LOW: 'border-emerald-900 bg-emerald-950 text-emerald-300',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  CRITICAL: 'Critical risk',
  HIGH: 'High risk',
  MEDIUM: 'Medium risk',
  LOW: 'Low risk',
};

export function RiskBadge({ riskLevel }: { riskLevel: RiskLevel | null }): ReactElement {
  if (!riskLevel) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
        Not yet assessed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${RISK_STYLES[riskLevel]}`}
    >
      {RISK_LABELS[riskLevel]}
    </span>
  );
}
