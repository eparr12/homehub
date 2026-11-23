import type { RouteObject } from 'react-router';
import { PhonePage } from './PhonePage.tsx';
import { RouteError } from './RouteError.tsx';
import { WallPage } from './WallPage.tsx';

/** The phone layout at / and the wall layout at /wall, under one error boundary. */
export const routes: RouteObject[] = [
  {
    ErrorBoundary: RouteError,
    children: [
      { path: '/', Component: PhonePage },
      { path: '/wall', Component: WallPage },
    ],
  },
];
