import type { ReactElement } from 'react';
import type { CarrierGuide } from '@recoverai/shared';

/** "Do not pretend RecoverAI itself blocked a SIM unless a legitimate carrier API confirms the action" (master spec) - this card only ever links out to the carrier's own official channel. */
export function CarrierGuideCard({ guide }: { guide: CarrierGuide }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">Contact {guide.displayName}</h2>
      <p className="mt-1 text-xs text-slate-500">
        RecoverAI can&apos;t block a SIM itself - only your carrier can. Use their official channel below.
      </p>

      <div className="mt-3 space-y-2 text-sm">
        {guide.websiteUrl ? (
          <a href={guide.websiteUrl} target="_blank" rel="noreferrer" className="block font-medium text-cyan-300 hover:underline">
            {guide.websiteUrl.replace(/^https?:\/\//, '')}
          </a>
        ) : null}
        {guide.phone ? <p className="text-slate-200">{guide.phone}</p> : null}
        {guide.phoneNote ? <p className="text-xs text-slate-500">{guide.phoneNote}</p> : null}
      </div>
    </div>
  );
}
