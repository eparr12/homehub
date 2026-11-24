import { useAppUpdate } from './AppUpdates.tsx';

/**
 * Offers a new version on the phone; the old one keeps running until Reload
 * is tapped. It sits in the layout's flow, so it never covers anything, and
 * its live region stays in the page, so a screen reader announces it.
 */
export function UpdatePrompt() {
  const { isReady, apply } = useAppUpdate();
  return (
    <div role="status" className="px-4">
      {isReady && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-raised p-2 pl-4">
          <p>A new version is ready.</p>
          {/* 48 px at the least, the phone's touch target (WEB-7). */}
          <button
            type="button"
            onClick={apply}
            className="min-h-12 min-w-12 rounded-lg bg-text px-4 font-semibold text-surface focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
