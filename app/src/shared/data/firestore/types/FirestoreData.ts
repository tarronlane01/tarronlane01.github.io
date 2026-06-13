/**
 * Raw Firestore document data - structure determined at runtime.
 * Using `any` is intentional here because:
 * 1. Firestore documents have flexible schemas
 * 2. We often access nested properties dynamically
 * 3. Type narrowing for every access would be verbose
 *
 * eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FirestoreData = Record<string, any>

