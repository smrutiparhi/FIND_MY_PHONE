import type { ReactElement } from 'react';
import type { SimGuidanceSection } from '@recoverai/shared';

export function SimGuidanceSections({ sections }: { sections: SimGuidanceSection[] }): ReactElement {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">What to know</h2>
      <dl className="mt-3 space-y-4">
        {sections.map((section) => (
          <div key={section.key}>
            <dt className="text-sm font-medium text-white">{section.title}</dt>
            <dd className="mt-1 text-xs text-slate-400">{section.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
