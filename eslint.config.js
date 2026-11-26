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
const WEB_RUNS_NO_SERVER_CODE =
  'src/web never imports runtime code from src/server (ARCH-2).';
const WEB_TAKES_ONLY_APP_TYPE =
  'Of src/server, src/web imports only `import type { AppType }` (ARCH-2).';
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
  // through still meets the others (ARCH-7).
  {
    files: ['src/shared/**/*.ts'],
    rules: {
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
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/web/**'],
              message: 'src/server never imports from src/web (ARCH-3).',
            },
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
