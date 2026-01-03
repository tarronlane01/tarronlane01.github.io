/**
 * Seed Import Mapping Components
 *
 * UI components for mapping unknown categories and accounts during seed import.
 * Extracted from SeedImportCard for better organization.
 */

import { useMemo } from 'react'
import type { CategoriesMap, AccountsMap, AccountGroupsMap } from '../../../contexts/budget_context'
import type { MappingEntry } from '../../../hooks/migrations/useSeedImport'
import { ADJUSTMENT_CATEGORY_ID, ADJUSTMENT_CATEGORY_NAME, NO_ACCOUNT_ID, NO_ACCOUNT_NAME } from '../../../data/constants'

// =============================================================================
// TYPES
// =============================================================================

interface MappingSectionProps {
  unmappedCategories: string[]
  unmappedAccounts: string[]
  customMappedCategories: string[]
  customMappedAccounts: string[]
  categoryMappings: Map<string, MappingEntry>
  accountMappings: Map<string, MappingEntry>
  categories: CategoriesMap
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  onCategoryMap: (oldName: string, newId: string, newName: string) => void
  onAccountMap: (oldName: string, newId: string, newName: string) => void
}

interface MappingRowProps {
  oldName: string
  currentMapping?: MappingEntry
  options: Array<{ id: string; name: string; rawName?: string }>
  onMap: (newId: string, newName: string) => void
  placeholder: string
  isAutoMapped?: boolean
}

// =============================================================================
// HELPERS
// =============================================================================

/** Get the account group name for display */
function getAccountGroupName(account: AccountsMap[string], accountGroups: AccountGroupsMap): string {
  if (account.account_group_id && accountGroups[account.account_group_id]) {
    return accountGroups[account.account_group_id].name
  }
  return 'Ungrouped'
}

// =============================================================================
// MAPPING ROW
// =============================================================================

export function MappingRow({ oldName, currentMapping, options, onMap, placeholder, isAutoMapped }: MappingRowProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    const selectedOption = options.find(opt => opt.id === selectedId)
    if (selectedOption) {
      // Use rawName if available (for accounts with type labels), otherwise use display name
      const nameToStore = selectedOption.rawName ?? selectedOption.name
      onMap(selectedId, nameToStore)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '0.5rem',
      padding: '0.5rem',
      background: isAutoMapped
        ? 'color-mix(in srgb, #22c55e 8%, transparent)'
        : 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '6px',
      borderLeft: isAutoMapped ? '3px solid #22c55e' : 'none',
    }}>
      <span style={{
        flex: '0 0 40%',
        fontSize: '0.85rem',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }} title={oldName}>
        "{oldName}"
        {isAutoMapped && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>(auto)</span>}
      </span>
      <span style={{ opacity: 0.5 }}>→</span>
      <select
        value={currentMapping?.newId ?? ''}
        onChange={handleChange}
        style={{
          flex: 1,
          padding: '0.4rem',
          borderRadius: '4px',
          border: currentMapping
            ? '1px solid #22c55e'
            : '1px solid color-mix(in srgb, currentColor 30%, transparent)',
          background: currentMapping
            ? 'color-mix(in srgb, #22c55e 10%, transparent)'
            : 'color-mix(in srgb, currentColor 10%, transparent)',
          color: 'inherit',
          fontSize: '0.85rem',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>
    </div>
  )
}

// =============================================================================
// MAPPING SECTION
// =============================================================================

