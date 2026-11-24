/**
 * Replaces a phone view that failed to render. It sits inside the phone
 * layout, so the navigation stays and leads to the other views (WEB-9).
 */
export function ViewError() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-text-muted">
        This view stopped working. Pick a view below to try again.
      </p>
    </>
  );
}
