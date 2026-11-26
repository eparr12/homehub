// JavaScript, not TypeScript: ESLint 10 loads a TypeScript config only through
// jiti or an unstable flag that the VS Code extension doesn't pass.
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import js from '@eslint/js';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const SHARED_IS_PURE = 'src/shared is pure TypeScript (ARCH-1).';
const SHARED_READS_NO_CLOCK =
  'src/shared reads no clock and no random source, so that the client and the server give the same answer: take the value as a parameter (TS-8).';
// The usual ways to read a clock or a random source, not every way:
// `const { now } = Date` and `globalThis.Date.now()` get past. A Date built
// from a value, Date.parse and Date.UTC stay allowed.
const CLOCK_AND_RANDOM_READS = [
  'NewExpression[callee.name="Date"][arguments.length=0]',
  // Date() returns the time now whatever it's passed.
  'CallExpression[callee.name="Date"]',
  'MemberExpression[object.name="Date"][property.name="now"]',
  'MemberExpression[object.name="Temporal"][property.name="Now"]',
  'MemberExpression[object.name="performance"][property.name="now"]',
  'MemberExpression[object.name="Math"][property.name="random"]',
  'Identifier[name="crypto"]',
];
const WEB_RUNS_NO_SERVER_CODE =
  'src/web never imports runtime code from src/server (ARCH-2).';
const WEB_TAKES_ONLY_APP_TYPE =
  'Of src/server, src/web imports only `import type { AppType }` (ARCH-2).';
const SERVER_NEVER_IMPORTS_WEB =
  'src/server never imports from src/web (ARCH-3).';
const SPECS_USE_THE_GUARD =
  'Import test and expect from ./fixtures.ts, whose guard fails a test on page errors and policy violations.';

export default defineConfig(
  includeIgnoreFile(join(import.meta.dirname, '.gitignore')),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
  },
  // The import boundaries below use ESLint's own no-restricted-imports, which
  // checks every pattern on its own: a type import that one pattern lets
  // through still meets the others (ARCH-7). That rule reads only import and
  // export declarations, so a dynamic import() would cross a boundary unseen,
  // and each block refuses one with no-restricted-syntax and its own message.
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      // Pure code loads nothing at run time, so every import() is refused,
      // and it reads no clock. One entry for both, because a later block that
      // set this rule would replace these options.
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: SHARED_IS_PURE },
        ...CLOCK_AND_RANDOM_READS.map((selector) => ({
          selector,
          message: SHARED_READS_NO_CLOCK,
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules.map((name) => ({
            name,
            message: SHARED_IS_PURE,
          })),
          patterns: [
            { group: ['node:*'], message: SHARED_IS_PURE },
            { group: ['**/server/**', '**/web/**'], message: SHARED_IS_PURE },
          ],
        },
      ],
    },
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)server\\//]',
          message: WEB_RUNS_NO_SERVER_CODE,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          // Two patterns for ARCH-2, because each leaves a gap alone:
          // allowTypeImports lets every type through, and allowImportNames
          // can't refuse a bare import, which names nothing.
          patterns: [
            {
              group: ['**/server/**'],
              allowTypeImports: true,
              message: WEB_RUNS_NO_SERVER_CODE,
            },
            {
              group: ['**/server/**'],
              allowImportNames: ['AppType'],
              message: WEB_TAKES_ONLY_APP_TYPE,
            },
            // tsc enforces TS-3 under nodenext but not under src/web's
            // bundler resolution.
            {
              regex: '^\\.{1,2}/(?:.*/)?[^./]+$',
              message: 'Relative imports include their file extension (TS-3).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)web\\//]',
          message: SERVER_NEVER_IMPORTS_WEB,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/web/**'], message: SERVER_NEVER_IMPORTS_WEB },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/e2e/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // Both names export Playwright's test runner.
          paths: ['@playwright/test', 'playwright/test'].map((name) => ({
            name,
            allowTypeImports: true,
            message: SPECS_USE_THE_GUARD,
          })),
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/main.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Only src/server/main.ts reads process.env; take config as a parameter (ARCH-6).',
        },
      ],
    },
  },
  prettier,
);
