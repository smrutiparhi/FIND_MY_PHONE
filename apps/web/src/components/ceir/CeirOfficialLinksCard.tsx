import type { ReactElement } from 'react';
import type { CeirOfficialLink } from '@recoverai/shared';

/** "Provide links/actions only to verified official government destinations configured by the application" (master spec) - never a fabricated or guessed URL. */
export function CeirOfficialLinksCard({ links }: { links: CeirOfficialLink[] }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">Official government destinations</h2>
      <p className="mt-1 text-xs text-slate-500">
        RecoverAI can&apos;t block an IMEI itself - only the CEIR portal can. Submit your request there.
      </p>
      <div className="mt-3 space-y-3">
        {links.map((link) => (
          <div key={link.key}>
            <a href={link.url} target="_blank" rel="noreferrer" className="block text-sm font-medium text-cyan-300 hover:underline">
              {link.label}
            </a>
            <p className="mt-0.5 text-xs text-slate-500">{link.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
