import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  // Main config for all TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Downgrade to warning - these are pre-existing in Firebase data handling code
      // TODO: Properly type Firebase data structures
      '@typescript-eslint/no-explicit-any': 'warn',

      // Prevent direct imports from firestore operations - use data layer exports instead
      // This applies to files OUTSIDE the data folder
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/firestore/operations', '**/firestore/operations.ts'],
            message: 'Import from "data/" instead. Direct Firestore access bypasses React Query caching.',
          },
        ],
      }],
    },
  },
  // Override for data layer - allow internal firestore imports
  {
    files: ['src/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
])
