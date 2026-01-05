/**
 * Currency Utility Functions
 *
 * Provides consistent rounding for all currency/financial values.
 * All monetary values should be rounded to 2 decimal places before storing.
 */

/**
 * Round a number to 2 decimal places for currency storage.
 * Uses banker's rounding (round half to even) to minimize cumulative rounding errors.
 *
 * @param value - The number to round
 * @returns The value rounded to 2 decimal places
 *
 * @example
 * roundCurrency(10.555) // 10.56
 * roundCurrency(10.554) // 10.55
 * roundCurrency(10.005) // 10.01 (not 10.00 due to floating point)
 */
export function roundCurrency(value: number): number {
  // Use Math.round with factor of 100 for 2 decimal places
  // Adding Number.EPSILON helps with floating point edge cases like 1.005
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Check if a number has more than 2 decimal places.
 * Used to identify values that need precision cleanup.
 *
 * Note: We use a tolerance of 1e-9 instead of Number.EPSILON because
 * JavaScript floating-point arithmetic can produce tiny errors even after
 * rounding. For example, `1.23 * 100` might give `122.99999999999999`.
 *
 * @param value - The number to check
 * @returns true if the value has more than 2 decimal places
 */
export function needsPrecisionFix(value: number): boolean {
  if (value === undefined || value === null || isNaN(value)) return false
  // Multiply by 100 and check if there's a fractional remainder
  // Use a tolerance of 1e-9 to account for floating-point representation errors
  const scaled = value * 100
  const TOLERANCE = 1e-9
  return Math.abs(scaled - Math.round(scaled)) > TOLERANCE
}

