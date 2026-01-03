/**
 * Seed Import Card
 *
 * Migration card for importing seed data from CSV files.
 * Handles combined imports with income, spend, and allocations in a single file.
 *
 * Features:
 * - File upload (combined format with type column)
 * - CSV parsing and validation
 * - Detection of unknown categories/accounts
 * - Mapping UI for unknown entities to existing ones
 * - Persistence of mappings to data_mappings collection
 */

import { useState, useRef, useCallback, useMemo } from 'react'
import { MigrationCard, StatusBox, ActionButton, Spinner } from './MigrationComponents'
import { ImportResults, ImportConfirmationContent, ImportProgressOverlay, type RecordTypeCounts } from './SeedImportHelpers'
import { MappingSection } from './SeedImportMappings'
import { Modal } from '../../../components/ui'
import type { MigrationCardStatus } from './MigrationComponents'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetQuery } from '../../../data'
import { useSeedImport } from '../../../hooks/migrations/useSeedImport'

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SeedImportCardProps {
  disabled?: boolean
}

export function SeedImportCard({ disabled }: SeedImportCardProps) {
  const { selectedBudgetId } = useBudget()
  const { data: budgetData } = useBudgetQuery(selectedBudgetId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const {
    // State
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
    // Actions
    parseFile,
    setCategoryMapping,
    setAccountMapping,
    runImport,
    reset,
    // Flags
    isParsing,
    isImporting,
    hasUnmappedEntities,
  } = useSeedImport(selectedBudgetId)

  // Whether there are any custom (non-exact-match) mappings to show
  const hasCustomMappings = customMappedCategories.length > 0 || customMappedAccounts.length > 0

  // Memoize categories, accounts, and account groups to prevent useCallback dep changes
  const categories = useMemo(() => budgetData?.budget?.categories ?? {}, [budgetData?.budget?.categories])
  const accounts = useMemo(() => budgetData?.budget?.accounts ?? {}, [budgetData?.budget?.accounts])
  const accountGroups = useMemo(() => budgetData?.budget?.account_groups ?? {}, [budgetData?.budget?.account_groups])

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      parseFile(file, categories, accounts)
    }
  }, [parseFile, categories, accounts])

  // Handle import button click - show confirmation modal
  const handleImportClick = useCallback(() => {
    if (!selectedBudgetId || !parsedData) return
    setShowConfirmModal(true)
  }, [selectedBudgetId, parsedData])

  // Handle confirmed import
  const handleConfirmedImport = useCallback(async () => {
    setShowConfirmModal(false)
    if (!selectedBudgetId || !parsedData) return
    await runImport(categories, accounts)
  }, [selectedBudgetId, parsedData, runImport, categories, accounts])

  // Handle reset
  const handleReset = useCallback(() => {
    setSelectedFile(null)
    reset()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [reset])

  // Determine card status
  const cardStatus: MigrationCardStatus = useMemo(() => {
    if (importResult && importResult.errors.length === 0) return 'complete'
    if (status === 'ready' || status === 'mapping') return 'needs-action'
    return 'unknown'
  }, [status, importResult])

  const statusText = useMemo(() => {
    if (importResult && importResult.errors.length === 0) return '✓ Import Complete'
    if (status === 'ready') return 'Ready to Import'
    if (status === 'mapping') return 'Mapping Required'
    return 'Select a File'
  }, [status, importResult])

  // Calculate month range and record type counts from parsed data
  const { monthRange, recordTypeCounts } = useMemo(() => {
    if (!parsedData || parsedData.length === 0) {
      return { monthRange: null, recordTypeCounts: { income: 0, spend: 0, allocations: 0 } }
    }

    const months = new Set<string>()
    let minYear = Infinity, maxYear = -Infinity
    let minMonth = 12, maxMonth = 1
    const counts: RecordTypeCounts = { income: 0, spend: 0, allocations: 0 }

    for (const row of parsedData) {
      months.add(`${row.year}-${row.month}`)
      if (row.year < minYear || (row.year === minYear && row.month < minMonth)) {
        minYear = row.year
        minMonth = row.month
      }
      if (row.year > maxYear || (row.year === maxYear && row.month > maxMonth)) {
        maxYear = row.year
        maxMonth = row.month
      }
      // Count by record type
      if (row.recordType === 'income') counts.income++
      else if (row.recordType === 'spend') counts.spend++
      else if (row.recordType === 'allocation') counts.allocations++
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const startLabel = `${monthNames[minMonth - 1]} ${minYear}`
    const endLabel = `${monthNames[maxMonth - 1]} ${maxYear}`

    return {
      monthRange: {
        start: startLabel,
        end: endLabel,
        count: months.size,
        isSingleMonth: months.size === 1,
      },
      recordTypeCounts: counts,
    }
  }, [parsedData])

  return (
    <MigrationCard
      title="📥 Seed Data Import"
      description="Import historical data from a combined CSV file. The file should have a 'type' column (income, spend, or allocation) as the first column. Unknown categories and accounts will be mapped to existing ones."
      status={cardStatus}
      statusText={statusText}
      onRefresh={handleReset}
      isRefreshing={false}
      isBusy={isParsing || isImporting}
      cardName="Seed Import"
    >
      {/* Import Loading Overlay */}
      {isImporting && importProgress && (
        <ImportProgressOverlay progress={importProgress} />
      )}

      {/* File Upload */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
          CSV File
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={disabled || isParsing || isImporting}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            color: 'inherit',
            cursor: disabled || isParsing || isImporting ? 'not-allowed' : 'pointer',
          }}
        />
        {selectedFile && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Selected: {selectedFile.name}
          </p>
        )}
      </div>

      {/* Parsing Status */}
      {isParsing && (
        <StatusBox type="running">
          <Spinner /> Parsing CSV file...
        </StatusBox>
      )}

      {/* Parse Results */}
      {parsedData && parsedData.length > 0 && !isParsing && (
        <div style={{ marginBottom: '1rem' }}>
          <StatusBox type={hasUnmappedEntities ? 'warning' : 'clean'}>
            <div>
              {hasUnmappedEntities ? '⚠️' : '✅'} Parsed {parsedData.length} rows
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                {recordTypeCounts.income > 0 && <li>{recordTypeCounts.income} income</li>}
                {recordTypeCounts.spend > 0 && <li>{recordTypeCounts.spend} spend</li>}
                {recordTypeCounts.allocations > 0 && <li>{recordTypeCounts.allocations} allocations</li>}
              </ul>
              {hasUnmappedEntities && (
                <span style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Some categories or accounts need to be mapped
                </span>
              )}
            </div>
          </StatusBox>
        </div>
      )}

      {/* Mapping UI - show when there are unmapped entities OR custom mappings */}
      {(hasUnmappedEntities || hasCustomMappings) && !isParsing && (
        <MappingSection
          unmappedCategories={unmappedCategories}
          unmappedAccounts={unmappedAccounts}
          customMappedCategories={customMappedCategories}
          customMappedAccounts={customMappedAccounts}
          categoryMappings={categoryMappings}
          accountMappings={accountMappings}
          categories={categories}
          accounts={accounts}
          accountGroups={accountGroups}
          onCategoryMap={setCategoryMapping}
          onAccountMap={setAccountMapping}
        />
      )}

      {/* Import Button */}
      {status === 'ready' && !isParsing && (
        <ActionButton
          onClick={handleImportClick}
          disabled={disabled || !selectedBudgetId}
          isBusy={isImporting}
          busyText="Importing..."
          actionName="Run Seed Import"
        >
          📥 Import {parsedData?.length ?? 0} Records
        </ActionButton>
      )}

      {/* Import Results */}
      {importResult && (
        <ImportResults result={importResult} />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="⚠️ Confirm Import"
      >
        <ImportConfirmationContent
          recordCount={parsedData?.length ?? 0}
          recordTypeCounts={recordTypeCounts}
          monthRange={monthRange}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmedImport}
        />
      </Modal>
    </MigrationCard>
  )
}
