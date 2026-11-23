import {
  type ServerHealth,
  useServerHealth,
} from '../data/use-server-health.ts';

/** The wall's placeholder, which shows that the page can reach the server. */
export function WallPage() {
  const health = useServerHealth();
  return (
    <main className="grid h-dvh place-items-center">
      <div className="text-center">
        <h1 className="text-7xl font-semibold">HomeHub</h1>
        <p role="status" className="mt-8 text-4xl">
          {describeHealth(health)}
        </p>
      </div>
    </main>
  );
}

function describeHealth(health: ServerHealth): string {
  switch (health.state) {
    case 'checking':
      return 'Checking the server…';
    case 'ok':
      return `Server: ${health.response.status}`;
    case 'unreachable':
      return "Can't reach the server";
  }
}
