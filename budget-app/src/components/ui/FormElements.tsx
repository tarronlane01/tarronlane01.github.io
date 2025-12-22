import { useState, useRef, useEffect, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { formGroup, label as labelStyle, input as inputStyle, select as selectStyle, form as formStyle, buttonGroupForm, colors } from '../../styles/shared'

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

// Textarea input
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

// Form button group
interface FormButtonGroupProps {
  children: ReactNode
}

export function FormButtonGroup({ children }: FormButtonGroupProps) {
  return <div style={buttonGroupForm}>{children}</div>
}

// Currency Input with auto-formatting (dollar sign and commas)
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

  // Update display when external value changes
  useEffect(() => {
    const formatted = formatCurrencyDisplay(value)
    if (parseCurrencyValue(displayValue) !== value) {
      setDisplayValue(formatted)
    }
  }, [value])

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

// Payee Autocomplete with fuzzy search
interface PayeeAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  payees: string[]
  placeholder?: string
}

// Fuzzy search - matches if all characters appear in order (case insensitive)
// Also matches if query appears anywhere in the string
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()

  // Direct substring match (highest priority)
  if (lowerTarget.includes(lowerQuery)) {
    const index = lowerTarget.indexOf(lowerQuery)
    // Prefer matches at word boundaries
    const atWordStart = index === 0 || /\s/.test(lowerTarget[index - 1])
    return { match: true, score: atWordStart ? 100 : 90 }
  }

  // Fuzzy match - characters in order
  let queryIndex = 0
  let score = 0
  let consecutiveMatches = 0

  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      queryIndex++
      consecutiveMatches++
      score += consecutiveMatches * 2 // Reward consecutive matches
    } else {
      consecutiveMatches = 0
    }
  }

  if (queryIndex === lowerQuery.length) {
    return { match: true, score }
  }

  return { match: false, score: 0 }
}

export function PayeeAutocomplete({ id, value, onChange, payees, placeholder = 'Enter payee name' }: PayeeAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get filtered and sorted suggestions
  const suggestions = value.trim()
    ? payees
        .map(payee => ({ payee, ...fuzzyMatch(value, payee) }))
        .filter(item => item.match)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(item => item.payee)
    : []

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      onChange(suggestions[highlightedIndex])
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    }
  }

  function selectSuggestion(payee: string) {
    onChange(payee)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
          setHighlightedIndex(-1)
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--background, #1a1a1a)',
          border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {suggestions.map((payee, index) => (
            <div
              key={payee}
              onClick={() => selectSuggestion(payee)}
              style={{
                padding: '0.6rem 0.8rem',
                cursor: 'pointer',
                background: index === highlightedIndex
                  ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                  : 'transparent',
                borderBottom: index < suggestions.length - 1
                  ? '1px solid color-mix(in srgb, currentColor 10%, transparent)'
                  : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {payee}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

