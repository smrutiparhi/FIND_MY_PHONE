import { useState, type ReactElement } from 'react';
import type { FinancialCategoryGuide, FinancialProtectionItem, UserSettableFinancialProtectionStatus } from '@recoverai/shared';
import { FinancialItemStatusBadge } from './FinancialItemStatusBadge';

const BUTTON_CLASSES =
  'rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

interface FinancialItemRowProps {
  item: FinancialProtectionItem;
  guide: FinancialCategoryGuide;
  submitting: boolean;
  onChangeStatus: (status: UserSettableFinancialProtectionStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** Confirming "protected" requires an explicit second click - this is the item's own critical external action, same discipline as Parts 9-11. */
export function FinancialItemRow({ item, guide, submitting, onChangeStatus, onDelete }: FinancialItemRowProps): ReactElement {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="rounded-md border border-slate-800 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{item.label ? `${guide.label}: ${item.label}` : guide.label}</p>
          <p className="mt-1 text-xs text-slate-400">{guide.instructions}</p>
        </div>
        <FinancialItemStatusBadge status={item.status} />
      </div>

      {item.status !== 'CONFIRMED_BY_USER' && item.status !== 'CONFIRMED_BY_INTEGRATION' ? (
        confirming ? (
          <div className="mt-2 rounded-md border border-emerald-900 bg-emerald-950/40 p-2">
            <p className="text-[11px] text-emerald-200">Only confirm once you&apos;ve actually secured this.</p>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onChangeStatus('CONFIRMED_BY_USER').then(() => setConfirming(false))}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yes, secured
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={BUTTON_CLASSES}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.status === 'NOT_STARTED' ? (
              <button type="button" disabled={submitting} onClick={() => void onChangeStatus('IN_PROGRESS')} className={BUTTON_CLASSES}>
                Mark in progress
              </button>
            ) : null}
            <button type="button" disabled={submitting} onClick={() => setConfirming(true)} className={BUTTON_CLASSES}>
              Mark secured
            </button>
            <button type="button" disabled={submitting} onClick={() => void onDelete()} className={BUTTON_CLASSES}>
              Remove
            </button>
          </div>
        )
      ) : (
        <div className="mt-2">
          <button type="button" disabled={submitting} onClick={() => void onDelete()} className={BUTTON_CLASSES}>
            Remove
          </button>
        </div>
      )}
    </li>
  );
}
