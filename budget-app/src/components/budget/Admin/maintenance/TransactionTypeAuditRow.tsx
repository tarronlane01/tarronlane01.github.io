/**
 * Transaction Type Audit Row
 *
 * Combined row for all transaction validation checks:
 * - Account/Category Validation
 * - Orphaned ID Cleanup
 * - Expense to Adjustment Migration
 * - Adjustments to Transfers Migration
 *
 * Displays as a single row with expandable sub-checks.
 */

import { useState } from 'react'
import type { ValidationStatus } from '@hooks/migrations/useAccountCategoryValidation'
import type { OrphanedIdCleanupStatus, OrphanedIdCleanupResult } from '@hooks/migrations/useOrphanedIdCleanup'
import type { ExpenseToAdjustmentStatus, ExpenseToAdjustmentResult } from '@hooks/migrations/useExpenseToAdjustmentMigration'
import type { AdjustmentsToTransfersStatus, AdjustmentsToTransfersResult } from '@hooks/migrations/useAdjustmentsToTransfersMigration'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'
import { statusConfig, type SubCheck, type SubCheckStatus } from './transactionAuditTypes'
import { SubCheckRow } from './SubCheckRow'

interface TransactionTypeAuditRowProps {
  accountCategoryValidation: {
    status: ValidationStatus | null
    hasData: boolean
    hasViolations: boolean
    violationCount: number
    isScanning: boolean
    report: string | null
    scan: (seedCsvContent?: string) => void
  }

  orphanedIdCleanup: {
    status: OrphanedIdCleanupStatus | null
    hasData: boolean
    hasItemsToFix: boolean
    totalOrphaned: number
    isScanning: boolean
    isRunning: boolean
    result: OrphanedIdCleanupResult | null
    scanStatus: () => void
  }

  expenseToAdjustment: {
    status: ExpenseToAdjustmentStatus | null
    hasData: boolean
    hasItemsToMigrate: boolean
    totalToMigrate: number
    isScanning: boolean
    isRunning: boolean
    result: ExpenseToAdjustmentResult | null
    scanStatus: () => void
  }

  adjustmentsToTransfers: {
    status: AdjustmentsToTransfersStatus | null
    hasData: boolean
    hasPairsToConvert: boolean
    totalPairs: number
    isScanning: boolean
    isRunning: boolean
    result: AdjustmentsToTransfersResult | null
    scanStatus: () => void
  }

  needsAction: boolean
  totalIssues: number
  isScanning: boolean
  isRunning: boolean
  disabled: boolean
  onRunOrphaned: () => void
  onRunExpense: () => void
  onRunTransfers: () => void
}

