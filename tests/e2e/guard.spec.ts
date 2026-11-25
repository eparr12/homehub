import { expect, test } from './fixtures.ts';

// Tests the guard in fixtures.ts, which every other test rests on (TEST-2).
// The guard asserts as each test ends, on the app's page under the server's
// real Content Security Policy.

// Late enough to miss a guard that compares as the test ends, and well inside
// the guard's wait.
const LATE_PROBLEM_MS = 300;
// For the test whose expected problem never happens, which waits the whole
// time in each project.
const SHORT_PROBLEM_WAIT_MS = 200;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Views' })).toBeVisible();
});

test('fails a test whose page logs a console error it did not expect', async ({
  page,
}) => {
  // Passes only if the test fails, which only the guard can make it do. The
  // list reporter still prints a cross beside it when it fails as expected.
  test.fail();

  await page.evaluate(() => {
    console.error('on purpose');
  });
});

test('records a console error, an uncaught error and a policy violation that a test expects', async ({
  page,
  expectProblem,
}) => {
  expectProblem(/^console error.*: on purpose$/);
  expectProblem(/^uncaught error: on purpose$/);
  expectProblem(/^policy violation: script-src-elem blocked inline$/);
  // The browser's own report of the blocked script, in every engine's words.
  expectProblem(/^console error.*Content Security Policy/);

  await page.evaluate(() => {
    console.error('on purpose');
  });
  const thrown = page.waitForEvent('pageerror');
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('on purpose');
    });
  });
  await thrown;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        document.addEventListener(
          'securitypolicyviolation',
          () => {
            resolve();
          },
          { once: true },
        );
        const script = document.createElement('script');
        script.textContent = 'void 0';
        document.head.append(script);
      }),
  );
});

test('passes a test whose expected problem arrives after its last line', async ({
  page,
  expectProblem,
}) => {
  expectProblem(/^console error.*: late on purpose$/);

  await page.evaluate((delay) => {
    setTimeout(() => {
      console.error('late on purpose');
    }, delay);
  }, LATE_PROBLEM_MS);
});

test.describe('with the wait cut short', () => {
  test.use({ expectedProblemWait: SHORT_PROBLEM_WAIT_MS });

  test('fails a test whose expected problem never happens', ({
    expectProblem,
  }) => {
    // Passes only if the test fails, which only the guard can make it do.
    test.fail();

    expectProblem(/^console error.*: never on purpose$/);
  });
});
