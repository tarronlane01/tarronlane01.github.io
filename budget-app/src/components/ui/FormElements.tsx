import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { formGroup, label as labelStyle, input as inputStyle, select as selectStyle, form as formStyle, buttonGroupForm } from '../../styles/shared'

// Form wrapper
interface FormWrapperProps {
  children: ReactNode
  onSubmit: (e: React.FormEvent) => void
}

export function FormWrapper({ children, onSubmit }: FormWrapperProps) {
  return (
    <form onSubmit={onSubmit} style={formStyle}>
      {children}
    </form>
  )
}

// Form field with label
interface FormFieldProps {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: ReactNode
}

export function FormField({ label, htmlFor, children, hint }: FormFieldProps) {
  return (
    <div style={formGroup}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.6 }}>
          {hint}
        </p>
      )}
    </div>
  )
}

// Text input
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput(props: TextInputProps) {
  return <input style={inputStyle} {...props} />
}

// Number input
interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  step?: string
}

export function NumberInput({ step = '0.01', ...props }: NumberInputProps) {
  return <input type="number" step={step} style={inputStyle} {...props} />
}

// Select dropdown
interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function SelectInput({ children, ...props }: SelectInputProps) {
  return (
    <select style={selectStyle} {...props}>
      {children}
    </select>
  )
}

// Form button group
interface FormButtonGroupProps {
  children: ReactNode
}

export function FormButtonGroup({ children }: FormButtonGroupProps) {
  return <div style={buttonGroupForm}>{children}</div>
}

