/**
 * Feedback Query Hook
 *
 * React Query hook for fetching all feedback items.
 * Uses fetchFeedback for the actual Firestore query.
 *
 * Used by the SettingsFeedback page for admin users.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { fetchFeedback } from './fetchFeedback'

/**
 * Query hook for all feedback items.
 * Only enabled for admin users.
 *
 * @param options - Additional query options including enabled flag
 */
export function useFeedbackQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.feedback(),
    queryFn: fetchFeedback,
    enabled: options?.enabled !== false,
  })
}

