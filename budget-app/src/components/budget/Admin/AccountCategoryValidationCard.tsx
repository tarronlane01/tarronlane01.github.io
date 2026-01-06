import { useState, useRef } from 'react'
import type { ValidationStatus } from '@hooks/migrations/useAccountCategoryValidation'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface AccountCategoryValidationCardProps {
  hasData: boolean
  status: ValidationStatus | null
  report: string | null
  hasViolations: boolean
  violationCount: number
  isScanning: boolean
  onScan: (seedCsvContent?: string) => void
  disabled: boolean
}

export function AccountCategoryValidationCard({
  hasData,
  status,
  report,
  hasViolations,
  violationCount,
  isScanning,
  onScan,
  disabled,
}: AccountCategoryValidationCardProps) {
  const [includeSeed, setIncludeSeed] = useState(false)
  const [seedContent, setSeedContent] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (!hasViolations) return 'clean'
    return 'needs-action'
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setSeedContent(event.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handleScan = () => {
    onScan(includeSeed && seedContent ? seedContent : undefined)
  }

  const handleCopyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report)
    }
  }

  return (
    <MigrationCard
      title="🔍 Account/Category Validation"
      description="Scans all transactions for invalid account/category combinations. Can compare against seed CSV to identify source rows."
      status={getStatus()}
      onRefresh={handleScan}
      isRefreshing={isScanning}
      isBusy={isScanning}
    >
      {/* Seed file option */}
      <div style={{
        marginBottom: '0.75rem',
        padding: '0.75rem',
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        borderRadius: '6px',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
          <input
            type="checkbox"
            checked={includeSeed}
            onChange={(e) => setIncludeSeed(e.target.checked)}
          />
          <span style={{ fontSize: '0.9rem' }}>Compare against seed CSV (optional)</span>
        </label>
        {includeSeed && (
          <div style={{ marginTop: '0.5rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ fontSize: '0.85rem' }}
            />
            {seedContent && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', opacity: 0.7 }}>
                ✓ Seed file loaded ({seedContent.split('\n').length} lines)
              </div>
            )}
          </div>
        )}
      </div>

      {isScanning ? (
        <StatusBox type="running">
          Scanning transactions...
        </StatusBox>
      ) : !hasData ? (
        <>
          <StatusBox type="unknown">
            ❓ Click Scan to check all transactions for validation issues
          </StatusBox>
          <ActionButton
            onClick={handleScan}
            disabled={disabled || (includeSeed && !seedContent)}
            isBusy={isScanning}
            busyText="Scanning..."
            actionName="Scan Transaction Validation"
          >
            🔍 Scan All Transactions
          </ActionButton>
        </>
      ) : hasViolations ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>
                ⚠️ Found {violationCount} transaction{violationCount !== 1 ? 's' : ''} with invalid account/category configuration
              </div>
              {status && (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                  {status.violations.filter(v => v.transactionType === 'income').length > 0 && (
                    <li>{status.violations.filter(v => v.transactionType === 'income').length} income transaction{status.violations.filter(v => v.transactionType === 'income').length !== 1 ? 's' : ''}</li>
                  )}
                  {status.violations.filter(v => v.transactionType === 'expense').length > 0 && (
                    <li>{status.violations.filter(v => v.transactionType === 'expense').length} expense transaction{status.violations.filter(v => v.transactionType === 'expense').length !== 1 ? 's' : ''}</li>
                  )}
                  {status.violations.filter(v => v.transactionType === 'adjustment').length > 0 && (
                    <li>{status.violations.filter(v => v.transactionType === 'adjustment').length} adjustment transaction{status.violations.filter(v => v.transactionType === 'adjustment').length !== 1 ? 's' : ''}</li>
                  )}
                  {status.violations.filter(v => v.transactionType === 'transfer').length > 0 && (
                    <li>{status.violations.filter(v => v.transactionType === 'transfer').length} transfer transaction{status.violations.filter(v => v.transactionType === 'transfer').length !== 1 ? 's' : ''}</li>
                  )}
                </ul>
              )}
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status?.totalMonths} month{status?.totalMonths !== 1 ? 's' : ''} ({status?.totalIncome} income, {status?.totalExpenses} expenses, {status?.totalAdjustments} adjustments, {status?.totalTransfers} transfers)
              </p>
            </div>
          </StatusBox>

          {/* Toggle report view */}
          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={() => setShowReport(!showReport)}
              style={{
                background: 'none',
                border: 'none',
                color: '#646cff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textDecoration: 'underline',
              }}
            >
              {showReport ? 'Hide' : 'Show'} Detailed Report
            </button>
            {report && (
              <button
                onClick={handleCopyReport}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#646cff',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  textDecoration: 'underline',
                  marginLeft: '1rem',
                }}
              >
                📋 Copy Report
              </button>
            )}
          </div>

          {showReport && report && (
            <pre style={{
              marginTop: '0.5rem',
              padding: '1rem',
              background: '#1a1a2e',
              color: '#eee',
              borderRadius: '6px',
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: '400px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {report}
            </pre>
          )}

          <ActionButton
            onClick={handleScan}
            disabled={disabled || (includeSeed && !seedContent)}
            isBusy={isScanning}
            busyText="Scanning..."
            actionName="Re-scan Transaction Validation"
          >
            🔄 Re-scan Transactions
          </ActionButton>
        </>
      ) : (
        <>
          <StatusBox type="clean">
            <div>
              ✅ All transactions have valid account/category configurations
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status?.totalMonths} month{status?.totalMonths !== 1 ? 's' : ''} ({status?.totalIncome} income, {status?.totalExpenses} expenses, {status?.totalAdjustments} adjustments, {status?.totalTransfers} transfers)
              </p>
            </div>
          </StatusBox>
          <ActionButton
            onClick={handleScan}
            disabled={disabled || (includeSeed && !seedContent)}
            isBusy={isScanning}
            busyText="Scanning..."
            actionName="Re-scan Transaction Validation"
          >
            🔄 Re-scan Transactions
          </ActionButton>
        </>
      )}
    </MigrationCard>
  )
}

