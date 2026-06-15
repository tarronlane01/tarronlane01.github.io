import { useNavigate } from 'react-router-dom'
import { getMatchingItems, getMatchingTasks } from '@packing/data'
import type { PackingDocument, Trip } from '@packing/data/types'

interface TripCardProps {
  tripId: string
  trip: Trip
  packing: PackingDocument
  onEdit: () => void
}

export function TripCard({ tripId, trip, packing, onEdit }: TripCardProps) {
  const navigate = useNavigate()
  const matchingItems = getMatchingItems(packing.items, trip)
  const matchingTasks = getMatchingTasks(packing.tasks)

  // Permanently skipped items excluded from total; temp skipped count as done
  const itemEntries = Object.entries(matchingItems)
  const permSkippedItemCount = itemEntries.filter(([id, item]) => {
    if (item.personIds.length > 0) {
      return item.personIds.every(pId => trip.permanentlySkippedPerPerson?.[id]?.[pId])
    }
    return trip.permanentlySkipped?.[id]
  }).length
  const totalItems = itemEntries.length - permSkippedItemCount

  const packedCount = itemEntries.filter(([id, item]) => {
    if (item.personIds.length > 0) {
      return item.personIds.every(pId =>
        trip.packedPerPerson?.[id]?.[pId] || trip.skippedPerPerson?.[id]?.[pId] || trip.permanentlySkippedPerPerson?.[id]?.[pId]
      )
    }
    return trip.packed[id] || trip.skipped[id] || trip.permanentlySkipped?.[id]
  }).length - permSkippedItemCount

  const taskIds = Object.keys(matchingTasks)
  const permSkippedTaskCount = taskIds.filter(id => trip.tasksPermanentlySkipped?.[id]).length
  const totalTasks = taskIds.length - permSkippedTaskCount
  const completedTasks = taskIds.filter(id =>
    trip.tasksCompleted[id] || trip.tasksSkipped?.[id] || trip.tasksPermanentlySkipped?.[id]
  ).length - permSkippedTaskCount

  const featureNames = trip.featureIds.map(fId => packing.features[fId]?.name).filter(Boolean)

  return (
    <div
      onClick={() => navigate(`/packing/trip/${tripId}`)}
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: '0.5rem',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{trip.name}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0.375rem', fontSize: '1.1rem' }}
        >
          ✏️
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {featureNames.map(name => (
          <span key={name} style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.75rem', background: 'var(--bg-secondary)' }}>
            {name}
          </span>
        ))}
      </div>

      <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
        Items: {packedCount}/{totalItems}
        {totalTasks > 0 && <> &middot; Tasks: {completedTasks}/{totalTasks}</>}
      </div>
    </div>
  )
}
