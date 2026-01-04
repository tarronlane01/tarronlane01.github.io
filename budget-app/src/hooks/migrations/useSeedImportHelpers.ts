/** Helper functions for seed import hook - File format detection and mappings persistence. */

// eslint-disable-next-line no-restricted-imports -- Migration utility needs direct Firestore access
import { readDocByPath, writeDocByPath } from '@firestore'
import type { FirestoreData } from '@types'
import type { MappingEntry, ImportDataMap } from './seedImportTypes'

/**
 * Detect file format from content
 * - Combined format starts with "type," (header) or valid type like "income,", "spend,", "allocation,"
 * - Raw cash flow format starts with "Cash Flow" or "Date," header
 */
export function detectFileFormat(content: string): 'combined' | 'raw_cash_flow' {
  const firstLine = content.split('\n')[0]?.toLowerCase().trim() || ''

  // Check for raw cash flow format indicators
  if (firstLine.startsWith('cash flow') || firstLine.startsWith('date,')) {
    return 'raw_cash_flow'
  }

  // Check for combined format (starts with type column)
  if (firstLine.startsWith('type,') ||
      firstLine.startsWith('income,') ||
      firstLine.startsWith('spend,') ||
      firstLine.startsWith('allocation,')) {
    return 'combined'
  }

  // Default to combined if unclear
  return 'combined'
}

/** Load existing mappings from Firestore */
export async function loadExistingMappings(budgetId: string | null): Promise<{
  categoryMappings: Map<string, MappingEntry>
  accountMappings: Map<string, MappingEntry>
}> {
  if (!budgetId) return { categoryMappings: new Map(), accountMappings: new Map() }

  try {
    const { exists, data } = await readDocByPath<ImportDataMap>(
      'data_mappings',
      `${budgetId}_import_data_map`,
      'loading existing import mappings'
    )

    if (!exists || !data) {
      return { categoryMappings: new Map(), accountMappings: new Map() }
    }

    const catMap = new Map<string, MappingEntry>()
    const accMap = new Map<string, MappingEntry>()

    if (data.category_mappings) {
      for (const [oldName, mapping] of Object.entries(data.category_mappings)) {
        catMap.set(oldName, { oldName, newId: mapping.id, newName: mapping.name })
      }
    }

    if (data.account_mappings) {
      for (const [oldName, mapping] of Object.entries(data.account_mappings)) {
        accMap.set(oldName, { oldName, newId: mapping.id, newName: mapping.name })
      }
    }

    return { categoryMappings: catMap, accountMappings: accMap }
  } catch (err) {
    console.error('[useSeedImport] Failed to load existing mappings:', err)
    return { categoryMappings: new Map(), accountMappings: new Map() }
  }
}

/** Save mappings to Firestore */
export async function saveMappings(
  budgetId: string | null,
  catMappings: Map<string, MappingEntry>,
  accMappings: Map<string, MappingEntry>
): Promise<void> {
  if (!budgetId) return

  const categoryMappingsObj: Record<string, { id: string; name: string }> = {}
  const accountMappingsObj: Record<string, { id: string; name: string }> = {}

  for (const [oldName, mapping] of catMappings) {
    categoryMappingsObj[oldName] = { id: mapping.newId, name: mapping.newName }
  }

  for (const [oldName, mapping] of accMappings) {
    accountMappingsObj[oldName] = { id: mapping.newId, name: mapping.newName }
  }

  const doc: ImportDataMap = {
    category_mappings: categoryMappingsObj,
    account_mappings: accountMappingsObj,
    last_updated: new Date().toISOString(),
  }

  await writeDocByPath(
    'data_mappings',
    `${budgetId}_import_data_map`,
    doc as unknown as FirestoreData,
    'saving import mappings'
  )
}

