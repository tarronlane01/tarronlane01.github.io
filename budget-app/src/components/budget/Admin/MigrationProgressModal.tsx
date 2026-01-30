/**
 * Migration Progress Modal
 *
 * This modal is automatically shown when any migration runs.
 * It CANNOT be dismissed while a migration is in progress.
 *
 * This is a key part of enforcing that all migrations show progress:
 * - The modal opens automatically via MigrationProgressProvider
 * - Close button is disabled while running
 * - Users can see exactly what's happening at all times
 */

import { useMigrationProgress } from '@hooks/migrations/migrationProgress'
import { Spinner } from './MigrationComponents'

export function MigrationProgressModal() {
  const { state, closeModal } = useMigrationProgress()

  if (!state.isOpen) return null

  const canClose = state.isComplete

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1002,
        padding: '1rem',
      }}
      onClick={canClose ? closeModal : undefined}
    >
      <div
        style={{
          background: 'var(--surface-base)',
          color: 'var(--text-primary)',
          borderRadius: '16px',
          padding: '2rem',
          width: '32rem',
          maxWidth: 'calc(100vw - 2rem)',
          boxShadow: '0 8px 32px var(--shadow-overlay)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!state.isComplete && <Spinner noMargin />}
            {state.migrationName}
          </h2>
          {canClose && (
            <button
              onClick={closeModal}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '1.5rem',
                opacity: 0.6,
                lineHeight: 1,
                padding: '0.25rem',
              }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Current Stage */}
        <div style={{
          fontSize: '1rem',
          fontWeight: 500,
          marginBottom: '1rem',
          color: state.error ? 'var(--color-error)' : state.isComplete ? 'var(--color-success)' : 'inherit',
        }}>
          {state.error ? '❌ ' : state.isComplete ? '✅ ' : ''}
          {state.stage}
        </div>

        {/* Progress Bar */}
        <div style={{
          background: 'var(--border-subtle)',
          borderRadius: '8px',
          height: '12px',
          overflow: 'hidden',
          marginBottom: '1rem',
        }}>
          {state.progress !== null ? (
            <div
              style={{
                background: state.error ? 'var(--color-error)' : state.isComplete ? 'var(--color-success)' : 'var(--color-primary)',
                height: '100%',
                width: `${state.progress}%`,
                transition: 'width 0.3s ease-out',
                borderRadius: '8px',
              }}
            />
          ) : (
            // Indeterminate progress animation
            <div
              style={{
                background: state.error ? 'var(--color-error)' : 'var(--color-primary)',
                height: '100%',
                width: '30%',
                borderRadius: '8px',
                animation: 'progressIndeterminate 1.5s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Current Item */}
        {state.currentItem && (
          <div style={{
            fontSize: '0.9rem',
            opacity: 0.8,
            marginBottom: '0.5rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {state.currentItem}
          </div>
        )}

        {/* Details */}
        {state.details && (
          <div style={{
            fontSize: '0.85rem',
            opacity: 0.6,
            marginBottom: state.error ? '1rem' : 0,
          }}>
            {state.details}
          </div>
        )}

        {/* Error Message */}
        {state.error && (
          <div style={{
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            color: 'var(--color-error)',
          }}>
            {state.error}
          </div>
        )}

        {/* Close Button (only when complete) */}
        {state.isComplete && (
          <button
            onClick={closeModal}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              background: state.error ? 'var(--color-error-bg)' : 'var(--color-primary)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '1rem',
            }}
          >
            {state.error ? 'Close' : 'Done'}
          </button>
        )}

        {/* Running indicator */}
        {!state.isComplete && (
          <div style={{
            marginTop: '1rem',
            fontSize: '0.85rem',
            opacity: 0.5,
            textAlign: 'center',
          }}>
            Please wait — do not close this window
          </div>
        )}

        {/* Animation keyframes */}
        <style>
          {`
            @keyframes progressIndeterminate {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}
        </style>
      </div>
    </div>
  )
}

