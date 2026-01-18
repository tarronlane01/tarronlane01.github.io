/**
 * Sync Context
 *
 * Manages document change tracking, background saves, and sync state.
 * Tracks which documents have been modified locally and need to be saved to Firestore.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type DocumentType = 'month' | 'budget' | 'payees'

export interface DocumentChange {
  type: DocumentType
  budgetId: string
  /** For month documents: year and month. For budget/payees: undefined */
  year?: number
  month?: number
  /** Timestamp when the change was made */
  timestamp: number
}

interface SyncContextType {
  // Change tracking
  trackChange: (change: Omit<DocumentChange, 'timestamp'>) => void
  clearChanges: () => void
  removeChange: (change: Omit<DocumentChange, 'timestamp'>) => void
  getChanges: () => DocumentChange[]
  hasChanges: () => boolean

  // Save state
  isSaving: boolean
  lastSaveTime: number | null
  saveError: string | null
  clearSaveError: () => void
  setIsSaving: (saving: boolean) => void
  setLastSaveTime: (time: number | null) => void
  setSaveError: (error: string | null) => void

  // Sync state
  syncError: string | null
  setSyncError: (error: string | null) => void
}

// ============================================================================
// DEFAULT CONTEXT VALUE
// ============================================================================

const defaultContextValue: SyncContextType = {
  trackChange: () => {},
  clearChanges: () => {},
  removeChange: () => {},
  getChanges: () => [],
  hasChanges: () => false,
  isSaving: false,
  setIsSaving: () => {},
  lastSaveTime: null,
  setLastSaveTime: () => {},
  saveError: null,
  setSaveError: () => {},
  clearSaveError: () => {},
  syncError: null,
  setSyncError: () => {},
}

const SyncContext = createContext<SyncContextType>(defaultContextValue)

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function SyncProvider({ children }: { children: ReactNode }) {
  // Track document changes (using Map to avoid duplicates)
  const [changes, setChanges] = useState<Map<string, DocumentChange>>(new Map())

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync state
  const [syncError, setSyncError] = useState<string | null>(null)

  // Expose setters for save state (used by useBackgroundSave)
  const setIsSavingState = useCallback((saving: boolean) => {
    setIsSaving(saving)
  }, [])

  const setLastSaveTimeState = useCallback((time: number | null) => {
    setLastSaveTime(time)
  }, [])

  const setSaveErrorState = useCallback((error: string | null) => {
    setSaveError(error)
  }, [])

  /**
   * Generate a unique key for a document change
   */
  const getChangeKey = useCallback((change: Omit<DocumentChange, 'timestamp'>): string => {
    if (change.type === 'month' && change.year !== undefined && change.month !== undefined) {
      return `${change.type}:${change.budgetId}:${change.year}:${change.month}`
    }
    return `${change.type}:${change.budgetId}`
  }, [])

  /**
   * Track a document change
   */
  const trackChange = useCallback((change: Omit<DocumentChange, 'timestamp'>) => {
    setChanges(prev => {
      const next = new Map(prev)
      const key = getChangeKey(change)
      next.set(key, {
        ...change,
        timestamp: Date.now(),
      })
      return next
    })
  }, [getChangeKey])

  /**
   * Clear all tracked changes
   */
  const clearChanges = useCallback(() => {
    setChanges(new Map())
  }, [])

  /**
   * Remove a specific change from tracking
   */
  const removeChange = useCallback((change: Omit<DocumentChange, 'timestamp'>) => {
    setChanges(prev => {
      const next = new Map(prev)
      const key = getChangeKey(change)
      next.delete(key)
      return next
    })
  }, [getChangeKey])

  /**
   * Get all tracked changes
   */
  const getChanges = useCallback((): DocumentChange[] => {
    return Array.from(changes.values())
  }, [changes])

  /**
   * Check if there are any tracked changes
   */
  const hasChanges = useCallback((): boolean => {
    return changes.size > 0
  }, [changes])

  /**
   * Clear save error
   */
  const clearSaveError = useCallback(() => {
    setSaveError(null)
  }, [])

  const contextValue: SyncContextType = {
    trackChange,
    clearChanges,
    removeChange,
    getChanges,
    hasChanges,
    isSaving,
    lastSaveTime,
    saveError,
    clearSaveError,
    setIsSaving: setIsSavingState,
    setLastSaveTime: setLastSaveTimeState,
    setSaveError: setSaveErrorState,
    syncError,
    setSyncError,
  }

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}

