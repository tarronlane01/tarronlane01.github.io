import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // ============================================================================
  // DEFAULT CONFIG: Block all direct Firebase and @firestore imports
  // ============================================================================
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

      // IMPORT ARCHITECTURE:
      // Layer 1: firebase/* -> only in src/data/firestore/ and auth-related files
      // Layer 2: @firestore   -> only in src/data/ (mutations, queries, cachedReads, etc.)
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/data/firestore/ and auth files. Use @firestore or data layer hooks instead.',
          },
          {
            group: ['@firestore', '@firestore/*'],
            message: 'Firestore imports only allowed in src/data/. Use data layer hooks instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // TYPES: Allow re-exporting firestore types and Firebase Auth types
  // ============================================================================
  {
    files: ['src/types/**/*.{ts,tsx}'],
    rules: {
      // Allow importing from firestore types for re-export
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/firestore', 'firebase/app'],
            message: 'Direct Firestore imports only allowed in src/data/firestore/.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // AUTH EXCEPTIONS: Files that need direct Firebase Auth access
  // ============================================================================
  {
    files: [
      'src/hooks/useFirebaseAuth.ts',
      'src/App.tsx',
    ],
    rules: {
      // Allow Firebase Auth imports for authentication functionality
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/firestore'],
            message: 'Direct Firestore imports only allowed in src/data/firestore/. Use @firestore instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // LAYER 2: data/ folder (except firestore/) can import from @firestore
  // Note: This must come BEFORE the firestore config to allow it to be overridden
  // ============================================================================
  {
    files: ['src/data/**/*.{ts,tsx}'],
    ignores: ['src/data/firestore/**/*.{ts,tsx}'],
    rules: {
      // Allow @firestore imports, but still block direct Firebase imports
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/data/firestore/. Use @firestore instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // LAYER 1: firestore/ folder can import from Firebase and use @firestore aliases
  // Note: This must come LAST so it overrides the data/ config
  // ============================================================================
  {
    files: ['src/data/firestore/**/*.{ts,tsx}'],
    rules: {
      // Allow both Firebase and @firestore/* path aliases within this folder
      'no-restricted-imports': 'off',
    },
  },
])
