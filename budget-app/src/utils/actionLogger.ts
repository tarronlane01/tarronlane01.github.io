/**
 * User Action Logger
 *
 * Logs user interactions to the console for AI-assisted debugging.
 * When an error occurs, copy/paste the console output to show exactly
 * what actions led up to the error.
 *
 * Controlled by featureFlags.logUserActions
 */

import { featureFlags } from '@constants/featureFlags'

type ActionType = 'CLICK' | 'CHANGE' | 'SUBMIT' | 'SELECT' | 'TOGGLE' | 'EXPAND' | 'COLLAPSE' | 'NAVIGATE' | 'OPEN' | 'CLOSE' | 'DRAG_START' | 'DRAG_END'

interface ActionContext {
  /** The new value (for form changes) */
  value?: unknown
  /** The previous value (for form changes) */
  previousValue?: unknown
  /** Additional context about the action */
  details?: string
  /** The component or section where this happened */
  component?: string
}

/**
 * Format a timestamp for console output
 * Returns format like "14:32:05.123"
 */
function formatTimestamp(): string {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

/**
 * Format a value for display in logs
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (value === '') return '(empty)'
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 50) {
      return `"${value.slice(0, 47)}..."`
    }
    return `"${value}"`
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return value.toString()
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`
  }
  return String(value)
}

/**
 * Log a user action to the console
 *
 * @param actionType - The type of action (CLICK, CHANGE, SUBMIT, etc.)
 * @param actionName - Human-readable description of what was clicked/changed
 * @param context - Optional additional context (values, component, etc.)
 *
 * @example
 * // Button click
 * logUserAction('CLICK', 'Save Budget')
 *
 * @example
 * // Form change with value
 * logUserAction('CHANGE', 'Budget Name', { value: 'My Budget', previousValue: 'Untitled' })
 *
 * @example
 * // With component context
 * logUserAction('SUBMIT', 'Add Income Form', { component: 'IncomeForm' })
 */
export function logUserAction(
  actionType: ActionType,
  actionName: string,
  context?: ActionContext
): void {
  if (!featureFlags.logUserActions) return

  const timestamp = formatTimestamp()
  let message = `[${timestamp}] [User] ${actionType}: ${actionName}`

  // Add value info for changes
  if (context?.value !== undefined || context?.previousValue !== undefined) {
    if (context.previousValue !== undefined && context.value !== undefined) {
      message += ` (${formatValue(context.previousValue)} → ${formatValue(context.value)})`
    } else if (context.value !== undefined) {
      message += ` = ${formatValue(context.value)}`
    }
  }

  // Add details if provided
  if (context?.details) {
    message += ` — ${context.details}`
  }

  // Add component context if provided
  if (context?.component) {
    message += ` [${context.component}]`
  }

  console.log(message)
}

/**
 * Create a wrapped onChange handler that logs the change
 *
 * @param actionName - What is being changed (e.g., "Budget Name", "Amount")
 * @param onChange - The original onChange handler
 * @param options - Optional configuration
 * @returns A wrapped handler that logs and then calls the original
 *
 * @example
 * <input
 *   value={name}
 *   onChange={trackedChange('Budget Name', setName)}
 * />
 */
export function trackedChange<T>(
  actionName: string,
  onChange: (value: T) => void,
  options?: { component?: string; getValue?: (e: T) => unknown }
): (value: T) => void {
  return (value: T) => {
    const displayValue = options?.getValue ? options.getValue(value) : value
    logUserAction('CHANGE', actionName, {
      value: displayValue,
      component: options?.component,
    })
    onChange(value)
  }
}

/**
 * Create a wrapped event handler that logs input changes
 * Works with standard React ChangeEvent from input/select/textarea
 *
 * @example
 * <input
 *   value={name}
 *   onChange={trackedInputChange('Budget Name', (e) => setName(e.target.value))}
 * />
 */
export function trackedInputChange(
  actionName: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void,
  options?: { component?: string }
): (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void {
  return (e) => {
    logUserAction('CHANGE', actionName, {
      value: e.target.value,
      component: options?.component,
    })
    onChange(e)
  }
}

/**
 * Create a wrapped click handler that logs the click
 *
 * @example
 * <button onClick={trackedClick('Save Budget', handleSave)}>Save</button>
 */
export function trackedClick(
  actionName: string,
  onClick?: (e: React.MouseEvent) => void,
  options?: { component?: string; details?: string }
): (e: React.MouseEvent) => void {
  return (e) => {
    logUserAction('CLICK', actionName, {
      component: options?.component,
      details: options?.details,
    })
    onClick?.(e)
  }
}

/**
 * Create a wrapped submit handler that logs the form submission
 *
 * @example
 * <form onSubmit={trackedSubmit('Income Form', handleSubmit)}>
 */
export function trackedSubmit(
  actionName: string,
  onSubmit: (e: React.FormEvent) => void,
  options?: { component?: string }
): (e: React.FormEvent) => void {
  return (e) => {
    logUserAction('SUBMIT', actionName, { component: options?.component })
    onSubmit(e)
  }
}

