// Budget-specific query key factory
// Pattern: ['domain', 'entity', 'identifier']
export const queryKeys = {
  user: (userId: string) => ['user', userId] as const,
  budget: (budgetId: string) => ['budget', budgetId] as const,
  month: (budgetId: string, year: number, month: number) =>
    ['month', budgetId, year, month] as const,
  payees: (budgetId: string) => ['payees', budgetId] as const,
  accessibleBudgets: (userId: string) => ['accessibleBudgets', userId] as const,
  feedback: () => ['feedback'] as const,
}