export function TransactionTypeAuditRow({
  accountCategoryValidation,
  orphanedIdCleanup,
  expenseToAdjustment,
  adjustmentsToTransfers,
  needsAction,
  totalIssues,
  isScanning,
  isRunning,
  disabled,
  onRunOrphaned,
  onRunExpense,
  onRunTransfers,
}: TransactionTypeAuditRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Determine overall status
  const getOverallStatus = (): SubCheckStatus => {
    if (isRunning) return 'running'
    const allHaveData =
      accountCategoryValidation.hasData &&
      orphanedIdCleanup.hasData &&
      expenseToAdjustment.hasData &&
      adjustmentsToTransfers.hasData
    if (!allHaveData) return 'unknown'
    if (needsAction) return 'needs-action'
    return 'clean'
  }

  const overallStatus = getOverallStatus()
  const config = statusConfig[overallStatus]

  // Build sub-checks array
  const subChecks: SubCheck[] = [
    {
      id: 'validation',
      name: 'Account/Category Validation',
      status: accountCategoryValidation.isScanning
        ? 'running'
        : !accountCategoryValidation.hasData
          ? 'unknown'
          : accountCategoryValidation.hasViolations
            ? 'needs-action'
            : 'clean',
      issueCount: accountCategoryValidation.violationCount,
      description: 'Validates all transactions have proper account/category combinations',
      canFix: false,
      onCheck: () => accountCategoryValidation.scan(),
      isChecking: accountCategoryValidation.isScanning,
      isRunning: false,
      details: accountCategoryValidation.hasViolations && accountCategoryValidation.status && (
        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'income').length > 0 && (
            <span>Income: {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'income').length} </span>
          )}
          {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'expense').length > 0 && (
            <span>Expenses: {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'expense').length} </span>
          )}
          {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'adjustment').length > 0 && (
            <span>Adjustments: {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'adjustment').length} </span>
          )}
          {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'transfer').length > 0 && (
            <span>Transfers: {accountCategoryValidation.status.violations.filter(v => v.transactionType === 'transfer').length}</span>
          )}
        </div>
      ),
    },
    {
      id: 'orphaned',
      name: 'Orphaned ID Cleanup',
      status: getSubCheckStatus(orphanedIdCleanup),
      issueCount: orphanedIdCleanup.totalOrphaned,
      description: 'Finds transactions with deleted/invalid account/category IDs',
      canFix: orphanedIdCleanup.hasItemsToFix,
      onCheck: orphanedIdCleanup.scanStatus,
      onFix: onRunOrphaned,
      isChecking: orphanedIdCleanup.isScanning,
      isRunning: orphanedIdCleanup.isRunning,
      details: orphanedIdCleanup.hasItemsToFix && orphanedIdCleanup.status && (
        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          {orphanedIdCleanup.status.orphanedCategoryIds > 0 && <span>Categories: {orphanedIdCleanup.status.orphanedCategoryIds} </span>}
          {orphanedIdCleanup.status.orphanedAccountIds > 0 && <span>Accounts: {orphanedIdCleanup.status.orphanedAccountIds}</span>}
        </div>
      ),
    },
    {
      id: 'expense',
      name: 'Expense → Adjustment',
      status: getSubCheckStatus(expenseToAdjustment, 'hasItemsToMigrate'),
      issueCount: expenseToAdjustment.totalToMigrate,
      description: 'Moves expenses without account/category to adjustments',
      canFix: expenseToAdjustment.hasItemsToMigrate,
      onCheck: expenseToAdjustment.scanStatus,
      onFix: onRunExpense,
      isChecking: expenseToAdjustment.isScanning,
      isRunning: expenseToAdjustment.isRunning,
      details: expenseToAdjustment.hasItemsToMigrate && expenseToAdjustment.status && (
        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          {expenseToAdjustment.status.expensesToMigrate} expense(s) with No Account or No Category
        </div>
      ),
    },
    {
      id: 'transfers',
      name: 'Adjustment → Transfers',
      status: getSubCheckStatus(adjustmentsToTransfers, 'hasPairsToConvert'),
      issueCount: adjustmentsToTransfers.totalPairs,
      description: 'Converts opposite adjustment pairs to transfers',
      canFix: adjustmentsToTransfers.hasPairsToConvert,
      onCheck: adjustmentsToTransfers.scanStatus,
      onFix: onRunTransfers,
      isChecking: adjustmentsToTransfers.isScanning,
      isRunning: adjustmentsToTransfers.isRunning,
      details: adjustmentsToTransfers.hasPairsToConvert && adjustmentsToTransfers.status && (
        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
          {adjustmentsToTransfers.status.accountTransferPairs > 0 && <span>Account transfers: {adjustmentsToTransfers.status.accountTransferPairs} </span>}
          {adjustmentsToTransfers.status.categoryTransferPairs > 0 && <span>Category transfers: {adjustmentsToTransfers.status.categoryTransferPairs}</span>}
        </div>
      ),
    },
  ]

  const isDisabled = disabled || isRunning || isScanning

  const handleCheckAll = () => {
    logUserAction('CLICK', 'Check All Transaction Audit')
    subChecks.forEach(check => check.onCheck())
  }

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      overflow: 'hidden',
    }}>
      {/* Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', gap: '1rem' }}>
        {/* Status Indicator */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: `color-mix(in srgb, ${config.color} 20%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', flexShrink: 0,
        }}>
          {isRunning || isScanning ? <Spinner noMargin /> : config.icon}
        </div>

        {/* Name and Description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Transaction Type Audit
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Validates account/category assignments and fixes invalid transactions
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ color: config.color, fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {overallStatus === 'unknown' ? 'Unknown' : overallStatus === 'clean' ? 'Clean' : overallStatus === 'running' ? 'Running' : 'Needs Action'}
          {totalIssues > 0 && (
            <span style={{ background: `color-mix(in srgb, ${config.color} 20%, transparent)`, padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
              {totalIssues}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={handleCheckAll}
            disabled={isDisabled}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              color: 'inherit', border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              padding: '0.35rem 0.6rem', borderRadius: '4px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', opacity: isDisabled ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}
            title="Check all"
          >
            {isScanning ? <Spinner noMargin /> : '🔄'}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent', color: 'inherit', border: 'none',
              padding: '0.35rem', borderRadius: '4px', cursor: 'pointer',
              fontSize: '0.9rem', opacity: 0.6,
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Expandable Sub-checks */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)', padding: '0.5rem', background: 'color-mix(in srgb, currentColor 2%, transparent)' }}>
          {subChecks.map(check => <SubCheckRow key={check.id} check={check} disabled={disabled} />)}
        </div>
      )}
    </div>
  )
}

// Helper to determine sub-check status
function getSubCheckStatus(
  data: { isRunning: boolean; result: { errors: string[] } | null; isScanning: boolean; hasData: boolean; hasItemsToFix?: boolean; hasItemsToMigrate?: boolean; hasPairsToConvert?: boolean },
  needsActionKey: 'hasItemsToFix' | 'hasItemsToMigrate' | 'hasPairsToConvert' = 'hasItemsToFix'
): SubCheckStatus {
  if (data.isRunning) return 'running'
  if (data.result && data.result.errors.length === 0) return 'complete'
  if (data.isScanning) return 'running'
  if (!data.hasData) return 'unknown'
  if (data[needsActionKey]) return 'needs-action'
  return 'clean'
}
