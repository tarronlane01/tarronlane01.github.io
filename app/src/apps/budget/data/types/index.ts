/**
 * Budget Firestore Types
 *
 * Type definitions for budget-specific Firestore documents.
 * For shared types (FirestoreData, WhereClause), import from @firestore.
 */

// Re-export shared types for convenience
export type { FirestoreData, WhereClause } from '@firestore'

// Document types
export type { PayeesDocument } from './PayeesDocument'

// User-related types
export type { PermissionFlags, UserDocument } from './user/index'

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
  MonthMap,
} from './budget/index'

// Month-related types
export type {
  IncomeTransaction,
  ExpenseTransaction,
  TransferTransaction,
  AdjustmentTransaction,
  CategoryMonthBalance,
  CategoryMonthBalanceStored,
  AccountMonthBalance,
  AccountMonthBalanceStored,
  MonthDocument,
} from './month/index'
