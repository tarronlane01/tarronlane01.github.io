/**
 * Column headers for the balances section.
 * Different headers for category view vs account view.
 */

interface CategoryColumnHeadersProps {
  isDraftMode: boolean
}

export function CategoryColumnHeaders({ isDraftMode }: CategoryColumnHeadersProps) {
  return (
    <div style={{
      display: 'flex',
      fontSize: '0.75rem',
      fontWeight: 600,
      opacity: 0.6,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      paddingTop: '0.5rem',
      marginTop: '0.5rem',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: 2, minWidth: 0 }}>Category</div>
      {isDraftMode ? (
        <>
          <div style={{ width: '200px', textAlign: 'center' }}>Allocated</div>
          <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
          <div style={{ flex: 1, textAlign: 'right' }}>Allocated</div>
        </>
      )}
      <div style={{ flex: 1, textAlign: 'right' }}>Spent</div>
      <div style={{ flex: 1, textAlign: 'right', paddingRight: '1rem', borderRight: '2px solid var(--border-muted)' }}>End</div>
      <div style={{ width: '120px', textAlign: 'right' }}>{isDraftMode ? 'Proj. All-Time' : 'All-Time'}</div>
    </div>
  )
}

export function AccountColumnHeaders() {
  return (
    <div style={{
      display: 'flex',
      fontSize: '0.75rem',
      fontWeight: 600,
      opacity: 0.6,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      paddingTop: '0.5rem',
      marginTop: '0.5rem',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: 2, minWidth: 0 }}>Account</div>
      <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
      <div style={{ flex: 1, textAlign: 'right' }}>Net Change</div>
      <div style={{ flex: 1, textAlign: 'right' }}>End</div>
      <div style={{ flex: 1 }}></div>
    </div>
  )
}

