/**
 * Seed Import Helper Components
 *
 * Sub-components for the SeedImportCard - extracted for file size management.
 */

import type { ImportProgress } from '../../../hooks/migrations/useSeedImport'
import type { RecalculationProgress } from '../../../data/recalculation'
import { StatusBox } from './MigrationComponents'
import { Button } from '../../../components/ui'
import { LoadingOverlay, ProgressBar, StatItem, StatGrid, PercentLabel } from '../../app/LoadingOverlay'

// =============================================================================
// MAPPING DROPDOWN
// =============================================================================

interface MappingDropdownProps {
  oldName: string
  options: Array<{ id: string; name: string }>
  currentMapping: { newId: string; newName: string } | undefined
  onSelect: (id: string, name: string) => void
  placeholder: string
}

export function MappingDropdown({
  oldName,
  options,
  currentMapping,
  onSelect,
  placeholder,
}: MappingDropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    if (!selectedId) return
    const selected = options.find(opt => opt.id === selectedId)
    if (selected) {
      onSelect(selected.id, selected.name)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.5rem',
      padding: '0.5rem',
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '6px',
    }}>
      <span style={{
        flex: '0 0 40%',
        fontSize: '0.85rem',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }} title={oldName}>
        "{oldName}"
      </span>
      <span style={{ opacity: 0.5 }}>→</span>
      <select
        value={currentMapping?.newId ?? ''}
        onChange={handleChange}
        style={{
          flex: 1,
          padding: '0.4rem',
          borderRadius: '4px',
          border: currentMapping
            ? '1px solid #22c55e'
            : '1px solid color-mix(in srgb, currentColor 30%, transparent)',
          background: currentMapping
            ? 'color-mix(in srgb, #22c55e 10%, transparent)'
            : 'color-mix(in srgb, currentColor 10%, transparent)',
          color: 'inherit',
          fontSize: '0.85rem',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>
    </div>
  )
}

// =============================================================================
// IMPORT RESULTS
// =============================================================================

interface ImportResultsProps {
  result: {
    success: boolean
    imported: number
    skipped: number
    errors: string[]
  }
}

export function ImportResults({ result }: ImportResultsProps) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
        <div>
          {result.errors.length > 0 ? '⚠️' : '✅'} Import {result.success ? 'complete' : 'finished with errors'}
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li>{result.imported} records imported</li>
            {result.skipped > 0 && <li>{result.skipped} records skipped</li>}
          </ul>
          {result.errors.length > 0 && (
            <>
              <p style={{ margin: '0.75rem 0 0.25rem 0', fontWeight: 500, color: '#ef4444' }}>Errors:</p>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#ef4444' }}>
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li style={{ opacity: 0.7 }}>...and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            </>
          )}
        </div>
      </StatusBox>
    </div>
  )
}

// =============================================================================
// IMPORT CONFIRMATION MODAL CONTENT
// =============================================================================

export interface MonthRangeInfo {
  start: string
  end: string
  count: number
  isSingleMonth: boolean
}

/** Counts of records by type for confirmation display */
export interface RecordTypeCounts {
  income: number
  spend: number
  allocations: number
}

interface ImportConfirmationContentProps {
  recordCount: number
  recordTypeCounts: RecordTypeCounts
  monthRange: MonthRangeInfo | null
  onCancel: () => void
  onConfirm: () => void
}

