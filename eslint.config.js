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
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
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
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**'],
              allowTypeImports: true,
              message:
                'src/web imports only `import type { AppType }` from src/server (ARCH-2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
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
  prettier,
);
