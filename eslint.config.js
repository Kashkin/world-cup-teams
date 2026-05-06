import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    // Untyped rules — apply everywhere (including root configs like vite.config.ts).
    rules: {
      // TypeScript already handles undefined-reference checks.
      // https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
      // Ban @lucide/svelte barrel imports — the barrel forces Vite to dep-optimise ~27 MB of icon modules.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lucide/svelte',
              message:
                "Import icons deeply, e.g. `import Camera from '@lucide/svelte/icons/camera'`.",
            },
          ],
        },
      ],
    },
  },
  {
    // Type-aware rules only apply to first-party source. SvelteKit's generated tsconfig
    // includes src/ but not root configs (vite.config.ts, playwright.config.ts, eslint.config.js),
    // so scoping here prevents "not found by the project service" parsing errors on them.
    files: ['src/**/*.ts', 'src/**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js', 'src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      '**/*.server.ts',
      '**/*.server.js',
      'src/hooks.server.ts',
      'vite.config.ts',
      'vite.config.js',
      'svelte.config.js',
      'playwright.config.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
);
