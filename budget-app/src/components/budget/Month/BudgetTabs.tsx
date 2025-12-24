import { useMemo } from 'react'
import { TabNavigation, type Tab } from '../../ui'

export type BudgetTab = 'income' | 'allocations' | 'spend' | 'balances'

interface BudgetTabsProps {
  activeTab: BudgetTab
  setActiveTab: (tab: BudgetTab) => void
  allocationsFinalized?: boolean
}

export function BudgetTabs({ activeTab, setActiveTab, allocationsFinalized }: BudgetTabsProps) {
  const tabs: Tab[] = useMemo(() => [
    { id: 'income', label: 'Income' },
    {
      id: 'allocations',
      label: 'Allocations',
      checkmark: allocationsFinalized,
    },
    { id: 'spend', label: 'Spend' },
    { id: 'balances', label: 'Balances' },
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
