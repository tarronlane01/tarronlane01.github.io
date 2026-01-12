import { useState, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import {
  buttonPrimary,
  buttonPrimaryLarge,
  buttonSecondary,
  buttonDanger,
  buttonSmall,
  colors,
} from '@styles/shared'
import { logUserAction } from '@utils'

type ButtonVariant = 'primary' | 'primary-large' | 'secondary' | 'danger' | 'small'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
  loadingText?: string
  /**
   * Name for action logging. When provided, clicks are logged to console
   * for AI-assisted debugging. Use descriptive names like "Save Budget",
   * "Add Income", "Delete Category".
   */
  actionName?: string
  /**
   * When provided, shows a temporary tooltip explaining why the button is disabled
   * when the user clicks on it. Only shown when disabled=true.
   */
  disabledReason?: string
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: buttonPrimary,
  'primary-large': buttonPrimaryLarge,
  secondary: buttonSecondary,
  danger: buttonDanger,
  small: buttonSmall,
}

// Tooltip styles
const tooltipStyle: CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  background: colors.warning,
  color: '#1a1a1a',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.8rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  marginBottom: '0.5rem',
  zIndex: 100,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  animation: 'tooltipFadeIn 0.15s ease-out',
}

const tooltipArrowStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: `6px solid ${colors.warning}`,
}

export function Button({
  variant = 'primary',
  isLoading,
  loadingText = 'Saving...',
  children,
  disabled,
  style,
  actionName,
  disabledReason,
  onClick,
  ...props
}: ButtonProps) {
  const baseStyle = variantStyles[variant]
  const isDisabled = disabled || isLoading
  const [showTooltip, setShowTooltip] = useState(false)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (actionName) {
      logUserAction('CLICK', actionName)
    }
    onClick?.(e)
  }

  // Handle clicks on the wrapper when button is disabled
  function handleWrapperClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isDisabled && disabledReason) {
      e.preventDefault()
      e.stopPropagation()
      setShowTooltip(true)
      // Auto-hide after 3 seconds
      setTimeout(() => setShowTooltip(false), 3000)
    }
  }

  // Disabled button styling - more obviously greyed out
  const disabledStyle: CSSProperties = isDisabled ? {
    cursor: 'not-allowed',
    opacity: 0.35,
    filter: 'grayscale(50%)',
  } : {}

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onClick={handleWrapperClick}
    >
      {/* Tooltip shown when clicking disabled button */}
      {showTooltip && disabledReason && (
        <div style={tooltipStyle}>
          {disabledReason}
          <div style={tooltipArrowStyle} />
        </div>
      )}
      <button
        disabled={isDisabled}
        style={{
          ...baseStyle,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...disabledStyle,
          ...style,
        }}
        onClick={handleClick}
        {...props}
      >
        {isLoading ? loadingText : children}
      </button>
    </div>
  )
}

