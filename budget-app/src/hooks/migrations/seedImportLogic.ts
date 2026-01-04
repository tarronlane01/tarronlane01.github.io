/**
 * Seed Import Logic
 *
 * Core import functions extracted from useSeedImport for better organization.
 * Handles the actual data import to Firestore including month creation and recalculation.
 */

import type { CategoriesMap, AccountsMap } from '@contexts'
// eslint-disable-next-line no-restricted-imports -- Migration utility needs direct Firestore access
import { batchWriteDocs, type BatchWriteDoc } from '@firestore'
import type { FirestoreData, MonthDocument } from '@types'
import { readMonthForEdit } from '@data'
import { createMonth } from '@data/mutations/month/createMonth'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from '@data/recalculation/recalculateMonth'

import type { ParsedSeedRow, MappingEntry, SeedImportResult, ImportProgress } from './seedImportTypes'
import { MONTH_NAMES } from './seedImportTypes'
import { processIncomeRows, processSpendRows, processAllocationRows } from './seedImportProcessors'
import { updateBudgetWithFinalBalances, type MonthInfo } from './seedImportBudgetUpdate'

// =============================================================================
// TYPES
// =============================================================================

/** Result of reading a month */
interface MonthReadResult {
  info: MonthInfo
  data: MonthDocument | null
  needsCreation: boolean
  error?: string
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

/**
 * Import seed data to Firestore (combined format).
 * Performs recalculation as part of the import - no separate recalc pass needed.
 */
export async function importSeedData(
  budgetId: string,
  rows: ParsedSeedRow[],
  categories: CategoriesMap,
  accounts: AccountsMap,
  categoryMappings: Map<string, MappingEntry>,
  accountMappings: Map<string, MappingEntry>,
  onProgress: (progress: ImportProgress) => void
): Promise<SeedImportResult> {
  const errors: string[] = []
  let imported = 0
  let skipped = 0
  let monthsCreated = 0
  let incomeImported = 0
  let spendImported = 0
  let allocationsImported = 0

  // Group rows by year/month for batch processing
  const monthInfos: MonthInfo[] = []
  const rowsByMonth = new Map<string, ParsedSeedRow[]>()

  for (const row of rows) {
    const key = `${row.year}-${row.month}`
    if (!rowsByMonth.has(key)) {
      rowsByMonth.set(key, [])
    }
    rowsByMonth.get(key)!.push(row)
  }

  // Convert to array with parsed info
  for (const [key, monthRows] of rowsByMonth) {
    const [yearStr, monthStr] = key.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    monthInfos.push({
      key,
      year,
      month,
      ordinal: getYearMonthOrdinal(year, month),
      name: `${MONTH_NAMES[month - 1]} ${year}`,
      rows: monthRows,
    })
  }

  // IMPORTANT: Sort months chronologically for proper recalculation
  monthInfos.sort((a, b) => a.ordinal.localeCompare(b.ordinal))

  // Fill in any gaps between earliest and latest months for proper balance propagation
  if (monthInfos.length > 0) {
    const existingOrdinals = new Set(monthInfos.map(m => m.ordinal))
    const firstMonth = monthInfos[0]
    const lastMonth = monthInfos[monthInfos.length - 1]

    let currentYear = firstMonth.year
    let currentMonth = firstMonth.month

    while (
      currentYear < lastMonth.year ||
      (currentYear === lastMonth.year && currentMonth <= lastMonth.month)
    ) {
      const ordinal = getYearMonthOrdinal(currentYear, currentMonth)

      if (!existingOrdinals.has(ordinal)) {
        monthInfos.push({
          key: `${currentYear}-${currentMonth}`,
          year: currentYear,
          month: currentMonth,
          ordinal,
          name: `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`,
          rows: [],
        })
      }

      currentMonth++
      if (currentMonth > 12) {
        currentMonth = 1
        currentYear++
      }
    }

    monthInfos.sort((a, b) => a.ordinal.localeCompare(b.ordinal))
  }

  const gapMonths = monthInfos.filter(m => m.rows.length === 0).length
  const totalMonths = monthInfos.length

  // PHASE 1: Read all months in parallel
  onProgress({
    phase: 'reading-months', currentMonth: null, monthsProcessed: 0, totalMonths,
    recordsImported: 0, totalRecords: rows.length, monthsCreated: 0, monthsToCreate: 0,
    gapMonths, percentComplete: 5, incomeImported: 0, spendImported: 0, allocationsImported: 0,
  })

  const readResults: MonthReadResult[] = await Promise.all(
    monthInfos.map(async (info): Promise<MonthReadResult> => {
      try {
        const data = await readMonthForEdit(budgetId, info.year, info.month, 'seed import combined')
        return { info, data, needsCreation: false }
      } catch {
        return { info, data: null, needsCreation: true }
      }
    })
  )

  const readResultsByOrdinal = new Map(readResults.map(r => [r.info.ordinal, r]))
  const sortedReadResults = monthInfos.map(info => readResultsByOrdinal.get(info.ordinal)!)
  const monthsToCreate = sortedReadResults.filter(r => r.needsCreation).length

  // PHASE 2: Create missing months (sequentially to avoid race conditions)
  if (monthsToCreate > 0) {
    onProgress({
      phase: 'creating-months', currentMonth: null, monthsProcessed: 0, totalMonths,
      recordsImported: 0, totalRecords: rows.length, monthsCreated: 0, monthsToCreate,
      gapMonths, percentComplete: 15, incomeImported: 0, spendImported: 0, allocationsImported: 0,
    })

    for (const result of sortedReadResults) {
      if (result.needsCreation) {
        try {
          result.data = await createMonth(budgetId, result.info.year, result.info.month, { bypassDateLimit: true })
          monthsCreated++
          onProgress({
            phase: 'creating-months', currentMonth: result.info.name, monthsProcessed: 0, totalMonths,
            recordsImported: 0, totalRecords: rows.length, monthsCreated, monthsToCreate,
            gapMonths, percentComplete: 15 + Math.round((monthsCreated / monthsToCreate) * 10),
            incomeImported: 0, spendImported: 0, allocationsImported: 0,
          })
        } catch (createErr) {
          result.error = `Failed to create month ${result.info.month}/${result.info.year}: ${createErr instanceof Error ? createErr.message : 'Unknown error'}`
          errors.push(result.error)
          skipped += result.info.rows.length
        }
      }
    }
  }

  // PHASE 3: Process and recalculate all months (in memory, chronological order)
  onProgress({
    phase: 'processing-months', currentMonth: null, monthsProcessed: 0, totalMonths,
    recordsImported: 0, totalRecords: rows.length, monthsCreated, monthsToCreate,
    gapMonths, percentComplete: 30, incomeImported: 0, spendImported: 0, allocationsImported: 0,
  })

  const processedMonths: Array<{ info: MonthInfo; data: MonthDocument }> = []
  let monthsProcessed = 0
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT

  for (const result of sortedReadResults) {
    if (!result.data || result.error) {
      monthsProcessed++
      continue
    }

    let monthData = result.data
    const monthRows = result.info.rows

    const incomeRows = monthRows.filter(r => r.recordType === 'income')
    const spendRows = monthRows.filter(r => r.recordType === 'spend')
    const allocationRows = monthRows.filter(r => r.recordType === 'allocation')

    if (incomeRows.length > 0) {
      const processResult = processIncomeRows(incomeRows, monthData, accounts, accountMappings)
      monthData = processResult.monthData
      imported += processResult.imported
      incomeImported += processResult.imported
      skipped += processResult.skipped
      errors.push(...processResult.errors)
    }

    if (spendRows.length > 0) {
      const processResult = processSpendRows(spendRows, monthData, categories, accounts, categoryMappings, accountMappings)
      monthData = processResult.monthData
      imported += processResult.imported
      spendImported += processResult.imported
      skipped += processResult.skipped
      errors.push(...processResult.errors)
    }

    if (allocationRows.length > 0) {
      const processResult = processAllocationRows(allocationRows, monthData, categories, categoryMappings)
      monthData = processResult.monthData
      imported += processResult.imported
      allocationsImported += processResult.imported
      skipped += processResult.skipped
      errors.push(...processResult.errors)
    }

    monthData = recalculateMonth(monthData, prevSnapshot)
    prevSnapshot = extractSnapshotFromMonth(monthData)
    processedMonths.push({ info: result.info, data: monthData })
    monthsProcessed++

    onProgress({
      phase: 'processing-months', currentMonth: result.info.name, monthsProcessed, totalMonths,
      recordsImported: imported, totalRecords: rows.length, monthsCreated, monthsToCreate,
      gapMonths, percentComplete: 30 + Math.round((monthsProcessed / totalMonths) * 30),
      incomeImported, spendImported, allocationsImported,
    })
  }

  // PHASE 4: Save all months in batches (Firestore batch write)
  onProgress({
    phase: 'saving-months', currentMonth: null, monthsProcessed: processedMonths.length,
    totalMonths: processedMonths.length, recordsImported: imported, totalRecords: rows.length,
    monthsCreated, monthsToCreate, gapMonths, percentComplete: 65,
    incomeImported, spendImported, allocationsImported,
  })

  const batchDocs: BatchWriteDoc[] = processedMonths.map(({ info, data }) => ({
    collectionPath: 'months',
    docId: getMonthDocId(budgetId, info.year, info.month),
    data: data as unknown as FirestoreData,
  }))

  try {
    await batchWriteDocs(batchDocs, `seed import combined (${processedMonths.length} months)`)
  } catch (err) {
    errors.push(`Error batch saving months: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  // PHASE 5: Update budget with final balances (no recalc needed!)
  onProgress({
    phase: 'updating-budget', currentMonth: null, monthsProcessed: processedMonths.length,
    totalMonths: processedMonths.length, recordsImported: imported, totalRecords: rows.length,
    monthsCreated, monthsToCreate, gapMonths, percentComplete: 85,
    incomeImported, spendImported, allocationsImported,
  })

  try {
    await updateBudgetWithFinalBalances(budgetId, prevSnapshot, processedMonths)
  } catch (err) {
    errors.push(`Error updating budget: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  return { success: errors.length === 0, imported, skipped, errors }
}
