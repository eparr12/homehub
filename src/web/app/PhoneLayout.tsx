import { Link, NavLink, Outlet } from 'react-router';
import { OfflineBadge } from '../components/OfflineBadge.tsx';
import { WALL_PATH } from './paths.ts';
import { UpdatePrompt } from './UpdatePrompt.tsx';

const VIEWS = [
  { path: '/', label: 'Groceries' },
  { path: '/photos', label: 'Photos' },
  { path: '/holidays', label: 'Holidays' },
] as const;

const FOCUS_RING =
  'focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-accent';

/**
 * The phone layout: the current view above a bottom navigation, from 360 px
 * wide, with 48 px touch targets (WEB-7, WEB-10). NavLink marks the current
 * view with aria-current, and a new version's prompt sits below the header.
 */
export function PhoneLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 px-4">
        <p className="font-semibold">HomeHub</p>
        <div className="flex items-center gap-2 text-sm">
          <OfflineBadge />
          {/* An installed app always opens at / and has no address bar. */}
          <Link
            to={WALL_PATH}
            className={`flex min-h-12 min-w-12 items-center justify-center rounded-lg text-text-muted underline underline-offset-4 ${FOCUS_RING}`}
          >
            Wall
          </Link>
        </div>
      </header>
      <UpdatePrompt />
      <main className="flex-1 px-4 py-2">
        <Outlet />
      </main>
      <nav
        aria-label="Views"
        className="sticky bottom-0 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-3">
          {VIEWS.map((view) => (
            <li key={view.path}>
              <NavLink
                to={view.path}
                className={`flex min-h-14 items-center justify-center border-t-4 border-transparent text-text-muted aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent ${FOCUS_RING}`}
              >
                {view.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
