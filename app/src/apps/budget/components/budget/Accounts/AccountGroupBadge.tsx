import { BADGE_COLORS } from '@constants'

interface AccountGroupBadgeProps {
  groupName: string
  colorKey: string
}

export function AccountGroupBadge({ groupName, colorKey }: AccountGroupBadgeProps) {
  const badgeColor = BADGE_COLORS[colorKey]?.cssVar ?? BADGE_COLORS.grey.cssVar

  return (
    <span
      title={groupName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: `color-mix(in srgb, ${badgeColor} 18%, transparent)`,
        border: `1px solid color-mix(in srgb, ${badgeColor} 35%, transparent)`,
        color: badgeColor,
        padding: '0.15rem 0.45rem',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        whiteSpace: 'nowrap',
        maxWidth: '8rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {groupName}
    </span>
  )
}
