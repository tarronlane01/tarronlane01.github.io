import { useState, useRef } from 'react'
import { Checkbox, CollapsibleSection } from '@components/ui'
import { usePackingActions } from '@packing/data/mutations/packing'
import type { PackingDocument } from '@packing/data/types'
import type { ItemPhaseGroup, TripItemEntry, PhaseGroup, TripTaskEntry } from '@packing/hooks'

interface PackingChecklistProps {
  tripId: string
  packing: PackingDocument
  itemPhases: ItemPhaseGroup[]
  taskPhases: PhaseGroup[]
  skippedItems: TripItemEntry[]
  onEditItem?: (id: string) => void
  onEditTask?: (id: string) => void
}

export function PackingChecklist({
  tripId, packing, itemPhases, taskPhases, skippedItems, onEditItem, onEditTask,
}: PackingChecklistProps) {
  const actions = usePackingActions()

  // Merge item phases and task phases by phaseId
  const allPhaseIds = new Set([
    ...itemPhases.map(p => p.phaseId),
    ...taskPhases.map(p => p.phaseId),
  ])

  const mergedPhases = [...allPhaseIds].map(phaseId => {
    const itemPhase = itemPhases.find(p => p.phaseId === phaseId)
    const taskPhase = taskPhases.find(p => p.phaseId === phaseId)
    const sortOrder = itemPhase?.sortOrder ?? taskPhase?.sortOrder ?? Infinity
    const name = itemPhase?.phaseName ?? taskPhase?.phaseName ?? 'Unassigned'
    const allDone = (itemPhase?.allDone ?? true) && (taskPhase?.allDone ?? true)
    return { phaseId, name, sortOrder, itemGroups: itemPhase?.groups ?? [], taskGroups: taskPhase ? [taskPhase] : [], allDone }
  }).sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div>
      {mergedPhases.map(phase => (
        <CollapsibleSection
          key={phase.phaseId}
          title={`${phase.name}${phase.allDone ? ' ✓' : ''}`}
          defaultExpanded
        >
          {phase.itemGroups.map(group => (
            <div key={group.categoryId} style={{ marginBottom: '1rem' }}>
              <h5 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem', opacity: 0.6 }}>
                {group.categoryName}{group.allDone ? ' ✓' : ''}
              </h5>
              {group.items.map(entry => (
                <ChecklistItemRow key={entry.id} tripId={tripId} entry={entry} packing={packing} actions={actions} onEdit={onEditItem} />
              ))}
            </div>
          ))}
          {phase.taskGroups.map(group => (
            <div key={group.phaseId} style={{ marginBottom: '1rem' }}>
              <h5 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem', opacity: 0.6, fontStyle: 'italic' }}>
                Tasks{group.allDone ? ' ✓' : ''}
              </h5>
              {group.tasks.map(entry => (
                <ChecklistTaskRow key={entry.id} tripId={tripId} entry={entry} actions={actions} onEdit={onEditTask} />
              ))}
            </div>
          ))}
        </CollapsibleSection>
      ))}

      {skippedItems.length > 0 && (
        <SkippedSection tripId={tripId} skippedItems={skippedItems} packing={packing} actions={actions} />
      )}
    </div>
  )
}

// --- Item Row ---

