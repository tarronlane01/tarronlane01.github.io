/**
 * AccountSectionDivider - Reusable section divider for account lists.
 * Renders an uppercase label with a horizontal rule, spanning full grid width.
 */

interface AccountSectionDividerProps {
  label: string
}

export function AccountSectionDivider({ label }: AccountSectionDividerProps) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 0.5rem 0.25rem',
    }}>
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        opacity: 0.5,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <hr style={{
        flex: 1,
        border: 'none',
        borderTop: '1px solid var(--border-medium)',
        margin: 0,
      }} />
    </div>
  )
}
