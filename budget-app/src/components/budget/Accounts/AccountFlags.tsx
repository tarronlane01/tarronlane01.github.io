import type { FinancialAccount } from '@types'
import type { GroupWithId } from './AccountForm'
import { AccountBadge } from './AccountBadge'

interface AccountFlagsProps {
  account: FinancialAccount
  accountGroups: GroupWithId[]
}

export function AccountFlags({ account, accountGroups }: AccountFlagsProps) {
  const flags: React.ReactNode[] = []

  // Find the account's group
  const group = account.account_group_id
    ? accountGroups.find(g => g.id === account.account_group_id)
    : null

  // Effective values (group overrides take precedence)
  const effectiveOnBudget = (group && group.on_budget !== null) ? group.on_budget : (account.on_budget !== false)

  // Off-budget flag
  if (!effectiveOnBudget) {
    const isFromGroup = group && group.on_budget !== null
    flags.push(
      <AccountBadge
        key="off-budget"
        icon="📊"
        label="Off Budget"
        variant="warning"
        title={isFromGroup ? `Set by "${group!.name}" account type` : "Tracking only - not included in budget"}
      />
    )
  }

  // Income default flag (takes precedence over regular income flag)
  if (account.is_income_default) {
    flags.push(
      <AccountBadge key="income-default" icon="💰" label="Income Default" variant="success" title="Default income deposit account" />
    )
  } else if (account.is_income_account) {
    flags.push(
      <AccountBadge key="income" icon="💰" label="Income" variant="income" title="Income deposit account" />
    )
  }

  // Outgo default flag (takes precedence over regular outgo flag)
  if (account.is_outgo_default) {
    flags.push(
      <AccountBadge key="outgo-default" icon="💸" label="Expense Default" variant="warning" title="Default expense account" />
    )
  } else if (account.is_outgo_account) {
    flags.push(
      <AccountBadge key="outgo" icon="💸" label="Expense" variant="expense" title="Expense account" />
    )
  }

  if (flags.length === 0) return null

  return <>{flags}</>
}

