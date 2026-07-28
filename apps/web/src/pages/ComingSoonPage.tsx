import type { ReactElement } from 'react';

/** Honest placeholder for nav destinations whose real functionality hasn't been built yet. */
export function ComingSoonPage({ title, description }: { title: string; description: string }): ReactElement {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
      <p className="text-xs font-semibold tracking-wide text-sky-400 uppercase">Coming soon</p>
      <h1 className="mt-1 text-xl font-semibold text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{description}</p>
    </div>
  );
}
