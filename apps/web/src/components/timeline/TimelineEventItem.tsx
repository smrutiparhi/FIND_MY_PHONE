import { useState, type ReactElement } from 'react';
import type { TimelineEvent, VerificationStatus } from '@recoverai/shared';
import { VerificationTag, type VerificationKind } from '../recoveryCase/VerificationTag';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { TIMELINE_EVENT_TYPE_LABELS } from './timelineEventLabels';

const VERIFICATION_KIND: Record<VerificationStatus, VerificationKind> = {
  SYSTEM_VERIFIED: 'system',
  USER_REPORTED: 'user',
  AI_GENERATED: 'ai',
  EXTERNAL_VERIFIED: 'external',
  UNVERIFIED: 'user',
};

interface TimelineEventItemProps {
  event: TimelineEvent;
  submitting: boolean;
  onEditNote: (event: TimelineEvent, title: string, description: string) => Promise<void>;
  onDeleteNote: (event: TimelineEvent) => Promise<void>;
}

/** Only USER_NOTE rows are ever editable/deletable - every other type is an immutable system audit event (master spec). */
export function TimelineEventItem({ event, submitting, onEditNote, onDeleteNote }: TimelineEventItemProps): ReactElement {
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
    <li className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
      {editing ? (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting || title.trim() === ''}
              onClick={() => void handleSave()}
              className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTitle(event.title);
                setDescription(event.description ?? '');
              }}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{event.title}</p>
              {event.description ? <p className="mt-1 text-xs text-slate-400">{event.description}</p> : null}
              <p className="mt-1 text-[11px] text-slate-500">
                {TIMELINE_EVENT_TYPE_LABELS[event.type]} &middot; {formatRelativeTime(event.createdAt)}
              </p>
            </div>
            <VerificationTag kind={VERIFICATION_KIND[event.verificationStatus]} />
          </div>

          {isNote ? (
            <div className="mt-2 flex gap-2">
              {confirmingDelete ? (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void onDeleteNote(event).then(() => setConfirmingDelete(false))}
                    className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirm delete
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
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setEditing(true)}
                    className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}
