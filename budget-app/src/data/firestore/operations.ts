/**
 * INTERNAL: Raw Firestore Operations
 *
 * ⚠️ DO NOT IMPORT THIS FILE DIRECTLY ⚠️
 *
 * This module provides low-level Firestore operations for INTERNAL use only.
 * It should only be imported by:
 * - data/queries/*.ts (query hooks)
 * - data/mutations/*.ts (mutation hooks)
 * - data/cachedReads.ts (cached read functions)
 *
 * ALL external code must use:
 * - Query hooks or cachedReads for READS
 * - Mutation hooks for WRITES
 *
 * The ESLint rule 'no-restricted-imports' enforces this pattern.
 * Exceptions require eslint-disable with an explanatory comment.
 */

import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  arrayUnion,
  type Firestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type WhereFilterOp,
} from 'firebase/firestore'
import app from '../../firebase'
import { featureFlags } from '../../constants/featureFlags'
import type { AccountsMap, IncomeTransaction, CategoryAllocation, ExpenseTransaction, CategoryMonthBalance } from '../../types/budget'

// Helper to conditionally log Firebase operations with source context and document count
function logFirebase(operation: string, path: string, source: string, docCount: number = 1): void {
  if (featureFlags.logFirebaseOperations) {
    // Clean up the path for readability:
    // - budgets/budget_xxx → budgets
    // - months/budget_xxx_2025_12 → months/2025/12
    let cleanPath = path
    if (path.startsWith('budgets/')) {
      cleanPath = 'budgets'
    } else if (path.startsWith('months/')) {
      // Extract year/month from doc ID (format: budgetId_YYYY_MM)
      const docId = path.replace('months/', '')
      const parts = docId.split('_')
      if (parts.length >= 2) {
        const month = parts[parts.length - 1]
        const year = parts[parts.length - 2]
        cleanPath = `months/${year}/${month}`
      }
    }
    console.log(`[Firebase] ${operation}(${docCount}): ${cleanPath} ← ${source}`)
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

// ============================================================================
// FIRESTORE INSTANCE & REFERENCES
// ============================================================================

/**
 * Get the shared Firestore instance
 * Use this instead of importing getFirestore in other files
 */
export function getDb(): Firestore {
  return getFirestore(app)
}

/**
 * Create a document reference by path
 * Use this instead of importing doc from firebase/firestore
 */
export function getDocRef(collectionPath: string, docId: string): DocumentReference {
  return doc(getDb(), collectionPath, docId)
}

// Re-export arrayUnion for files that need it
export { arrayUnion }

// ============================================================================
// WHERE CLAUSE TYPES
// ============================================================================

export interface WhereClause {
  field: string
  op: WhereFilterOp
  value: unknown
}

/**
 * Check if a value is a Firestore field transform sentinel (arrayUnion, serverTimestamp, etc.)
 * These have a special internal structure with _methodName that must not be modified
 */
function isFirestoreSentinel(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  // Firestore sentinels have an internal _methodName property
  return '_methodName' in (value as Record<string, unknown>)
}

/**
 * Strip undefined values from an object (Firestore doesn't allow undefined)
 * Recursively removes undefined from nested objects and arrays
 * Preserves Firestore field transform sentinels (arrayUnion, serverTimestamp, etc.)
 */
export function stripUndefined<T extends FirestoreData>(obj: T): T {
  const result: FirestoreData = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    // Preserve Firestore sentinels (arrayUnion, serverTimestamp, increment, etc.) unchanged
    if (isFirestoreSentinel(value)) {
      result[key] = value
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripUndefined(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item !== null && typeof item === 'object' && !isFirestoreSentinel(item)
          ? stripUndefined(item)
          : item
      )
    } else {
      result[key] = value
    }
  }
  return result as T
}

// ============================================================================
// PATH-BASED FIRESTORE OPERATIONS (preferred - no firebase imports needed in callers)
// ============================================================================

/**
 * Read a document by collection and doc ID
 * Logs the read with full path and source context
 *
 * @param collectionPath - Firestore collection path
 * @param docId - Document ID
 * @param source - Description of what triggered this read (e.g., "useBudgetQuery: initial load")
 * @internal Use cached reads from data/ instead when possible
 */
export async function readDoc<T = FirestoreData>(
  collectionPath: string,
  docId: string,
  source: string
): Promise<{ exists: boolean; data: T | null; ref: DocumentReference }> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  logFirebase('READ', path, source)
  const snapshot = await getDoc(docRef)
  return {
    exists: snapshot.exists(),
    data: snapshot.exists() ? (snapshot.data() as T) : null,
    ref: docRef,
  }
}

