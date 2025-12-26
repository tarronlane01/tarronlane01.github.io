import { colors } from '../../styles/shared'

interface LoadingOverlayProps {
  /** Whether to show the overlay */
  isVisible: boolean
  /** Text to display under the spinner */
  message?: string
}

/**
 * Full-page loading overlay with spinner.
 * Use when performing operations that should block all user interaction.
 */
export function LoadingOverlay({ isVisible, message = 'Loading...' }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      gap: '1rem',
    }}>
      <div style={{
        width: '3rem',
        height: '3rem',
        border: '3px solid rgba(255, 255, 255, 0.2)',
        borderTopColor: colors.primary,
        borderRadius: '50%',
        animation: 'loadingOverlaySpin 0.8s linear infinite',
      }} />
      <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500 }}>
        {message}
      </p>
      <style>{`
        @keyframes loadingOverlaySpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

