import { z } from 'zod';

// Zod 4 probes for eval with `new Function` when it creates its first object
// schema. The server's Content Security Policy refuses eval (SEC-8), so the
// browser reports a violation on every page load, even though Zod catches the
// error. jitless skips the probe, but only for schemas created after it's
// set, so main.tsx imports this module before anything that reaches
// src/shared.
z.config({ jitless: true });
