import { useState, useRef } from 'react'
import { Checkbox, CollapsibleSection, Modal, Button } from '@components/ui'
import { usePackingActions } from '@packing/data/mutations/packing'
import type { PackingDocument } from '@packing/data/types'
import type { ItemPhaseGroup, TripItemEntry, PhaseGroup, TripTaskEntry } from '@packing/hooks'

interface SkipConfirmation {
  kind: 'item' | 'task'
  targetId: string
  personId?: string
  name: string
  personName?: string
}

interface PackingChecklistProps {
  tripId: string
  packing: PackingDocument
  itemPhases: ItemPhaseGroup[]
  taskPhases: PhaseGroup[]
  skippedItems: TripItemEntry[]
  skippedTasks: TripTaskEntry[]
  searchQuery?: string
  onEditItem?: (id: string) => void
  onEditTask?: (id: string) => void
}

export function PackingChecklist({
  tripId, packing, itemPhases, taskPhases, skippedItems, skippedTasks, searchQuery, onEditItem, onEditTask,
}: PackingChecklistProps) {
  const actions = usePackingActions()
  const [skipConfirm, setSkipConfirm] = useState<SkipConfirmation | null>(null)

  const handleSkipConfirm = (type: 'session' | 'always') => {
    if (!skipConfirm) return
    const { kind, targetId, personId } = skipConfirm
    if (kind === 'task') {
      if (type === 'session') actions.toggleTaskSkipped(tripId, targetId, true)
      else actions.toggleTaskPermanentlySkipped(tripId, targetId, true)
    } else if (type === 'session') {
      if (personId) actions.toggleSkippedPerPerson(tripId, targetId, personId, true)
      else actions.toggleSkipped(tripId, targetId, true)
    } else {
      if (personId) actions.togglePermanentlySkippedPerPerson(tripId, targetId, personId, true)
      else actions.togglePermanentlySkipped(tripId, targetId, true)
    }
    setSkipConfirm(null)
  }

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

  const q = searchQuery?.toLowerCase() ?? ''
  const displayPhases = searchQuery ? mergedPhases.map(phase => ({
    ...phase,
    itemGroups: phase.itemGroups
      .map(g => ({ ...g, items: g.items.filter(e => e.item.name.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0),
    taskGroups: phase.taskGroups
      .map(g => ({ ...g, tasks: g.tasks.filter(e => e.task.name.toLowerCase().includes(q)) }))
      .filter(g => g.tasks.length > 0),
  })).filter(p => p.itemGroups.length > 0 || p.taskGroups.length > 0) : mergedPhases

  const partiallySkipped: TripItemEntry[] = []
  for (const phase of mergedPhases) {
    for (const group of phase.itemGroups) {
      for (const entry of group.items) {
        if (entry.relevantPersonIds.length === 0) continue
        const skippedPersonIds = entry.relevantPersonIds.filter(pId => entry.perPersonSkipped[pId])
        if (skippedPersonIds.length > 0 && skippedPersonIds.length < entry.relevantPersonIds.length) {
          partiallySkipped.push(entry)
        }
      }
    }
  }

  const allSkipped = [...skippedItems, ...partiallySkipped]
  const filteredSkippedItems = searchQuery
    ? allSkipped.filter(e => e.item.name.toLowerCase().includes(q))
    : allSkipped
  const filteredSkippedTasks = searchQuery
    ? skippedTasks.filter(e => e.task.name.toLowerCase().includes(q))
    : skippedTasks
  const hasSkipped = filteredSkippedItems.length > 0 || filteredSkippedTasks.length > 0

  return (
    <div>
      {displayPhases.map(phase => (
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
                <ChecklistItemRow key={entry.id} tripId={tripId} entry={entry} packing={packing} actions={actions} onEdit={onEditItem} onSkip={setSkipConfirm} />
              ))}
            </div>
          ))}
          {phase.taskGroups.map(group => (
            <div key={group.phaseId} style={{ marginBottom: '1rem' }}>
              <h5 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem', opacity: 0.6, fontStyle: 'italic' }}>
                Tasks{group.allDone ? ' ✓' : ''}
              </h5>
              {group.tasks.map(entry => (
                <ChecklistTaskRow key={entry.id} tripId={tripId} entry={entry} actions={actions} onEdit={onEditTask} onSkip={setSkipConfirm} />
              ))}
            </div>
          ))}
        </CollapsibleSection>
      ))}

      {hasSkipped && (
        <SkippedSection
          tripId={tripId}
          skippedItems={filteredSkippedItems}
          skippedTasks={filteredSkippedTasks}
          packing={packing}
          actions={actions}
          forceExpanded={!!searchQuery && hasSkipped}
        />
      )}

      <Modal isOpen={!!skipConfirm} onClose={() => setSkipConfirm(null)} title={`Skip ${skipConfirm?.kind === 'task' ? 'Task' : 'Item'}`} width="22rem">
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.95rem' }}>
          Skip <strong>{skipConfirm?.name}</strong>
          {skipConfirm?.personName && <> for <strong>{skipConfirm.personName}</strong></>}?
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setSkipConfirm(null)}>Cancel</Button>
          <Button variant="secondary" onClick={() => handleSkipConfirm('session')}>Skip this time</Button>
          <Button variant="primary" onClick={() => handleSkipConfirm('always')}>Always skip</Button>
        </div>
      </Modal>
    </div>
  )
}