function ChecklistItemRow({ tripId, entry, packing, actions, onEdit }: {
  tripId: string
  entry: TripItemEntry
  packing: PackingDocument
  actions: ReturnType<typeof usePackingActions>
  onEdit?: (id: string) => void
}) {
  const qtyLabel = entry.quantity > 1 ? ` (x${entry.quantity})` : ''

  if (entry.item.perPerson && entry.relevantPersonIds.length > 0) {
    return (
      <div style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{ fontWeight: 500, cursor: onEdit ? 'pointer' : undefined }}
            onClick={onEdit ? () => onEdit(entry.id) : undefined}
          >
            {entry.item.name}
            {qtyLabel && <span style={{ opacity: 0.6, fontWeight: 400 }}>{qtyLabel}</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <QuantityEditor tripId={tripId} itemId={entry.id} quantity={entry.quantity} actions={actions} />
            <SkipButton onClick={() => actions.toggleSkipped(tripId, entry.id, true)} />
          </div>
        </div>
        <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
          {entry.relevantPersonIds.map(pId => {
            const personName = packing.persons[pId]?.name ?? pId
            const isPacked = entry.perPersonPacked[pId]
            const isSkipped = entry.perPersonSkipped[pId]
            return (
              <div key={pId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', minHeight: '2.25rem' }}>
                <Checkbox
                  checked={isPacked}
                  disabled={isSkipped}
                  onChange={() => actions.togglePackedPerPerson(tripId, entry.id, pId, !isPacked)}
                >
                  <span style={{ opacity: isPacked || isSkipped ? 0.5 : 1, textDecoration: isPacked ? 'line-through' : 'none', fontSize: '0.9rem' }}>
                    {personName}
                  </span>
                </Checkbox>
                {!isSkipped && (
                  <button onClick={() => actions.toggleSkippedPerPerson(tripId, entry.id, pId, true)}
                    style={skipActionStyle}>skip</button>
                )}
                {isSkipped && (
                  <button onClick={() => actions.toggleSkippedPerPerson(tripId, entry.id, pId, false)}
                    style={skipActionStyle}>unskip</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)', minHeight: '2.75rem' }}>
      <Checkbox
        checked={entry.isPacked}
        onChange={() => actions.togglePacked(tripId, entry.id, !entry.isPacked)}
        labelStyle={{ flex: 'none' }}
      />
      <span
        style={{ flex: 1, minWidth: 0, opacity: entry.isPacked ? 0.5 : 1, textDecoration: entry.isPacked ? 'line-through' : 'none', cursor: onEdit ? 'pointer' : undefined }}
        onClick={onEdit ? () => onEdit(entry.id) : undefined}
      >
        {entry.item.name}
        {qtyLabel && <span style={{ opacity: 0.6 }}>{qtyLabel}</span>}
      </span>
      <QuantityEditor tripId={tripId} itemId={entry.id} quantity={entry.quantity} actions={actions} />
      <SkipButton onClick={() => actions.toggleSkipped(tripId, entry.id, true)} />
    </div>
  )
}

// --- Task Row ---

function ChecklistTaskRow({ tripId, entry, actions, onEdit }: {
  tripId: string
  entry: TripTaskEntry
  actions: ReturnType<typeof usePackingActions>
  onEdit?: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)', minHeight: '2.75rem' }}>
      <Checkbox
        checked={entry.isCompleted}
        onChange={() => actions.toggleTaskCompleted(tripId, entry.id, !entry.isCompleted)}
        labelStyle={{ flex: 'none' }}
      />
      <span
        style={{ flex: 1, minWidth: 0, opacity: entry.isCompleted ? 0.5 : 1, textDecoration: entry.isCompleted ? 'line-through' : 'none', cursor: onEdit ? 'pointer' : undefined }}
        onClick={onEdit ? () => onEdit(entry.id) : undefined}
      >
        {entry.task.name}
      </span>
    </div>
  )
}

// --- Skipped Section ---

function SkippedSection({ tripId, skippedItems, packing, actions }: {
  tripId: string
  skippedItems: TripItemEntry[]
  packing: PackingDocument
  actions: ReturnType<typeof usePackingActions>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ marginTop: '2rem' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.85rem', padding: 0 }}
      >
        {expanded ? '▼' : '▶'} Skipped ({skippedItems.length})
      </button>
      {expanded && (
        <div style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
          {skippedItems.map(entry => (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', minHeight: '2.5rem', opacity: 0.6 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{entry.item.name}</span>
              {entry.item.perPerson ? (
                entry.relevantPersonIds.map(pId => (
                  <button key={pId} onClick={() => actions.toggleSkippedPerPerson(tripId, entry.id, pId, false)}
                    style={skipActionStyle}>
                    unskip {packing.persons[pId]?.name}
                  </button>
                ))
              ) : (
                <button onClick={() => actions.toggleSkipped(tripId, entry.id, false)}
                  style={skipActionStyle}>unskip</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuantityEditor({ tripId, itemId, quantity, actions }: {
  tripId: string
  itemId: string
  quantity: number
  actions: ReturnType<typeof usePackingActions>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    if (draft === null) return
    const parsed = parseInt(draft, 10)
    if (!isNaN(parsed) && parsed >= 1) {
      actions.setQuantity(tripId, itemId, parsed)
    }
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <input
        ref={(el) => { if (el) { inputRef.current = el; el.select() } }}
        type="number"
        min={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setDraft(null) }}
        style={{ width: '3rem', textAlign: 'center', fontSize: '0.8rem', padding: '0.2rem', border: '1px solid var(--border-subtle)', borderRadius: '0.25rem' }}
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setDraft(String(quantity)) }}
      title="Set quantity"
      style={{ ...skipActionStyle, flexShrink: 0, opacity: quantity > 1 ? 0.7 : 0.3, fontSize: '0.75rem' }}
    >
      x{quantity}
    </button>
  )
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{ ...skipActionStyle, flexShrink: 0 }}
    >
      skip
    </button>
  )
}

const skipActionStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  opacity: 0.4, fontSize: '0.8rem', padding: '0.375rem 0.5rem',
}
