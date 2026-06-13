import type { PackingDocument, Task } from '@packing/data/types'

interface TaskListProps {
  packing: PackingDocument
  filterPhaseId?: string
  onEdit: (id: string, task: Task) => void
  onAdd?: (phaseId: string) => void
}

export function TaskList({ packing, filterPhaseId, onEdit, onAdd }: TaskListProps) {
  const { phases, features } = packing

  const filteredTasks = filterPhaseId
    ? Object.fromEntries(Object.entries(packing.tasks).filter(([, task]) => {
        if (filterPhaseId === '_unassigned') return !task.phaseId
        return task.phaseId === filterPhaseId
      }))
    : packing.tasks

  const sortedPhases = Object.entries(phases)
    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)

  const unphased = Object.entries(filteredTasks).filter(([, task]) => !task.phaseId || !phases[task.phaseId])
  const grouped = sortedPhases.map(([phaseId, phase]) => ({
    phaseId,
    phaseName: phase.name,
    tasks: Object.entries(filteredTasks)
      .filter(([, task]) => task.phaseId === phaseId)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name)),
  }))

  if (Object.keys(filteredTasks).length === 0) {
    const msg = filterPhaseId ? 'No tasks match this phase.' : 'No tasks yet. Add your first task.'
    return <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>{msg}</p>
  }

  return (
    <div>
      {grouped.map(({ phaseId, phaseName, tasks: phaseTasks }) => (
        phaseTasks.length > 0 && (
          <div key={phaseId} style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', opacity: 0.7 }}>{phaseName}</h4>
              {onAdd && (
                <button
                  onClick={() => onAdd(phaseId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', padding: '0.125rem 0.25rem', lineHeight: 1 }}
                  title={`Add task to ${phaseName}`}
                >
                  +
                </button>
              )}
            </div>
            {phaseTasks.map(([id, task]) => (
              <TaskRow key={id} id={id} task={task} features={features} onEdit={onEdit} />
            ))}
          </div>
        )
      ))}
      {unphased.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', opacity: 0.7 }}>No Phase</h4>
          {unphased.sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([id, task]) => (
            <TaskRow key={id} id={id} task={task} features={features} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ id, task, features, onEdit }: {
  id: string
  task: Task
  features: PackingDocument['features']
  onEdit: (id: string, task: Task) => void
}) {
  const featureTags = task.featureIds.map(fId => features[fId]?.name).filter(Boolean)

  return (
    <div
      onClick={() => onEdit(id, task)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1 }}>{task.name}</span>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {featureTags.map(tag => (
          <span key={tag} style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.75rem', background: 'var(--bg-secondary)', opacity: 0.7 }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
