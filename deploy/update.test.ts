// Runs the real update.ps1 under pwsh with docker replaced by fake-docker.ts.
// A function named docker wins over any program of that name, whatever PATH
// holds, so no test can reach the real docker.
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Plan } from './fake-docker.ts';

const SCRIPT = fileURLToPath(new URL('update.ps1', import.meta.url));
const FAKE_DOCKER = fileURLToPath(new URL('fake-docker.ts', import.meta.url));
// The paths travel in environment variables, so nothing here needs quoting.
const RUNNER =
  'function docker { & $env:FAKE_NODE $env:FAKE_DOCKER @args }; & $env:UPDATE_SCRIPT; exit $LASTEXITCODE';
// Should a change ever get past the docker function, the real docker finds no
// daemon to act on.
const NO_DOCKER_DAEMON = 'tcp://127.0.0.1:1';
// As fake-docker.ts writes each call: the folder, a tab, the command line.
const CALL_SEPARATOR = '\t';
const LOG_FILE = 'update.log';
const LOG_LIMIT_BYTES = 1024 * 1024;
// Old log lines of a fixed size, enough of them to pass the limit.
const OLD_LINE_BYTES = 128;
const OLD_LINE_COUNT = Math.ceil(LOG_LIMIT_BYTES / OLD_LINE_BYTES) + 100;

const PS = 'compose ps --all --quiet';
const PULL = 'compose pull --quiet';
const UP = 'compose up --detach --wait --wait-timeout 120';
const VERSION = 'compose exec -T homehub printenv GIT_SHA';
const PRUNE = 'image prune --force';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const PULL_ERROR =
  'Error response from daemon: Get "https://ghcr.io/v2/": dial tcp: lookup ghcr.io: no such host';
const UNHEALTHY = 'container homehub-homehub-1 is unhealthy';

// Docker writes its progress to stderr, also when it succeeds.
const UNCHANGED: Plan = {
  [PS]: [{ stdout: 'container-1\n' }],
  [PULL]: [{}],
  [UP]: [{ stderr: ' Container homehub-homehub-1 Running\n' }],
  [PRUNE]: [{ stdout: 'Total reclaimed space: 0B\n' }],
};
const REPLACED: Plan = {
  ...UNCHANGED,
  [PS]: [{ stdout: 'container-1\n' }, { stdout: 'container-2\n' }],
  [PULL]: [{ stderr: ' homehub Pulling\n homehub Pulled\n' }],
  [UP]: [{ stderr: ' Container homehub-homehub-1 Recreated\n' }],
  [VERSION]: [{ stdout: `${SHA}\n`, stderr: 'WARN[0000] a warning\n' }],
};
const FAILED_PULL: Plan = {
  ...UNCHANGED,
  [PULL]: [
    {
      exitCode: 1,
      stdout: 'text on stdout\n',
      stderr: ` homehub Pulling\n${PULL_ERROR}\n`,
    },
  ],
};
const FAILED_START: Plan = {
  ...UNCHANGED,
  [UP]: [
    {
      exitCode: 1,
      stderr: ` Container homehub-homehub-1 Started\n${UNHEALTHY}\n`,
    },
  ],
};

interface Run {
  readonly exitCode: number | null;
  /** What pwsh printed, for a failed assertion's message. */
  readonly output: string;
  readonly commands: readonly string[];
  readonly folders: readonly string[];
  /** update.log's lines; none when there's no file. */
  readonly log: readonly string[];
  readonly deployDir: string;
  /** What the folder it was started from held afterwards. */
  readonly leftInStartDir: readonly string[];
}

