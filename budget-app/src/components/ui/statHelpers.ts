// Helper functions for stat card formatting
// Separated from components to satisfy react-refresh/only-export-components

import { colors } from '../../styles/shared'

// Helper for formatting currency
// Formats a currency amount. Always uses absolute value - callers should handle sign display.
export function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Formats a balance with negative sign for debt: -$100.00 for negative, $100.00 for positive
export function formatBalanceCurrency(amount: number): string {
  if (amount < 0) {
    return `-$${Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Formats a currency amount with sign prefix: +$100.00, -$100.00, or $0.00 (no sign for zero)
export function formatSignedCurrency(amount: number): string {
  if (amount === 0) return '$0.00'
  const sign = amount > 0 ? '+' : '-'
  return `${sign}${formatCurrency(amount)}`
}

// Formats a currency amount with sign prefix, always showing sign: +$100.00, -$100.00, +$0.00
export function formatSignedCurrencyAlways(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(amount)}`
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
// For spend values: negative = money out (red), positive = money in (green)
export function getSpendColor(value: number): string {
  if (value === 0) return colors.zero
  return value < 0 ? colors.error : colors.success
}

// Helper for allocated color (green positive, red negative, grey zero)
export function getAllocatedColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

