import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CaseSummaryExport, CreateTimelineNoteInput, TimelineEvent, TimelineOrder } from '@recoverai/shared';
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { AddTimelineNoteForm } from '../components/timeline/AddTimelineNoteForm';
import { TimelineEventItem } from '../components/timeline/TimelineEventItem';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; events: TimelineEvent[] };

function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function TimelinePage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [order, setOrder] = useState<TimelineOrder>('desc');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<TimelineEvent[]>(`/api/recovery-cases/${caseId}/timeline?order=${order}`)
      .then((events) => setState({ status: 'success', events }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId, order]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddNote(input: CreateTimelineNoteInput): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost<TimelineEvent>(`/api/recovery-cases/${caseId}/timeline/notes`, input);
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditNote(event: TimelineEvent, title: string, description: string): Promise<void> {
    if (!caseId || title === '') return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch<TimelineEvent>(`/api/recovery-cases/${caseId}/timeline/notes/${event.id}`, {
        title,
        description: description === '' ? null : description,
      });
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteNote(event: TimelineEvent): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiDelete(`/api/recovery-cases/${caseId}/timeline/notes/${event.id}`);
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport(): Promise<void> {
    if (!caseId) return;
    setExporting(true);
    setActionError(null);
    try {
      const result = await apiGet<CaseSummaryExport>(`/api/recovery-cases/${caseId}/timeline/export`);
      downloadTextFile(`recoverai-case-summary-${caseId}.txt`, result.summary);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setExporting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading timeline...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load the timeline.</p>
        <p className="mt-1 text-red-400">{state.message}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-md border border-red-800 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-900"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${caseId}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-white">Timeline</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              {order === 'desc' ? 'Newest first' : 'Oldest first'} (switch)
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export summary (.txt)'}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Every significant change to this case, automatically recorded. The exported summary
          excludes IMEI/serial, exact location, and file contents.
        </p>
      </div>

      {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300">Events ({state.events.length})</h2>
          {state.events.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {state.events.map((event) => (
                <TimelineEventItem
                  key={event.id}
                  event={event}
                  submitting={submitting}
                  onEditNote={handleEditNote}
                  onDeleteNote={handleDeleteNote}
                />
              ))}
            </ul>
          )}
        </div>

        <AddTimelineNoteForm submitting={submitting} onSubmit={handleAddNote} />
      </div>
    </div>
  );
}
