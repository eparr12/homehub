# ADR-0004: Tailscale-only access with identity headers

Nov 25, 2026 · Ethan

## Status

Accepted

## Context

Two people use HomeHub, at the wall and on their phones, and both need full use of it away from home. Nothing about it may be reachable from the public internet, and the overview's goals rule out passwords.

The first design put the API on the public internet from its first deploy. Each of us would sign in through an OIDC provider, the client would refresh its token ahead of every outbox flush, and the wall would sign in with a one-time pairing code. All of it was code to write and to keep working offline, where an expired session could strand the outbox.

## Decision

Every device joins one Tailscale tailnet, on the free Personal plan. The host publishes HomeHub with Tailscale Serve at `https://homehub.<tailnet>.ts.net`, tailnet only, and Serve passes each request to the container on 127.0.0.1:8080. For each request from a user's device, Serve adds identity headers, Tailscale-User-Login among them. The server lets an /api request through only when that login is on ALLOWED_USERS, which gives each login a short name that logs and the app show in its place, and answers any other with a 401 (SEC-3, SEC-7). GET /api/health is the one /api route open without it, and it reports only status (SRV-6). In development, where there's no Serve, DEV_USER stands in for the missing header, and the config refuses DEV_USER anywhere else.

There are no passwords, sessions or tokens, so none can expire under the outbox.

Trusting the header rests on four things:

1. **The port listens on loopback only.** compose.yaml publishes 127.0.0.1:8080 and nothing else (SEC-2), so nothing from another machine reaches the server without passing through Serve. #13's trial saw 127.0.0.1:8080 as the only address listening on that port.
2. **Serve replaces the identity headers.** It removes a client's own copies, in any letter case and with underscores for hyphens, and sets them from the connection's source address (read in Tailscale's source). #16's Find out saw it: a forged login, in either spelling, got the same answer as none.
3. **Serve sets none for a request with no user behind it.** It sets no identity headers for a tagged device, or for a request from outside the tailnet (Tailscale's docs and source). Funnel, which would let the internet in, stays off (SEC-2).
4. **The server answers only to its own names** (SEC-3, #17): a loopback name on any port, and a name under ts.net with no port. Any other Host gets a 421, before any route, file or identity check.

The fourth is there for browsers on the host. A web page can point a name of its own at 127.0.0.1 (DNS rebinding), and its requests to that name are then same-origin, so it can send any header, a forged login among them. But the browser writes the Host from the page's own address, so such a page has to name the server's port, whoever answers its DNS. A request through Serve names none, because Serve passes the browser's Host on (read in its source) and a browser leaves out HTTPS's default port. #17's description has what a trial on main without the check showed: another site's name with an allowed login got 200. Its Find out b ran after the merge, from a laptop on the tailnet, on November 26 at about 01:50 UTC. It saw the real Serve pass a forged Host on to the 421: GET /api/me and GET /api/health at the address answered 200, and GET /api/health with `Host: attacker.example` got the server's own 421 problem. Chrome also asks before a public page reaches a loopback address, in its Local Network Access check (read on developer.chrome.com), but the server doesn't count on it.

Two more things were decided along the way:

- **The web app's files need no identity** (#8). They hold no data until the app calls /api, which does. So a device whose login isn't on the list still gets every page and can install the app, and every /api route but the health check refuses it with a 401.
- **The host's own browser counts as me.** At the ts.net address, Serve gives the desktop's browser my identity, which I saw on November 25 (#16), so the wall, which runs in Edge on the desktop until Phase 6, can use /api.

**The tailnet's access rules.** On November 25 I decided to keep Tailscale's default policy, under which every device on the tailnet reaches every other, because the tailnet holds only our own devices (SEC-11) and two people who trust each other. I'll revisit it in Phase 7, when the NAS takes over, because the NAS can carry a tag that a rule names. The desktop can't: a tagged device has no user, so Serve would give the wall on it no identity.

## Alternatives considered

**Public hosting with OIDC sign-in**, the first design, as the Context describes. It puts an endpoint on the internet, which the overview's goals rule out, and its sign-in, token refresh and pairing code are code to write and keep working offline.

**For the Host check** (#17):

- **No check at all**, as on main before #17. The trial above shows what that let in.
- **Any name under ts.net, on any port.** That was #17's first version. Its review tightened it, because whoever answers this machine's DNS can point such a name at a page too, and only the port tells that page apart from a request through Serve.
- **The exact address.** It would put the tailnet's name in a setting.

**For the tailnet's rules:** a grant that lets our devices reach only HomeHub's HTTPS port, in place of the default policy.

## Consequences

HomeHub has no sign-in code to write or keep working offline, and the server never listens beyond 127.0.0.1. Its limits, stated plainly:

- **Identity is the tailnet user, not the device or the program.** Any program on any of my machines on the tailnet reaches HomeHub as me, a Claude Code session included, which is why CLAUDE.md lets such a session send the address only the GET requests a prompt names. The wall signs in to Tailscale as one of us too, so the sync design records a device name, such as "wall", with each change (ADR-0005).
- **Any program on the host can reach the port and send the header itself.** The Host check stops only a browser, which writes the Host from a page's address. Any other program sends whatever Host it likes.
- **An organization I don't control sets policy on the wall's browser.** Until Phase 6 the wall runs in Edge on the desktop, and a work or school account manages that Edge, which is why it can't install an app there. So that account's organization sets policy on the browser that holds the wall's session. The mini PC won't have that account.
- **Serve stays on port 443.** A second HTTPS port would put its number in the Host, and every request through it would get a 421 (deploy/README.md).
- **It all depends on Tailscale.** The host has to be on, both phones need Tailscale connected, and the free Personal plan's limits apply.
