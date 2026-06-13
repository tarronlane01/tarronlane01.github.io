/**
 * Shared Firestore Module
 *
 * Provides low-level Firestore operations for use by app data layers.
 * Each app's data layer (e.g., @budget/data) imports from here.
 */

// Firebase app
export { default as app } from './app'

// Instance & references
export { getDb, getDocRef, arrayUnion, arrayRemove, deleteField } from './instance'

// Shared types
export type { WhereClause, FirestoreData } from './types'

// Operations
export { readDocByPath, queryCollection, subscribeToDoc, writeDocByPath, updateDocByPath, deleteDocByPath, batchWriteDocs, batchDeleteDocs, type BatchWriteDoc, type BatchDeleteDoc } from './operations/index'
