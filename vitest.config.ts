import { defineConfig } from 'vitest/config';

// Started from a path with a lowercase drive letter, such as c:\dev\homehub,
// Vitest 5 loads two copies of its runtime and every suite fails with
// "Vitest failed to find the current suite" (vitest-dev/vitest#11872). A root
// setting can't fix it, because Vitest has already loaded from that path.
// Remove this check once the issue is fixed.
const LOWERCASE_DRIVE_LETTER = /^[a-z]:/;
const cwd = process.cwd();
if (process.platform === 'win32' && LOWERCASE_DRIVE_LETTER.test(cwd)) {
  const fixedCwd = `${cwd.charAt(0).toUpperCase()}${cwd.slice(1)}`;
  throw new Error(
    `Vitest 5 can't run from ${cwd}, because its drive letter is lowercase (vitest-dev/vitest#11872). Run Set-Location '${fixedCwd}' (in Bash, cd '${fixedCwd.replaceAll('\\', '/')}'), then try again.`,
  );
}

export default defineConfig({
  test: {
    // On only in CI, as forbidOnly is in playwright.config.ts, so `npm run
    // check` stays one command for everyone; `npm run test -- --coverage`
    // prints the table locally. No thresholds: the number is a signal, not a
    // target (TEST-3).
    coverage: {
      enabled: Boolean(process.env.CI),
      // Every source file counts, so a module that no test imports shows at
      // 0% instead of going missing from the table. Vitest leaves out the
      // test files and setup files itself; test-support.ts holds the server
      // tests' helpers, which aren't code under test.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/server/test-support.ts'],
      reporter: ['text'],
    },
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/server/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/web/**/*.test.{ts,tsx}'],
          setupFiles: ['src/web/test-setup.ts'],
        },
      },
    ],
  },
});
