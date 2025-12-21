import type { CSSProperties, ReactNode } from 'react'
import { errorAlert, errorAlertDismiss } from '../../styles/shared'

interface ErrorAlertProps {
  message?: string
  children?: ReactNode
  onDismiss?: () => void
  style?: CSSProperties
}

export function ErrorAlert({ message, children, onDismiss, style }: ErrorAlertProps) {
  return (
    <div style={{ ...errorAlert, ...style }}>
      <span>{children ?? message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={errorAlertDismiss}>
          ×
        </button>
      )}
    </div>
  )
}

