import { useState, type ReactElement } from 'react';
import type { TimelineEvent, VerificationStatus } from '@recoverai/shared';
import { formatRelativeTime } from '@recoverai/shared';
import { VerificationTag, type VerificationKind } from './VerificationTag';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './Button';

const VERIFICATION_KIND: Record<VerificationStatus, VerificationKind> = {
  SYSTEM_VERIFIED: 'system',
  USER_REPORTED: 'user',
  AI_GENERATED: 'ai',
  EXTERNAL_VERIFIED: 'external',
  UNVERIFIED: 'user',
};

interface TimelineItemProps {
  event: TimelineEvent;
  typeLabel: string;
  submitting: boolean;
  onEditNote: (event: TimelineEvent, title: string, description: string) => Promise<void>;
  onDeleteNote: (event: TimelineEvent) => Promise<void>;
}

/** Only USER_NOTE rows are ever editable/deletable - every other type is an immutable system audit event (master spec). */
export function TimelineItem({ event, typeLabel, submitting, onEditNote, onDeleteNote }: TimelineItemProps): ReactElement {
  const isNote = event.type === 'USER_NOTE';
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave(): Promise<void> {
    await onEditNote(event, title.trim(), description.trim());
    setEditing(false);
  }

  return (
    <li className="glass-panel-inset rounded-2xl p-3">
      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            aria-label="Note title"
            className="input-field text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            aria-label="Note description"
            className="input-field text-xs"
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={submitting || title.trim() === ''} onClick={() => void handleSave()}>
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setTitle(event.title);
                setDescription(event.description ?? '');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{event.title}</p>
              {event.description ? <p className="mt-1 text-xs text-slate-400">{event.description}</p> : null}
              <p className="mt-1 text-[11px] text-slate-500">
                {typeLabel} &middot; {formatRelativeTime(event.createdAt)}
              </p>
            </div>
            <VerificationTag kind={VERIFICATION_KIND[event.verificationStatus]} />
          </div>

          {isNote ? (
            <div className="mt-2 flex gap-2">
              <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            </div>
          ) : null}

          <ConfirmDialog
            open={confirmingDelete}
            title="Delete this note?"
            description="This removes your note from the timeline permanently. System-generated events are never affected."
            confirmLabel="Delete note"
            tone="danger"
            submitting={submitting}
            onConfirm={() => void onDeleteNote(event).then(() => setConfirmingDelete(false))}
            onCancel={() => setConfirmingDelete(false)}
          />
        </>
      )}
    </li>
  );
}
