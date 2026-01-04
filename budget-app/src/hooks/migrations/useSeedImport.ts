/** Seed Import Hook - Handles CSV parsing, entity mapping, and data import for combined seed files. */

import { useState, useCallback } from 'react'
import type { CategoriesMap, AccountsMap } from '@contexts'
import { queryClient, queryKeys } from '@data/queryClient'

import type { SeedImportStatus, ParsedSeedRow, MappingEntry, SeedImportResult, ImportProgress } from './seedImportTypes'
import { parseCSV, parseRawCashFlowCSV } from './seedImportParser'
import { findUnmappedEntities } from './seedImportProcessors'
import { importSeedData } from './seedImportLogic'
import { detectFileFormat, loadExistingMappings, saveMappings } from './useSeedImportHelpers'

export type { SeedRecordType, SeedImportStatus, ParsedSeedRow, MappingEntry, ImportDataMap, SeedImportResult, ImportProgress } from './seedImportTypes'

export function useSeedImport(budgetId: string | null) {
  // State
  const [status, setStatus] = useState<SeedImportStatus>('idle')
  const [parsedData, setParsedData] = useState<ParsedSeedRow[] | null>(null)
  const [unmappedCategories, setUnmappedCategories] = useState<string[]>([])
  const [unmappedAccounts, setUnmappedAccounts] = useState<string[]>([])
  // Categories/accounts with custom mappings (from saved mappings doc, not auto-matched)
  const [customMappedCategories, setCustomMappedCategories] = useState<string[]>([])
  const [customMappedAccounts, setCustomMappedAccounts] = useState<string[]>([])
  const [categoryMappings, setCategoryMappings] = useState<Map<string, MappingEntry>>(new Map())
  const [accountMappings, setAccountMappings] = useState<Map<string, MappingEntry>>(new Map())
  const [importResult, setImportResult] = useState<SeedImportResult | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)

  // Flags
  const isParsing = status === 'parsing'
  const isImporting = status === 'importing'
  const hasUnmappedEntities = unmappedCategories.length > 0 || unmappedAccounts.length > 0

  // Parse file (auto-detects format: combined or raw cash flow)
  const parseFile = useCallback(async (
    file: File,
    categories: CategoriesMap,
    accounts: AccountsMap
  ) => {
    setStatus('parsing')
    setImportResult(null)

    try {
      const content = await file.text()

      // Auto-detect format and use appropriate parser
      const format = detectFileFormat(content)
      const rows = format === 'raw_cash_flow'
        ? parseRawCashFlowCSV(content)
        : parseCSV(content)

      if (rows.length === 0) {
        setStatus('error')
        setParsedData(null)
        return
      }

      setParsedData(rows)

      // Collect ALL unique categories and accounts from the file
      const allCats = new Set<string>()
      const allAccs = new Set<string>()
      const NA_VALUES = ['n/a', 'na', 'none', '-', '']

      for (const row of rows) {
        // Categories from spend and allocation records
        if ((row.recordType === 'spend' || row.recordType === 'allocation') && row.category) {
          const catName = row.category.toLowerCase().trim()
          if (!NA_VALUES.includes(catName)) {
            allCats.add(row.category)
          }
        }
        // Accounts from spend and income records
        if ((row.recordType === 'spend' || row.recordType === 'income') && row.account) {
          const accName = row.account.toLowerCase().trim()
          if (!NA_VALUES.includes(accName)) {
            allAccs.add(row.account)
          }
        }
      }

      const sortedAllCats = Array.from(allCats).sort()
      const sortedAllAccs = Array.from(allAccs).sort()

      // Load existing mappings (from saved mappings document)
      const { categoryMappings: existingCatMappings, accountMappings: existingAccMappings } =
        await loadExistingMappings(budgetId)

      // Build category name lookup (case-insensitive)
      const categoryNameToId = new Map<string, { id: string; name: string }>()
      for (const [id, cat] of Object.entries(categories)) {
        categoryNameToId.set(cat.name.toLowerCase(), { id, name: cat.name })
      }

      // Build account name lookup (case-insensitive)
      const accountNameToId = new Map<string, { id: string; name: string }>()
      for (const [id, acc] of Object.entries(accounts)) {
        accountNameToId.set(acc.nickname.toLowerCase(), { id, name: acc.nickname })
      }

      // Track which categories/accounts have CUSTOM mappings (from saved doc, not exact name match)
      const customCats: string[] = []
      const customAccs: string[] = []

      // Categories with saved mappings that are NOT exact matches
      for (const catName of sortedAllCats) {
        if (existingCatMappings.has(catName)) {
          // Has a saved mapping - check if it's different from exact match
          const exactMatch = categoryNameToId.get(catName.toLowerCase())
          const savedMapping = existingCatMappings.get(catName)!
          // It's a custom mapping if there's no exact match OR the saved target is different
          if (!exactMatch || exactMatch.id !== savedMapping.newId) {
            customCats.push(catName)
          }
        }
      }

      // Accounts with saved mappings that are NOT exact matches
      for (const accName of sortedAllAccs) {
        if (existingAccMappings.has(accName)) {
          const exactMatch = accountNameToId.get(accName.toLowerCase())
          const savedMapping = existingAccMappings.get(accName)!
          if (!exactMatch || exactMatch.id !== savedMapping.newId) {
            customAccs.push(accName)
          }
        }
      }

      setCustomMappedCategories(customCats)
      setCustomMappedAccounts(customAccs)

      // Pre-populate mappings for auto-matched categories
      const allCatMappings = new Map(existingCatMappings)
      for (const catName of sortedAllCats) {
        if (!allCatMappings.has(catName)) {
          const match = categoryNameToId.get(catName.toLowerCase())
          if (match) {
            // Auto-match: category name exists in app
            allCatMappings.set(catName, { oldName: catName, newId: match.id, newName: match.name })
          }
        }
      }

      // Pre-populate mappings for auto-matched accounts
      const allAccMappings = new Map(existingAccMappings)
      for (const accName of sortedAllAccs) {
        if (!allAccMappings.has(accName)) {
          const match = accountNameToId.get(accName.toLowerCase())
          if (match) {
            // Auto-match: account name exists in app
            allAccMappings.set(accName, { oldName: accName, newId: match.id, newName: match.name })
          }
        }
      }

      setCategoryMappings(allCatMappings)
      setAccountMappings(allAccMappings)

      // Find unmapped entities (handles mixed record types)
      const { unmappedCategories: unmappedCats, unmappedAccounts: unmappedAccs } =
        findUnmappedEntities(rows, categories, accounts, allCatMappings, allAccMappings)

      setUnmappedCategories(unmappedCats)
      setUnmappedAccounts(unmappedAccs)

      // Determine status based on unmapped entities
      if (unmappedCats.length > 0 || unmappedAccs.length > 0) {
        setStatus('mapping')
      } else {
        setStatus('ready')
      }
    } catch (err) {
      console.error('[useSeedImport] Parse error:', err)
      setStatus('error')
      setParsedData(null)
    }
  }, [budgetId])

  // Set category mapping
  const setCategoryMapping = useCallback((oldName: string, newId: string, newName: string) => {
    setCategoryMappings(prev => {
      const next = new Map(prev)
      next.set(oldName, { oldName, newId, newName })
      return next
    })

    // Check if all mappings are complete
    setUnmappedCategories(prev => {
      const remaining = prev.filter(name => {
        if (name === oldName) return false
        return !categoryMappings.has(name)
      })

      if (remaining.length === 0 && unmappedAccounts.length === 0) {
        setStatus('ready')
      }

      return remaining
    })
  }, [categoryMappings, unmappedAccounts.length])

  // Set account mapping
  const setAccountMapping = useCallback((oldName: string, newId: string, newName: string) => {
    setAccountMappings(prev => {
      const next = new Map(prev)
      next.set(oldName, { oldName, newId, newName })
      return next
    })

    // Check if all mappings are complete
    setUnmappedAccounts(prev => {
      const remaining = prev.filter(name => {
        if (name === oldName) return false
        return !accountMappings.has(name)
      })

      if (remaining.length === 0 && unmappedCategories.length === 0) {
        setStatus('ready')
      }

      return remaining
    })
  }, [accountMappings, unmappedCategories.length])

  // Run import
  const runImport = useCallback(async (
    categories: CategoriesMap,
    accounts: AccountsMap
  ) => {
    if (!budgetId || !parsedData) return

    setStatus('importing')
    setImportProgress({
      phase: 'saving-mappings',
      currentMonth: null,
      monthsProcessed: 0,
      totalMonths: 0,
      recordsImported: 0,
      totalRecords: parsedData.length,
      monthsCreated: 0,
      monthsToCreate: 0,
      gapMonths: 0,
      percentComplete: 0,
      incomeImported: 0,
      spendImported: 0,
      allocationsImported: 0,
    })

    // Save mappings first
    await saveMappings(budgetId, categoryMappings, accountMappings)

    // Import the data (combined format - handles all record types)
    const result = await importSeedData(
      budgetId,
      parsedData,
      categories,
      accounts,
      categoryMappings,
      accountMappings,
      (progress) => setImportProgress(progress)
    )

    // Remove all month queries from cache after import
    // Using removeQueries instead of invalidateQueries to avoid triggering refetches
    // for months that might be cached but weren't part of the import
    queryClient.removeQueries({ queryKey: ['month'] })

    // Also remove budget query so fresh data is fetched when navigating
    queryClient.removeQueries({ queryKey: queryKeys.budget(budgetId) })

    setImportProgress(prev => prev ? { ...prev, phase: 'complete', percentComplete: 100 } : null)
    setImportResult(result)
    setStatus(result.success ? 'complete' : 'error')
  }, [budgetId, parsedData, categoryMappings, accountMappings])

  // Reset
  const reset = useCallback(() => {
    setStatus('idle')
    setParsedData(null)
    setUnmappedCategories([])
    setUnmappedAccounts([])
    setCustomMappedCategories([])
    setCustomMappedAccounts([])
    setImportResult(null)
    setImportProgress(null)
  }, [])

  return {
    status,
    parsedData,
    unmappedCategories,
    unmappedAccounts,
    customMappedCategories,
    customMappedAccounts,
    categoryMappings,
    accountMappings,
    importResult,
    importProgress,
    parseFile,
    setCategoryMapping,
    setAccountMapping,
    runImport,
    reset,
    isParsing,
    isImporting,
    hasUnmappedEntities,
  }
}
