import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import type { PackingDocument } from '@packing/data/types'
import type { FirestoreData } from '@firestore'

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
  }
}
