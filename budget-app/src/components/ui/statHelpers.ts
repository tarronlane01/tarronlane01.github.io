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

// Helper for balance color (standard: green positive, red negative)
export function getBalanceColor(amount: number): string {
  return amount >= 0 ? colors.success : colors.danger
}

// Helper for category balance color (uses debt/orange for negative instead of red)
export function getCategoryBalanceColor(amount: number): string {
  return amount >= 0 ? colors.success : colors.debt
}

