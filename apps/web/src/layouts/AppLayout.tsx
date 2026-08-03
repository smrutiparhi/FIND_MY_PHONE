import { useEffect, useState, type ReactElement } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import type { NotificationListState, RecoveryCaseId } from '@recoverai/shared';
import { apiGet } from '../lib/apiClient';
import { DemoModeBar } from '../components/demo/DemoModeBar';

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/devices', label: 'My Devices' },
  { to: '/recovery-cases', label: 'Recovery Cases' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/settings', label: 'Settings' },
];

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
      : 'text-slate-300 hover:bg-white/10 hover:text-white',
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
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  // Picks up :caseId from whatever nested route matched (e.g. /recovery-cases/:caseId/sim) -
  // React Router merges params across the whole matched branch, so this works from the layout
  // route even though AppLayout itself declares no :caseId param of its own.
  const { caseId } = useParams<{ caseId?: string }>();

  // AppLayout wraps every authenticated route via <Outlet /> and never
  // remounts on client-side navigation, so fetching once on mount alone
  // would leave the badge stale after e.g. marking notifications read and
  // clicking to another page (caught in a real browser, not by any test -
  // the badge kept showing the old count until a full page reload).
  // Refetching on every route change is the same lightweight, no-global-
  // state approach the rest of this app already uses.
  useEffect(() => {
    apiGet<NotificationListState>('/api/notifications?unreadOnly=true')
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {
        /* Non-critical - the nav badge just stays at its last known value if this fails. */
      });
  }, [location.pathname]);

  function renderLabel(item: { to: string; label: string }): ReactElement {
    return (
      <span className="inline-flex items-center gap-1.5">
        {item.label}
        {item.to === '/notifications' && unreadCount > 0 ? (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      <header className="glass-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="font-display text-sm font-semibold tracking-[0.2em] text-gradient uppercase">
            RecoverAI
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClasses}>
                {renderLabel(item)}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 md:hidden"
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
          <nav id="mobile-nav" className="border-t border-white/10 px-4 py-2 md:hidden" aria-label="Main navigation">
            <div className="flex flex-col gap-1 py-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClasses}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {renderLabel(item)}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {caseId ? <DemoModeBar caseId={caseId as RecoveryCaseId} /> : null}
        <Outlet />
      </main>
    </div>
  );
}
