import type { ReactNode, CSSProperties } from 'react'
import { statsCard, statLabel, statValue, colors } from '../../styles/shared'

interface StatItemProps {
  label: string
  value: string | number
  valueColor?: string
}

export function StatItem({ label, value, valueColor }: StatItemProps) {
  return (
    <div>
      <p style={statLabel}>{label}</p>
      <p style={{ ...statValue, color: valueColor }}>{value}</p>
    </div>
  )
}

interface StatCardProps {
  children: ReactNode
  style?: CSSProperties
}

export function StatCard({ children, style }: StatCardProps) {
  return <div style={{ ...statsCard, ...style }}>{children}</div>
}

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

