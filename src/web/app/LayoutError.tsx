import { useEffect } from 'react';
import { useAppUpdate } from './AppUpdates.tsx';
import { RouteError } from './RouteError.tsx';

/**
 * Replaces a layout that failed to render (WEB-9) and takes a new version as
 * soon as one is ready, as the wall does: the layout's prompt is gone, a
 * broken page has nothing to keep, and the new version may hold the fix.
 */
export function LayoutError() {
  const { isReady, apply } = useAppUpdate();
  useEffect(() => {
    if (isReady) apply();
  }, [isReady, apply]);
  return <RouteError />;
}
