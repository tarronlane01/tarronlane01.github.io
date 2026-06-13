import { colors } from '@styles/shared'

interface AccountBadgeProps {
  icon: string
  label: string
  variant: 'success' | 'warning' | 'muted' | 'income' | 'expense'
  title?: string
}

export function AccountBadge({ icon, label, variant, title }: AccountBadgeProps) {
  const variantStyles = {
    success: {
      background: `color-mix(in srgb, ${colors.success} 20%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colors.success} 40%, transparent)`,
      color: colors.success,
      opacity: 1,
    },
    warning: {
      background: `color-mix(in srgb, ${colors.warning} 15%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colors.warning} 35%, transparent)`,
      color: colors.warning,
      opacity: 1,
    },
    muted: {
      background: 'color-mix(in srgb, currentColor 12%, transparent)',
      border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
      color: 'inherit',
      opacity: 0.7,
    },
    income: {
      background: `color-mix(in srgb, ${colors.success} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colors.success} 25%, transparent)`,
      color: colors.success,
      opacity: 0.7,
    },
    expense: {
      background: `color-mix(in srgb, ${colors.warning} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${colors.warning} 25%, transparent)`,
      color: colors.warning,
      opacity: 0.7,
    },
  }

  const styles = variantStyles[variant]

  return (
    <span
      title={title || label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        background: styles.background,
        border: styles.border,
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        color: styles.color,
        opacity: styles.opacity,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '0.75rem' }}>{icon}</span>
      {label}
    </span>
  )
}

