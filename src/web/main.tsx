// First, so Zod is jitless before src/shared creates a schema.
import './zod-config.ts';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './app/routes.tsx';
import { ApiClientContext, createApiClient } from './data/api-client.ts';
import {
  ConnectivityContext,
  createConnectivity,
} from './data/connectivity.ts';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('index.html has no #root element');

const connectivity = createConnectivity(window);
const apiClient = createApiClient(
  window.location.origin,
  connectivity.trackFetch(fetch),
);

createRoot(rootElement).render(
  <StrictMode>
    <ConnectivityContext value={connectivity}>
      <ApiClientContext value={apiClient}>
        {/* Transform animations stop for anyone who prefers reduced motion (WEB-8). */}
        <MotionConfig reducedMotion="user">
          <RouterProvider router={createBrowserRouter(routes)} />
        </MotionConfig>
      </ApiClientContext>
    </ConnectivityContext>
  </StrictMode>,
);
