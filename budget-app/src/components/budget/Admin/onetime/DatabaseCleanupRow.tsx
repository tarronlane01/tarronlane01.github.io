/**
 * Database Cleanup Row
 *
 * Compact row for database schema validation and cleanup.
 */

import { MONTH_NAMES } from '@constants'
import type { DatabaseCleanupStatus, DatabaseCleanupResult } from '@hooks/migrations/useDatabaseCleanup'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface DatabaseCleanupRowProps {
  status: DatabaseCleanupStatus | null
  hasData: boolean
  hasIssues: boolean
  totalIssues: number
  isChecking: boolean
  isRunning: boolean
  result: DatabaseCleanupResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function DatabaseCleanupRow({
  status,
  hasData,
  hasIssues,
  totalIssues,
  isChecking,
  isRunning,
  result,
  onCheck,
  onRun,
  disabled,
}: DatabaseCleanupRowProps) {
  const getStatus = (): MigrationRowStatus => {
    if (isRunning) return 'running'
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0) return 'complete'
    if (result && result.errors.length > 0) return 'error'
    if (!hasIssues) return 'clean'
    return 'needs-action'
  }

  const getStatusText = (): string | undefined => {
    if (result && result.errors.length === 0) {
      const totalFixed = (
        result.accountsFixed +
        result.categoriesFixed +
        result.groupsFixed +
        result.monthMapsUpdated +
        result.deprecatedFieldsRemoved +
        result.futureMonthsDeleted +
        result.monthsFixed +
        result.oldRecalcFieldsRemoved +
        result.dataMappingsFixed
      )
      return totalFixed > 0 ? `Fixed ${totalFixed}` : 'Complete'
    }
    return undefined
  }

  // Build details for expandable section
  const renderDetails = () => {
    if (result) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Cleanup complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) processed</li>}
            {result.arraysConverted > 0 && <li>{result.arraysConverted} array(s) converted to maps</li>}
            {result.accountsFixed > 0 && <li>{result.accountsFixed} account(s) fixed</li>}
            {result.categoriesFixed > 0 && <li>{result.categoriesFixed} categor(ies) fixed</li>}
            {result.groupsFixed > 0 && <li>{result.groupsFixed} group(s) fixed</li>}
            {result.monthMapsUpdated > 0 && <li>{result.monthMapsUpdated} month_map(s) updated</li>}
            {result.deprecatedFieldsRemoved > 0 && <li>{result.deprecatedFieldsRemoved} deprecated field(s) removed</li>}
            {result.futureMonthsDeleted > 0 && <li>{result.futureMonthsDeleted} future month(s) deleted</li>}
            {result.monthsFixed > 0 && <li>{result.monthsFixed} month schema(s) fixed</li>}
            {result.oldRecalcFieldsRemoved > 0 && <li>{result.oldRecalcFieldsRemoved} old recalc field(s) removed</li>}
            {result.dataMappingsFixed > 0 && <li>{result.dataMappingsFixed} data mapping(s) fixed</li>}
          </ul>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: '#ef4444' }}>
              <div>Errors ({result.errors.length}):</div>
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
                {result.errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                {result.errors.length > 3 && <li>...and {result.errors.length - 3} more</li>}
              </ul>
            </div>
          )}
        </div>
      )
    }

    if (!hasData) {
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for issues.</div>
    }

    if (!hasIssues) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All {status!.totalBudgets} budgets, {status!.totalMonths} months, and {status!.totalDataMappings} data mappings are clean.
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: '#fbbf24' }}>Issues found:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {status!.budgetsWithArrays > 0 && <li>{status!.budgetsWithArrays} budget(s) using legacy array format</li>}
          {status!.accountsNeedingDefaults > 0 && <li>{status!.accountsNeedingDefaults} account(s) missing defaults</li>}
          {status!.categoriesNeedingDefaults > 0 && <li>{status!.categoriesNeedingDefaults} categor(ies) missing defaults</li>}
          {status!.groupsNeedingDefaults > 0 && <li>{status!.groupsNeedingDefaults} group(s) missing defaults</li>}
          {status!.budgetsNeedingMonthMapUpdate > 0 && <li>{status!.budgetsNeedingMonthMapUpdate} budget(s) missing month_map</li>}
          {status!.budgetsWithDeprecatedEarliestMonth > 0 && <li>{status!.budgetsWithDeprecatedEarliestMonth} deprecated earliest_month field(s)</li>}
          {status!.futureMonthsToDelete.length > 0 && (
            <li>
              {status!.futureMonthsToDelete.length} future month(s) to delete
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', opacity: 0.8 }}>
                {status!.futureMonthsToDelete.slice(0, 2).map((m) => (
                  <li key={m.docId}>{MONTH_NAMES[m.month - 1]} {m.year}</li>
                ))}
                {status!.futureMonthsToDelete.length > 2 && (
                  <li>...and {status!.futureMonthsToDelete.length - 2} more</li>
                )}
              </ul>
            </li>
          )}
          {status!.monthsWithSchemaIssues > 0 && <li>{status!.monthsWithSchemaIssues} month(s) with schema issues</li>}
          {status!.monthsWithOldRecalcField > 0 && <li>{status!.monthsWithOldRecalcField} month(s) with old recalc field</li>}
          {status!.dataMappingsMissingBudgetId > 0 && <li>{status!.dataMappingsMissingBudgetId} data mapping(s) missing budget_id</li>}
        </ul>
        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
          Scanned {status!.totalBudgets} budgets, {status!.totalMonths} months, {status!.totalDataMappings} data mappings.
        </div>
      </div>
    )
  }

  return (
    <MigrationRow
      name="Database Cleanup"
      description="Validates and fixes schema for budgets, months, and data mappings"
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={`Fix ${totalIssues}`}
      disabled={disabled}
      itemCount={hasIssues ? totalIssues : undefined}
      details={renderDetails()}
      isDestructive
    />
  )
}

