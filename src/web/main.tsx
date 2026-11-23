import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './app/routes.ts';
import { ApiClientContext, createApiClient } from './data/api-client.ts';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('index.html has no #root element');

createRoot(rootElement).render(
  <StrictMode>
    <ApiClientContext value={createApiClient(window.location.origin)}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </ApiClientContext>
  </StrictMode>,
);
