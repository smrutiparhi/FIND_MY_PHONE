import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-slate-100">
      <p className="text-sm font-medium tracking-wide text-sky-400 uppercase">RecoverAI</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="text-sm font-medium text-sky-400 hover:text-sky-300">
        Back to home
      </Link>
    </main>
  );
}
