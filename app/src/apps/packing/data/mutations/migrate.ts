import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'
import type { PackingDocument } from '@packing/data/types'
import type { FirestoreData } from '@firestore'

interface LegacyItem {
  name: string
  categoryId: string
  featureIds: string[]
  personIds: string[]
  perPerson?: boolean
  phaseId?: string
}

interface LegacySection {
  name: string
  sortOrder: number
}

interface LegacyCategory {
  name: string
  sectionId?: string
  sortOrder?: number
}

interface LegacyPhase {
  name: string
  sectionId?: string
  sortOrder: number
}

export function usePackingMigrations() {
  const mutation = usePackingMutation()

  return {
    migrateSectionsToPhases: (packing: PackingDocument) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = packing as any
      const sections: Record<string, LegacySection> = raw.sections ?? {}
      const categories: Record<string, LegacyCategory> = raw.categories ?? {}
      const phases: Record<string, LegacyPhase> = raw.phases ?? {}

      const updates: FirestoreData = {}

      // 1. Build section → phase ID map; create a phase for each section
      const sectionToPhase: Record<string, string> = {}
      for (const [secId, sec] of Object.entries(sections)) {
        if (!sec) continue
        const phaseId = secId.replace(/^sec_/, 'pha_')
        sectionToPhase[secId] = phaseId
        // Only create if not already present
        if (!phases[phaseId]) {
          updates[`phases.${phaseId}`] = { name: sec.name, sortOrder: sec.sortOrder }
        }
      }

      // 2. For each category: find its sectionId, map to phaseId, set phaseId on items
      for (const [catId, cat] of Object.entries(categories)) {
        if (!cat) continue
        const mappedPhaseId = cat.sectionId ? sectionToPhase[cat.sectionId] : undefined

        if (mappedPhaseId) {
          // Set phaseId on all items using this category
          for (const [itemId, item] of Object.entries(packing.items)) {
            if (item.categoryId === catId && !item.phaseId) {
              updates[`items.${itemId}.phaseId`] = mappedPhaseId
            }
          }
        }

        // Simplify category: remove sectionId and sortOrder
        if (cat.sectionId !== undefined) updates[`categories.${catId}.sectionId`] = deleteField()
        if (cat.sortOrder !== undefined) updates[`categories.${catId}.sortOrder`] = deleteField()
      }

      // 3. For each existing phase: remove sectionId if present
      for (const [phaseId, phase] of Object.entries(phases)) {
        if (!phase) continue
        if (phase.sectionId !== undefined) {
          updates[`phases.${phaseId}.sectionId`] = deleteField()
        }
      }

      // 4. Delete all sections
      for (const secId of Object.keys(sections)) {
        updates[`sections.${secId}`] = deleteField()
      }
      // Also delete the sections field itself if it exists
      updates['sections'] = deleteField()

      if (Object.keys(updates).length === 0) return

      mutation.mutate({
        updates,
        description: 'migrating sections to phases',
        optimisticUpdate: (prev) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = { ...prev } as any
          delete result.sections

          // Add new phases
          const newPhases = { ...result.phases }
          for (const [secId, sec] of Object.entries(sections)) {
            if (!sec) continue
            const phaseId = secId.replace(/^sec_/, 'pha_')
            if (!newPhases[phaseId]) {
              newPhases[phaseId] = { name: sec.name, sortOrder: sec.sortOrder }
            }
          }
          result.phases = newPhases

          // Simplify categories
          const newCats: Record<string, { name: string }> = {}
          for (const [catId, cat] of Object.entries(categories)) {
            if (!cat) continue
            newCats[catId] = { name: cat.name }
          }
          result.categories = newCats

          // Set phaseId on items
          const newItems = { ...result.items }
          for (const [itemId, item] of Object.entries(packing.items)) {
            const cat = categories[item.categoryId]
            const mappedPhaseId = cat?.sectionId ? sectionToPhase[cat.sectionId] : undefined
            if (mappedPhaseId && !item.phaseId) {
              newItems[itemId] = { ...item, phaseId: mappedPhaseId }
            }
          }
          result.items = newItems

          // Clean sectionId from existing phases
          for (const [phaseId, phase] of Object.entries(result.phases)) {
            if (phase && typeof phase === 'object' && 'sectionId' in phase) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { sectionId: _secId, ...rest } = phase as LegacyPhase
              result.phases[phaseId] = rest
            }
          }

          return result as PackingDocument
        },
      })
    },

    migratePersonsToPerPerson: (packing: PackingDocument) => {
      const items = packing.items as Record<string, LegacyItem>
      const updates: FirestoreData = {}

      // Build person name → existing feature ID map (case-insensitive)
      const featureByName: Record<string, string> = {}
      for (const [fId, feat] of Object.entries(packing.features)) {
        if (feat) featureByName[feat.name.toLowerCase()] = fId
      }

      // Track new features to create and person→feature mapping
      const personToFeature: Record<string, string> = {}
      const newFeatures: Record<string, { name: string }> = {}

      // 1. Find items with perPerson === false AND personIds.length > 0
      const affectedItemIds: string[] = []
      for (const [itemId, item] of Object.entries(items)) {
        if (item.perPerson === false && item.personIds.length > 0) {
          affectedItemIds.push(itemId)
          for (const pId of item.personIds) {
            if (personToFeature[pId]) continue
            const personName = packing.persons[pId]?.name
            if (!personName) continue
            const existing = featureByName[personName.toLowerCase()]
            if (existing) {
              personToFeature[pId] = existing
            } else {
              const newId = generateId('fea')
              personToFeature[pId] = newId
              featureByName[personName.toLowerCase()] = newId
              newFeatures[newId] = { name: personName }
            }
          }
        }
      }

      // 2. Create new features in Firestore
      for (const [feaId, feat] of Object.entries(newFeatures)) {
        updates[`features.${feaId}`] = feat
      }

      // 3. Update affected items: add feature IDs, clear personIds
      for (const itemId of affectedItemIds) {
        const item = items[itemId]
        const mappedFeatureIds = item.personIds
          .map(pId => personToFeature[pId])
          .filter(Boolean)
        const mergedFeatureIds = [...new Set([...item.featureIds, ...mappedFeatureIds])]
        updates[`items.${itemId}.featureIds`] = mergedFeatureIds
        updates[`items.${itemId}.personIds`] = []
      }

      // 4. Update trips that had these persons: add matching feature IDs
      for (const [tripId, trip] of Object.entries(packing.trips)) {
        const tripFeatureIds = [...trip.featureIds]
        let changed = false
        for (const pId of trip.personIds) {
          const feaId = personToFeature[pId]
          if (feaId && !tripFeatureIds.includes(feaId)) {
            tripFeatureIds.push(feaId)
            changed = true
          }
        }
        if (changed) {
          updates[`trips.${tripId}.featureIds`] = tripFeatureIds
        }
      }

      // 5. Delete perPerson field from ALL items
      for (const itemId of Object.keys(items)) {
        updates[`items.${itemId}.perPerson`] = deleteField()
      }

      if (Object.keys(updates).length === 0) return

      mutation.mutate({
        updates,
        description: 'migrating persons to per-person',
        optimisticUpdate: (prev) => {
          const result = { ...prev }

          // Add new features
          result.features = { ...result.features, ...newFeatures }

          // Update items
          const newItems = { ...result.items }
          for (const itemId of affectedItemIds) {
            const item = items[itemId]
            const mappedFeatureIds = item.personIds
              .map(pId => personToFeature[pId])
              .filter(Boolean)
            newItems[itemId] = {
              ...newItems[itemId],
              featureIds: [...new Set([...item.featureIds, ...mappedFeatureIds])],
              personIds: [],
            }
          }
          // Remove perPerson from all items in cache
          for (const itemId of Object.keys(newItems)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
            const { perPerson: _perPerson, ...rest } = newItems[itemId] as any
            newItems[itemId] = rest
          }
          result.items = newItems

          // Update trip featureIds
          const newTrips = { ...result.trips }
          for (const [tripId, trip] of Object.entries(packing.trips)) {
            const tripFeatureIds = [...trip.featureIds]
            let changed = false
            for (const pId of trip.personIds) {
              const feaId = personToFeature[pId]
              if (feaId && !tripFeatureIds.includes(feaId)) {
                tripFeatureIds.push(feaId)
                changed = true
              }
            }
            if (changed) {
              newTrips[tripId] = { ...newTrips[tripId], featureIds: tripFeatureIds }
            }
          }
          result.trips = newTrips

          return result
        },
      })
    },
  }
}
