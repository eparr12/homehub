import {
  type ServerHealth,
  useServerHealth,
} from '../../data/use-server-health.ts';

/** The wall's status tile: whether the server and its database answer (OBS-6). */
export function StatusTile() {
  const health = useServerHealth();
  return (
    <p role="status" className="text-2xl">
      {describeHealth(health)}
    </p>
  );
}

function describeHealth(health: ServerHealth): string {
  switch (health.state) {
    case 'checking':
      return 'Checking the server…';
    case 'answered':
      return health.report.database === 'ok'
        ? 'Server and database OK'
        : 'Server is up, but its database check failed';
    case 'unreachable':
      return "Can't reach the server";
  }
}
