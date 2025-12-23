// Centralized Firestore access layer
// ALL Firestore operations should go through this module
// Other files should NOT import from firebase/firestore directly

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
import app from '../firebase'
import type { AccountsMap, IncomeTransaction, CategoryAllocation, ExpenseTransaction, CategoryMonthBalance } from '../types/budget'

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
 * Strip undefined values from an object (Firestore doesn't allow undefined)
 * Recursively removes undefined from nested objects and arrays
 */
export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripUndefined(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item !== null && typeof item === 'object' ? stripUndefined(item) : item
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
 * Logs the read with full path
 */
export async function readDoc<T = Record<string, any>>(
  collectionPath: string,
  docId: string
): Promise<{ exists: boolean; data: T | null; ref: DocumentReference }> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  console.log('[Firebase] READ getDoc:', path)
  const snapshot = await getDoc(docRef)
  return {
    exists: snapshot.exists(),
    data: snapshot.exists() ? (snapshot.data() as T) : null,
    ref: docRef,
  }
}

/**
 * Write (set) a document by collection and doc ID
 * Logs the write with full path and data
 */
export async function writeDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, any>,
  options?: { merge?: boolean }
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const cleanData = stripUndefined(data)
  const path = `${collectionPath}/${docId}`
  console.log('[Firebase] WRITE setDoc:', path, cleanData)
  return setDoc(docRef, cleanData, options ?? {})
}

/**
 * Update a document by collection and doc ID
 * Logs the update with full path and data
 */
export async function updateDocByPath(
  collectionPath: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const cleanData = stripUndefined(data)
  const path = `${collectionPath}/${docId}`
  console.log('[Firebase] WRITE updateDoc:', path, cleanData)
  return updateDoc(docRef, cleanData)
}

/**
 * Delete a document by collection and doc ID
 * Logs the delete with full path
 */
export async function deleteDocByPath(
  collectionPath: string,
  docId: string
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  console.log('[Firebase] DELETE:', path)
  return deleteDoc(docRef)
}

/**
 * Query a collection with optional where clauses
 * Logs the query with collection name and constraints
 *
 * @example
 * // Simple collection read
 * const feedback = await queryCollection('feedback')
 *
 * // With where clause
 * const userBudgets = await queryCollection('budgets', [
 *   { field: 'user_ids', op: 'array-contains', value: userId }
 * ])
 */
export async function queryCollection<T = Record<string, any>>(
  collectionPath: string,
  whereClauses?: WhereClause[]
): Promise<{ docs: Array<{ id: string; data: T }> }> {
  const db = getDb()
  const collRef = collection(db, collectionPath)

  // Build log description
  let logDescription = collectionPath
  if (whereClauses && whereClauses.length > 0) {
    const clauseStr = whereClauses
      .map(c => `${c.field} ${c.op} ${JSON.stringify(c.value)}`)
      .join(', ')
    logDescription += ` WHERE ${clauseStr}`
  }
  console.log('[Firebase] READ getDocs:', logDescription)

  // Build and execute query
  let q: Query
  if (whereClauses && whereClauses.length > 0) {
    const constraints = whereClauses.map(c => where(c.field, c.op, c.value))
    q = query(collRef, ...constraints)
  } else {
    q = collRef as Query
  }

  const snapshot = await getDocs(q)
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
  data: Record<string, any>,
  options?: { merge?: boolean }
): Promise<void> {
  const cleanData = stripUndefined(data)
  const docPath = docRef.path
  console.log('[Firebase] WRITE setDoc:', docPath, cleanData)
  return setDoc(docRef, cleanData, options ?? {})
}

/**
 * Wrapper for Firestore updateDoc that logs writes and strips undefined values
 * @deprecated Use updateDocByPath() instead
 */
export async function firebaseUpdateDoc(
  docRef: DocumentReference,
  data: Record<string, any>
): Promise<void> {
  const cleanData = stripUndefined(data)
  const docPath = docRef.path
  console.log('[Firebase] WRITE updateDoc:', docPath, cleanData)
  return updateDoc(docRef, cleanData)
}

/**
 * Wrapper for Firestore deleteDoc that logs deletes
 * @deprecated Use deleteDocByPath() instead
 */
export async function firebaseDeleteDoc(docRef: DocumentReference): Promise<void> {
  const docPath = docRef.path
  console.log('[Firebase] DELETE:', docPath)
  return deleteDoc(docRef)
}

/**
 * Wrapper for Firestore getDoc that logs reads
 * @deprecated Use readDoc() instead
 */
export async function firebaseGetDoc<T>(docRef: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const docPath = docRef.path
  console.log('[Firebase] READ getDoc:', docPath)
  return getDoc(docRef)
}

/**
 * Wrapper for Firestore getDocs that logs collection/query reads
 * @deprecated Use queryCollection() instead
 * @param queryRef - The Firestore query to execute
 * @param label - Optional label describing what is being queried (e.g., "budgets for user", "months for budget")
 */
export async function firebaseGetDocs<T>(queryRef: Query<T>, label?: string): Promise<QuerySnapshot<T>> {
  const description = label ? label : '(collection query)'
  console.log('[Firebase] READ getDocs:', description)
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
export function cleanIncomeForFirestore(incomeList: IncomeTransaction[]): Record<string, any>[] {
  return incomeList.map(inc => {
    const cleaned: Record<string, any> = {
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
export function cleanAllocationsForFirestore(allocationsList: CategoryAllocation[]): Record<string, any>[] {
  return allocationsList.map(alloc => ({
    category_id: alloc.category_id,
    amount: alloc.amount,
  }))
}

/**
 * Clean expenses array for Firestore (removes undefined values)
 */
export function cleanExpensesForFirestore(expensesList: ExpenseTransaction[]): Record<string, any>[] {
  return expensesList.map(exp => {
    const cleaned: Record<string, any> = {
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
export function cleanCategoryBalancesForFirestore(balances: CategoryMonthBalance[]): Record<string, any>[] {
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

