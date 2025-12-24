import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBudget, type Category } from '../../../contexts/budget_context'
import { useBudgetData, useAllocationsPage } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { Button, StatCard, formatCurrency, getBalanceColor, ErrorAlert } from '../../ui'
import { colors, sectionHeader } from '../../../styles/shared'
import { AllocationRow } from '../Allocations'

export function AllocationsSection() {
  const { selectedBudgetId, currentUserId } = useBudget()
  const { categories, categoryGroups } = useBudgetData(selectedBudgetId, currentUserId)
  const {
    localAllocations,
    isSavingAllocations,
    isFinalizingAllocations,
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

      {/* Allocation Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>On-Budget Total</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(onBudgetTotal) }}>
            {formatCurrency(onBudgetTotal)}
          </p>
        </StatCard>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Available Now</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(availableNow) }}>
            {formatCurrency(availableNow)}
          </p>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', opacity: 0.5 }}>
            (applied allocations only)
          </p>
        </StatCard>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>This Month's Draft</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: colors.primary }}>
            {formatCurrency(currentDraftTotal)}
          </p>
        </StatCard>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>After Apply</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(availableAfterApply) }}>
            {formatCurrency(availableAfterApply)}
          </p>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', opacity: 0.5 }}>
            (if you apply draft)
          </p>
        </StatCard>
      </div>

      {/* Previous month income info for percentage calculations */}
      {hasPercentageCategories && (
        <div style={{
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ opacity: 0.6 }}>📊</span>
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
        monthLoading={monthLoading}
        onCancel={resetAllocationsToSaved}
        onSave={handleSaveAllocations}
        onFinalize={handleFinalizeAllocations}
        onStartEdit={() => setIsEditingAppliedAllocations(true)}
      />

      {/* Categories for Allocation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.keys(categories).length === 0 && (
          <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No categories yet.{' '}
            <Link to="/budget/admin/categories" style={{ color: colors.primaryLight }}>
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
  monthLoading: boolean
  onCancel: () => void
  onSave: () => void
  onFinalize: () => void
  onStartEdit: () => void
}

function AllocationStatus({
  allocationsFinalized,
  isEditingAppliedAllocations,
  isSavingAllocations,
  isFinalizingAllocations,
  monthLoading,
  onCancel,
  onSave,
  onFinalize,
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
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {allocationsFinalized ? (
          isEditingAppliedAllocations ? (
            <>
              <Button onClick={onCancel} disabled={isSavingAllocations || monthLoading} variant="secondary">
                Cancel
              </Button>
              <Button onClick={onSave} disabled={isSavingAllocations || monthLoading}>
                {isSavingAllocations ? '⏳ Saving...' : '💾 Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={onStartEdit} disabled={monthLoading} variant="secondary">
              ✏️ Edit Allocations
            </Button>
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

