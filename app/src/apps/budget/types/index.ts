// Budget UI types (not Firestore documents)
export type { BudgetInvite, BudgetSummary } from './budget'

// Re-export Firestore document types for convenience
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
} from '../data/types'

// Alias for BudgetCategory (same as Category)
export type { Category as BudgetCategory } from '../data/types'
