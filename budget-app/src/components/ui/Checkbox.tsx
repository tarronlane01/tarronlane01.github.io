import type { InputHTMLAttributes, ReactNode } from 'react'
import { colors } from '@styles/shared'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children?: ReactNode
  labelStyle?: React.CSSProperties
}

export function Checkbox({ children, labelStyle, ...props }: CheckboxProps) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      flex: 1,
      cursor: 'pointer',
      ...labelStyle,
    }}>
      <input
        type="checkbox"
        style={{
          width: '1.25rem',
          height: '1.25rem',
          marginTop: '0.1rem',
          cursor: 'pointer',
          accentColor: colors.primary,
        }}
        {...props}
      />
      {children}
    </label>
  )
}

