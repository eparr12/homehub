import { setTimeout as delay } from 'node:timers/promises';
import { test as base, type BrowserContext, expect } from '@playwright/test';

/**
 * Declares a page problem that the current test causes on purpose: the test
 * passes with problems that match the pattern, and fails if none does. Call
 * it before the problem can happen. A browser reports a problem on its own
 * schedule, which can be after the test's last line, so the guard waits up
 * to expectedProblemWait while an expected problem is missing, then compares.
 * Problems read "console error at <url>: <text>", "uncaught error: <message>"
 * or "policy violation: <directive> blocked <what>".
 */
export type ExpectProblem = (pattern: RegExp) => void;

declare global {
  interface Window {
    /** Exposed in every page of a test's context, by the guard below. */
    reportPolicyViolation: (description: string) => Promise<void>;
  }
}

const REPORT_VIOLATION = 'reportPolicyViolation' satisfies keyof Window;

// The same limit as Playwright's assertions.
const EXPECTED_PROBLEM_WAIT_MS = 5_000;
const EXPECTED_PROBLEM_CHECK_MS = 25;

/**
 * Playwright's test with a guard that fails any test whose pages log a
 * console error, throw an uncaught error or break the Content Security
 * Policy (SEC-8), unless the test expected that problem. Warnings pass:
 * AppUpdates warns about a failed update check, a case it handles.
 */
export const test = base.extend<{
  expectProblem: ExpectProblem;
  expectedProblemWait: number;
}>({
  // An option, so that a test of the guard can cut the wait short.
  expectedProblemWait: [EXPECTED_PROBLEM_WAIT_MS, { option: true }],
  expectProblem: [
    async ({ context, expectedProblemWait }, use) => {
      const problems = await recordProblems(context);
      const expected: RegExp[] = [];

      await use((pattern) => {
        expected.push(pattern);
      });

      await waitForExpected(problems, expected, expectedProblemWait);
      expect(compareProblems(problems, expected)).toEqual({
        unexpected: [],
        neverHappened: [],
      });
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Records the problems of every page in the context, from before its first
 * page opens. The list it returns grows as problems arrive.
 */
async function recordProblems(
  context: BrowserContext,
): Promise<readonly string[]> {
  const problems: string[] = [];
  context.on('console', (message) => {
    if (message.type() !== 'error') return;
    // A failed request reports the resource's URL, and a console.error call
    // its script's, so a test can expect a problem from one place.
    const { url } = message.location();
    const source = url === '' ? '' : ` at ${url}`;
    problems.push(`console error${source}: ${message.text()}`);
  });
  context.on('weberror', (webError) => {
    problems.push(`uncaught error: ${webError.error().message}`);
  });
  await context.exposeFunction(REPORT_VIOLATION, (description: string) => {
    problems.push(`policy violation: ${description}`);
  });
  await context.addInitScript(reportPolicyViolations);
  return problems;
}

/**
 * Waits while an expected problem is missing, for at most waitMs, and not at
 * all once every pattern matches a problem. The list grows as problems
 * arrive.
 */
async function waitForExpected(
  problems: readonly string[],
  expected: readonly RegExp[],
  waitMs: number,
): Promise<void> {
  for (let waited = 0; waited < waitMs; waited += EXPECTED_PROBLEM_CHECK_MS) {
    if (neverHappened(problems, expected).length === 0) return;
    await delay(EXPECTED_PROBLEM_CHECK_MS);
  }
}

/** The problems that no pattern expected, and the patterns that matched none. */
function compareProblems(
  problems: readonly string[],
  expected: readonly RegExp[],
): { unexpected: string[]; neverHappened: string[] } {
  return {
    unexpected: problems.filter(
      (problem) => !expected.some((pattern) => pattern.test(problem)),
    ),
    neverHappened: neverHappened(problems, expected),
  };
}

/** The patterns that match no problem, written as text. */
function neverHappened(
  problems: readonly string[],
  expected: readonly RegExp[],
): string[] {
  return expected
    .filter((pattern) => !problems.some((problem) => pattern.test(problem)))
    .map(String);
}

/**
 * Runs in each page before the page's own scripts. A violation is reported
 * as an event whether or not the page catches the error, as Zod does when it
 * probes for eval.
 */
function reportPolicyViolations(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    // Voided because the test side only records the description.
    void window.reportPolicyViolation(
      `${event.effectiveDirective} blocked ${event.blockedURI}`,
    );
  });
}