/**
 * Write (set) a document by collection and doc ID
 * Logs the write with full path, source context, and data
 *
 * @param collectionPath - Firestore collection path
 * @param docId - Document ID
 * @param data - Data to write
 * @param source - Description of what triggered this write (e.g., "addIncome: saving new income transaction")
 * @param options - Firestore setDoc options
 */
export async function writeDoc(
  collectionPath: string,
  docId: string,
  data: FirestoreData,
  source: string,
  options?: { merge?: boolean }
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const cleanData = stripUndefined(data)
  const path = `${collectionPath}/${docId}`
  logFirebase('WRITE', path, source)
  return setDoc(docRef, cleanData, options ?? {})
}

/**
 * Update a document by collection and doc ID
 * Logs the update with full path, source context, and data
 *
 * @param collectionPath - Firestore collection path
 * @param docId - Document ID
 * @param data - Data to update
 * @param source - Description of what triggered this update (e.g., "updateAccounts: saving account changes")
 */
export async function updateDocByPath(
  collectionPath: string,
  docId: string,
  data: FirestoreData,
  source: string
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const cleanData = stripUndefined(data)
  const path = `${collectionPath}/${docId}`
  logFirebase('UPDATE', path, source)
  return updateDoc(docRef, cleanData)
}

/**
 * Delete a document by collection and doc ID
 * Logs the delete with full path and source context
 *
 * @param collectionPath - Firestore collection path
 * @param docId - Document ID
 * @param source - Description of what triggered this delete
 */
export async function deleteDocByPath(
  collectionPath: string,
  docId: string,
  source: string
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  logFirebase('DELETE', path, source)
  return deleteDoc(docRef)
}

/**
 * Query a collection with optional where clauses
 * Logs the query with collection name, constraints, and source context
 *
 * @param collectionPath - Firestore collection path
 * @param source - Description of what triggered this query (e.g., "useAccessibleBudgetsQuery: loading user's budgets")
 * @param whereClauses - Optional where clauses to filter the query
 * @internal Use cached reads from data/ instead when possible
 *
 * @example
 * // Simple collection read
 * const feedback = await queryCollection('feedback', 'useFeedbackQuery: loading all feedback')
 *
 * // With where clause
 * const userBudgets = await queryCollection('budgets', 'useAccessibleBudgetsQuery: loading budgets for user', [
 *   { field: 'user_ids', op: 'array-contains', value: userId }
 * ])
 */
export async function queryCollection<T = FirestoreData>(
  collectionPath: string,
  source: string,
  whereClauses?: WhereClause[]
): Promise<{ docs: Array<{ id: string; data: T }> }> {
  const db = getDb()
  const collRef = collection(db, collectionPath)

  // Build and execute query
  let q: Query
  if (whereClauses && whereClauses.length > 0) {
    const constraints = whereClauses.map(c => where(c.field, c.op, c.value))
    q = query(collRef, ...constraints)
  } else {
    q = collRef as Query
  }

  const snapshot = await getDocs(q)

  // Log AFTER query to show document count
  let logDescription = collectionPath
  if (whereClauses && whereClauses.length > 0) {
    const clauseStr = whereClauses
      .map(c => `${c.field} ${c.op} ${JSON.stringify(c.value)}`)
      .join(', ')
    logDescription += ` WHERE ${clauseStr}`
  }
  logFirebase('QUERY', logDescription, source, snapshot.docs.length)

  return {
    docs: snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data() as T,
    })),
  }
}

// ============================================================================
// REF-BASED FIRESTORE OPERATIONS (legacy - for gradual migration)
// ============================================================================

/**
 * Wrapper for Firestore setDoc that logs writes and strips undefined values
 * @deprecated Use writeDoc() instead
 */
export async function firebaseSetDoc(
  docRef: DocumentReference,
  data: FirestoreData,
  source: string,
  options?: { merge?: boolean }
): Promise<void> {
  const cleanData = stripUndefined(data)
  const docPath = docRef.path
  logFirebase('WRITE', docPath, source)
  return setDoc(docRef, cleanData, options ?? {})
}

/**
 * Wrapper for Firestore updateDoc that logs writes and strips undefined values
 * @deprecated Use updateDocByPath() instead
 */
