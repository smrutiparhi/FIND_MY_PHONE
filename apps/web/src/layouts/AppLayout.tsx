import { useState, type ReactElement } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/devices', label: 'My Devices' },
  { to: '/recovery-cases', label: 'Recovery Cases' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/settings', label: 'Settings' },
];

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
  ].join(' ');
}

/**
 * Persistent authenticated shell (Part 4): brand, the six nav items the
 * master spec names, and the page content via <Outlet />. Nested under
 * <ProtectedRoute /> in AppRoutes, so it never renders for a signed-out
 * visitor.
 */
export function AppLayout(): ReactElement {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-wide text-sky-400 uppercase">
            RecoverAI
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClasses}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="rounded-md p-2 text-slate-300 hover:bg-slate-800 md:hidden"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu"
          >
            <span className="block text-xl leading-none" aria-hidden="true">
              {mobileNavOpen ? '✕' : '☰'}
            </span>
          </button>
        </div>

        {mobileNavOpen ? (
          <nav id="mobile-nav" className="border-t border-slate-800 px-4 py-2 md:hidden" aria-label="Main navigation">
            <div className="flex flex-col gap-1 py-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClasses}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
