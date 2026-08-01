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
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-slate-100">
      <div className="fade-in w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <p className="font-display text-sm font-semibold tracking-[0.2em] text-gradient uppercase">RecoverAI</p>
          <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </header>
        <div className="glass-panel p-6">{children}</div>
        {footer ? <div className="text-center text-sm text-slate-400">{footer}</div> : null}
      </div>
    </main>
  );
}
