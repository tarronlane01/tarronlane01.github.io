/**
 * Month Creation Rules
 * 
 * Centralized logic for determining whether a month can be created or navigated to.
 * Used by both navigation buttons and month creation logic to keep rules in sync.
 * 
 * RULES:
 * 1. If month already exists in month_map → allow (navigation only)
 * 2. Walking FORWARD: If month is immediately after the latest month AND not more than
 *    3 months in the FUTURE → allow. Don't care if it's in the past.
 * 3. Walking BACKWARD: If month is immediately before the earliest month AND not more than
 *    3 months in the PAST → allow. Don't care if it's in the future.
 * 4. Otherwise → reject
 */

import { getYearMonthOrdinal } from './date'

export interface MonthMap {
  [ordinal: string]: unknown
}

/**
 * Custom error class for month navigation/creation errors.
 * Use `shouldRedirectToValidMonth` to determine if the error handler should
 * redirect to a valid month in the budget (instead of showing an error).
 */
export class MonthNavigationError extends Error {
  static readonly __type = 'MonthNavigationError' as const
  readonly __type = 'MonthNavigationError' as const
  readonly shouldRedirectToValidMonth: boolean
  readonly year: number
  readonly month: number

  constructor(message: string, year: number, month: number, shouldRedirect: boolean = true) {
    super(message)
    this.name = 'MonthNavigationError'
    this.year = year
    this.month = month
    this.shouldRedirectToValidMonth = shouldRedirect
  }

  /**
   * Type guard to check if an error is a MonthNavigationError.
   * Works even when instanceof fails (e.g., across module boundaries or after serialization).
   */
  static is(error: unknown): error is MonthNavigationError {
    return (
      error !== null &&
      typeof error === 'object' &&
      '__type' in error &&
      (error as MonthNavigationError).__type === 'MonthNavigationError'
    )
  }
}

export interface MonthCreationResult {
  allowed: boolean
  reason: 'exists' | 'walk_forward' | 'walk_back' | null
  error: string | null
}

export interface MonthNavigationState {
  canNavigate: boolean
  canCreate: boolean
  disabledReason: string | null
}

/**
 * Get the current calendar bounds (3 months in past/future from today)
 */
export function getCalendarBounds(): {
  currentOrdinal: number
  minOrdinal: number
  maxOrdinal: number
} {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const currentOrdinal = Number(getYearMonthOrdinal(currentYear, currentMonth))
  
  // Calculate min/max with proper month rollover (not simple ordinal arithmetic)
  // 3 months in past
  let minYear = currentYear
  let minMonth = currentMonth - 3
  if (minMonth <= 0) {
    minMonth += 12
    minYear -= 1
  }
  
  // 3 months in future
  let maxYear = currentYear
  let maxMonth = currentMonth + 3
  if (maxMonth > 12) {
    maxMonth -= 12
    maxYear += 1
  }
  
  return {
    currentOrdinal,
    minOrdinal: Number(getYearMonthOrdinal(minYear, minMonth)),
    maxOrdinal: Number(getYearMonthOrdinal(maxYear, maxMonth)),
  }
}

/**
 * Get the next month ordinal, properly handling year rollover.
 * e.g., 202412 (Dec 2024) -> 202501 (Jan 2025)
 */
export function getNextMonthOrdinal(ordinal: number): number {
  const year = Math.floor(ordinal / 100)
  const month = ordinal % 100
  if (month === 12) {
    return (year + 1) * 100 + 1 // January of next year
  }
  return year * 100 + (month + 1)
}

/**
 * Get the previous month ordinal, properly handling year rollover.
 * e.g., 202501 (Jan 2025) -> 202412 (Dec 2024)
 */
export function getPrevMonthOrdinal(ordinal: number): number {
  const year = Math.floor(ordinal / 100)
  const month = ordinal % 100
  if (month === 1) {
    return (year - 1) * 100 + 12 // December of previous year
  }
  return year * 100 + (month - 1)
}

/**
 * Get the bounds of the month_map
 */
export function getMonthMapBounds(monthMap: MonthMap | null | undefined): {
  earliestOrdinal: number | null
  latestOrdinal: number | null
  ordinals: number[]
} {
  if (!monthMap || Object.keys(monthMap).length === 0) {
    return { earliestOrdinal: null, latestOrdinal: null, ordinals: [] }
  }
  
  const ordinals = Object.keys(monthMap).map(Number).sort((a, b) => a - b)
  return {
    earliestOrdinal: ordinals[0],
    latestOrdinal: ordinals[ordinals.length - 1],
    ordinals,
  }
}

/**
 * Check if a month exists in the month_map
 */
export function monthExistsInMap(
  year: number,
  month: number,
  monthMap: MonthMap | null | undefined
): boolean {
  if (!monthMap) return false
  const ordinal = getYearMonthOrdinal(year, month)
  return ordinal in monthMap
}

/**
 * Check if a month can be created (for new months that don't exist yet)
 * 
 * Returns detailed information about whether creation is allowed and why.
 */
