/**
 * Firestore Instance & References
 *
 * Core database instance and document reference helpers.
 */

import { getFirestore, doc, arrayUnion, type Firestore, type DocumentReference } from 'firebase/firestore'
import app from '@firestore/app'

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

