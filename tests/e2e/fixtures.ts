import { test as base, expect } from '@playwright/test';

/**
 * Declares a page problem that the current test causes on purpose: the test
 * passes with problems that match the pattern, and fails if none does. Call
 * it before the problem can happen. Problems read "console error at <url>:
 * <text>", "uncaught error: <message>" or "policy violation: <directive>
 * blocked <what>".
 */
export type ExpectProblem = (pattern: RegExp) => void;

declare global {
  interface Window {
    /** Exposed in every page of a test's context, by the guard below. */
    reportPolicyViolation: (description: string) => Promise<void>;
  }
}

const REPORT_VIOLATION = 'reportPolicyViolation' satisfies keyof Window;

/**
 * Playwright's test with a guard that fails any test whose pages log a
 * console error, throw an uncaught error or break the Content Security
 * Policy (SEC-8), unless the test expected that problem. Warnings pass:
 * AppUpdates warns about a failed update check, a case it handles.
 */
export const test = base.extend<{ expectProblem: ExpectProblem }>({
  expectProblem: [
    async ({ context }, use) => {
      const problems: string[] = [];
      const expected: RegExp[] = [];
      context.on('console', (message) => {
        if (message.type() !== 'error') return;
        // A failed request reports the resource's URL, and a console.error
        // call its script's, so a test can expect a problem from one place.
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

      await use((pattern) => {
        expected.push(pattern);
      });

      expect({
        unexpected: problems.filter(
          (problem) => !expected.some((pattern) => pattern.test(problem)),
        ),
        neverHappened: expected
          .filter(
            (pattern) => !problems.some((problem) => pattern.test(problem)),
          )
          .map(String),
      }).toEqual({ unexpected: [], neverHappened: [] });
    },
    { auto: true },
  ],
});

export { expect };

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