function ChecklistItemRow({ tripId, entry, packing, actions, onEdit, onSkip }: {
  tripId: string; entry: TripItemEntry; packing: PackingDocument
  actions: ReturnType<typeof usePackingActions>
  onEdit?: (id: string) => void; onSkip: (c: SkipConfirmation) => void
}) {
  const qtyLabel = entry.quantity > 1 ? ` (x${entry.quantity})` : ''
  const activePersonIds = entry.relevantPersonIds.filter(pId => !entry.perPersonSkipped[pId])

  if (entry.relevantPersonIds.length > 0 && activePersonIds.length > 0) {
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
            <button onClick={(e) => { e.stopPropagation(); onSkip({ kind: 'item', targetId: entry.id, name: entry.item.name }) }} style={skipBtnStyle}>skip</button>
          </div>
        </div>
        <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
          {activePersonIds.map(pId => {
            const personName = packing.persons[pId]?.name ?? pId
            const isPacked = entry.perPersonPacked[pId]
            return (
              <div key={pId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', minHeight: '2.25rem' }}>
                <Checkbox
                  checked={isPacked}
                  onChange={() => actions.togglePackedPerPerson(tripId, entry.id, pId, !isPacked)}
                >
                  <span style={{ opacity: isPacked ? 0.5 : 1, textDecoration: isPacked ? 'line-through' : 'none', fontSize: '0.9rem' }}>
                    {personName}
                  </span>
                </Checkbox>
                <button onClick={() => onSkip({ kind: 'item', targetId: entry.id, personId: pId, name: entry.item.name, personName })}
                  style={skipActionStyle}>skip</button>
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
      <button onClick={(e) => { e.stopPropagation(); onSkip({ kind: 'item', targetId: entry.id, name: entry.item.name }) }} style={skipBtnStyle}>skip</button>
    </div>
  )
}

function ChecklistTaskRow({ tripId, entry, actions, onEdit, onSkip }: {
  tripId: string; entry: TripTaskEntry
  actions: ReturnType<typeof usePackingActions>
  onEdit?: (id: string) => void; onSkip: (c: SkipConfirmation) => void
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
      <button onClick={(e) => { e.stopPropagation(); onSkip({ kind: 'task', targetId: entry.id, name: entry.task.name }) }} style={skipBtnStyle}>skip</button>
    </div>
  )
}

function SkippedSection({ tripId, skippedItems, skippedTasks, packing, actions, forceExpanded }: {
  tripId: string; skippedItems: TripItemEntry[]; skippedTasks: TripTaskEntry[]
  packing: PackingDocument; actions: ReturnType<typeof usePackingActions>; forceExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = forceExpanded || expanded
  const totalCount = skippedItems.length + skippedTasks.length

  const wholeItemSession = skippedItems.filter(e => e.relevantPersonIds.length === 0 && !e.isPermanentlySkipped)
  const wholeItemPermanent = skippedItems.filter(e => e.relevantPersonIds.length === 0 && e.isPermanentlySkipped)
  const perPersonEntries = skippedItems.filter(e => e.relevantPersonIds.length > 0)
  const sessionPerPerson: { entry: TripItemEntry; personIds: string[] }[] = []
  const permanentPerPerson: { entry: TripItemEntry; personIds: string[] }[] = []
  for (const entry of perPersonEntries) {
    const sessionPIds = entry.relevantPersonIds.filter(pId => entry.perPersonSkipped[pId] && !entry.perPersonPermanentlySkipped[pId])
    const permPIds = entry.relevantPersonIds.filter(pId => entry.perPersonPermanentlySkipped[pId])
    if (sessionPIds.length > 0) sessionPerPerson.push({ entry, personIds: sessionPIds })
    if (permPIds.length > 0) permanentPerPerson.push({ entry, personIds: permPIds })
  }

  const sessionTasks = skippedTasks.filter(e => !e.isPermanentlySkipped)
  const permanentTasks = skippedTasks.filter(e => e.isPermanentlySkipped)

  const hasSession = wholeItemSession.length > 0 || sessionPerPerson.length > 0 || sessionTasks.length > 0
  const hasPermanent = wholeItemPermanent.length > 0 || permanentPerPerson.length > 0 || permanentTasks.length > 0

  return (
    <div style={{ marginTop: '2rem' }}>
      <button
        onClick={() => setExpanded(!isOpen)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '0.85rem', padding: 0 }}
      >
        {isOpen ? '▼' : '▶'} Skipped ({totalCount})
      </button>
      {isOpen && (
        <div style={{ paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
          {hasSession && (
            <SkippedGroup
              label="Skipped (this session)"
              wholeItems={wholeItemSession}
              perPersonItems={sessionPerPerson}
              tasks={sessionTasks}
              packing={packing}
              unskipItem={(id) => actions.toggleSkipped(tripId, id, false)}
              unskipPerson={(id, pId) => actions.toggleSkippedPerPerson(tripId, id, pId, false)}
              unskipTask={(id) => actions.toggleTaskSkipped(tripId, id, false)}
            />
          )}
          {hasPermanent && (
            <SkippedGroup
              label="Always skipped"
              wholeItems={wholeItemPermanent}
              perPersonItems={permanentPerPerson}
              tasks={permanentTasks}
              packing={packing}
              unskipItem={(id) => actions.togglePermanentlySkipped(tripId, id, false)}
              unskipPerson={(id, pId) => actions.togglePermanentlySkippedPerPerson(tripId, id, pId, false)}
              unskipTask={(id) => actions.toggleTaskPermanentlySkipped(tripId, id, false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SkippedGroup({ label, wholeItems, perPersonItems, tasks, packing, unskipItem, unskipPerson, unskipTask }: {
  label: string; wholeItems: TripItemEntry[]; tasks: TripTaskEntry[]
  perPersonItems: { entry: TripItemEntry; personIds: string[] }[]; packing: PackingDocument
  unskipItem: (id: string) => void; unskipPerson: (id: string, pId: string) => void
  unskipTask: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <h6 style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.7rem', opacity: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</h6>
      <div style={{ paddingLeft: '0.75rem' }}>
        {perPersonItems.map(({ entry, personIds }) => (
          <div key={entry.id} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--border-subtle)', opacity: 0.6 }}>
            <span style={{ fontWeight: 500 }}>{entry.item.name}</span>
            <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
              {personIds.map(pId => (
                <div key={pId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', minHeight: '2.25rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>{packing.persons[pId]?.name ?? pId}</span>
                  <button onClick={() => unskipPerson(entry.id, pId)} style={skipActionStyle}>unskip</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {wholeItems.map(entry => (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', minHeight: '2.5rem', opacity: 0.6 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{entry.item.name}</span>
            <button onClick={() => unskipItem(entry.id)} style={skipActionStyle}>unskip</button>
          </div>
        ))}
        {tasks.map(entry => (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', minHeight: '2.5rem', opacity: 0.6 }}>
            <span style={{ flex: 1, minWidth: 0, fontStyle: 'italic' }}>{entry.task.name}</span>
            <button onClick={() => unskipTask(entry.id)} style={skipActionStyle}>unskip</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuantityEditor({ tripId, itemId, quantity, actions }: {
  tripId: string; itemId: string; quantity: number; actions: ReturnType<typeof usePackingActions>
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

const skipBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  opacity: 0.4, fontSize: '0.8rem', padding: '0.375rem 0.5rem', flexShrink: 0,
}

const skipActionStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  opacity: 0.4, fontSize: '0.8rem', padding: '0.375rem 0.5rem',
}
