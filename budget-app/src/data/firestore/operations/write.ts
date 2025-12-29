/**
 * Firestore Write Operations
 *
 * Operations for writing, updating, and deleting documents.
 */

import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { getDb } from '@firestore/instance'
import { logFirebase } from '@firestore/logger'
import type { FirestoreData } from '@firestore/types/index'

export async function writeDocByPath(
  collectionPath: string,
  docId: string,
  data: FirestoreData,
  source: string,
  options?: { merge?: boolean }
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  // Putting this here so that all writes to firebase will always have a console log
  // So I can see how often writes are happening
  logFirebase('WRITE', path, source)
  return setDoc(docRef, data, options ?? {})
}

export async function updateDocByPath(
  collectionPath: string,
  docId: string,
  data: FirestoreData,
  source: string
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  // Putting this here so I can easily track firebase reads in the console
  logFirebase('UPDATE', path, source)
  return updateDoc(docRef, data)
}

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

