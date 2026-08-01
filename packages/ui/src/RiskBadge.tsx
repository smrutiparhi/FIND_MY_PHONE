import type { ReactElement } from 'react';
import type { RiskLevel } from '@recoverai/shared';

const RISK_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'border-rose-500/50 bg-rose-500/15 text-rose-300 pulse-critical',
  HIGH: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
  MEDIUM: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  LOW: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
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
      <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
        Not yet assessed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${RISK_STYLES[riskLevel]}`}
    >
      {RISK_LABELS[riskLevel]}
    </span>
  );
}
