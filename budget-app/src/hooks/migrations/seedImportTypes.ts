/**
 * Seed Import Types
 *
 * Type definitions for seed data import functionality.
 * Supports combined import format where the first column indicates record type.
 */

/** The type of record (used in combined CSV format) */
export type SeedRecordType = 'allocation' | 'income' | 'spend'

export type SeedImportStatus = 'idle' | 'parsing' | 'mapping' | 'ready' | 'importing' | 'complete' | 'error'

/** Parsed row from CSV with record type */
export interface ParsedSeedRow {
  recordType: SeedRecordType // Type of record: income, spend, or allocation
  date: string // Original date string
  year: number
  month: number
  day: number
  payee: string
  category: string
  account: string
  amount: number // Parsed as number (positive for income/allocations, can be negative for spend)
  description: string
  cleared: boolean // Whether this transaction has cleared (from the flag column)
  rawLine: string // Original line for debugging
}

/** Mapping entry for category or account */
export interface MappingEntry {
  oldName: string
  newId: string
  newName: string
}

/** Stored mapping document structure */
export interface ImportDataMap {
  budget_id: string // Required for Firestore security rules validation
  category_mappings: Record<string, { id: string; name: string }>
  account_mappings: Record<string, { id: string; name: string }>
  last_updated: string
}

/** Import result */
export interface SeedImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}

/** Import progress tracking */
export interface ImportProgress {
  phase: 'saving-mappings' | 'reading-months' | 'creating-months' | 'processing-months' | 'saving-months' | 'updating-budget' | 'complete'
  currentMonth: string | null
  monthsProcessed: number
  totalMonths: number
  recordsImported: number
  totalRecords: number
  monthsCreated: number
  monthsToCreate: number
  /** Number of gap months (months with no import data) being created for continuity */
  gapMonths: number
  percentComplete: number
  /** Counts by record type */
  incomeImported: number
  spendImported: number
  allocationsImported: number
}

/** Month names for progress display */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

