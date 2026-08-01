import type { ReactElement } from 'react';
import type { PoliceReportVersion } from '@recoverai/shared';
import { formatRelativeTime } from '@recoverai/shared';

/** "Store complaint versions" (master spec) - every edit and regeneration is kept, never overwritten in place. */
export function PoliceReportVersionHistory({ versions }: { versions: PoliceReportVersion[] }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">Version history</h2>
      <ul className="mt-3 space-y-1.5">
        {versions.map((version) => (
          <li key={version.id} className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <span>Version {version.versionNumber}</span>
            <span className="flex items-center gap-2">
              {version.isSimulated ? <span className="text-amber-400">demo</span> : null}
              {formatRelativeTime(version.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
