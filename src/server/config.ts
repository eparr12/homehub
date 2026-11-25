import { z } from 'zod';

// Loopback only: Tailscale Serve on the same machine must be the server's one
// client, because that's what makes its identity headers trustworthy (SEC-2).
// Only the container sets HOST=0.0.0.0, and Compose publishes 127.0.0.1 alone.
const DEFAULT_HOST = '127.0.0.1';
// Not 8080: on the desktop, where development happens too, the container
// holds it. The image and compose.yaml set PORT=8080 themselves.
const DEFAULT_PORT = 8081;
const MAX_TCP_PORT = 65_535;
// The repo's gitignored data/ folder in development. The container sets
// DATA_DIR=/data, where Compose mounts the volume.
const DEFAULT_DATA_DIR = 'data';
// The image sets GIT_SHA to the commit it was built from (OBS-6); anywhere
// else, the server reports this.
const DEFAULT_VERSION = 'dev';
const DEVELOPMENT = 'development';
// The default, so DEV_USER is refused unless NODE_ENV says development (SEC-3).
const PRODUCTION = 'production';
const ENTRY_SEPARATOR = ',';
// A pair splits at its last "=": a login may contain one, a short name can't.
const PAIR_SEPARATOR = '=';
const SHORT_NAME = /^[a-z0-9-]+$/;
const MISSING_ALLOWED_USERS =
  'Set ALLOWED_USERS to the allowed Tailscale logins, each with a short name, as comma-separated login=shortname pairs, such as alex@example.com=alex,sam@example.com=sam';

/**
 * Each allowed Tailscale login, in lowercase, and the short name that logs
 * and the app show instead of it (SEC-3, SEC-7). A Map, because a plain object
 * would match a login such as "constructor" to an inherited property.
 */
export type AllowedUsers = ReadonlyMap<string, string>;

type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

interface Pair {
  readonly login: string;
  readonly shortName: string;
}

const environmentSchema = z.object({
  HOST: z.ipv4().default(DEFAULT_HOST),
  PORT: z.coerce.number().int().min(1).max(MAX_TCP_PORT).default(DEFAULT_PORT),
  DATA_DIR: z.string().min(1).default(DEFAULT_DATA_DIR),
  GIT_SHA: z.string().min(1).default(DEFAULT_VERSION),
  NODE_ENV: z.enum([DEVELOPMENT, PRODUCTION]).default(PRODUCTION),
  ALLOWED_USERS: z
    .string({ error: MISSING_ALLOWED_USERS })
    .trim()
    .min(1, MISSING_ALLOWED_USERS)
    .transform((value, ctx) => {
      const users = parseAllowedUsers(value);
      if (users.ok) return users.value;
      ctx.addIssue(users.error);
      return z.NEVER;
    }),
  DEV_USER: z.string().optional(),
});

type Environment = z.infer<typeof environmentSchema>;

// Runs only once every variable has parsed, because DEV_USER's check needs
// NODE_ENV and ALLOWED_USERS.
const configSchema = environmentSchema.transform((env, ctx) => {
  const devUser = parseDevUser(env);
  if (!devUser.ok) {
    ctx.addIssue({
      code: 'custom',
      message: devUser.error,
      path: ['DEV_USER'],
    });
    return z.NEVER;
  }
  return {
    host: env.HOST,
    port: env.PORT,
    dataDir: env.DATA_DIR,
    allowedUsers: env.ALLOWED_USERS,
    devUser: devUser.value,
    version: env.GIT_SHA,
  };
});

export type Config = z.infer<typeof configSchema>;

export type ConfigResult = Parsed<Config>;

/**
 * Parses the server's settings from environment variables (SRV-9). Errors
 * name the variable and an entry's position, never a value, because values
 * are email addresses and main.ts logs the error (SEC-7).
 */
export function parseConfig(
  env: Readonly<Record<string, string | undefined>>,
): ConfigResult {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, value: result.data };
}

function parseAllowedUsers(value: string): Parsed<AllowedUsers> {
  const users = new Map<string, string>();
  const positions = new Map<string, number>();
  for (const [index, entry] of value.split(ENTRY_SEPARATOR).entries()) {
    const position = index + 1;
    const pair = parsePair(entry);
    if (pair === undefined) {
      return rejected(`Entry ${String(position)} isn't a login=shortname pair`);
    }
    if (!SHORT_NAME.test(pair.shortName)) {
      return rejected(
        `Entry ${String(position)} has a short name with characters other than lowercase letters, digits and hyphens`,
      );
    }
    const first = positions.get(pair.login);
    if (first !== undefined) {
      return rejected(
        `Entry ${String(position)} repeats the login in entry ${String(first)}`,
      );
    }
    positions.set(pair.login, position);
    users.set(pair.login, pair.shortName);
  }
  return { ok: true, value: users };
}

/** Splits "login=shortname" at its last "=", unless either side is empty. */
function parsePair(entry: string): Pair | undefined {
  const separator = entry.lastIndexOf(PAIR_SEPARATOR);
  if (separator === -1) return undefined;
  const login = normalizeLogin(entry.slice(0, separator));
  const shortName = entry.slice(separator + PAIR_SEPARATOR.length).trim();
  if (login === '' || shortName === '') return undefined;
  return { login, shortName };
}

function parseDevUser({
  NODE_ENV,
  ALLOWED_USERS,
  DEV_USER,
}: Environment): Parsed<string | undefined> {
  if (DEV_USER === undefined) return { ok: true, value: undefined };
  if (NODE_ENV !== DEVELOPMENT) {
    return rejected('DEV_USER works only when NODE_ENV is development');
  }
  const login = normalizeLogin(DEV_USER);
  if (!ALLOWED_USERS.has(login)) {
    return rejected('DEV_USER must be one of the logins in ALLOWED_USERS');
  }
  return { ok: true, value: login };
}

/** Logins compare trimmed and in lowercase. */
function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function rejected(error: string): Parsed<never> {
  return { ok: false, error };
}
