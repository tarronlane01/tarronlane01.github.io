/**
 * Firestore Module
 *
 * ⚠️ DO NOT IMPORT THIS FILE DIRECTLY FROM OUTSIDE data/ ⚠️
 *
 * This module provides low-level Firestore operations for INTERNAL use only.
 * It should only be imported by:
 * - data/queries/*.ts (query hooks)
 * - data/mutations/*.ts (mutation hooks)
 * - data/cachedReads.ts (cached read functions)
 *
 * ALL external code must use:
 * - Query hooks or cachedReads for READS
 * - Mutation hooks for WRITES
 *
 * The ESLint rule 'no-restricted-imports' enforces this pattern.
 * Exceptions require eslint-disable with an explanatory comment.
 */

// Firebase app
export { default as app } from '@firestore/app'

// Instance & references
export { getDb, getDocRef, arrayUnion } from '@firestore/instance'

// Types
export type {
  WhereClause,
  FirestoreData,
  PayeesDocument,
  PermissionFlags,
  UserDocument,
  ExpectedBalanceType,
  AccountGroup,
  AccountGroupsMap,
  FinancialAccount,
  AccountsMap,
  DefaultAmountType,
  Category,
  CategoriesMap,
  CategoryGroup,
  Budget,
  IncomeTransaction,
  ExpenseTransaction,
  CategoryMonthBalance,
  AccountMonthBalance,
  MonthDocument,
} from '@firestore/types/index'

// Operations
export { readDocByPath, queryCollection, writeDocByPath, updateDocByPath, deleteDocByPath } from '@firestore/operations/index'
