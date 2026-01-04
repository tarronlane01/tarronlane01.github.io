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
      background: 'rgba(220, 38, 38, 0.1)',
      border: '1px solid rgba(220, 38, 38, 0.3)',
      color: '#f87171',
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
          color: '#f87171',
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
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      color: '#4ade80',
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
          color: '#4ade80',
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

