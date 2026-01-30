import { useMemo } from 'react'
import { type BudgetTab } from '@contexts'
import { TabNavigation, type Tab } from '@components/ui'

// Re-export for backward compatibility
export type { BudgetTab }

// Top-level sections
export type TopLevelSection = 'balances' | 'transactions'

// Map sub-tabs to their parent sections
const TAB_TO_SECTION: Record<BudgetTab, TopLevelSection> = {
  categories: 'balances',
  accounts: 'balances',
  income: 'transactions',
  spend: 'transactions',
  transfers: 'transactions',
  adjustments: 'transactions',
}

interface BudgetTabsProps {
  activeTab: BudgetTab
  setActiveTab: (tab: BudgetTab) => void
  /** Last sub-tab used in Balances section (remembered when switching sections). */
  lastBalancesTab: BudgetTab
  /** Last sub-tab used in Transactions section (remembered when switching sections). */
  lastTransactionsTab: BudgetTab
  allocationsFinalized?: boolean
}

export function BudgetTabs({ activeTab, setActiveTab, lastBalancesTab, lastTransactionsTab, allocationsFinalized }: BudgetTabsProps) {
  const activeSection = TAB_TO_SECTION[activeTab]

  // Top-level tabs
  const topTabs: Tab[] = useMemo(() => [
    { id: 'balances', label: 'Balances' },
    { id: 'transactions', label: 'Transactions' },
  ], [])

  // Sub-tabs for Balances section
  const balancesTabs: Tab[] = useMemo(() => [
    {
      id: 'categories',
      label: 'Categories',
      checkmark: allocationsFinalized,
    },
    { id: 'accounts', label: 'Accounts' },
  ], [allocationsFinalized])

  // Sub-tabs for Transactions section
  const transactionsTabs: Tab[] = useMemo(() => [
    { id: 'income', label: 'Income' },
    { id: 'spend', label: 'Spend' },
    { id: 'transfers', label: 'Transfers' },
    { id: 'adjustments', label: 'Adjustments' },
  ], [])

  const handleTopTabChange = (sectionId: string) => {
    const section = sectionId as TopLevelSection
    const remembered = section === 'balances' ? lastBalancesTab : lastTransactionsTab
    setActiveTab(remembered)
  }

  const subTabs = activeSection === 'balances' ? balancesTabs : transactionsTabs

  return (
    <div>
      {/* Top-level section tabs - full width segmented */}
      <TabNavigation
        mode="button"
        tabs={topTabs}
        activeTab={activeSection}
        onTabChange={handleTopTabChange}
        variant="segmented"
      />

      {/* Sub-tabs - left aligned */}
      <TabNavigation
        mode="button"
        tabs={subTabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as BudgetTab)}
        variant="secondary"
      />
    </div>
  )
}
