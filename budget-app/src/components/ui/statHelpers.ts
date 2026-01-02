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

// Helper for balance color (standard: green positive, grey zero, red negative)
export function getBalanceColor(amount: number): string {
  if (amount === 0) return colors.zero
  return amount > 0 ? colors.success : colors.danger
}

// Helper for category balance color (green positive, grey zero, orange/debt negative)
export function getCategoryBalanceColor(amount: number): string {
  if (amount === 0) return colors.zero
  return amount > 0 ? colors.success : colors.debt
}

// Helper for spend color (red when money leaves, green if refund, grey if zero)
export function getSpendColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.error : colors.success
}

// Helper for allocated color (green when positive, grey if zero)
export function getAllocatedColor(value: number): string {
  return value > 0 ? colors.success : colors.zero
}

