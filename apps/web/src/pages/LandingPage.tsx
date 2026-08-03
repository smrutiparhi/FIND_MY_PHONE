import type { ReactElement } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { buttonClasses } from '@recoverai/ui';

const FEATURES: { title: string; description: string }[] = [
  {
    title: 'Device finding, guided',
    description: 'Walks you through Find My / Find Hub the moment you report a device lost or stolen.',
  },
  {
    title: 'SIM & account protection',
    description: 'Block a compromised SIM and lock down account access before anyone else can.',
  },
  {
    title: 'Police & CEIR assistance',
    description: 'Drafts your complaint and tracks CEIR/Sanchar Saathi IMEI blocking end to end.',
  },
  {
    title: 'One recovery plan',
    description: 'A single, risk-ranked checklist replaces the scramble of "what do I do first?"',
  },
];

export function LandingPage(): ReactElement {
  const { session, loading } = useAuth();

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="min-h-screen text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <span className="font-display text-sm font-semibold tracking-[0.2em] text-gradient uppercase">RecoverAI</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className={buttonClasses('ghost', 'sm')}>
            Sign in
          </Link>
          <Link to="/register" className={buttonClasses('primary', 'sm')}>
            Get started
          </Link>
        </div>
      </header>

      <section className="fade-in mx-auto max-w-4xl px-4 pt-16 pb-20 text-center">
        <p className="font-mono-data text-xs tracking-[0.3em] text-cyan-300 uppercase">Lost or stolen phone recovery</p>
        <h1 className="font-display mt-4 text-4xl font-bold text-white sm:text-5xl">
          Every step to get your phone back, <span className="text-gradient">in the right order</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400">
          RecoverAI is an AI-assisted recovery coordinator - not a tracker, not spyware. It guides you through
          device-finding, SIM protection, account recovery, financial-account protection, police complaints, and
          CEIR/Sanchar Saathi guidance, in the order that actually matters.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className={buttonClasses('primary', 'md') + ' !px-6 !py-3 !text-base'}>
            Report a lost or stolen phone
          </Link>
          <Link to="/login" className={buttonClasses('secondary', 'md') + ' !px-6 !py-3 !text-base'}>
            I already have an account
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Just here to look around?{' '}
          <Link to="/demo" className="font-medium text-fuchsia-300 hover:text-fuchsia-200">
            Try the guided demo &rarr;
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="glass-panel glass-panel-hover p-5">
              <h2 className="font-display text-sm font-semibold text-white">{feature.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-slate-600">
        Not affiliated with Apple, Google, your carrier, the police, or CEIR/Sanchar Saathi - RecoverAI coordinates
        the real, official steps you take yourself.
      </footer>
    </main>
  );
}
