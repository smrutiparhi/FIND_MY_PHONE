import { useState, type ReactElement } from 'react';
import type { FinancialCategoryGuide, FinancialProtectionItem, UserSettableFinancialProtectionStatus } from '@recoverai/shared';
import { Button, ConfirmDialog } from '@recoverai/ui';
import { FinancialItemStatusBadge } from './FinancialItemStatusBadge';

interface FinancialItemRowProps {
  item: FinancialProtectionItem;
  guide: FinancialCategoryGuide;
  submitting: boolean;
  onChangeStatus: (status: UserSettableFinancialProtectionStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** Confirming "protected" requires an explicit second click - this is the item's own critical external action, same discipline as Parts 9-11. */
export function FinancialItemRow({ item, guide, submitting, onChangeStatus, onDelete }: FinancialItemRowProps): ReactElement {
  const [confirmingSecured, setConfirmingSecured] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const itemLabel = item.label ? `${guide.label}: ${item.label}` : guide.label;

  return (
    <li className="glass-panel-inset rounded-2xl p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{itemLabel}</p>
          <p className="mt-1 text-xs text-slate-400">{guide.instructions}</p>
        </div>
        <FinancialItemStatusBadge status={item.status} />
      </div>

      {item.status !== 'CONFIRMED_BY_USER' && item.status !== 'CONFIRMED_BY_INTEGRATION' ? (
        confirmingSecured ? (
          <div className="mt-2 glass-panel-success p-2">
            <p className="text-[11px] text-emerald-200">Only confirm once you&apos;ve actually secured this.</p>
            <div className="mt-1.5 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="!px-2.5 !py-1 !text-[11px]"
                disabled={submitting}
                onClick={() => void onChangeStatus('CONFIRMED_BY_USER').then(() => setConfirmingSecured(false))}
              >
                Yes, secured
              </Button>
              <Button variant="ghost" size="sm" className="!px-2.5 !py-1 !text-[11px]" onClick={() => setConfirmingSecured(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.status === 'NOT_STARTED' ? (
              <Button variant="secondary" size="sm" className="!px-2.5 !py-1 !text-[11px]" disabled={submitting} onClick={() => void onChangeStatus('IN_PROGRESS')}>
                Mark in progress
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" className="!px-2.5 !py-1 !text-[11px]" disabled={submitting} onClick={() => setConfirmingSecured(true)}>
              Mark secured
            </Button>
            <Button variant="secondary" size="sm" className="!px-2.5 !py-1 !text-[11px]" disabled={submitting} onClick={() => setConfirmingRemove(true)}>
              Remove
            </Button>
          </div>
        )
      ) : (
        <div className="mt-2">
          <Button variant="secondary" size="sm" className="!px-2.5 !py-1 !text-[11px]" disabled={submitting} onClick={() => setConfirmingRemove(true)}>
            Remove
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingRemove}
        title="Remove this item?"
        description={`"${itemLabel}" will no longer be tracked here. If it's still on the device, remember to secure it another way.`}
        confirmLabel="Remove"
        tone="danger"
        submitting={submitting}
        onConfirm={() => void onDelete().then(() => setConfirmingRemove(false))}
        onCancel={() => setConfirmingRemove(false)}
      />
    </li>
  );
}
