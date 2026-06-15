import { useEffect, useState } from 'react'
import { Button } from '@components/ui'
import { usePacking } from '@packing/contexts'
import { usePackingQuery } from '@packing/data/queries'
import { useTripMutations } from '@packing/data/mutations/trips'
import { createPackingDocument } from '@packing/data/mutations/writePackingData'
import { createFeedbackDocument } from '@packing/data/mutations/feedback'
import { createEmptyPackingDocument } from '@packing/data/types'
import { TripCard, TripModal } from '@packing/components/trips'
import type { Trip } from '@packing/data/types'

export default function Trips() {
  const { setPageTitle, isAdmin, currentUserId } = usePacking()
  const { data: packing, isFetched } = usePackingQuery()
  const { addTrip, updateTrip } = useTripMutations()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTrip, setEditingTrip] = useState<{ id: string; trip: Trip } | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => { setPageTitle('Trips') }, [setPageTitle])

  // Document doesn't exist yet — show setup
  if (isFetched && !packing) {
    return (
      <div>
        <p style={{ opacity: 0.6, marginBottom: '1rem' }}>
          No packing data found. {isAdmin ? 'Create the initial document to get started.' : 'Ask an admin to set up the packing app.'}
        </p>
        {isAdmin && (
          <Button
            variant="primary"
            disabled={isCreating}
            onClick={async () => {
              setIsCreating(true)
              try {
                const userIds = currentUserId ? [currentUserId] : []
                await createPackingDocument(createEmptyPackingDocument(userIds))
                await createFeedbackDocument(userIds)
              } catch {
                setIsCreating(false)
              }
            }}
          >
            {isCreating ? 'Creating...' : 'Create Packing Document'}
          </Button>
        )}
      </div>
    )
  }

  if (!packing) return <p style={{ opacity: 0.6 }}>Loading...</p>

  const sortedFeatures = Object.entries(packing.features)
    .map(([id, f]) => ({ id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const tripNames = Object.values(packing.trips).map(t => t.name)
  const tripEntries = Object.entries(packing.trips).sort(([, a], [, b]) => a.name.localeCompare(b.name))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Button variant="small" onClick={() => setShowAddModal(true)}>+ Add Trip</Button>
      </div>

      {tripEntries.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No trips yet. Create your first trip to get started.</p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {tripEntries.map(([id, trip]) => (
          <TripCard key={id} tripId={id} trip={trip} packing={packing} onEdit={() => setEditingTrip({ id, trip })} />
        ))}
      </div>

      {showAddModal && (
        <TripModal
          mode="add"
          existingNames={tripNames}
          features={sortedFeatures}
          onSave={(name, featureIds) => addTrip(name, featureIds)}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingTrip && (
        <TripModal
          mode="edit"
          initialName={editingTrip.trip.name}
          initialFeatureIds={editingTrip.trip.featureIds}
          existingNames={tripNames}
          features={sortedFeatures}
          onSave={(name, featureIds) => updateTrip(editingTrip.id, name, featureIds)}
          onClose={() => setEditingTrip(null)}
        />
      )}
    </div>
  )
}
