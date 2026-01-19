/**
 * AccountGroupHeader - Header for account group cards
 */

import { Button, formatCurrency, getBalanceColor } from '../../ui'
import { sectionHeader, reorderButton, reorderButtonGroup } from '@styles/shared'
import { GroupOverrideFlags } from './GroupOverrideFlags'
import type { GroupWithId } from './AccountForm'
import { logUserAction } from '@utils'
import { featureFlags } from '@constants'

interface GroupHeaderProps {
  group: GroupWithId
  accountCount: number
  groupTotal: number
  canMoveUp: boolean
  canMoveDown: boolean
  isMobile: boolean
  createForGroupId: string | null
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAddAccount: () => void
}

export function GroupHeader({
  group,
  accountCount,
  groupTotal,
  canMoveUp,
  canMoveDown,
  isMobile,
  createForGroupId,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddAccount,
}: GroupHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? '0.5rem' : '0.75rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      gap: '0.5rem',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      <h3 style={{ ...sectionHeader, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '2px solid currentColor', paddingBottom: '2px' }}>
          {group.name}
        </span>
        <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem', flexShrink: 0 }}>
          ({accountCount})
        </span>
        {featureFlags.showGroupTotals && (
          <span style={{
            marginLeft: '0.5rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: getBalanceColor(groupTotal),
            flexShrink: 0,
            borderBottom: '2px solid currentColor',
            paddingBottom: '2px',
          }}>
            {formatCurrency(groupTotal)}
          </span>
        )}
        <GroupOverrideFlags group={group} />
      </h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
        {!isMobile && (
          <Button variant="small" actionName={`Open Add Account Form (${group.name})`} onClick={onAddAccount} disabled={createForGroupId !== null}>
            + Account
          </Button>
        )}
        <button onClick={() => { logUserAction('CLICK', 'Edit Account Type', { details: group.name }); onEdit() }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }} title="Edit account type">
          ✏️
        </button>
        <button onClick={() => { logUserAction('CLICK', 'Delete Account Type', { details: group.name }); onDelete() }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }} title="Delete account type">
          🗑️
        </button>
        <div style={reorderButtonGroup}>
          <button onClick={onMoveUp} disabled={!canMoveUp} style={{ ...reorderButton, opacity: canMoveUp ? 0.6 : 0.2, cursor: canMoveUp ? 'pointer' : 'default' }} title="Move up" aria-label="Move up">
            ▲
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} style={{ ...reorderButton, opacity: canMoveDown ? 0.6 : 0.2, cursor: canMoveDown ? 'pointer' : 'default' }} title="Move down" aria-label="Move down">
            ▼
          </button>
        </div>
      </div>
    </div>
  )
}

