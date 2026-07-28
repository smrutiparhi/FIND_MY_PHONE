import type { ReactElement, ReactNode } from 'react';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}): ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-sm font-medium tracking-wide text-sky-400 uppercase">RecoverAI</p>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </header>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">{children}</div>
        {footer ? <div className="text-center text-sm text-slate-400">{footer}</div> : null}
      </div>
    </main>
  );
}
