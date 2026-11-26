import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AllowedUsers } from '../config.ts';
import { problem } from './errors.ts';
import type { RequestEnv } from './request-log.ts';

// Tailscale Serve sets these on each request from a tailnet user, replacing
// any that the client sent.
const LOGIN_HEADER = 'Tailscale-User-Login';
const NAME_HEADER = 'Tailscale-User-Name';
const HTTP_UNAUTHORIZED = 401;
const REFUSED_DETAIL =
  'The request has no Tailscale identity on the allowed list.';
// Serve sends a non-ASCII value as RFC 2047 encoded words in UTF-8 and Q
// encoding (Tailscale issue 11603), and splits a long value into several words
// with a space between them. That space isn't part of the value (RFC 2047,
// section 6.2), so a match takes it along when another word follows.
const ENCODED_WORD =
  /=\?utf-8\?q\?([^?]*)\?=(?:\s+(?==\?utf-8\?q\?[^?]*\?=))?/gi;
// In Q encoding, "=XX" is a byte in hex and any other character stands for
// itself, once "_" has become a space.
const Q_BYTE = /=([0-9a-f]{2})|./gi;
const HEX_RADIX = 16;

type Refusal = 'login header missing' | 'login not on ALLOWED_USERS';

/** The allowed user who sent a request. */
export interface User {
  /** Stands in for the login in logs and in the app (SEC-7). */
  readonly shortName: string;
  readonly displayName: string;
}

/** What a request carries once identity has let it through. */
export interface IdentifiedEnv {
  Variables: RequestEnv['Variables'] & { user: User };
}

export interface IdentityOptions {
  readonly allowedUsers: AllowedUsers;
  /** The login that a request without a login header counts as; config allows it in development only (SEC-3). */
  readonly devUser?: string | undefined;
}

/**
 * Lets a request through only when its Tailscale-User-Login is on
 * ALLOWED_USERS, and answers any other with a 401 problem (SEC-3). The header
 * is trusted only because Tailscale Serve on the same machine is the server's
 * one client from the tailnet (SEC-2), and ownHost has already refused a web
 * page that reached the port under its own name.
 */
export function identity({ allowedUsers, devUser }: IdentityOptions) {
  return createMiddleware<IdentifiedEnv>(async (c, next) => {
    const header = c.req.header(LOGIN_HEADER);
    const login =
      header === undefined ? devUser : decodeHeader(header).toLowerCase();
    if (login === undefined) return refuse(c, 'login header missing');
    const shortName = allowedUsers.get(login);
    if (shortName === undefined) return refuse(c, 'login not on ALLOWED_USERS');
    const displayName = readDisplayName(c.req.header(NAME_HEADER), shortName);
    c.set('user', { shortName, displayName });
    c.set('log', c.get('log').child({ user: shortName }));
    await next();
  });
}

function refuse(c: Context<IdentifiedEnv>, reason: Refusal): Response {
  // The reason only, because a login is an email address (SEC-7).
  c.get('log').warn({ reason }, 'request refused');
  return problem(c, HTTP_UNAUTHORIZED, REFUSED_DETAIL);
}

/** The decoded name header, or the short name when the header is missing or empty. */
function readDisplayName(
  header: string | undefined,
  shortName: string,
): string {
  if (header === undefined || header === '') return shortName;
  return decodeHeader(header);
}

/** Decodes the encoded words in a header value; other text stays as it is. */
function decodeHeader(value: string): string {
  return value.replaceAll(ENCODED_WORD, (_word, text: string) => decodeQ(text));
}

function decodeQ(text: string): string {
  const bytes = Uint8Array.from(
    text.replaceAll('_', ' ').matchAll(Q_BYTE),
    ([character, hex]) =>
      hex === undefined
        ? character.charCodeAt(0)
        : Number.parseInt(hex, HEX_RADIX),
  );
  return new TextDecoder().decode(bytes);
}