export async function firebaseUpdateDoc(
  docRef: DocumentReference,
  data: FirestoreData,
  source: string
): Promise<void> {
  const cleanData = stripUndefined(data)
  const docPath = docRef.path
  logFirebase('UPDATE', docPath, source)
  return updateDoc(docRef, cleanData)
}

/**
 * Wrapper for Firestore deleteDoc that logs deletes
 * @deprecated Use deleteDocByPath() instead
 */
export async function firebaseDeleteDoc(docRef: DocumentReference, source: string): Promise<void> {
  const docPath = docRef.path
  logFirebase('DELETE', docPath, source)
  return deleteDoc(docRef)
}

/**
 * Wrapper for Firestore getDoc that logs reads
 * @deprecated Use readDoc() instead
 */
export async function firebaseGetDoc<T>(docRef: DocumentReference<T>, source: string): Promise<DocumentSnapshot<T>> {
  const docPath = docRef.path
  logFirebase('READ', docPath, source)
  return getDoc(docRef)
}

/**
 * Wrapper for Firestore getDocs that logs collection/query reads
 * @deprecated Use queryCollection() instead
 * @param queryRef - The Firestore query to execute
 * @param source - Description of what triggered this query
 */
export async function firebaseGetDocs<T>(queryRef: Query<T>, source: string): Promise<QuerySnapshot<T>> {
  logFirebase('QUERY', '(collection query)', source)
  return getDocs(queryRef)
}

/**
 * Clean accounts for Firestore (removes undefined values)
 * Firebase Firestore does not allow undefined values
 */
export function cleanAccountsForFirestore(accounts: AccountsMap): AccountsMap {
  const cleaned: AccountsMap = {}
  Object.entries(accounts).forEach(([accId, acc]) => {
    cleaned[accId] = {
      nickname: acc.nickname,
      balance: acc.balance,
      account_group_id: acc.account_group_id ?? null,
      sort_order: acc.sort_order,
    }
    // Only include optional fields if they have a value
    if (acc.is_income_account !== undefined) cleaned[accId].is_income_account = acc.is_income_account
    if (acc.is_income_default !== undefined) cleaned[accId].is_income_default = acc.is_income_default
    if (acc.is_outgo_account !== undefined) cleaned[accId].is_outgo_account = acc.is_outgo_account
    if (acc.is_outgo_default !== undefined) cleaned[accId].is_outgo_default = acc.is_outgo_default
    if (acc.on_budget !== undefined) cleaned[accId].on_budget = acc.on_budget
    if (acc.is_active !== undefined) cleaned[accId].is_active = acc.is_active
  })
  return cleaned
}

/**
 * Clean income array for Firestore (removes undefined values)
 */
export function cleanIncomeForFirestore(incomeList: IncomeTransaction[]): FirestoreData[] {
  return incomeList.map(inc => {
    const cleaned: FirestoreData = {
      id: inc.id,
      amount: inc.amount,
      account_id: inc.account_id,
      date: inc.date,
      created_at: inc.created_at,
    }
    if (inc.payee) cleaned.payee = inc.payee
    if (inc.description) cleaned.description = inc.description
    return cleaned
  })
}

/**
 * Clean allocations for Firestore
 */
export function cleanAllocationsForFirestore(allocationsList: CategoryAllocation[]): FirestoreData[] {
  return allocationsList.map(alloc => ({
    category_id: alloc.category_id,
    amount: alloc.amount,
  }))
}

/**
 * Clean expenses array for Firestore (removes undefined values)
 */
export function cleanExpensesForFirestore(expensesList: ExpenseTransaction[]): FirestoreData[] {
  return expensesList.map(exp => {
    const cleaned: FirestoreData = {
      id: exp.id,
      amount: exp.amount,
      category_id: exp.category_id,
      account_id: exp.account_id,
      date: exp.date,
      created_at: exp.created_at,
    }
    if (exp.payee) cleaned.payee = exp.payee
    if (exp.description) cleaned.description = exp.description
    return cleaned
  })
}

/**
 * Clean category balances for Firestore
 */
export function cleanCategoryBalancesForFirestore(balances: CategoryMonthBalance[]): FirestoreData[] {
  return balances.map(bal => ({
    category_id: bal.category_id,
    start_balance: bal.start_balance,
    allocated: bal.allocated,
    spent: bal.spent,
    end_balance: bal.end_balance,
  }))
}

/**
 * Generate month document ID
 */
export function getMonthDocId(budgetId: string, year: number, month: number): string {
  const monthStr = month.toString().padStart(2, '0')
  return `${budgetId}_${year}_${monthStr}`
}

