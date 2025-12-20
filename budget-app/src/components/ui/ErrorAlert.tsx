import { errorAlert, errorAlertDismiss } from '../../styles/shared'

interface ErrorAlertProps {
  message: string
  onDismiss: () => void
}

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div style={errorAlert}>
      <span>{message}</span>
      <button onClick={onDismiss} style={errorAlertDismiss}>
        ×
      </button>
    </div>
  )
}

