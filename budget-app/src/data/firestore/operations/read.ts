/**
 * Firestore Read Operations
 *
 * Operations for reading documents and querying collections.
 */

import { doc, collection, query, where, getDoc, getDocs, type Query, type DocumentReference } from 'firebase/firestore'
import { getDb } from '@firestore/instance'
import { logFirebase } from '@firestore/logger'
import type { WhereClause, FirestoreData } from '@firestore/types/index'

export async function readDocByPath<T = FirestoreData>(
  collectionPath: string,
  docId: string,
  source: string
): Promise<{ exists: boolean; data: T | null; ref: DocumentReference }> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  const snapshot = await getDoc(docRef)
  const exists = snapshot.exists()

  // Log after read so we can include existence info
  logFirebase('READ', path, source, 1, exists)

  return {
    exists,
    data: exists ? (snapshot.data() as T) : null,
    ref: docRef,
  }
}

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
    const clauseStr = whereClauses.map(c => `${c.field} ${c.op} ${JSON.stringify(c.value)}`).join(', ')
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

