import { createMiddleware } from 'hono/factory';
import { problem } from './errors.ts';
import type { RequestEnv } from './request-log.ts';

// The names that reach the server from its own machine. A URL writes an IPv6
// address in brackets.
const LOOPBACK_NAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);
// Tailscale Serve passes on the Host that the browser sent, the machine's name
// under ts.net, and only Tailscale answers DNS for names there. The leading
// dot keeps out a name such as attackerts.net.
const TAILNET_SUFFIX = '.ts.net';
const HTTP_MISDIRECTED_REQUEST = 421;
const REFUSED_DETAIL =
  "The request's Host is neither a loopback name nor a name under ts.net.";
const REFUSED_REASON = 'Host not a loopback name or under ts.net';

/**
 * Refuses, with a 421 problem, any request whose Host isn't one of the
 * server's own names (SEC-3). A web page can point its own name at 127.0.0.1
 * (DNS rebinding), and its requests to that name are then same-origin, so it
 * could send Tailscale-User-Login itself. The one thing it can't choose is the
 * Host, which the browser writes from the page's own address.
 */
export function ownHost() {
  return createMiddleware<RequestEnv>(async (c, next) => {
    // @hono/node-server builds the URL from the Host header, and app.request()
    // takes it from the URL that a test passes. Either way, its hostname is in
    // lowercase and has no port.
    if (!isOwnName(new URL(c.req.url).hostname)) {
      c.get('log').warn({ reason: REFUSED_REASON }, 'request refused');
      return problem(c, HTTP_MISDIRECTED_REQUEST, REFUSED_DETAIL);
    }
    await next();
  });
}

function isOwnName(hostname: string): boolean {
  return LOOPBACK_NAMES.has(hostname) || hostname.endsWith(TAILNET_SUFFIX);
}
