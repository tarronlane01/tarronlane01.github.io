/**
 * Firestore Types
 *
 * Type definitions for Firestore operations.
 */

// Core Firestore types
export type { FirestoreData } from './FirestoreData'
export type { WhereClause } from './WhereClause'

// Document types
export type { PayeesDocument } from './PayeesDocument'

// User-related types
export type { PermissionFlags, UserDocument } from '@firestore/types/user/index'

// Budget-related types
export type {
  ExpectedBalanceType,
  AccountGroup,
  AccountGroupsMap,
  FinancialAccount,
  AccountsMap,
  DefaultAmountType,
  Category,
  CategoriesMap,
  CategoryGroup,
  CategoryGroupsMap,
  CategoryGroupWithId,
  Budget,
  MonthInfo,
  MonthMap,
} from '@firestore/types/budget/index'

// Month-related types
export type {
  IncomeTransaction,
  ExpenseTransaction,
  TransferTransaction,
  AdjustmentTransaction,
  CategoryMonthBalance,
  AccountMonthBalance,
  MonthDocument,
} from '@firestore/types/month/index'
