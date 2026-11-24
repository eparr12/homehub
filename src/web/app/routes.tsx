import type { RouteObject } from 'react-router';
import { PhoneLayout } from './PhoneLayout.tsx';
import { PhonePlaceholder } from './PhonePlaceholder.tsx';
import { RouteError } from './RouteError.tsx';
import { ViewError } from './ViewError.tsx';
import { WallPage } from './WallPage.tsx';

/**
 * The phone views at /, /photos and /holidays, each with its own error
 * boundary inside the phone layout, and the wall layout at /wall. RouteError
 * catches the rest, such as a path with no route (WEB-9).
 */
export const routes: RouteObject[] = [
  {
    ErrorBoundary: RouteError,
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
      { path: '/wall', Component: WallPage },
    ],
  },
];
