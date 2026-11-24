import { z } from 'zod';

/** The one /api route that needs no identity: Docker's health check calls it (SRV-6). */
export const HEALTH_PATH = '/api/health';

const statusSchema = z.enum(['ok', 'error']);

/** The body of GET /api/health: 200 when every part is ok, 503 otherwise. */
export const healthResponseSchema = z.object({
  status: statusSchema,
  database: statusSchema,
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
