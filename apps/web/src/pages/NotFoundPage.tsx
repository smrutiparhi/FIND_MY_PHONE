import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-slate-100">
      <p className="font-display text-sm font-semibold tracking-[0.2em] text-gradient uppercase">RecoverAI</p>
      <h1 className="font-display text-2xl font-semibold">404 — Page not found</h1>
      <p className="text-sm text-slate-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="text-sm font-medium text-cyan-300 hover:text-cyan-300">
        Back to home
      </Link>
    </main>
  );
}
