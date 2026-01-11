/**
 * Optimistic Mutation Factory
 *
 * This factory ENFORCES optimistic updates by requiring them as mandatory parameters.
 * It's architecturally impossible to create a mutation without defining how it
 * optimistically updates the cache.
 *
 * ENFORCEMENT MECHANISMS:
 * 1. TypeScript: `optimisticUpdate` is a required property - compile error if missing
 * 2. Runtime: Factory throws if optimisticUpdate is not a function
 * 3. ESLint: Direct useMutation imports are blocked (see eslint.config.js)
 *
 * Usage:
 * ```ts
 * export const useAddExpense = createOptimisticMutation({
 *   // REQUIRED: Define how to optimistically update the cache
 *   optimisticUpdate: (params) => ({
 *     cacheKey: queryKeys.month(params.budgetId, params.year, params.month),
 *     transform: (cached) => ({ ...cached, expenses: [...cached.expenses, newExpense] }),
 *   }),
 *
 *   // REQUIRED: The actual Firestore write
 *   mutationFn: async (params) => { ... },
 * })
 * ```
 */

import { useState, useCallback } from 'react'
import { queryClient } from '@data/queryClient'

// ============================================================================
// TYPES - These enforce the required structure
// ============================================================================

/**
 * Configuration for optimistic cache updates.
 * ALL properties are REQUIRED - TypeScript will error if any are missing.
 */
export interface OptimisticUpdateConfig<TCacheData> {
  /** The React Query cache key to update */
  cacheKey: readonly unknown[]

  /**
   * Transform function that returns the optimistically updated cache data.
   * Receives current cached data (may be undefined if not cached).
   * Must return the new cache state.
   */
  transform: (currentData: TCacheData | undefined) => TCacheData
}

/**
 * Full mutation configuration.
 * `optimisticUpdate` is REQUIRED - this is the enforcement mechanism.
 */
export interface OptimisticMutationConfig<TParams, TResult, TCacheData> {
  /**
   * REQUIRED: Function that returns optimistic update configuration.
   * This is the enforcement mechanism - you cannot create a mutation without it.
   *
   * @param params - The mutation parameters
   * @returns Configuration for cache key and transform
   */
  optimisticUpdate: (params: TParams) => OptimisticUpdateConfig<TCacheData>

  /**
   * REQUIRED: The actual mutation function (e.g., Firestore write).
   * This runs AFTER the optimistic update is applied.
   *
   * @param params - The mutation parameters
   * @returns Promise resolving to the mutation result
   */
  mutationFn: (params: TParams) => Promise<TResult>

  /**
   * Optional: Called after successful mutation.
   * Use this to sync cache with server response if needed.
   */
  onSuccess?: (result: TResult, params: TParams) => void

  /**
   * Optional: Custom error handler.
   * Cache rollback happens automatically before this is called.
   */
  onError?: (error: Error, params: TParams) => void
}

/**
 * Return type of the created mutation hook.
 * Provides consistent interface across all mutations.
 */
export interface OptimisticMutationResult<TParams, TResult> {
  /** Execute the mutation */
  mutate: (params: TParams) => Promise<TResult>
  /** Async version that can be awaited */
  mutateAsync: (params: TParams) => Promise<TResult>
  /** Whether the mutation is currently in progress */
  isPending: boolean
  /** Whether the last mutation resulted in an error */
  isError: boolean
  /** The error from the last mutation, if any */
  error: Error | null
  /** Reset error state */
  reset: () => void
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a mutation hook with REQUIRED optimistic updates.
 *
 * This factory enforces optimistic updates at multiple levels:
 * 1. TypeScript requires `optimisticUpdate` parameter
 * 2. Runtime validation ensures it's a function
 * 3. The pattern handles all boilerplate (rollback, error state, etc.)
 *
 * @example
 * ```ts
 * // This will NOT compile - optimisticUpdate is required
 * const useBrokenMutation = createOptimisticMutation({
 *   mutationFn: async () => { ... },
 *   // ERROR: Property 'optimisticUpdate' is missing
 * })
 *
 * // This WILL compile - optimisticUpdate is provided
 * const useWorkingMutation = createOptimisticMutation({
 *   optimisticUpdate: (params) => ({ ... }),
 *   mutationFn: async () => { ... },
 * })
 * ```
 */
export function createOptimisticMutation<TParams, TResult, TCacheData>(
  config: OptimisticMutationConfig<TParams, TResult, TCacheData>
): () => OptimisticMutationResult<TParams, TResult> {
  // Runtime enforcement - belt and suspenders with TypeScript
  if (typeof config.optimisticUpdate !== 'function') {
    throw new Error(
      '[createOptimisticMutation] optimisticUpdate is REQUIRED. ' +
        'All mutations must define how they optimistically update the cache.'
    )
  }

  if (typeof config.mutationFn !== 'function') {
    throw new Error(
      '[createOptimisticMutation] mutationFn is REQUIRED. ' +
        'All mutations must define the actual mutation function.'
    )
  }

  // Return the hook factory
  return function useOptimisticMutation(): OptimisticMutationResult<TParams, TResult> {
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const reset = useCallback(() => {
      setError(null)
    }, [])

    const mutateAsync = useCallback(
      async (params: TParams): Promise<TResult> => {
        setError(null)
        setIsPending(true)

        // Get optimistic update configuration
        const { cacheKey, transform } = config.optimisticUpdate(params)

        // Capture previous cache state for rollback
        const previousData = queryClient.getQueryData<TCacheData>(cacheKey)

        // Apply optimistic update BEFORE the async operation
        const optimisticData = transform(previousData)
        queryClient.setQueryData<TCacheData>(cacheKey, optimisticData)

        try {
          // Execute the actual mutation
          const result = await config.mutationFn(params)

          // Call success handler if provided
          config.onSuccess?.(result, params)

          setIsPending(false)
          return result
        } catch (err) {
          // ROLLBACK: Restore previous cache state on error
          if (previousData !== undefined) {
            queryClient.setQueryData<TCacheData>(cacheKey, previousData)
          } else {
            // If there was no previous data, remove the optimistic entry
            queryClient.removeQueries({ queryKey: cacheKey })
          }

          const mutationError = err instanceof Error ? err : new Error('Mutation failed')
          setError(mutationError)
          setIsPending(false)

          // Call error handler if provided
          config.onError?.(mutationError, params)

          throw mutationError
        }
      },
      []
    )

    // Convenience wrapper that doesn't throw
    const mutate = useCallback(
      (params: TParams): Promise<TResult> => {
        return mutateAsync(params).catch(() => {
          // Error is captured in state, don't rethrow
          return undefined as unknown as TResult
        })
      },
      [mutateAsync]
    )

    return {
      mutate,
      mutateAsync,
      isPending,
      isError: !!error,
      error,
      reset,
    }
  }
}

