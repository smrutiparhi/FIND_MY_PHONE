import type { ReactElement } from 'react';
import type { FinalCaseSummary } from '@recoverai/shared';

function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString();
}

function downloadTextFile(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSummaryText(summary: FinalCaseSummary): string {
  const lines: string[] = [];
  lines.push('RecoverAI - Final Case Summary');
  lines.push('');
  lines.push(`Incident date: ${formatDate(summary.incidentDate)}`);
  lines.push(`Recovery date: ${formatDate(summary.recoveryDate)}`);
  lines.push(`Police status: ${summary.policeStatus}`);
  lines.push(`CEIR status: ${summary.ceirStatus}`);
  lines.push('');
  lines.push(`Actions completed (${summary.actionsCompleted.length})`);
  for (const action of summary.actionsCompleted) lines.push(`  - ${action.title}`);
  lines.push('');
  lines.push(`Location observations (${summary.locationObservations.length})`);
  for (const obs of summary.locationObservations) {
    lines.push(`  - ${formatDate(obs.observedAt)}: ${obs.latitude}, ${obs.longitude} (${obs.source})`);
  }
  lines.push('');
  lines.push(`Status changes / timeline (${summary.statusChanges.length})`);
  for (const event of summary.statusChanges) {
    lines.push(`  [${formatDate(event.createdAt)}] ${event.title}`);
  }
  return lines.join('\n');
}

/** "Create a final case summary containing: incident date, recovery date, actions completed, important status changes, location observations, police status, CEIR status" (master spec, verbatim field list) - the user's own closing record, not a redacted share-out (compare Part 16's sanitized Timeline export). */
export function FinalCaseSummaryView({ summary }: { summary: FinalCaseSummary }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-300">Final case summary</h2>
        <button
          type="button"
          onClick={() => downloadTextFile('recoverai-final-case-summary.txt', buildSummaryText(summary))}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
        >
          Download (.txt)
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-slate-500">Incident date</dt>
        <dd className="text-slate-200">{formatDate(summary.incidentDate)}</dd>
        <dt className="text-slate-500">Recovery date</dt>
        <dd className="text-slate-200">{formatDate(summary.recoveryDate)}</dd>
        <dt className="text-slate-500">Police status</dt>
        <dd className="text-slate-200">{summary.policeStatus}</dd>
        <dt className="text-slate-500">CEIR status</dt>
        <dd className="text-slate-200">{summary.ceirStatus}</dd>
      </dl>

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-400">Actions completed ({summary.actionsCompleted.length})</h3>
        {summary.actionsCompleted.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
            {summary.actionsCompleted.map((a) => (
              <li key={a.type}>- {a.title}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-400">Location observations ({summary.locationObservations.length})</h3>
        {summary.locationObservations.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">None recorded.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
            {summary.locationObservations.map((obs) => (
              <li key={obs.id}>
                {formatDate(obs.observedAt)}: {obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-400">Timeline ({summary.statusChanges.length})</h3>
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-slate-300">
          {summary.statusChanges.map((event) => (
            <li key={event.id}>
              [{formatDate(event.createdAt)}] {event.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
