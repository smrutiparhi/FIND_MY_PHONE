import type { ReactElement } from 'react';
import type { CeirGuidanceSection } from '@recoverai/shared';

export function CeirGuidanceSections({ sections }: { sections: CeirGuidanceSection[] }): ReactElement {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
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
