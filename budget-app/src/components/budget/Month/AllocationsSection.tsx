import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBudget, type Category } from '../../../contexts/budget_context'
import { useBudgetData, useAllocationsPage } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { Button, formatCurrency, getBalanceColor, ErrorAlert } from '../../ui'
import { colors, sectionHeader } from '../../../styles/shared'
import { AllocationRow } from '../Allocations'

export function AllocationsSection() {
  const { selectedBudgetId, currentUserId } = useBudget()
  const { categories, categoryGroups } = useBudgetData(selectedBudgetId, currentUserId)
  const {
    localAllocations,
    isSavingAllocations,
    isFinalizingAllocations,
    isDeletingAllocations,
    isEditingAppliedAllocations,
    error,
    monthLoading,
    onBudgetTotal,
    availableNow,
    currentDraftTotal,
    availableAfterApply,
    previousMonthIncome,
    allocationsFinalized,
    getAllocationAmount,
    handleAllocationChange,
    resetAllocationsToSaved,
    handleSaveAllocations,
    handleFinalizeAllocations,
    handleDeleteAllocations,
    setIsEditingAppliedAllocations,
    setError,
  } = useAllocationsPage()
  const isMobile = useIsMobile()

  // Category entry type for working with categories map
  type CategoryEntry = [string, Category]

  // Organize categories by group for allocations display
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
  const categoriesByGroup = useMemo(() => {
    const result = Object.entries(categories).reduce((acc, [catId, cat]) => {
      const groupId = cat.category_group_id || 'ungrouped'
      if (!acc[groupId]) acc[groupId] = []
      acc[groupId].push([catId, cat] as CategoryEntry)
      return acc
    }, {} as Record<string, CategoryEntry[]>)

    // Sort categories within each group
    Object.keys(result).forEach(groupId => {
      result[groupId].sort((a, b) => a[1].sort_order - b[1].sort_order)
    })

    return result
  }, [categories])

  // Check if any categories use percentage-based allocation
  const hasPercentageCategories = Object.values(categories).some(c => c.default_monthly_type === 'percentage')

  return (
    <div style={{
      opacity: monthLoading ? 0.5 : 1,
      transition: 'opacity 0.15s ease-out',
      pointerEvents: monthLoading ? 'none' : 'auto',
    }}>
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Allocation Summary Table */}
      <div style={{
        display: 'flex',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        overflow: 'hidden',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <div style={{
          flex: 1,
          padding: '0.75rem 1rem',
          borderRight: isMobile ? 'none' : '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          borderBottom: isMobile ? '1px solid color-mix(in srgb, currentColor 10%, transparent)' : 'none',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-Budget Total</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, color: getBalanceColor(onBudgetTotal) }}>
            {formatCurrency(onBudgetTotal)}
          </p>
        </div>
        <div style={{
          flex: 1,
          padding: '0.75rem 1rem',
          borderRight: isMobile ? 'none' : '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          borderBottom: isMobile ? '1px solid color-mix(in srgb, currentColor 10%, transparent)' : 'none',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available Now</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, color: getBalanceColor(availableNow) }}>
            {formatCurrency(availableNow)}
          </p>
          <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.65rem', opacity: 0.5 }}>
            applied only
          </p>
        </div>
        <div style={{
          flex: 1,
          padding: '0.75rem 1rem',
          borderRight: isMobile ? 'none' : '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          borderBottom: isMobile ? '1px solid color-mix(in srgb, currentColor 10%, transparent)' : 'none',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Draft Total</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, color: colors.primary }}>
            {formatCurrency(currentDraftTotal)}
          </p>
        </div>
        <div style={{
          flex: 1,
          padding: '0.75rem 1rem',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>After Apply</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 600, color: getBalanceColor(availableAfterApply) }}>
            {formatCurrency(availableAfterApply)}
          </p>
          <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.65rem', opacity: 0.5 }}>
            if applied
          </p>
        </div>
      </div>

      {/* Previous month income info for percentage calculations */}
      {hasPercentageCategories && (
        <div style={{
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
        }}>
          <span style={{ opacity: 0.7 }}>
            Percentage allocations based on prev month income: <strong style={{ color: colors.primary }}>{formatCurrency(previousMonthIncome)}</strong>
          </span>
        </div>
      )}

      {/* Finalization Status */}
      <AllocationStatus
        allocationsFinalized={allocationsFinalized}
        isEditingAppliedAllocations={isEditingAppliedAllocations}
        isSavingAllocations={isSavingAllocations}
        isFinalizingAllocations={isFinalizingAllocations}
        isDeletingAllocations={isDeletingAllocations}
        monthLoading={monthLoading}
        onCancel={resetAllocationsToSaved}
        onSave={handleSaveAllocations}
        onFinalize={handleFinalizeAllocations}
        onDelete={handleDeleteAllocations}
        onStartEdit={() => setIsEditingAppliedAllocations(true)}
      />

      {/* Categories for Allocation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.keys(categories).length === 0 && (
          <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No categories yet.{' '}
            <Link to="/budget/settings/categories" style={{ color: colors.primaryLight }}>
              Create categories →
            </Link>
          </p>
        )}

        {sortedCategoryGroups.map(group => {
          const groupCats = categoriesByGroup[group.id] || []
          if (groupCats.length === 0) return null

          const groupTotal = groupCats.reduce((sum, [catId, cat]) => {
            return sum + getAllocationAmount(catId, cat)
          }, 0)

          return (
            <CategoryGroupBlock
              key={group.id}
              name={group.name}
              categories={groupCats}
              groupTotal={groupTotal}
              localAllocations={localAllocations}
              previousMonthIncome={previousMonthIncome}
              disabled={allocationsFinalized && !isEditingAppliedAllocations}
              onAllocationChange={handleAllocationChange}
            />
          )
        })}

        {/* Ungrouped categories */}
        {categoriesByGroup['ungrouped']?.length > 0 && (
          <CategoryGroupBlock
            name="Uncategorized"
            categories={categoriesByGroup['ungrouped']}
            groupTotal={categoriesByGroup['ungrouped'].reduce((sum, [catId, cat]) =>
              sum + getAllocationAmount(catId, cat), 0
            )}
            localAllocations={localAllocations}
            previousMonthIncome={previousMonthIncome}
            disabled={allocationsFinalized && !isEditingAppliedAllocations}
            onAllocationChange={handleAllocationChange}
            isUngrouped
          />
        )}
      </div>
    </div>
  )
}

interface AllocationStatusProps {
  allocationsFinalized: boolean
  isEditingAppliedAllocations: boolean
  isSavingAllocations: boolean
  isFinalizingAllocations: boolean
  isDeletingAllocations: boolean
  monthLoading: boolean
  onCancel: () => void
  onSave: () => void
  onFinalize: () => void
  onDelete: () => void
  onStartEdit: () => void
}

function AllocationStatus({
  allocationsFinalized,
  isEditingAppliedAllocations,
  isSavingAllocations,
  isFinalizingAllocations,
  isDeletingAllocations,
  monthLoading,
  onCancel,
  onSave,
  onFinalize,
  onDelete,
  onStartEdit,
}: AllocationStatusProps) {
  const statusColor = allocationsFinalized
    ? (isEditingAppliedAllocations ? colors.primary : colors.success)
    : colors.warning

  return (
    <div style={{
      background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
      border: `1px solid ${statusColor}`,
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      marginBottom: '1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '0.75rem',
    }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, color: statusColor }}>
          {allocationsFinalized
            ? isEditingAppliedAllocations
              ? '✏️ Editing Applied Allocations'
              : '✓ Allocations Applied'
            : '⏳ Allocations Not Applied'}
        </p>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
          {allocationsFinalized
            ? isEditingAppliedAllocations
              ? 'Make changes and save, or cancel to revert.'
              : 'Click Edit to make changes to allocations.'
            : 'Save and apply to update category balances.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {allocationsFinalized ? (
          isEditingAppliedAllocations ? (
            <>
              <Button onClick={onCancel} disabled={isSavingAllocations || isDeletingAllocations || monthLoading} variant="secondary">
                Cancel
              </Button>
              <Button onClick={onSave} disabled={isSavingAllocations || isDeletingAllocations || monthLoading}>
                {isSavingAllocations ? '⏳ Saving...' : '💾 Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onStartEdit} disabled={isDeletingAllocations || monthLoading} variant="secondary">
                ✏️ Edit Allocations
              </Button>
              <Button
                onClick={onDelete}
                disabled={isDeletingAllocations || monthLoading}
                variant="danger"
              >
                {isDeletingAllocations ? '⏳ Deleting...' : '🗑️ Delete Allocations'}
              </Button>
            </>
          )
        ) : (
          <>
            <Button onClick={onSave} disabled={isSavingAllocations || monthLoading} variant="secondary">
              {isSavingAllocations ? '⏳ Saving...' : '💾 Save Draft'}
            </Button>
            <Button onClick={onFinalize} disabled={isFinalizingAllocations || monthLoading}>
              {isFinalizingAllocations ? '⏳ Applying...' : '✓ Save & Apply'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

interface CategoryGroupBlockProps {
  name: string
  categories: [string, Category][]
  groupTotal: number
  localAllocations: Record<string, string>
  previousMonthIncome: number
  disabled: boolean
  onAllocationChange: (categoryId: string, value: string) => void
  isUngrouped?: boolean
}

function CategoryGroupBlock({
  name,
  categories,
  groupTotal,
  localAllocations,
  previousMonthIncome,
  disabled,
  onAllocationChange,
  isUngrouped,
}: CategoryGroupBlockProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      }}>
        <h3 style={{ ...sectionHeader, margin: 0, opacity: isUngrouped ? 0.7 : 1 }}>
          {name}
          <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({categories.length})
          </span>
        </h3>
        <span style={{ fontWeight: 600, color: colors.primary }}>
          {formatCurrency(groupTotal)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {categories.map(([catId, cat]) => (
          <AllocationRow
            key={catId}
            category={cat}
            value={localAllocations[catId] || ''}
            onChange={(val) => onAllocationChange(catId, val)}
            previousMonthIncome={previousMonthIncome}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

