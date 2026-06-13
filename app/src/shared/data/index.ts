/**
 * Shared Data Layer
 *
 * Provides React Query client, query provider, and Firestore infrastructure
 * shared by all apps. App-specific queries/mutations live in each app's data layer.
 */

// Query client and provider
export { queryClient } from './queryClient'
export { QueryProvider } from './QueryProvider'
