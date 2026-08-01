import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { Notification, NotificationListState, UpdateNotificationPreferencesInput } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { NotificationItem } from '../components/notifications/NotificationItem';
import { NotificationPreferencesForm } from '../components/notifications/NotificationPreferencesForm';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; state: NotificationListState };

export function NotificationsPage(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    apiGet<NotificationListState>(`/api/notifications${unreadOnly ? '?unreadOnly=true' : ''}`)
      .then((data) => setState({ status: 'success', state: data }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkRead(notification: Notification): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch(`/api/notifications/${notification.id}/read`, {});
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost('/api/notifications/read-all', {});
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePreferences(input: UpdateNotificationPreferencesInput): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch('/api/notifications/preferences', input);
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading notifications...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load notifications.</p>
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

  const { notifications, unreadCount, preferences } = state.state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Notifications</h1>
          <p className="mt-1 text-sm text-slate-400">{unreadCount} unread</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            {unreadOnly ? 'Show all' : 'Show unread only'}
          </button>
          <button
            type="button"
            disabled={submitting || unreadCount === 0}
            onClick={() => void handleMarkAllRead()}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      </div>

      {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300">
            {unreadOnly ? 'Unread' : 'All'} ({notifications.length})
          </h2>
          {notifications.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing here yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} submitting={submitting} onMarkRead={handleMarkRead} />
              ))}
            </ul>
          )}
        </div>

        <NotificationPreferencesForm preferences={preferences} submitting={submitting} onSave={handleSavePreferences} />
      </div>
    </div>
  );
}
