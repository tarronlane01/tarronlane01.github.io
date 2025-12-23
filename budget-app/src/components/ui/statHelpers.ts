// Helper functions for stat card formatting
// Separated from components to satisfy react-refresh/only-export-components

import { colors } from '../../styles/shared'

// Helper for formatting currency
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Helper for balance color
export function getBalanceColor(amount: number): string {
  return amount >= 0 ? colors.success : colors.danger
}

