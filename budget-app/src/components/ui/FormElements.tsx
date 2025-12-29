import { useState, useRef, useEffect, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { formGroup, label as labelStyle, input as inputStyle, select as selectStyle, form as formStyle, buttonGroupForm } from '../../styles/shared'

// Re-export autocomplete components from their own file
export { PayeeAutocomplete, CategoryAutocomplete } from './Autocomplete'

// =============================================================================
// FORM WRAPPER
// =============================================================================

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

// =============================================================================
// FORM FIELD
// =============================================================================

interface FormFieldProps {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: ReactNode
  style?: React.CSSProperties
}

export function FormField({ label, htmlFor, children, hint, style }: FormFieldProps) {
  return (
    <div style={{ ...formGroup, ...style }}>
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

// =============================================================================
// TEXT INPUT
// =============================================================================

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input style={inputStyle} {...props} />
}

// =============================================================================
// DATE INPUT
// =============================================================================

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: string // YYYY-MM-DD format
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

// Format date string (YYYY-MM-DD) to readable format (Dec 1)
function formatDateDisplay(dateString: string | undefined): string {
  if (!dateString) return ''
  try {
    // Add time component to avoid timezone issues
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateString
  }
}

export function DateInput({ value, onChange, style, ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayValue = formatDateDisplay(value)

  // Open the date picker when clicking anywhere in the field
  function handleClick() {
    inputRef.current?.showPicker?.()
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Hidden native date input for picker functionality */}
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={onChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          pointerEvents: 'none',
        }}
        {...props}
      />
      {/* Visible display showing formatted date */}
      <div
        onClick={handleClick}
        style={{
          ...inputStyle,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          color: value ? 'inherit' : 'color-mix(in srgb, currentColor 50%, transparent)',
          ...style,
        }}
      >
        {displayValue || 'Select date'}
      </div>
    </div>
  )
}

// =============================================================================
// NUMBER INPUT
// =============================================================================

interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  step?: string
}

export function NumberInput({ step = '0.01', ...props }: NumberInputProps) {
  return <input type="number" step={step} style={inputStyle} {...props} />
}

// =============================================================================
// SELECT INPUT
// =============================================================================

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

// =============================================================================
// TEXTAREA INPUT
// =============================================================================

interface TextAreaInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: string
}

export function TextAreaInput({ minHeight = '6rem', style, ...props }: TextAreaInputProps) {
  return (
    <textarea
      style={{
        ...inputStyle,
        width: '100%',
        minHeight,
        resize: 'vertical',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    />
  )
}

// =============================================================================
// FORM BUTTON GROUP
// =============================================================================

interface FormButtonGroupProps {
  children: ReactNode
}

export function FormButtonGroup({ children }: FormButtonGroupProps) {
  return <div style={buttonGroupForm}>{children}</div>
}

// =============================================================================
// CURRENCY INPUT
// =============================================================================

interface CurrencyInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
}

// Format number with commas and optional decimals
function formatCurrencyDisplay(value: string): string {
  // Remove everything except digits and decimal point
  const cleaned = value.replace(/[^\d.]/g, '')

  // Split into integer and decimal parts
  const parts = cleaned.split('.')
  const integerPart = parts[0] || ''
  const decimalPart = parts[1]

  // Add commas to integer part
  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  // Combine with decimal if present
  if (decimalPart !== undefined) {
    return `$${withCommas}.${decimalPart.slice(0, 2)}`
  }
  return withCommas ? `$${withCommas}` : ''
}

// Parse formatted currency back to raw number string
function parseCurrencyValue(formatted: string): string {
  return formatted.replace(/[$,]/g, '')
}

export function CurrencyInput({ id, value, onChange, placeholder = '$0.00', required, autoFocus }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatCurrencyDisplay(value))
  const inputRef = useRef<HTMLInputElement>(null)

  // Update display when external value changes (controlled input sync pattern)
  useEffect(() => {
    const formatted = formatCurrencyDisplay(value)
    if (parseCurrencyValue(displayValue) !== value) {
      setDisplayValue(formatted)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]) // displayValue intentionally excluded to prevent infinite loops

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawInput = e.target.value

    // Allow empty
    if (!rawInput || rawInput === '$') {
      setDisplayValue('')
      onChange('')
      return
    }

    // Remove non-numeric except decimal point
    const cleaned = rawInput.replace(/[^\d.]/g, '')

    // Don't allow more than one decimal point
    const parts = cleaned.split('.')
    let sanitized = parts[0]
    if (parts.length > 1) {
      sanitized += '.' + parts.slice(1).join('').slice(0, 2)
    }

    // Format for display
    const formatted = formatCurrencyDisplay(sanitized)
    setDisplayValue(formatted)

    // Pass raw numeric value to parent
    onChange(sanitized)
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      autoFocus={autoFocus}
      style={inputStyle}
    />
  )
}
