/**
 * Utility Functions
 *
 * Pure utility functions with no side effects.
 * Import via @utils alias.
 */

export { getMonthDocId } from './monthDocId'
export { getPreviousMonth, getNextMonth, getMonthsBack, getYearMonthOrdinal, formatDate, getDefaultFormDate, parseDateToYearMonth } from './date'
export {
  canCreateMonth,
  monthExistsInMap,
  getPrevMonthNavigationState,
  getNextMonthNavigationState,
  getCalendarBounds,
  getMonthMapBounds,
  MonthNavigationError,
  type MonthCreationResult,
  type MonthNavigationState,
} from './monthCreationRules'
export {
  logUserAction,
  trackedChange,
  trackedInputChange,
  trackedClick,
  trackedSubmit,
} from './actionLogger'
export { roundCurrency, needsPrecisionFix } from './currency'
export { cleanForFirestore } from './firestore'

