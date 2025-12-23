import { useMemo } from 'react'
import { TabNavigation, type Tab } from '../../ui'
import { colors } from '../../../styles/shared'

export type BudgetTab = 'income' | 'allocations' | 'spend' | 'balances'

interface BudgetTabsProps {
  activeTab: BudgetTab
  setActiveTab: (tab: BudgetTab) => void
  allocationsFinalized?: boolean
}

export function BudgetTabs({ activeTab, setActiveTab, allocationsFinalized }: BudgetTabsProps) {
  const tabs: Tab[] = useMemo(() => [
    { id: 'income', label: 'Income', icon: '💰' },
    {
      id: 'allocations',
      label: 'Allocations',
      icon: '📊',
      badge: allocationsFinalized ? { text: 'Applied', color: colors.success } : undefined,
    },
    { id: 'spend', label: 'Spend', icon: '🛒' },
    { id: 'balances', label: 'Balances', icon: '💰' },
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
