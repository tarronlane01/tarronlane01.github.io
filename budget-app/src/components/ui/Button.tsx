import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import {
  buttonPrimary,
  buttonPrimaryLarge,
  buttonSecondary,
  buttonDanger,
  buttonSmall,
} from '../../styles/shared'

type ButtonVariant = 'primary' | 'primary-large' | 'secondary' | 'danger' | 'small'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
  loadingText?: string
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
  ...props
}: ButtonProps) {
  const baseStyle = variantStyles[variant]
  const isDisabled = disabled || isLoading

  return (
    <button
      disabled={isDisabled}
      style={{
        ...baseStyle,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.7 : 1,
        ...style,
      }}
      {...props}
    >
      {isLoading ? loadingText : children}
    </button>
  )
}

