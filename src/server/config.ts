import { z } from 'zod';

// Loopback only: Tailscale Serve on the same machine must be the server's one
// client, because that's what makes its identity headers trustworthy (SEC-2).
// Only the container sets HOST=0.0.0.0, and Compose publishes 127.0.0.1 alone.
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;
const MAX_TCP_PORT = 65_535;

const configSchema = z
  .object({
    HOST: z.ipv4().default(DEFAULT_HOST),
    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_TCP_PORT)
      .default(DEFAULT_PORT),
  })
  .transform((env) => ({ host: env.HOST, port: env.PORT }));

export type Config = z.infer<typeof configSchema>;

export type ConfigResult =
  | { readonly ok: true; readonly value: Config }
  | { readonly ok: false; readonly error: string };

/** Parses the server's settings from environment variables (SRV-9). */
export function parseConfig(
  env: Readonly<Record<string, string | undefined>>,
): ConfigResult {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, value: result.data };
}