export function ImportConfirmationContent({
  recordCount,
  recordTypeCounts,
  monthRange,
  onCancel,
  onConfirm,
}: ImportConfirmationContentProps) {

  const getMonthRangeLabel = () => {
    if (!monthRange) return ''
    if (monthRange.isSingleMonth) return monthRange.start
    return `${monthRange.start} to ${monthRange.end}`
  }

  return (
    <div>
      <div style={{
        background: 'color-mix(in srgb, #ef4444 15%, transparent)',
        border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <p style={{ margin: 0, color: '#fca5a5', fontWeight: 500, fontSize: '0.95rem' }}>
          ⚠️ Warning: Destructive Operation
        </p>
        <p style={{ margin: '0.5rem 0 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
          This will <strong>REPLACE</strong> all existing income, expenses, and allocations in{' '}
          <strong style={{ color: '#fbbf24' }}>
            {monthRange?.count === 1 ? '1 month' : `${monthRange?.count} months`}
          </strong>{' '}
          ({getMonthRangeLabel()}).
        </p>
      </div>

      <p style={{ margin: '0 0 0.5rem', opacity: 0.8 }}>
        You are about to import <strong>{recordCount.toLocaleString()}</strong> records:
      </p>
      <ul style={{ margin: '0 0 1rem', paddingLeft: '1.5rem', fontSize: '0.9rem', opacity: 0.9 }}>
        {recordTypeCounts.income > 0 && <li>{recordTypeCounts.income.toLocaleString()} income transactions</li>}
        {recordTypeCounts.spend > 0 && <li>{recordTypeCounts.spend.toLocaleString()} expense transactions</li>}
        {recordTypeCounts.allocations > 0 && <li>{recordTypeCounts.allocations.toLocaleString()} budget allocations</li>}
      </ul>

      <p style={{ margin: '0 0 1.5rem', opacity: 0.8 }}>
        Any existing data of these types in the affected months will be <strong style={{ color: '#fca5a5' }}>deleted and replaced</strong>.
        This cannot be undone.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Button variant="secondary" actionName="Cancel Seed Import" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" actionName="Confirm Seed Import" onClick={onConfirm}>
          Replace & Import
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// IMPORT PROGRESS OVERLAY
// =============================================================================

interface ImportProgressOverlayProps {
  progress: ImportProgress
}

export function ImportProgressOverlay({ progress }: ImportProgressOverlayProps) {
  const getPhaseLabel = () => {
    switch (progress.phase) {
      case 'saving-mappings': return 'Saving mappings...'
      case 'reading-months': return `Reading ${progress.totalMonths} months (parallel)...`
      case 'creating-months':
        return progress.currentMonth
          ? `Creating ${progress.currentMonth}...`
          : `Creating ${progress.monthsToCreate} new months...`
      case 'processing-months':
        return progress.currentMonth
          ? `Processing & recalculating ${progress.currentMonth}...`
          : `Processing ${progress.totalRecords.toLocaleString()} records...`
      case 'saving-months': return `Saving ${progress.totalMonths} months (batch)...`
      case 'updating-budget': return 'Updating budget balances...'
      case 'complete': return 'Import complete!'
      default: return 'Importing...'
    }
  }

  // Show different stats based on phase
  const showCreationProgress = progress.phase === 'creating-months' && progress.monthsToCreate > 0
  const showRecordProgress = progress.phase === 'processing-months' || progress.phase === 'saving-months' || progress.phase === 'updating-budget' || progress.phase === 'complete'

  return (
    <LoadingOverlay message={getPhaseLabel()} spinnerColor="#646cff">
      <ProgressBar percent={progress.percentComplete} gradient="linear-gradient(90deg, #646cff, #8b5cf6)" />

      {/* Phase-specific stats */}
      {showCreationProgress && (
        <StatGrid columns={2}>
          <StatItem value={`${progress.monthsCreated}/${progress.monthsToCreate}`} label="Months Created" color="#f59e0b" />
          <StatItem value={progress.totalMonths} label="Total Months" color="#646cff" />
        </StatGrid>
      )}

      {!showCreationProgress && (
        <StatGrid columns={progress.gapMonths > 0 ? 3 : 2}>
          <StatItem value={progress.totalMonths} label="Months" color="#646cff" />
          {progress.monthsCreated > 0 && (
            <StatItem value={progress.monthsCreated} label="New" color="#f59e0b" />
          )}
          {progress.gapMonths > 0 && (
            <StatItem value={progress.gapMonths} label="Gap Filled" color="#8b5cf6" />
          )}
        </StatGrid>
      )}

      {/* Record breakdown - show when processing or later */}
      {showRecordProgress && (
        <StatGrid columns={3}>
          <StatItem value={progress.incomeImported} label="Income" color="#22c55e" />
          <StatItem value={progress.spendImported} label="Expenses" color="#ef4444" />
          <StatItem value={progress.allocationsImported} label="Allocations" color="#3b82f6" />
        </StatGrid>
      )}

      <PercentLabel percent={progress.percentComplete} />
    </LoadingOverlay>
  )
}

// =============================================================================
// RECALCULATION PROGRESS OVERLAY
// =============================================================================

interface RecalculationProgressOverlayProps {
  progress: RecalculationProgress
}

export function RecalculationProgressOverlay({ progress }: RecalculationProgressOverlayProps) {
  const getPhaseLabel = () => {
    switch (progress.phase) {
      case 'reading-budget': return 'Reading budget data...'
      case 'fetching-months':
        return progress.totalMonthsToFetch
          ? `Fetching ${progress.totalMonthsToFetch} months (parallel)...`
          : 'Fetching months...'
      case 'recalculating':
        return progress.currentMonth
          ? `Recalculating ${progress.currentMonth}...`
          : 'Processing months...'
      case 'saving':
        return progress.totalMonths > 0
          ? `Saving ${progress.totalMonths} months (batch)...`
          : 'Saving results...'
      case 'complete': return 'Recalculation complete!'
      default: return 'Recalculating...'
    }
  }

  const greenGradient = 'linear-gradient(90deg, #22c55e, #10b981)'

  // Determine what stats to show based on phase
  const showFetchProgress = progress.phase === 'fetching-months' && progress.totalMonthsToFetch
  const showRecalcProgress = progress.phase === 'recalculating' || progress.phase === 'saving' || progress.phase === 'complete'

  return (
    <LoadingOverlay message={getPhaseLabel()} spinnerColor="#22c55e">
      <ProgressBar percent={progress.percentComplete} gradient={greenGradient} />

      {showFetchProgress && (
        <StatItem
          value={progress.totalMonthsToFetch ?? 0}
          label="Months to Fetch"
          color="#22c55e"
        />
      )}

      {showRecalcProgress && progress.totalMonths > 0 && (
        <StatGrid columns={2}>
          <StatItem
            value={`${progress.monthsProcessed}/${progress.totalMonths}`}
            label="Recalculated"
            color="#22c55e"
          />
          {progress.phase === 'complete' && (
            <StatItem value="✓" label="Saved" color="#10b981" />
          )}
        </StatGrid>
      )}

      <PercentLabel percent={progress.percentComplete} />
    </LoadingOverlay>
  )
}

