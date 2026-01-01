import { colors } from '../../styles/shared'

/**
 * Full-page loading overlay with spinner.
 *
 * Rendered in App.tsx, controlled via AppContext:
 *   addLoadingHold('unique-key', 'Message...')
 *   removeLoadingHold('unique-key')
 */
export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 15, 20, 0.92)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      gap: '1.25rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '3.5rem',
        height: '3.5rem',
        border: '3px solid rgba(255, 255, 255, 0.15)',
        borderTopColor: colors.primary,
        borderRadius: '50%',
        animation: 'loadingOverlaySpin 0.8s linear infinite',
      }} />
      <p style={{
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '1.1rem',
        fontWeight: 500,
        letterSpacing: '0.02em',
      }}>
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

