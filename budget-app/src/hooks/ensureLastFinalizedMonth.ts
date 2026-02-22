/**
 * Ensure the last finalized month is loaded for a budget (for ALL-TIME balance calculation).
 */

import { getYearMonthOrdinal } from '@utils'
// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import type { MonthDocument, FirestoreData } from '@types'
import { parseMonthData } from './initialDataLoadParse'

/**
 * Find and load the last finalized month based on the loaded months.
 * If latest loaded is UNFINALIZED: walk backward to find first finalized.
 * If latest loaded is FINALIZED: walk forward to find last finalized.
 */
export async function ensureLastFinalizedMonthLoaded(
  budgetId: string,
  loadedMonths: MonthDocument[],
  monthMap: Record<string, unknown>
): Promise<MonthDocument[]> {
  if (loadedMonths.length === 0) return loadedMonths

  const ordinals = Object.keys(monthMap).sort()
  if (ordinals.length === 0) return loadedMonths

  const latestLoaded = loadedMonths.reduce((max, m) => {
    const mOrdinal = getYearMonthOrdinal(m.year, m.month)
    const maxOrdinal = getYearMonthOrdinal(max.year, max.month)
    return mOrdinal > maxOrdinal ? m : max
  })
  const latestOrdinal = getYearMonthOrdinal(latestLoaded.year, latestLoaded.month)

  const earliestLoaded = loadedMonths.reduce((min, m) => {
    const mOrdinal = getYearMonthOrdinal(m.year, m.month)
    const minOrdinal = getYearMonthOrdinal(min.year, min.month)
    return mOrdinal < minOrdinal ? m : min
  })
  const earliestOrdinal = getYearMonthOrdinal(earliestLoaded.year, earliestLoaded.month)

  let ordinalsToQuery: string[]
  let searchDirection: 'backward' | 'forward'

  if (!latestLoaded.are_allocations_finalized) {
    searchDirection = 'backward'
    ordinalsToQuery = ordinals.filter(o => o < earliestOrdinal).reverse()
  } else {
    searchDirection = 'forward'
    ordinalsToQuery = ordinals.filter(o => o > latestOrdinal)
  }

  if (ordinalsToQuery.length === 0) return loadedMonths

  const minOrdinal = ordinalsToQuery[0] < ordinalsToQuery[ordinalsToQuery.length - 1]
    ? ordinalsToQuery[0]
    : ordinalsToQuery[ordinalsToQuery.length - 1]
  const maxOrdinal = ordinalsToQuery[0] > ordinalsToQuery[ordinalsToQuery.length - 1]
    ? ordinalsToQuery[0]
    : ordinalsToQuery[ordinalsToQuery.length - 1]

  const result = await queryCollection<FirestoreData>(
    'months',
    `useInitialDataLoad: searching ${searchDirection} for finalized month`,
    [
      { field: 'budget_id', op: '==', value: budgetId },
      { field: 'year_month_ordinal', op: '>=', value: minOrdinal },
      { field: 'year_month_ordinal', op: '<=', value: maxOrdinal },
    ]
  )

  const fetchedMonths = result.docs.map(doc => {
    const data = doc.data
    const year = data.year as number
    const month = data.month as number
    return parseMonthData(data, budgetId, year, month)
  })

  let targetFinalizedMonth: MonthDocument | null = null
  let monthsToAdd: MonthDocument[] = []

  if (searchDirection === 'backward') {
    const sortedDesc = [...fetchedMonths].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
    targetFinalizedMonth = sortedDesc.find(m => m.are_allocations_finalized) || null
    if (targetFinalizedMonth) {
      const targetOrdinal = getYearMonthOrdinal(targetFinalizedMonth.year, targetFinalizedMonth.month)
      monthsToAdd = fetchedMonths.filter(m => {
        const ordinal = getYearMonthOrdinal(m.year, m.month)
        return ordinal >= targetOrdinal && ordinal < earliestOrdinal
      })
    }
  } else {
    const sortedAsc = [...fetchedMonths].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
    for (const month of sortedAsc) {
      if (month.are_allocations_finalized) {
        targetFinalizedMonth = month
      } else {
        break
      }
    }
    if (targetFinalizedMonth) {
      const targetOrdinal = getYearMonthOrdinal(targetFinalizedMonth.year, targetFinalizedMonth.month)
      monthsToAdd = fetchedMonths.filter(m => {
        const ordinal = getYearMonthOrdinal(m.year, m.month)
        return ordinal > latestOrdinal && ordinal <= targetOrdinal
      })
    }
  }

  if (monthsToAdd.length === 0) return loadedMonths

  const allMonths = [...loadedMonths, ...monthsToAdd].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
  return allMonths
}
