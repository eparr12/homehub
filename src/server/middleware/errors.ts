import { STATUS_CODES } from 'node:http';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Problem } from '../../shared/problem.ts';
import type { RequestEnv } from './request-log.ts';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';
// A problem that means no more than its status code (RFC 9457, section 4.2.1).
const BLANK_TYPE = 'about:blank';
// Only for a status code that Node has no reason phrase for.
const UNKNOWN_STATUS_TITLE = 'Unknown Status';
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** Answers with RFC 9457 Problem Details that carry the request ID (SRV-4, OBS-5). */
export function problem<E extends RequestEnv>(
  c: Context<E>,
  status: ContentfulStatusCode,
  detail?: string,
): Response {
  const body: Problem = {
    type: BLANK_TYPE,
    // An about:blank problem's title is its status code's reason phrase.
    title: STATUS_CODES[status] ?? UNKNOWN_STATUS_TITLE,
    status,
    detail,
    requestId: c.get('requestId'),
  };
  return c.json(body, status, { 'Content-Type': PROBLEM_CONTENT_TYPE });
}

/** Answers a request that no route matches with a 404 problem. */
export const handleNotFound: NotFoundHandler<RequestEnv> = (c) =>
  problem(c, HTTP_NOT_FOUND);

/**
 * Answers every error with Problem Details (SRV-4, OBS-4). csrf and bodyLimit
 * throw an HTTPException that carries a plain-text response, so only its
 * status is kept. Anything else is unexpected: it's logged once, here, and
 * answered with a 500 that has no detail, because the message could name a
 * file or hold SQL (OBS-3).
 */
export const handleError: ErrorHandler<RequestEnv> = (error, c) => {
  if (error instanceof HTTPException) return problem(c, error.status);
  c.get('log').error({ err: error }, 'request failed');
  return problem(c, HTTP_INTERNAL_SERVER_ERROR);
};
