import { useState, type ReactElement } from 'react';
import type { Evidence } from '@recoverai/shared';
import { EvidenceCategoryBadge, MalwareScanBadge } from './EvidenceBadges';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './Button';

interface EvidenceCardProps {
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

/** Never offers to open a file the scan flagged. */
export function EvidenceCard({ evidence, submitting, onView, onDelete }: EvidenceCardProps): ReactElement {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const flagged = evidence.malwareScanStatus === 'FLAGGED';

  return (
    <li className="glass-panel-inset rounded-2xl p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{evidence.originalFileName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatFileSize(evidence.fileSizeBytes)} &middot; uploaded {new Date(evidence.createdAt).toLocaleDateString()}
          </p>
          {evidence.description ? <p className="mt-1 text-xs text-slate-400">{evidence.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <EvidenceCategoryBadge category={evidence.category} />
            <MalwareScanBadge status={evidence.malwareScanStatus} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {!flagged ? (
            <Button variant="ghost" size="sm" disabled={submitting} onClick={() => void onView(evidence)}>
              View
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this evidence?"
        description={`"${evidence.originalFileName}" will be removed from the Evidence Vault. This can't be undone.`}
        confirmLabel="Delete evidence"
        tone="danger"
        submitting={submitting}
        onConfirm={() => void onDelete(evidence).then(() => setConfirmingDelete(false))}
        onCancel={() => setConfirmingDelete(false)}
      />
    </li>
  );
}
