/**
 * Feedback Migration Hook
 *
 * Fixes feedback documents with issues:
 * 1. Sanitized doc IDs (e.g., "user_gmail.com" -> "user@gmail.com")
 * 2. Corrupted arrayUnion sentinels in items field
 *
 * Uses the migration framework to ensure cache invalidation.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { readDocByPath, writeDocByPath, queryCollection, deleteDocByPath } from '@firestore'
import { runMigration } from './migrationRunner'

// Types
interface FeedbackItem {
  id: string
  text: string
  created_at: string
  is_done: boolean
  completed_at: string | null
  sort_order: number
  feedback_type?: string
}

export interface FeedbackMigrationResult {
  documentsFound: number
  sanitizedDocuments: string[]
  corruptedDocuments: string[]
  mergedItems: number
  deletedDocuments: number
  fixedDocuments: number
  errors: string[]
}

// Helper functions

/**
 * Check if a document ID is a sanitized email
 * Detects: "user_gmail_com" or "user_gmail.com" instead of "user@gmail.com"
 */
function isSanitizedEmailDocId(docId: string): boolean {
  if (docId.includes('@')) return false

  // Pattern 1: Full sanitization (e.g., "user_gmail_com")
  const fullSanitizedPattern = /_[a-z0-9]+_(com|org|net|edu|io|co|uk|gov|mil|biz|info)$/i
  if (fullSanitizedPattern.test(docId)) {
    const underscoreCount = (docId.match(/_/g) || []).length
    if (underscoreCount >= 2) return true
  }

  // Pattern 2: Partial sanitization (e.g., "user_gmail.com")
  const partialSanitizedPattern = /_[a-z0-9]+\.(com|org|net|edu|io|co|uk|gov|mil|biz|info)$/i
  if (partialSanitizedPattern.test(docId)) {
    const underscoreCount = (docId.match(/_/g) || []).length
    if (underscoreCount >= 1) return true
  }

  return false
}

/**
 * Convert sanitized doc ID back to email format
 */
function unsanitizeDocId(docId: string): string {
  let email = docId

  // Handle partial sanitization first (e.g., "tarronlane_gmail.com")
  const partialPattern = /^(.+)_(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail)\.(.+)$/i
  const partialMatch = email.match(partialPattern)
  if (partialMatch) {
    return `${partialMatch[1]}@${partialMatch[2]}.${partialMatch[3]}`
  }

  // Handle full sanitization (e.g., "tarronlane_gmail_com")
  email = email
    .replace(/_com$/, '.com')
    .replace(/_net$/, '.net')
    .replace(/_org$/, '.org')
    .replace(/_edu$/, '.edu')
    .replace(/_io$/, '.io')

  email = email
    .replace(/_gmail_/, '@gmail.')
    .replace(/_yahoo_/, '@yahoo.')
    .replace(/_hotmail_/, '@hotmail.')
    .replace(/_outlook_/, '@outlook.')
    .replace(/_icloud_/, '@icloud.')

  return email
}

/**
 * Check if items field is a corrupted arrayUnion sentinel
 */
function isCorruptedArrayUnion(items: unknown): items is { _methodName: string; vc: FeedbackItem[] } {
  if (items === null || typeof items !== 'object' || Array.isArray(items)) return false
  const obj = items as Record<string, unknown>
  return obj._methodName === 'arrayUnion' && Array.isArray(obj.vc)
}

/**
 * Extract items from corrupted arrayUnion
 */
function extractItemsFromCorrupted(items: { _methodName: string; vc: FeedbackItem[] }): FeedbackItem[] {
  return items.vc || []
}

/**
 * Get items from document, handling both normal and corrupted formats
 */
function getItemsFromDoc(data: { items?: FeedbackItem[] | { _methodName: string; vc: FeedbackItem[] } }): FeedbackItem[] {
  if (Array.isArray(data.items)) {
    return data.items
  }
  if (isCorruptedArrayUnion(data.items)) {
    return extractItemsFromCorrupted(data.items)
  }
  return []
}

// Hook
export interface FeedbackMigrationStatus {
  documentsFound: number
  sanitizedDocuments: string[]
  corruptedDocuments: string[]
  isHealthy: boolean
}

interface UseFeedbackMigrationOptions {
  currentUser: unknown
}

