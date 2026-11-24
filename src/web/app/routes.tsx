import type { RouteObject } from 'react-router';
import { AppUpdates } from './AppUpdates.tsx';
import { LayoutError } from './LayoutError.tsx';
import { WALL_PATH } from './paths.ts';
import { PhoneLayout } from './PhoneLayout.tsx';
import { PhonePlaceholder } from './PhonePlaceholder.tsx';
import { RouteError } from './RouteError.tsx';
import { ViewError } from './ViewError.tsx';
import { WallPage } from './WallPage.tsx';

/**
 * The phone views at /, /photos and /holidays, each with its own error
 * boundary inside the phone layout, and the wall layout at /wall (WEB-9).
 *
 * AppUpdates wraps them all and must stay mounted when a layout throws, so
 * two boundaries share the error page. LayoutError, on the child around the
 * layouts, catches a layout that throws, below AppUpdates, and takes a new
 * version at once. RouteError, on the root, answers a path with no route,
 * which React Router reports there.
 */
export const routes: RouteObject[] = [
  {
    Component: AppUpdates,
    ErrorBoundary: RouteError,
    children: [
      {
        ErrorBoundary: LayoutError,
        children: [
          {
            Component: PhoneLayout,
            children: [
              {
                index: true,
                element: (
                  <PhonePlaceholder title="Groceries">
                    The grocery list will appear here.
                  </PhonePlaceholder>
                ),
                ErrorBoundary: ViewError,
              },
              {
                path: 'photos',
                element: (
                  <PhonePlaceholder title="Photos">
                    Photos from Lightroom will appear here.
                  </PhonePlaceholder>
                ),
                ErrorBoundary: ViewError,
              },
              {
                path: 'holidays',
                element: (
                  <PhonePlaceholder title="Holidays">
                    The next holidays will count down here.
                  </PhonePlaceholder>
                ),
                ErrorBoundary: ViewError,
              },
            ],
          },
          { path: WALL_PATH, Component: WallPage },
        ],
      },
    ],
  },
];
