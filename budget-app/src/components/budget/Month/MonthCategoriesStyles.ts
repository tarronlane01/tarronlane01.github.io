/**
 * MonthCategories - Shared styles and helpers
 */

import type { RecalculationProgress } from '../../../data/recalculation'

// Column header style for the grid
export const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  paddingTop: '0.5rem',
  paddingBottom: '0.5rem',
  borderBottom: '2px solid rgba(255,255,255,0.2)',
}

/** Get phase label for progress overlay */
export function getRecalcPhaseLabel(recalcProgress: RecalculationProgress | null): string {
  if (!recalcProgress) return ''
  switch (recalcProgress.phase) {
    case 'reading-budget': return 'Reading budget data...'
    case 'fetching-months': return 'Fetching months...'
    case 'recalculating':
      return recalcProgress.currentMonth ? `Recalculating ${recalcProgress.currentMonth}...` : 'Recalculating...'
    case 'saving': return 'Saving results...'
    case 'complete': return 'Recalculation complete!'
    default: return 'Recalculating balances...'
  }
}

