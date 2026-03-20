import { useState } from 'react'
import { Modal, Button } from '../../ui'
import { GroupForm, type GroupFormData } from './GroupForm'
import { AccountGroupBadge } from './AccountGroupBadge'
import type { GroupWithId } from './AccountForm'

interface EditGroupsModalProps {
  isOpen: boolean
  onClose: () => void
  groups: GroupWithId[]
  onCreateGroup: (data: GroupFormData) => void
  onUpdateGroup: (groupId: string, data: GroupFormData) => void
  onDeleteGroup: (groupId: string) => void
  onMoveGroup: (groupId: string, direction: 'up' | 'down') => void
}

export function EditGroupsModal({
  isOpen,
  onClose,
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onMoveGroup,
}: EditGroupsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Account Types" width="34rem">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {groups.length === 0 && (
          <p style={{ opacity: 0.6, textAlign: 'center', padding: '1rem 0' }}>
            No account types yet.
          </p>
        )}

        {groups.map((group, idx) => (
          <div key={group.id}>
            {editingId === group.id ? (
              <GroupForm
                initialData={{
                  name: group.name,
                  expected_balance: group.expected_balance || 'positive',
                  on_budget: group.on_budget ?? undefined,
                  badge_color: group.badge_color ?? 'grey',
                }}
                onSubmit={(data) => { onUpdateGroup(group.id, data); setEditingId(null) }}
                onCancel={() => setEditingId(null)}
                submitLabel="Save"
              />
            ) : (
              <GroupRow
                group={group}
                index={idx}
                totalGroups={groups.length}
                onEdit={() => setEditingId(group.id)}
                onDelete={() => onDeleteGroup(group.id)}
                onMoveUp={() => onMoveGroup(group.id, 'up')}
                onMoveDown={() => onMoveGroup(group.id, 'down')}
              />
            )}
          </div>
        ))}

        {showCreate ? (
          <GroupForm
            onSubmit={(data) => { onCreateGroup(data); setShowCreate(false) }}
            onCancel={() => setShowCreate(false)}
            submitLabel="Create Account Type"
          />
        ) : (
          <Button
            variant="primary-large"
            actionName="Open Add Account Type Form"
            onClick={() => setShowCreate(true)}
          >
            + Add Account Type
          </Button>
        )}
      </div>
    </Modal>
  )
}

function GroupRow({
  group,
  index,
  totalGroups,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  group: GroupWithId
  index: number
  totalGroups: number
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const canMoveUp = index > 0
  const canMoveDown = index < totalGroups - 1
  const iconBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.6,
    fontSize: '0.9rem',
    padding: '0.25rem',
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0.5rem',
      borderRadius: '6px',
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
    }}>
      <AccountGroupBadge groupName={group.name} colorKey={group.badge_color ?? 'grey'} />
      <span style={{ flex: 1, fontSize: '0.85rem', opacity: 0.6 }}>
        {group.expected_balance === 'negative' ? '(debt)' : ''}
      </span>
      <button onClick={onEdit} style={iconBtn} title="Edit">✏️</button>
      <button onClick={onDelete} style={iconBtn} title="Delete">🗑️</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          style={{ ...iconBtn, opacity: canMoveUp ? 0.6 : 0.2, cursor: canMoveUp ? 'pointer' : 'default', fontSize: '0.75rem' }}
          title="Move up"
        >▲</button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          style={{ ...iconBtn, opacity: canMoveDown ? 0.6 : 0.2, cursor: canMoveDown ? 'pointer' : 'default', fontSize: '0.75rem' }}
          title="Move down"
        >▼</button>
      </div>
    </div>
  )
}
