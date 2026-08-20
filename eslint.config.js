// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Project-wide ignores (mirrors .gitignore build/dep outputs)
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
      '**/.vite/**',
      '**/*.tsbuildinfo',
      // Local design prototype (standalone Next.js scaffold, not workspace source)
      'chatframe/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Constitution XIV: `any` is forbidden in core modules unless justified
      // and isolated at an external boundary.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Disable stylistic rules that conflict with Prettier (must be last).
  prettier,
);
