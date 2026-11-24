import { useIsOffline } from '../data/connectivity.ts';

/**
 * "Offline" while the browser has no network or the last API request got no
 * answer, sized by its parent's font. The live region stays in the page, so a
 * screen reader announces the change.
 */
export function OfflineBadge() {
  const isOffline = useIsOffline();
  return (
    <div role="status">
      {isOffline && (
        <span className="inline-block rounded-full bg-text px-[0.75em] py-[0.25em] font-semibold text-surface">
          Offline
        </span>
      )}
    </div>
  );
}
