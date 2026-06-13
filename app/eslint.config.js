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
      // Layer 1: firebase/* -> only in src/shared/data/firestore/ and auth-related files
      // Layer 2: @firestore   -> only in data layers (src/shared/data/, src/apps/*/data/)
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/shared/data/firestore/ and auth files. Use @firestore or data layer hooks instead.',
          },
          {
            group: ['@firestore', '@firestore/*'],
            message: 'Firestore imports only allowed in data layers. Use data layer hooks instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // TYPES: Allow re-exporting firestore types and Firebase Auth types
  // ============================================================================
  {
    files: [
      'src/shared/types/**/*.{ts,tsx}',
      'src/apps/*/types/**/*.{ts,tsx}',
      'src/apps/*/data/types/**/*.{ts,tsx}',
    ],
    rules: {
      // Allow importing from firestore types for re-export
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/firestore', 'firebase/app'],
            message: 'Direct Firestore imports only allowed in src/shared/data/firestore/.',
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
      'src/shared/hooks/useFirebaseAuth.ts',
      'src/App.tsx',
    ],
    rules: {
      // Allow Firebase Auth imports for authentication functionality
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/firestore'],
            message: 'Direct Firestore imports only allowed in src/shared/data/firestore/. Use @firestore instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // LAYER 2: Shared data/ folder (except firestore/) can import from @firestore
  // ============================================================================
  {
    files: ['src/shared/data/**/*.{ts,tsx}'],
    ignores: ['src/shared/data/firestore/**/*.{ts,tsx}'],
    rules: {
      // Allow @firestore imports, but still block direct Firebase imports
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/shared/data/firestore/. Use @firestore instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // LAYER 2: App data/ folders can import from @firestore
  // ============================================================================
  {
    files: ['src/apps/*/data/**/*.{ts,tsx}'],
    rules: {
      // Allow @firestore imports, but still block direct Firebase imports
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/shared/data/firestore/. Use @firestore instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // MUTATION FILES: Block direct @firestore writes (must use write utilities)
  // Also blocks direct readMonthForEdit to enforce cache-aware reads via readMonth
  // ============================================================================
  {
    files: ['src/apps/budget/data/mutations/**/*.{ts,tsx}'],
    ignores: [
      // Domain-specific WRITE utilities (files that perform @firestore writes)
      'src/apps/budget/data/mutations/month/useWriteMonthData.ts',
      'src/apps/budget/data/mutations/month/createMonth.ts',
      'src/apps/budget/data/mutations/budget/writeBudgetData.ts',
      'src/apps/budget/data/mutations/user/writeUserData.ts',
      'src/apps/budget/data/mutations/payees/savePayeeIfNew.ts',
      'src/apps/budget/data/mutations/feedback/writeFeedbackData.ts',
      // Legacy: These use direct @firestore writes (should migrate to use write utilities)
      'src/apps/budget/data/mutations/user/useAcceptInvite.ts',
      'src/apps/budget/data/mutations/user/useCreateBudget.ts',
      // Index files just re-export
      'src/apps/budget/data/mutations/**/index.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/shared/data/firestore/. Use @firestore instead.',
          },
          {
            // Block direct @firestore write imports in mutation files
            group: ['@firestore'],
            importNames: ['writeDocByPath', 'updateDocByPath', 'deleteDocByPath', 'batchWriteDocs', 'batchDeleteDocs'],
            message: 'Direct Firestore writes are blocked in mutations. Use domain write utilities (writeMonthData, writeBudgetData, etc.) to ensure proper cache updates.',
          },
        ],
        paths: [
          {
            // Block direct readMonthForEdit in mutations - must use readMonth which is cache-aware via fetchQuery
            name: '@budget/data/queries/month',
            importNames: ['readMonthForEdit'],
            message: 'Direct readMonthForEdit is blocked in mutations. Use readMonth() which is cache-aware via React Query fetchQuery.',
          },
          {
            // Also block if imported via @budget/data
            name: '@budget/data',
            importNames: ['readMonthForEdit'],
            message: 'Direct readMonthForEdit is blocked in mutations. Use readMonth() which is cache-aware via React Query fetchQuery.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // MUTATION WRITE UTILITIES: Full access for files that perform Firestore writes
  // ============================================================================
  {
    files: [
      // Write utilities (provide writeXxxData functions)
      'src/apps/budget/data/mutations/month/useWriteMonthData.ts',
      'src/apps/budget/data/mutations/month/createMonth.ts',
      'src/apps/budget/data/mutations/budget/writeBudgetData.ts',
      'src/apps/budget/data/mutations/user/writeUserData.ts',
      'src/apps/budget/data/mutations/payees/savePayeeIfNew.ts',
      'src/apps/budget/data/mutations/feedback/writeFeedbackData.ts',
      // Special cases: These use useMutation for non-optimistic patterns
      // useCheckInvite: Query-as-mutation pattern (read-only, no cache update needed)
      'src/apps/budget/data/mutations/user/useCheckInvite.ts',
      // useAcceptInvite/useCreateBudget: Cross-document writes that use invalidation
      'src/apps/budget/data/mutations/user/useAcceptInvite.ts',
      'src/apps/budget/data/mutations/user/useCreateBudget.ts',
      // Packing write utility
      'src/apps/packing/data/mutations/writePackingData.ts',
    ],
    rules: {
      // These files are write utilities - allow @firestore, block only raw Firebase
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['firebase/*', 'firebase/firestore', 'firebase/app', 'firebase/auth'],
            message: 'Direct Firebase imports only allowed in src/shared/data/firestore/. Use @firestore instead.',
          },
        ],
      }],
    },
  },

  // ============================================================================
  // LAYER 1: firestore/ folder can import from Firebase
  // ============================================================================
  {
    files: ['src/shared/data/firestore/**/*.{ts,tsx}'],
    rules: {
      // Allow both Firebase and @firestore/* path aliases within this folder
      'no-restricted-imports': 'off',
    },
  },
])