export function canCreateMonth(
  year: number,
  month: number,
  monthMap: MonthMap | null | undefined
): MonthCreationResult {
  const monthOrdinal = Number(getYearMonthOrdinal(year, month))
  const calendar = getCalendarBounds()
  const mapBounds = getMonthMapBounds(monthMap)
  
  // If month already exists in map, it's navigation not creation
  if (monthExistsInMap(year, month, monthMap)) {
    return { allowed: true, reason: 'exists', error: null }
  }
  
  // If no month_map or empty, allow creation (legacy support)
  if (mapBounds.earliestOrdinal === null || mapBounds.latestOrdinal === null) {
    return { allowed: true, reason: 'walk_forward', error: null }
  }
  
  // Check if month is right after latest (walk forward)
  // Use proper ordinal math to handle year rollover (Dec -> Jan)
  const nextAfterLatest = getNextMonthOrdinal(mapBounds.latestOrdinal)
  const isRightAfterLatest = monthOrdinal === nextAfterLatest
  
  if (isRightAfterLatest) {
    // Walking forward: only care if it's too far in the FUTURE, don't care about past
    const isWithinFutureLimit = monthOrdinal <= calendar.maxOrdinal
    if (isWithinFutureLimit) {
      return { allowed: true, reason: 'walk_forward', error: null }
    }
    return {
      allowed: false,
      reason: null,
      error: `Month ${year}/${month} is more than 3 months in the future.`,
    }
  }
  
  // Check if month is right before earliest (walk back)
  // Use proper ordinal math to handle year rollover (Jan -> Dec)
  const prevBeforeEarliest = getPrevMonthOrdinal(mapBounds.earliestOrdinal)
  const isRightBeforeEarliest = monthOrdinal === prevBeforeEarliest
  
  if (isRightBeforeEarliest) {
    // Walking backward: only care if it's too far in the PAST, don't care about future
    const isWithinPastLimit = monthOrdinal >= calendar.minOrdinal
    if (isWithinPastLimit) {
      return { allowed: true, reason: 'walk_back', error: null }
    }
    return {
      allowed: false,
      reason: null,
      error: `Month ${year}/${month} is more than 3 months in the past.`,
    }
  }
  
  // Month is not adjacent to existing months
  if (monthOrdinal > mapBounds.latestOrdinal) {
    return {
      allowed: false,
      reason: null,
      error: `Month ${year}/${month} is not immediately after the latest month. You must walk forward one month at a time.`,
    }
  }
  
  if (monthOrdinal < mapBounds.earliestOrdinal) {
    return {
      allowed: false,
      reason: null,
      error: `Month ${year}/${month} is not immediately before the earliest month. You must walk back one month at a time.`,
    }
  }
  
  // Month is in a gap within the range (shouldn't happen normally)
  return {
    allowed: false,
    reason: null,
    error: `Month ${year}/${month} does not exist in budget and cannot be created.`,
  }
}

/**
 * Get navigation state for previous month button
 */
export function getPrevMonthNavigationState(
  currentYear: number,
  currentMonth: number,
  monthMap: MonthMap | null | undefined
): MonthNavigationState {
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  
  const exists = monthExistsInMap(prevYear, prevMonth, monthMap)
  if (exists) {
    return { canNavigate: true, canCreate: false, disabledReason: null }
  }
  
  const creation = canCreateMonth(prevYear, prevMonth, monthMap)
  if (creation.allowed) {
    return { canNavigate: true, canCreate: true, disabledReason: null }
  }
  
  // Determine the appropriate disabled reason
  const calendar = getCalendarBounds()
  const prevOrdinal = Number(getYearMonthOrdinal(prevYear, prevMonth))
  
  if (prevOrdinal < calendar.minOrdinal) {
    return {
      canNavigate: false,
      canCreate: false,
      disabledReason: 'Cannot create months more than 3 months in the past',
    }
  }
  
  return {
    canNavigate: false,
    canCreate: false,
    disabledReason: 'Can only create the month immediately before the earliest month',
  }
}

/**
 * Get navigation state for next month button
 */
export function getNextMonthNavigationState(
  currentYear: number,
  currentMonth: number,
  monthMap: MonthMap | null | undefined
): MonthNavigationState {
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  
  const exists = monthExistsInMap(nextYear, nextMonth, monthMap)
  if (exists) {
    return { canNavigate: true, canCreate: false, disabledReason: null }
  }
  
  const creation = canCreateMonth(nextYear, nextMonth, monthMap)
  if (creation.allowed) {
    return { canNavigate: true, canCreate: true, disabledReason: null }
  }
  
  // Determine the appropriate disabled reason
  const calendar = getCalendarBounds()
  const nextOrdinal = Number(getYearMonthOrdinal(nextYear, nextMonth))
  
  if (nextOrdinal > calendar.maxOrdinal) {
    return {
      canNavigate: false,
      canCreate: false,
      disabledReason: 'Cannot create months more than 3 months into the future',
    }
  }
  
  return {
    canNavigate: false,
    canCreate: false,
    disabledReason: 'Can only create the month immediately after the latest month',
  }
}
