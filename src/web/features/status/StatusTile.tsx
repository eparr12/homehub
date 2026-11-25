import {
  type ServerHealth,
  useServerHealth,
} from '../../data/use-server-health.ts';

// As GitHub shortens a commit, and as the image's sha- tag names it.
const SHORT_VERSION_LENGTH = 7;

/**
 * The wall's status tile: whether the server and its database answer, and
 * the version the server reports once it has answered (OBS-6).
 */
export function StatusTile() {
  const health = useServerHealth();
  return (
    <div>
      <p role="status" className="text-2xl">
        {describeHealth(health)}
      </p>
      {health.state === 'answered' && (
        <p className="text-2xl text-text-muted">
          Version {health.report.version.slice(0, SHORT_VERSION_LENGTH)}
        </p>
      )}
    </div>
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
