/**
 * Seed Import Parser
 *
 * CSV parsing functions for seed data import.
 *
 * Supports two formats:
 * 1. Combined format: type,date,payee,category,account,amount,description,cleared
 *    Where type is one of: income, spend, allocation
 *
 * 2. Raw cash flow format: date,payee,category,account,amount,description,cleared
 *    Type is inferred from data:
 *    - Category = "Income" → income
 *    - Payee = "Budget Allocation" → allocation
 *    - Everything else → spend
 *
 * Cleared is a boolean (TRUE/FALSE) indicating if the transaction has cleared
 */

import type { ParsedSeedRow, SeedRecordType } from './seedImportTypes'

/**
 * Parse a CSV line, handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Don't forget the last field
  result.push(current.trim())

  return result
}

/**
 * Parse amount string to number
 * Handles formats like "$1,234.56", "-$100.00", "($50.00)"
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0

  // Remove currency symbols and whitespace
  let cleaned = amountStr.replace(/[$\s]/g, '')

  // Handle parentheses for negative numbers
  const isNegative = cleaned.startsWith('(') || cleaned.startsWith('-')
  cleaned = cleaned.replace(/[()]/g, '').replace('-', '')

  // Remove commas
  cleaned = cleaned.replace(/,/g, '')

  const value = parseFloat(cleaned)
  if (isNaN(value)) return 0

  return isNegative ? -value : value
}

/**
 * Parse date string to year/month/day
 * Handles M/D/YYYY format
 */
function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null

  const parts = dateStr.split('/')
  if (parts.length !== 3) return null

  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  return { year, month, day }
}

/**
 * Parse a record type string into a valid SeedRecordType
 */
function parseRecordType(typeStr: string): SeedRecordType | null {
  const normalized = typeStr.toLowerCase().trim()
  if (normalized === 'income') return 'income'
  if (normalized === 'spend') return 'spend'
  if (normalized === 'allocation' || normalized === 'allocations') return 'allocation'
  return null
}

/**
 * Parse a boolean/flag string to boolean
 * Handles TRUE/FALSE, true/false, 1/0, yes/no
 */
function parseBoolean(value: string): boolean {
  if (!value) return false
  const normalized = value.toLowerCase().trim()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

/**
 * Parse CSV content into typed rows
 * Combined CSV format: type,date,payee,category,account,amount,description,cleared
 * Where type is one of: income, spend, allocation
 * And cleared is a boolean (TRUE/FALSE) indicating if the transaction has cleared
 */
export function parseCSV(content: string): ParsedSeedRow[] {
  const lines = content.split('\n').filter(line => line.trim())
  const rows: ParsedSeedRow[] = []

  for (const line of lines) {
    const fields = parseCSVLine(line)
    if (fields.length < 6) continue // Skip invalid lines (need at least: type,date,payee,category,account,amount)

    const [typeStr, dateStr, payee, category, account, amountStr, description, clearedStr] = fields

    // Skip header row if present
    if (typeStr.toLowerCase() === 'type') continue

    // Parse record type
    const recordType = parseRecordType(typeStr)
    if (!recordType) continue // Skip rows with invalid type

    const parsedDate = parseDate(dateStr)
    if (!parsedDate) continue

    const amount = parseAmount(amountStr)
    const cleared = parseBoolean(clearedStr || '')

    rows.push({
      recordType,
      date: dateStr,
      year: parsedDate.year,
      month: parsedDate.month,
      day: parsedDate.day,
      payee,
      category,
      account,
      amount,
      description: description || '',
      cleared,
      rawLine: line,
    })
  }

  return rows
}

/**
 * Format date for storage (YYYY-MM-DD)
 */
export function formatDateForStorage(year: number, month: number, day: number): string {
  const m = month.toString().padStart(2, '0')
  const d = day.toString().padStart(2, '0')
  return `${year}-${m}-${d}`
}

/**
 * Infer record type from raw cash flow data
 * - Category = "Income" → income
 * - Payee = "Budget Allocation" → allocation
 * - Everything else → spend
 */
function inferRecordType(payee: string, category: string): SeedRecordType {
  if (category.toLowerCase() === 'income') return 'income'
  if (payee.toLowerCase() === 'budget allocation') return 'allocation'
  return 'spend'
}

/**
 * Parse raw cash flow CSV content into typed rows
 * Raw cash flow format: date,payee,category,account,amount,description,cleared
 * May have a title row and header row at the start
 * Type is inferred from payee/category
 */
export function parseRawCashFlowCSV(content: string): ParsedSeedRow[] {
  const lines = content.split('\n').filter(line => line.trim())
  const rows: ParsedSeedRow[] = []

  for (const line of lines) {
    const fields = parseCSVLine(line)
    if (fields.length < 5) continue // Skip invalid lines (need at least: date,payee,category,account,amount)

    const [dateStr, payee, category, account, amountStr, description, clearedStr] = fields

    // Skip title row (e.g., "Cash Flow,,,,,,,")
    if (dateStr.toLowerCase() === 'cash flow') continue

    // Skip header row (e.g., "Date,Payee,Category,...")
    if (dateStr.toLowerCase() === 'date') continue

    const parsedDate = parseDate(dateStr)
    if (!parsedDate) continue

    // Infer record type from payee/category
    const recordType = inferRecordType(payee, category)

    const amount = parseAmount(amountStr)
    const cleared = parseBoolean(clearedStr || '')

    rows.push({
      recordType,
      date: dateStr,
      year: parsedDate.year,
      month: parsedDate.month,
      day: parsedDate.day,
      payee,
      category,
      account,
      amount,
      description: description || '',
      cleared,
      rawLine: line,
    })
  }

  return rows
}

