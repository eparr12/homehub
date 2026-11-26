import { createMiddleware } from 'hono/factory';
import { problem } from './errors.ts';
import type { RequestEnv } from './request-log.ts';

// The names that reach the server from its own machine, on any port. A URL
// writes an IPv6 address in brackets.
const LOOPBACK_NAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);
// The machine's name on the tailnet, which Tailscale Serve passes on as the
// browser sent it, by Tailscale's source (ipn/ipnlocal/serve.go). The leading
// dot keeps out a name such as attackerts.net.
const TAILNET_SUFFIX = '.ts.net';
const HTTP_MISDIRECTED_REQUEST = 421;
const REFUSED_DETAIL = "The request's Host isn't one of the server's names.";
const REFUSED_REASON = "Host not one of the server's names";

/**
 * Refuses, with a 421 problem, any request whose Host isn't one of the
 * server's own names: a loopback name on any port, or a name under ts.net
 * with no port (SEC-3). A web page can point a name of its own at 127.0.0.1
 * (DNS rebinding), and its requests to that name are then same-origin, so it
 * could send Tailscale-User-Login itself. The browser writes the Host from the
 * page's own address, and to reach the server the page has to name its port.
 */
export function ownHost() {
  return createMiddleware<RequestEnv>(async (c, next) => {
    // @hono/node-server builds the URL from the Host header, and app.request()
    // takes it from the URL that a test passes. Either way, the name is in
    // lowercase, and a port that is the scheme's default is gone.
    const url = new URL(c.req.url);
    if (!isOwnName(url)) {
      // Never a login (SEC-7): a URL's host can't hold an @, and
      // @hono/node-server answers a Host header that holds one with a 400.
      c.get('log').warn(
        { reason: REFUSED_REASON, refusedHost: url.host },
        'request refused',
      );
      return problem(c, HTTP_MISDIRECTED_REQUEST, REFUSED_DETAIL);
    }
    await next();
  });
}

/**
 * A name under ts.net counts only with no port: a request through Serve has
 * none, because the browser leaves out HTTPS's default port, and a page under
 * a rebound name carries the server's.
 */
function isOwnName({ hostname, port }: URL): boolean {
  if (LOOPBACK_NAMES.has(hostname)) return true;
  return hostname.endsWith(TAILNET_SUFFIX) && port === '';
}
