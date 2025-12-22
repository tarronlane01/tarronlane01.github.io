import type { AccountGroup } from '../../../types/budget'
import { colors } from '../../../styles/shared'

interface GroupOverrideFlagsProps {
  group: AccountGroup
}

export function GroupOverrideFlags({ group }: GroupOverrideFlagsProps) {
  const flags: React.ReactNode[] = []

  // Show inactive override
  if (group.is_active === false) {
    flags.push(
      <span
        key="inactive"
        style={{
          fontSize: '0.65rem',
          fontWeight: 500,
          padding: '0.15rem 0.35rem',
          borderRadius: '4px',
          background: `color-mix(in srgb, ${colors.warning} 20%, transparent)`,
          color: colors.warning,
          whiteSpace: 'nowrap',
        }}
        title="All accounts in this type are inactive"
      >
        All Inactive
      </span>
    )
  } else if (group.is_active === true) {
    flags.push(
      <span
        key="active"
        style={{
          fontSize: '0.65rem',
          fontWeight: 500,
          padding: '0.15rem 0.35rem',
          borderRadius: '4px',
          background: `color-mix(in srgb, ${colors.success} 20%, transparent)`,
          color: colors.success,
          whiteSpace: 'nowrap',
        }}
        title="All accounts in this type are active"
      >
        All Active
      </span>
    )
  }

  // Show off-budget override
  if (group.on_budget === false) {
    flags.push(
      <span
        key="off-budget"
        style={{
          fontSize: '0.65rem',
          fontWeight: 500,
          padding: '0.15rem 0.35rem',
          borderRadius: '4px',
          background: `color-mix(in srgb, ${colors.warning} 20%, transparent)`,
          color: colors.warning,
          whiteSpace: 'nowrap',
        }}
        title="All accounts in this type are off budget"
      >
        All Off Budget
      </span>
    )
  } else if (group.on_budget === true) {
    flags.push(
      <span
        key="on-budget"
        style={{
          fontSize: '0.65rem',
          fontWeight: 500,
          padding: '0.15rem 0.35rem',
          borderRadius: '4px',
          background: `color-mix(in srgb, ${colors.success} 20%, transparent)`,
          color: colors.success,
          whiteSpace: 'nowrap',
        }}
        title="All accounts in this type are on budget"
      >
        All On Budget
      </span>
    )
  }

  if (flags.length === 0) return null

  return <>{flags}</>
}

