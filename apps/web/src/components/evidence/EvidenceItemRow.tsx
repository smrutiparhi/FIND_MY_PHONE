import { useState, type ReactElement } from 'react';
import type { Evidence } from '@recoverai/shared';
import { EvidenceCategoryBadge } from './EvidenceCategoryBadge';
import { MalwareScanBadge } from './MalwareScanBadge';

interface EvidenceItemRowProps {
  evidence: Evidence;
  submitting: boolean;
  onView: (evidence: Evidence) => Promise<void>;
  onDelete: (evidence: Evidence) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** BLOCKED-equivalent for evidence: never offer to open a file the scan flagged. */
export function EvidenceItemRow({ evidence, submitting, onView, onDelete }: EvidenceItemRowProps): ReactElement {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const flagged = evidence.malwareScanStatus === 'FLAGGED';

  return (
    <li className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{evidence.originalFileName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatFileSize(evidence.fileSizeBytes)} - uploaded {new Date(evidence.createdAt).toLocaleDateString()}
          </p>
          {evidence.description ? <p className="mt-1 text-xs text-slate-400">{evidence.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <EvidenceCategoryBadge category={evidence.category} />
            <MalwareScanBadge status={evidence.malwareScanStatus} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {!flagged ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onView(evidence)}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              View
            </button>
          ) : null}
          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onDelete(evidence).then(() => setConfirmingDelete(false))}
                className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