/** Matches a log line: the UTC time, then the message. */
function logLine(message: string): RegExp {
  return new RegExp(
    String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z ${RegExp.escape(message)}$`,
  );
}

const FAILED_PULL_LINE = logLine(
  `failed: docker ${PULL} failed with exit code 1: ${PULL_ERROR}`,
);

/**
 * Copies update.ps1 into a deploy folder of its own, with a space in its
 * name, starts it from another folder, as Task Scheduler does, reads back
 * what it did, and removes the folders.
 */
async function runUpdate(plan: Plan, oldLog?: string): Promise<Run> {
  const root = realpathSync.native(
    mkdtempSync(join(tmpdir(), 'homehub-update-')),
  );
  try {
    const deployDir = join(root, 'deploy folder');
    const startDir = join(root, 'elsewhere');
    mkdirSync(deployDir);
    mkdirSync(startDir);
    copyFileSync(SCRIPT, join(deployDir, 'update.ps1'));
    if (oldLog !== undefined) writeFileSync(join(deployDir, LOG_FILE), oldLog);
    const planFile = join(root, 'plan.json');
    const callsFile = join(root, 'calls.txt');
    writeFileSync(planFile, JSON.stringify(plan));

    const { exitCode, output } = await runPwsh(startDir, {
      FAKE_NODE: process.execPath,
      FAKE_DOCKER,
      FAKE_DOCKER_PLAN: planFile,
      FAKE_DOCKER_CALLS: callsFile,
      UPDATE_SCRIPT: join(deployDir, 'update.ps1'),
      DOCKER_HOST: NO_DOCKER_DAEMON,
    });
    const calls = readLines(callsFile).map((line) => {
      const separator = line.indexOf(CALL_SEPARATOR);
      return {
        folder: realpathSync.native(line.slice(0, separator)),
        command: line.slice(separator + CALL_SEPARATOR.length),
      };
    });
    return {
      exitCode,
      output,
      commands: calls.map(({ command }) => command),
      folders: calls.map(({ folder }) => folder),
      log: readLines(join(deployDir, LOG_FILE)),
      deployDir,
      leftInStartDir: readdirSync(startDir),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runPwsh(
  cwd: string,
  env: Readonly<Record<string, string>>,
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pwsh',
      ['-NoProfile', '-NonInteractive', '-Command', RUNNER],
      { cwd, env: { ...process.env, ...env } },
    );
    let output = '';
    const keep = (chunk: Buffer) => {
      output += chunk.toString();
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, output });
    });
  });
}

function readLines(file: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line !== '');
}

function oldLogLine(index: number): string {
  return `2026-01-01T00:00:00Z failed: old line ${String(index + 1)} `.padEnd(
    OLD_LINE_BYTES - 1,
    'x',
  );
}

// The command lists are compared whole, never with "contains": that is what
// keeps a command such as one that removes a container or a volume out of the
// script.
describe('update.ps1', { concurrent: true, timeout: 30_000 }, () => {
  it('pulls, starts and prunes, and logs nothing while the container stays the same', async () => {
    const run = await runUpdate(UNCHANGED);

    expect(run.exitCode, run.output).toBe(0);
    expect(run.commands).toEqual([PS, PULL, UP, PS, PRUNE]);
    expect(run.log).toEqual([]);
  });

  it('logs the version once when the container was replaced', async () => {
    const run = await runUpdate(REPLACED);

    expect(run.exitCode, run.output).toBe(0);
    expect(run.commands).toEqual([PS, PULL, UP, PS, VERSION, PRUNE]);
    expect(run.log).toHaveLength(1);
    expect(run.log[0]).toMatch(logLine(`new container, version ${SHA}`));
  });

  it('runs every command in its own folder, wherever it was started', async () => {
    const run = await runUpdate(REPLACED);

    expect(run.exitCode, run.output).toBe(0);
    expect(run.folders).toEqual(run.commands.map(() => run.deployDir));
    expect(run.leftInStartDir).toEqual([]);
  });

  it('stops at a failed pull, leaving the container alone, and logs why', async () => {
    const run = await runUpdate(FAILED_PULL);

    expect(run.exitCode, run.output).toBe(1);
    expect(run.commands).toEqual([PS, PULL]);
    expect(run.log).toHaveLength(1);
    expect(run.log[0]).toMatch(FAILED_PULL_LINE);
  });

  it('stops at a container that fails to start, pruning nothing', async () => {
    const run = await runUpdate(FAILED_START);

    expect(run.exitCode, run.output).toBe(1);
    expect(run.commands).toEqual([PS, PULL, UP]);
    expect(run.log).toHaveLength(1);
    expect(run.log[0]).toMatch(
      logLine(`failed: docker ${UP} failed with exit code 1: ${UNHEALTHY}`),
    );
  });

  it('keeps the newer half of a log that has passed 1 MB', async () => {
    const oldLines = Array.from({ length: OLD_LINE_COUNT }, (_, index) =>
      oldLogLine(index),
    );

    const run = await runUpdate(FAILED_PULL, `${oldLines.join('\n')}\n`);

    // The run adds one line, then half of all the lines stay.
    const kept = Math.floor((OLD_LINE_COUNT + 1) / 2);
    expect(run.log).toHaveLength(kept);
    expect(run.log.slice(0, -1)).toEqual(oldLines.slice(1 - kept));
    expect(run.log.at(-1)).toMatch(FAILED_PULL_LINE);
  });
});
