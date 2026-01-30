/**
 * MyBudgets Manual Invite Section - Join budget by ID
 */

import type { FormEvent } from 'react'

interface ManualInvite {
  budgetId: string
  budgetName: string
  ownerEmail: string | null
}

interface ManualInviteSectionProps {
  budgetIdInput: string
  setBudgetIdInput: (value: string) => void
  isCheckingManual: boolean
  manualInvite: ManualInvite | null
  isAccepting: string | null
  onCheckInvite: (e: FormEvent) => void
  onAcceptInvite: () => void
  onCancel: () => void
}

export function ManualInviteSection({
  budgetIdInput,
  setBudgetIdInput,
  isCheckingManual,
  manualInvite,
  isAccepting,
  onCheckInvite,
  onAcceptInvite,
  onCancel,
}: ManualInviteSectionProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      padding: '1.25rem',
      borderRadius: '8px',
    }}>
      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>🔗</span> Join Budget by ID
      </h3>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', opacity: 0.7 }}>
        If someone shared a budget ID with you, enter it below to accept the invitation:
      </p>

      {!manualInvite ? (
        <form onSubmit={onCheckInvite} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            value={budgetIdInput}
            onChange={(e) => setBudgetIdInput(e.target.value)}
            placeholder="Enter Budget ID"
            style={{
              flex: 1,
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              background: 'color-mix(in srgb, currentColor 5%, transparent)',
              fontSize: '0.95rem',
              color: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={isCheckingManual || !budgetIdInput.trim()}
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              padding: '0.6rem 1.25rem',
              borderRadius: '6px',
              cursor: isCheckingManual || !budgetIdInput.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isCheckingManual || !budgetIdInput.trim() ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isCheckingManual ? 'Checking...' : 'Check Invite'}
          </button>
        </form>
      ) : (
        <div style={{
          background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
          padding: '1rem',
          borderRadius: '8px',
        }}>
          <p style={{ margin: '0 0 0.75rem 0', fontWeight: 500 }}>
            🎉 You've been invited to join:
          </p>
          <div style={{
            background: 'color-mix(in srgb, currentColor 8%, transparent)',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}>
            <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '1.1rem' }}>
              {manualInvite.budgetName}
            </p>
            {manualInvite.ownerEmail && (
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
                Owner: {manualInvite.ownerEmail}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onAcceptInvite}
              disabled={isAccepting === manualInvite.budgetId}
              style={{
                background: 'var(--color-success)',
                color: 'white',
                border: 'none',
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                cursor: isAccepting === manualInvite.budgetId ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isAccepting === manualInvite.budgetId ? 0.7 : 1,
              }}
            >
              {isAccepting === manualInvite.budgetId ? 'Accepting...' : 'Accept Invitation'}
            </button>
            <button
              onClick={onCancel}
              disabled={isAccepting === manualInvite.budgetId}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                cursor: isAccepting === manualInvite.budgetId ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isAccepting === manualInvite.budgetId ? 0.7 : 0.8,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface UserIdInfoProps {
  currentUserId: string
}

export function UserIdInfo({ currentUserId }: UserIdInfoProps) {
  return (
    <div style={{
      marginTop: '1.5rem',
      padding: '1rem',
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '6px',
      fontSize: '0.85rem',
      opacity: 0.7,
    }}>
      <p style={{ margin: '0 0 0.5rem 0' }}>
        💡 Share your User ID with budget owners so they can invite you:
      </p>
      <code style={{
        display: 'block',
        padding: '0.5rem 0.75rem',
        background: 'color-mix(in srgb, currentColor 8%, transparent)',
        borderRadius: '4px',
        fontSize: '0.8rem',
        wordBreak: 'break-all',
      }}>
        {currentUserId}
      </code>
    </div>
  )
}

