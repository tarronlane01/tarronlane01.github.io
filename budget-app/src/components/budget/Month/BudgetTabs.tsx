import { useMemo } from 'react'
import { type BudgetTab } from '@contexts'
import { TabNavigation, type Tab } from '../../ui'

// Re-export for backward compatibility
export type { BudgetTab }

interface BudgetTabsProps {
  activeTab: BudgetTab
  setActiveTab: (tab: BudgetTab) => void
  allocationsFinalized?: boolean
}

export function BudgetTabs({ activeTab, setActiveTab, allocationsFinalized }: BudgetTabsProps) {
  const tabs: Tab[] = useMemo(() => [
    {
      id: 'categories',
      label: 'Categories',
      checkmark: allocationsFinalized,
    },
    { id: 'accounts', label: 'Accounts' },
    { id: 'income', label: 'Income' },
    { id: 'spend', label: 'Spend' },
  ], [allocationsFinalized])

  return (
    <TabNavigation
      mode="button"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as BudgetTab)}
    />
  )
}
