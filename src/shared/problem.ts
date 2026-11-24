import { z } from 'zod';

/**
 * The body of every error response: RFC 9457 Problem Details, sent as
 * application/problem+json, plus the request ID from the logs (SRV-4, OBS-5).
 */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  requestId: z.string(),
});

export type Problem = z.infer<typeof problemSchema>;
