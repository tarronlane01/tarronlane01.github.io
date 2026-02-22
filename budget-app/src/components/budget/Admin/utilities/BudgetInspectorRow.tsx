/**
 * Budget Inspector Row
 * 
 * UI for inspecting a specific budget by ID for debugging.
 */

import { useState } from 'react'
import { Spinner } from '../MigrationComponents'
import type { BudgetInspectorResult } from '@hooks/migrations/useBudgetInspector'

interface BudgetInspectorRowProps {
  isInspecting: boolean
  result: BudgetInspectorResult | null
  error: string | null
  onInspect: (budgetId: string) => Promise<BudgetInspectorResult | null>
  onDownload: () => void
  onClear: () => void
  disabled?: boolean
}

export function BudgetInspectorRow({
  isInspecting,
  result,
  error,
  onInspect,
  onDownload,
  onClear,
  disabled,
}: BudgetInspectorRowProps) {
  const [budgetId, setBudgetId] = useState('')

  const handleInspect = async () => {
    if (budgetId.trim()) {
      await onInspect(budgetId.trim())
    }
  }

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      padding: '0.75rem 1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>🔍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>Budget Inspector</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Inspect a specific budget by ID for debugging</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.85rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            value={budgetId}
            onChange={(e) => setBudgetId(e.target.value)}
            placeholder="Enter budget ID..."
            disabled={disabled || isInspecting}
            style={{
              flex: 1,
              padding: '0.4rem 0.6rem',
              borderRadius: '4px',
              border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
              background: 'color-mix(in srgb, currentColor 5%, transparent)',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              color: 'inherit',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isInspecting && budgetId.trim()) {
                handleInspect()
              }
            }}
          />
          <button
            onClick={handleInspect}
            disabled={disabled || isInspecting || !budgetId.trim()}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              border: 'none',
              background: 'var(--color-primary)',
              color: 'white',
              fontSize: '0.8rem',
              cursor: disabled || isInspecting || !budgetId.trim() ? 'not-allowed' : 'pointer',
              opacity: disabled || isInspecting || !budgetId.trim() ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {isInspecting ? <><Spinner noMargin /> Inspecting...</> : 'Inspect'}
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.5rem',
            borderRadius: '4px',
            background: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
            color: 'var(--color-error)',
            fontSize: '0.75rem',
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            padding: '0.75rem',
            borderRadius: '4px',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            fontSize: '0.75rem',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {result.exists ? '✅ Budget Found' : '❌ Budget Not Found'}
            </div>

            {result.exists && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ opacity: 0.6 }}>Name:</span>
                  <span>{result.rawData?.name || '(no name)'}</span>
                  <span style={{ opacity: 0.6 }}>Accounts:</span>
                  <span>{result.analysis.accountCount}</span>
                  <span style={{ opacity: 0.6 }}>Categories:</span>
                  <span>{result.analysis.categoryCount}</span>
                  <span style={{ opacity: 0.6 }}>Month Map:</span>
                  <span>{result.analysis.hasMonthMap ? `${result.analysis.monthMapKeys.length} months` : '❌ Missing'}</span>
                  <span style={{ opacity: 0.6 }}>Month Docs:</span>
                  <span>{result.monthDocuments.filter(m => m.exists).length} / {result.monthDocuments.length}</span>
                </div>

                {result.issues.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '0.25rem' }}>
                      ⚠️ Issues ({result.issues.length}):
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-warning)' }}>
                      {result.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.recommendations.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-info)', marginBottom: '0.25rem' }}>
                      💡 Recommendations:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', opacity: 0.8 }}>
                      {result.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    onClick={onDownload}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'var(--color-success)',
                      color: 'white',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                    }}
                  >
                    Download Full Report
                  </button>
                  <button
                    onClick={onClear}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      opacity: 0.7,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </>
            )}

            {!result.exists && (
              <div style={{ opacity: 0.8 }}>
                The budget document does not exist in Firestore. It may have been deleted or the ID is incorrect.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