export function useFeedbackMigration({ currentUser }: UseFeedbackMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isMigratingFeedback, setIsMigratingFeedback] = useState(false)
  const [status, setStatus] = useState<FeedbackMigrationStatus | null>(null)
  const [feedbackMigrationResult, setFeedbackMigrationResult] = useState<FeedbackMigrationResult | null>(null)

  /**
   * Scan feedback documents for issues (doesn't fix them)
   */
  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    const scanResult: FeedbackMigrationStatus = {
      documentsFound: 0,
      sanitizedDocuments: [],
      corruptedDocuments: [],
      isHealthy: true,
    }

    try {
      const feedbackResult = await queryCollection<{
        items?: FeedbackItem[] | { _methodName: string; vc: FeedbackItem[] }
      }>(
        'feedback',
        'feedback migration: scanning for issues'
      )

      scanResult.documentsFound = feedbackResult.docs.length

      for (const docSnap of feedbackResult.docs) {
        if (isSanitizedEmailDocId(docSnap.id)) {
          scanResult.sanitizedDocuments.push(docSnap.id)
        }
        if (isCorruptedArrayUnion(docSnap.data.items)) {
          scanResult.corruptedDocuments.push(docSnap.id)
        }
      }

      scanResult.isHealthy = scanResult.sanitizedDocuments.length === 0 && scanResult.corruptedDocuments.length === 0
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan feedback:', err)
    } finally {
      setIsScanning(false)
    }
  }

  /**
   * Fix feedback documents using the migration framework (guarantees cache invalidation):
   * 1. Fix corrupted arrayUnion sentinels
   * 2. Merge sanitized doc IDs into proper email format
   */
  async function migrateFeedbackDocuments(): Promise<void> {
    if (!currentUser) return

    setIsMigratingFeedback(true)

    try {
      // runMigration automatically clears all caches after completion
      const result = await runMigration(async () => {
        const migrationResult: FeedbackMigrationResult = {
          documentsFound: 0,
          sanitizedDocuments: [],
          corruptedDocuments: [],
          mergedItems: 0,
          deletedDocuments: 0,
          fixedDocuments: 0,
          errors: [],
        }

        const feedbackResult = await queryCollection<{
          items?: FeedbackItem[] | { _methodName: string; vc: FeedbackItem[] }
          user_email?: string
          created_at?: string
          updated_at?: string
        }>(
          'feedback',
          'feedback migration: listing all documents'
        )

        migrationResult.documentsFound = feedbackResult.docs.length

        // First pass: Fix corrupted documents (but not sanitized ones)
        for (const docSnap of feedbackResult.docs) {
          const isSanitized = isSanitizedEmailDocId(docSnap.id)
          const isCorrupted = isCorruptedArrayUnion(docSnap.data.items)

          if (isCorrupted && !isSanitized) {
            migrationResult.corruptedDocuments.push(docSnap.id)
            const extractedItems = extractItemsFromCorrupted(docSnap.data.items as { _methodName: string; vc: FeedbackItem[] })

            try {
              await writeDocByPath(
                'feedback',
                docSnap.id,
                {
                  items: extractedItems,
                  user_email: docSnap.data.user_email || docSnap.id,
                  created_at: docSnap.data.created_at || new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                `feedback migration: fixing corrupted arrayUnion in ${docSnap.id}`
              )
              migrationResult.fixedDocuments++
            } catch (err) {
              migrationResult.errors.push(`Failed to fix ${docSnap.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
            }
          }
        }

        // Second pass: Migrate sanitized documents
        for (const docSnap of feedbackResult.docs) {
          if (isSanitizedEmailDocId(docSnap.id)) {
            migrationResult.sanitizedDocuments.push(docSnap.id)

            const sanitizedId = docSnap.id
            const properEmailId = unsanitizeDocId(sanitizedId)
            const sanitizedItems = getItemsFromDoc(docSnap.data)

            const { exists: properExists, data: properData } = await readDocByPath<{
              items?: FeedbackItem[] | { _methodName: string; vc: FeedbackItem[] }
              user_email?: string
              created_at?: string
              updated_at?: string
            }>(
              'feedback',
              properEmailId,
              `feedback migration: checking if ${properEmailId} exists`
            )

            if (properExists && properData) {
              const existingItems = getItemsFromDoc(properData)
              const existingIds = new Set(existingItems.map(i => i.id))
              const newItems = sanitizedItems.filter(item => !existingIds.has(item.id))

              if (newItems.length > 0 || isCorruptedArrayUnion(properData.items)) {
                const mergedItems = [...existingItems, ...newItems]
                await writeDocByPath(
                  'feedback',
                  properEmailId,
                  {
                    ...properData,
                    items: mergedItems,
                    updated_at: new Date().toISOString(),
                  },
                  `feedback migration: merging ${newItems.length} items from ${sanitizedId}`
                )
                migrationResult.mergedItems += newItems.length
              }
            } else if (sanitizedItems.length > 0) {
              await writeDocByPath(
                'feedback',
                properEmailId,
                {
                  items: sanitizedItems,
                  user_email: properEmailId,
                  created_at: docSnap.data.created_at || new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                `feedback migration: creating ${properEmailId} from ${sanitizedId}`
              )
              migrationResult.mergedItems += sanitizedItems.length
            }

            // Delete the sanitized document
            try {
              await deleteDocByPath(
                'feedback',
                sanitizedId,
                `feedback migration: deleting sanitized document ${sanitizedId}`
              )
              migrationResult.deletedDocuments++
            } catch (err) {
              migrationResult.errors.push(`Failed to delete ${sanitizedId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
            }
          }
        }

        return migrationResult
      })

      setFeedbackMigrationResult(result)
    } catch (err) {
      setFeedbackMigrationResult({
        documentsFound: 0,
        sanitizedDocuments: [],
        corruptedDocuments: [],
        mergedItems: 0,
        deletedDocuments: 0,
        fixedDocuments: 0,
        errors: [err instanceof Error ? err.message : 'Migration failed'],
      })
    } finally {
      setIsMigratingFeedback(false)
    }
  }

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    // Migration
    isMigratingFeedback,
    feedbackMigrationResult,
    migrateFeedbackDocuments,
  }
}

