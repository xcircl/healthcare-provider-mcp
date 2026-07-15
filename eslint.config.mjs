// Flat ESLint config — TypeScript recommended, scoped to package sources & tests.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'examples/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts'],
    rules: {
      // The SDK deliberately uses `!` after a runtime hasSignals check.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
