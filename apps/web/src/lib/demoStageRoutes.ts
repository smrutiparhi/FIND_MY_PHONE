import type { RecoveryCaseId } from '@recoverai/shared';

/**
 * Maps each of the master spec's 10 named presentation-flow stages to the
 * real app page that shows it - Demo Mode walks a presenter through the
 * actual product, not a separate set of mockup screens. Several stages
 * (report/risk/engine/secure) share the case detail page, since they're
 * different things to point out on the same view rather than separate
 * pages of their own.
 */
export function demoStageRoute(caseId: RecoveryCaseId, stage: number): string {
  switch (stage) {
    case 3:
      return `/recovery-cases/${caseId}/location`;
    case 6:
      return `/recovery-cases/${caseId}/sim`;
    case 7:
      return `/recovery-cases/${caseId}/police-report`;
    case 8:
      return `/recovery-cases/${caseId}/ceir`;
    case 9:
      return `/recovery-cases/${caseId}/timeline`;
    case 10:
      return `/recovery-cases/${caseId}/recovered`;
    default:
      return `/recovery-cases/${caseId}`;
  }
}
