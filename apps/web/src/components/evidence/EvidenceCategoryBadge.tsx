import type { ReactElement } from 'react';
import type { EvidenceCategory } from '@recoverai/shared';
import { EVIDENCE_CATEGORY_LABELS } from './evidenceCategoryLabels';

export function EvidenceCategoryBadge({ category }: { category: EvidenceCategory }): ReactElement {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
      {EVIDENCE_CATEGORY_LABELS[category]}
    </span>
  );
}
