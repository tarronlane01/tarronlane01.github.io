// Barrel file for all type exports

// UI types (not Firestore documents)
export type { BudgetInvite, BudgetSummary } from './budget'

// Firestore document types (from firestore module)
export type {
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
  CategoryGroupsMap,
  CategoryGroupWithId,
  Budget,
  MonthMap,
  IncomeTransaction,
  ExpenseTransaction,
  TransferTransaction,
  AdjustmentTransaction,
  CategoryMonthBalance,
  CategoryMonthBalanceStored,
  AccountMonthBalance,
  AccountMonthBalanceStored,
  MonthDocument,
} from '../data/firestore/types'

// Alias for BudgetCategory (same as Category)
export type { Category as BudgetCategory } from '../data/firestore/types'

// Auth types
export type { type_firebase_auth_hook } from './type_firebase_auth_hook'

// User context types
export type { type_user_context } from './type_user_context'
