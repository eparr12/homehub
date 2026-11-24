import { z } from 'zod';

/** The body of GET /api/me: the allowed user who sent the request (SEC-3). */
export const meResponseSchema = z.object({
  shortName: z.string(),
  displayName: z.string(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
