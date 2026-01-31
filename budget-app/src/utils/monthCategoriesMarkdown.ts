/**
 * Build a markdown document from month categories data for export/sharing.
 * Matches the columns and values shown on the Month Categories page.
 */

import type { Category, CategoryMonthBalance, CategoryGroup } from '@types'
import { UNGROUPED_CATEGORY_GROUP_ID } from '@constants'

const numOpts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

function fmt(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', numOpts)}`
}

/** Balance-style: negative sign for negative, no sign for positive (matches UI). */
function fmtBalance(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toLocaleString('en-US', numOpts)}`
  return `$${amount.toLocaleString('en-US', numOpts)}`
}

function fmtSigned(amount: number): string {
  if (amount === 0) return '$0.00'
  const sign = amount > 0 ? '+' : '-'
  return `${sign}${fmt(amount)}`
}

function fmtSignedAlways(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${fmt(amount)}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export interface MonthCategoriesMarkdownInput {
  year: number
  monthNumber: number
  categoryGroups: CategoryGroup[]
  categoriesByGroup: Record<string, [string, Category][]>
  categories: Record<string, Category>
  liveCategoryBalances: Record<string, CategoryMonthBalance>
  getAllocationAmount: (catId: string, cat: Category) => number
  savedAllocations: Record<string, number>
  previousMonthIncome: number
  isDraftMode: boolean
  balanceTotals: { start: number; allocated: number; spent: number; transfers: number; adjustments: number; end: number }
  grandAllTime: number
}

/**
 * Returns markdown string with a title, summary line, and a markdown table
 * of all category groups and rows matching the Month Categories view.
 */
export function buildMonthCategoriesMarkdown(input: MonthCategoriesMarkdownInput): string {
  const {
    year,
    monthNumber,
    categoryGroups,
    categoriesByGroup,
    liveCategoryBalances,
    getAllocationAmount,
    isDraftMode,
    balanceTotals,
    grandAllTime,
  } = input

  const monthLabel = `${MONTH_NAMES[monthNumber - 1]} ${year}`
  const lines: string[] = []

  lines.push(`# Category Balances — ${monthLabel}`)
  lines.push('')
  if (isDraftMode) {
    lines.push('*Draft allocations (not yet applied).*')
    lines.push('')
  }

  // Table header
  const header = '| Category | Start | Allocated | Spent | Transfers | Adjust | Net Change | End | All-Time |'
  const separator = '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  lines.push(header)
  lines.push(separator)

  const sortedGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)

  function getAllTimeBalance(catId: string, cat: Category): number {
    const storedBalance = cat.balance ?? 0
    if (!isDraftMode) return Math.max(0, storedBalance)
    const draftAllocation = getAllocationAmount(catId, cat)
    const savedAllocation = input.savedAllocations[catId] ?? 0
    const allocationChange = draftAllocation - savedAllocation
    return Math.max(0, storedBalance + allocationChange)
  }

  // Rows: each group, then ungrouped. Allocated column uses live balance (draft or saved).
  for (const group of sortedGroups) {
    const groupCats = categoriesByGroup[group.id] || []
    if (groupCats.length === 0) continue

    let groupStart = 0
    let groupAllocated = 0
    let groupSpent = 0
    let groupTransfers = 0
    let groupAdjustments = 0
    let groupEnd = 0
    let groupAllTime = 0

    for (const [catId, cat] of groupCats) {
      const bal = liveCategoryBalances[catId]
      if (!bal) continue
      const netChange = bal.allocated + bal.spent + bal.transfers + bal.adjustments
      const allTime = getAllTimeBalance(catId, cat)
      groupStart += bal.start_balance
      groupAllocated += bal.allocated
      groupSpent += bal.spent
      groupTransfers += bal.transfers
      groupAdjustments += bal.adjustments
      groupEnd += bal.end_balance
      groupAllTime += allTime

      const name = cat.name.replace(/\|/g, '\\|')
      lines.push(
        `| ${name} | ${fmtBalance(bal.start_balance)} | +${fmt(bal.allocated)} | ${fmtSigned(bal.spent)} | ${fmtSignedAlways(bal.transfers)} | ${fmtSignedAlways(bal.adjustments)} | ${fmtSignedAlways(netChange)} | ${fmtBalance(bal.end_balance)} | ${fmtBalance(allTime)} |`
      )
    }

    const groupNetChange = groupAllocated + groupSpent + groupTransfers + groupAdjustments
    const groupName = group.name.replace(/\|/g, '\\|')
    lines.push(`| **${groupName}** *(total)* | **${fmtBalance(groupStart)}** | **+${fmt(groupAllocated)}** | **${fmtSigned(groupSpent)}** | **${fmtSignedAlways(groupTransfers)}** | **${fmtSignedAlways(groupAdjustments)}** | **${fmtSignedAlways(groupNetChange)}** | **${fmtBalance(groupEnd)}** | **${fmtBalance(groupAllTime)}** |`)
  }

  // Ungrouped
  const ungroupedCats = categoriesByGroup[UNGROUPED_CATEGORY_GROUP_ID] || []
  if (ungroupedCats.length > 0) {
    let uStart = 0
    let uAllocated = 0
    let uSpent = 0
    let uTransfers = 0
    let uAdjustments = 0
    let uEnd = 0
    let uAllTime = 0
    for (const [catId, cat] of ungroupedCats) {
      const bal = liveCategoryBalances[catId]
      if (!bal) continue
      const netChange = bal.allocated + bal.spent + bal.transfers + bal.adjustments
      const allTime = getAllTimeBalance(catId, cat)
      uStart += bal.start_balance
      uAllocated += bal.allocated
      uSpent += bal.spent
      uTransfers += bal.transfers
      uAdjustments += bal.adjustments
      uEnd += bal.end_balance
      uAllTime += allTime
      const name = cat.name.replace(/\|/g, '\\|')
      lines.push(
        `| ${name} | ${fmtBalance(bal.start_balance)} | +${fmt(bal.allocated)} | ${fmtSigned(bal.spent)} | ${fmtSignedAlways(bal.transfers)} | ${fmtSignedAlways(bal.adjustments)} | ${fmtSignedAlways(netChange)} | ${fmtBalance(bal.end_balance)} | ${fmtBalance(allTime)} |`
      )
    }
    const uNetChange = uAllocated + uSpent + uTransfers + uAdjustments
    lines.push(`| **Uncategorized** *(total)* | **${fmtBalance(uStart)}** | **+${fmt(uAllocated)}** | **${fmtSigned(uSpent)}** | **${fmtSignedAlways(uTransfers)}** | **${fmtSignedAlways(uAdjustments)}** | **${fmtSignedAlways(uNetChange)}** | **${fmtBalance(uEnd)}** | **${fmtBalance(uAllTime)}** |`)
  }

  // Grand totals row
  const netChange = balanceTotals.allocated + balanceTotals.spent + balanceTotals.transfers + balanceTotals.adjustments
  lines.push(`| **Grand Totals** | **${fmtBalance(balanceTotals.start)}** | **+${fmt(balanceTotals.allocated)}** | **${fmtSigned(balanceTotals.spent)}** | **${fmtSignedAlways(balanceTotals.transfers)}** | **${fmtSignedAlways(balanceTotals.adjustments)}** | **${fmtSignedAlways(netChange)}** | **${fmtBalance(balanceTotals.end)}** | **${fmtBalance(grandAllTime)}** |`)

  return lines.join('\n')
}

/**
 * Trigger a file download of the markdown string with a suggested filename.
 */
export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
