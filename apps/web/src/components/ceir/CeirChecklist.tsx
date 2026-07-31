import type { ReactElement } from 'react';
import type { CeirChecklistHint, CeirChecklistItem } from '@recoverai/shared';

interface CeirChecklistProps {
  hints: CeirChecklistHint[];
  completedItems: CeirChecklistItem[];
  submitting: boolean;
  onToggle: (item: CeirChecklistItem, completed: boolean) => Promise<void>;
}

/**
 * `satisfied` hints are computed fresh from real data elsewhere in the case
 * (see buildCeirChecklistHints.ts) and shown as a hint only - checking the
 * box is always the user's own action, never auto-applied from the hint.
 */
export function CeirChecklist({ hints, completedItems, submitting, onToggle }: CeirChecklistProps): ReactElement {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Checklist</h2>
      <p className="mt-1 text-xs text-slate-500">What the CEIR form asks for. Check off what you have ready.</p>
      <ul className="mt-3 space-y-2">
        {hints.map((hint) => {
          const checked = completedItems.includes(hint.item);
          return (
            <li key={hint.item} className="flex items-start gap-2.5 rounded-md border border-slate-800 p-2.5">
              <input
                type="checkbox"
                checked={checked}
                disabled={submitting}
                onChange={(e) => void onToggle(hint.item, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-emerald-600"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{hint.label}</p>
                  {hint.satisfied ? (
                    <span className="rounded-full border border-emerald-900 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      on file
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{hint.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
