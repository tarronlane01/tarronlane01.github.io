import { colors } from '../../styles/shared'
import type { ReactNode } from 'react'

/**
 * Shared Loading Overlay Component
 *
 * Base full-page loading overlay used throughout the app.
 * Can be customized with different spinner colors, messages, and additional content.
 *
 * Rendered in App.tsx for global loading, controlled via AppContext:
 *   addLoadingHold('unique-key', 'Message...')
 *   removeLoadingHold('unique-key')
 *
 * Also used by ImportProgressOverlay and RecalculationProgressOverlay.
 */

interface LoadingOverlayProps {
  /** Main message to display below spinner */
  message?: string
  /** Spinner border color (defaults to primary/purple) */
  spinnerColor?: string
  /** Additional content to render below the message (progress bars, stats, etc.) */
  children?: ReactNode
  /** Custom spinner size in rem (defaults to 4) */
  spinnerSize?: number
}

export function LoadingOverlay({
  message = 'Loading...',
  spinnerColor = colors.primary,
  children,
  spinnerSize = 4,
}: LoadingOverlayProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 15, 20, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      gap: '1.5rem',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Spinner */}
      <div style={{
        width: `${spinnerSize}rem`,
        height: `${spinnerSize}rem`,
        border: '3px solid rgba(255, 255, 255, 0.15)',
        borderTopColor: spinnerColor,
        borderRadius: '50%',
        animation: 'loadingOverlaySpin 0.8s linear infinite',
      }} />

      {/* Message */}
      <p style={{
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: '1.2rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        margin: 0,
      }}>
        {message}
      </p>

      {/* Additional content (progress bars, stats, etc.) */}
      {children}

      <style>{`
        @keyframes loadingOverlaySpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

interface ProgressBarProps {
  /** Percentage complete (0-100) */
  percent: number
  /** Gradient colors for the progress bar */
  gradient?: string
  /** Width of the bar (defaults to 300px) */
  width?: number
}

export function ProgressBar({
  percent,
  gradient = 'linear-gradient(90deg, #646cff, #8b5cf6)',
  width = 300,
}: ProgressBarProps) {
  return (
    <div style={{
      width: `${width}px`,
      height: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${percent}%`,
        height: '100%',
        background: gradient,
        borderRadius: '4px',
        transition: 'width 0.3s ease-out',
      }} />
    </div>
  )
}

// =============================================================================
// STAT ITEM COMPONENT
// =============================================================================

interface StatItemProps {
  /** The main value to display */
  value: string | number
  /** Label below the value */
  label: string
  /** Color for the value */
  color?: string
}

export function StatItem({ value, label, color = '#646cff' }: StatItemProps) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color, fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
        {value}
      </p>
      <p style={{
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '0.8rem',
        margin: '0.25rem 0 0',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </p>
    </div>
  )
}

// =============================================================================
// STAT GRID COMPONENT
// =============================================================================

interface StatGridProps {
  children: ReactNode
  columns?: number
}

export function StatGrid({ children, columns = 3 }: StatGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: '2rem',
      textAlign: 'center',
    }}>
      {children}
    </div>
  )
}

// =============================================================================
// PERCENT LABEL COMPONENT
// =============================================================================

export function PercentLabel({ percent }: { percent: number }) {
  return (
    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', margin: 0 }}>
      {percent}% complete
    </p>
  )
}
