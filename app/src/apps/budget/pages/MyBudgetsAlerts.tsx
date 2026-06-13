/**
 * MyBudgets Alert Components - Error and Success alerts for MyBudgets page
 */

interface AlertProps {
  message: string
  onDismiss: () => void
}

export function ErrorAlertBox({ message, onDismiss }: AlertProps) {
  return (
    <div style={{
      background: 'var(--color-error-bg)',
      border: '1px solid var(--color-error-border)',
      color: 'var(--color-error)',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      marginBottom: '1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-error)',
          cursor: 'pointer',
          fontSize: '1.2rem',
          padding: '0 0.25rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

export function SuccessAlertBox({ message, onDismiss }: AlertProps) {
  return (
    <div style={{
      background: 'var(--color-success-bg)',
      border: '1px solid var(--color-success-border)',
      color: 'var(--color-success)',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      marginBottom: '1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-success)',
          cursor: 'pointer',
          fontSize: '1.2rem',
          padding: '0 0.25rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

