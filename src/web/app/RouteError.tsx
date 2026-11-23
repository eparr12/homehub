import { isRouteErrorResponse, useRouteError } from 'react-router';

const HTTP_NOT_FOUND = 404;

/** Replaces a route that failed to render, or a path with no route (WEB-9). */
export function RouteError() {
  const error = useRouteError();
  const isNotFound =
    isRouteErrorResponse(error) && error.status === HTTP_NOT_FOUND;
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <h1 className="text-4xl font-semibold">
        {isNotFound ? 'Page not found' : 'Something went wrong'}
      </h1>
    </main>
  );
}
