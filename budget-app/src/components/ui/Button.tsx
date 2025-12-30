import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import {
  buttonPrimary,
  buttonPrimaryLarge,
  buttonSecondary,
  buttonDanger,
  buttonSmall,
} from '../../styles/shared'
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
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: buttonPrimary,
  'primary-large': buttonPrimaryLarge,
  secondary: buttonSecondary,
  danger: buttonDanger,
  small: buttonSmall,
}

export function Button({
  variant = 'primary',
  isLoading,
  loadingText = 'Saving...',
  children,
  disabled,
  style,
  actionName,
  onClick,
  ...props
}: ButtonProps) {
  const baseStyle = variantStyles[variant]
  const isDisabled = disabled || isLoading

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (actionName) {
      logUserAction('CLICK', actionName)
    }
    onClick?.(e)
  }

  return (
    <button
      disabled={isDisabled}
      style={{
        ...baseStyle,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.7 : 1,
        ...style,
      }}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? loadingText : children}
    </button>
  )
}