export function MappingSection({
  unmappedCategories,
  unmappedAccounts,
  customMappedCategories,
  customMappedAccounts,
  categoryMappings,
  accountMappings,
  categories,
  accounts,
  accountGroups,
  onCategoryMap,
  onAccountMap,
}: MappingSectionProps) {
  // Sort categories and accounts by name for dropdowns
  // Include special categories/accounts for all combined imports
  const sortedCategories = useMemo(() => {
    const catEntries = Object.entries(categories).sort((a, b) => a[1].name.localeCompare(b[1].name))
    // Add Adjustment category at the top for spend records
    return [
      [ADJUSTMENT_CATEGORY_ID, { name: ADJUSTMENT_CATEGORY_NAME, category_group_id: null, sort_order: -1 }] as const,
      ...catEntries,
    ]
  }, [categories])
  const sortedAccounts = useMemo(() => {
    const accEntries = Object.entries(accounts)
      .sort((a, b) => a[1].nickname.localeCompare(b[1].nickname))
      .map(([id, acc]) => ({
        id,
        acc,
        displayName: `${acc.nickname} (${getAccountGroupName(acc, accountGroups)})`,
      }))
    // Add No Account at the top for spend and income records
    return [
      { id: NO_ACCOUNT_ID, acc: { nickname: NO_ACCOUNT_NAME } as AccountsMap[string], displayName: NO_ACCOUNT_NAME },
      ...accEntries,
    ]
  }, [accounts, accountGroups])

  const hasUnmappedEntities = unmappedCategories.length > 0 || unmappedAccounts.length > 0

  return (
    <div style={{
      background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
      border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem',
    }}>
      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
        🔗 Entity Mappings
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', opacity: 0.8 }}>
        {hasUnmappedEntities
          ? 'Map unknown entities to existing categories/accounts.'
          : 'Review saved mappings (names that don\'t exactly match existing entities).'}
        {' '}These mappings will be saved for future imports.
      </p>

      {/* Unmapped Categories */}
      {unmappedCategories.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#ef4444' }}>
            ⚠️ Unmapped Categories ({unmappedCategories.length})
          </h5>
          {unmappedCategories.map(oldName => (
            <MappingRow
              key={`cat-unmapped-${oldName}`}
              oldName={oldName}
              currentMapping={categoryMappings.get(oldName)}
              options={sortedCategories.map(([id, cat]) => ({ id, name: cat.name }))}
              onMap={(newId, newName) => onCategoryMap(oldName, newId, newName)}
              placeholder="Select a category..."
            />
          ))}
        </div>
      )}

      {/* Custom Mapped Categories (from saved mappings doc) */}
      {customMappedCategories.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#60a5fa' }}>
            📋 Saved Category Mappings ({customMappedCategories.length})
          </h5>
          {customMappedCategories.map(oldName => (
            <MappingRow
              key={`cat-custom-${oldName}`}
              oldName={oldName}
              currentMapping={categoryMappings.get(oldName)}
              options={sortedCategories.map(([id, cat]) => ({ id, name: cat.name }))}
              onMap={(newId, newName) => onCategoryMap(oldName, newId, newName)}
              placeholder="Select a category..."
              isAutoMapped={true}
            />
          ))}
        </div>
      )}

      {/* Unmapped Accounts */}
      {unmappedAccounts.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#ef4444' }}>
            ⚠️ Unmapped Accounts ({unmappedAccounts.length})
          </h5>
          {unmappedAccounts.map(oldName => (
            <MappingRow
              key={`acc-unmapped-${oldName}`}
              oldName={oldName}
              currentMapping={accountMappings.get(oldName)}
              options={sortedAccounts.map(({ id, acc, displayName }) => ({ id, name: displayName, rawName: acc.nickname }))}
              onMap={(newId, newName) => onAccountMap(oldName, newId, newName)}
              placeholder="Select an account..."
            />
          ))}
        </div>
      )}

      {/* Custom Mapped Accounts (from saved mappings doc) */}
      {customMappedAccounts.length > 0 && (
        <div>
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#60a5fa' }}>
            📋 Saved Account Mappings ({customMappedAccounts.length})
          </h5>
          {customMappedAccounts.map(oldName => (
            <MappingRow
              key={`acc-custom-${oldName}`}
              oldName={oldName}
              currentMapping={accountMappings.get(oldName)}
              options={sortedAccounts.map(({ id, acc, displayName }) => ({ id, name: displayName, rawName: acc.nickname }))}
              onMap={(newId, newName) => onAccountMap(oldName, newId, newName)}
              placeholder="Select an account..."
              isAutoMapped={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

