import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { Notification } from '@recoverai/shared';
import { formatRelativeTime } from '@recoverai/shared';
import { NOTIFICATION_TYPE_LABELS } from './notificationTypeLabels';

const CRITICAL_TYPE_STYLE = 'border-rose-500/40 bg-red-950/40';

interface NotificationItemProps {
  notification: Notification;
  submitting: boolean;
  onMarkRead: (notification: Notification) => void;
}

export function NotificationItem({ notification, submitting, onMarkRead }: NotificationItemProps): ReactElement {
  const isCritical = notification.type === 'CRITICAL_ACTION_PENDING';

  return (
    <li
      className={`rounded-md border p-3 ${
        notification.isRead ? 'border-white/10 bg-slate-950/40' : isCritical ? CRITICAL_TYPE_STYLE : 'border-cyan-400/30 bg-cyan-400/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {!notification.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden="true" /> : null}
            <p className="text-sm font-medium text-white">{notification.title}</p>
          </div>
          <p className="mt-1 text-xs text-slate-400">{notification.body}</p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {NOTIFICATION_TYPE_LABELS[notification.type]} &middot; {formatRelativeTime(notification.createdAt)}
          </p>
          {notification.caseId ? (
            <Link to={`/recovery-cases/${notification.caseId}`} className="mt-1 inline-block text-xs font-medium text-cyan-300 hover:underline">
              Open case &rarr;
            </Link>
          ) : null}
        </div>
        {!notification.isRead ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => onMarkRead(notification)}
            className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark read
          </button>
        ) : null}
      </div>
    </li>
  );
}
