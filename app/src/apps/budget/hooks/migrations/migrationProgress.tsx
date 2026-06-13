/**
 * Migration Progress System
 *
 * This module provides a REQUIRED progress reporting system for all migrations.
 * By design, migrations CANNOT run without showing progress in a modal.
 *
 * ARCHITECTURE:
 * - MigrationProgressContext provides the modal state and controls
 * - runMigrationWithProgress() is the ONLY way to run migrations
 * - ProgressReporter is passed to every migration function (required param)
 * - The modal cannot be dismissed while a migration is running
 *
 * WHY THIS DESIGN:
 * This makes it "very hard" to add migrations that don't show progress because:
 * 1. The migration function signature REQUIRES a ProgressReporter parameter
 * 2. TypeScript will error if you try to call runMigration without using the reporter
 * 3. The modal automatically opens when a migration starts
 * 4. The only export for running migrations is runMigrationWithProgress
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { clearAllCaches, type MigrationResultBase } from './migrationRunner'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Progress reporter that migrations MUST use to report their progress.
 * This is a required parameter for all migration functions.
 */
export interface ProgressReporter {
  /**
   * Set the current stage of the migration (e.g., "Scanning budgets", "Writing updates")
   */
  setStage: (stage: string) => void

  /**
   * Set progress percentage (0-100). Set to null for indeterminate progress.
   */
  setProgress: (percent: number | null) => void

  /**
   * Set the current item being processed (e.g., "Budget: Family Budget")
   */
  setCurrentItem: (item: string | null) => void

  /**
   * Set additional details to show below the progress bar
   */
  setDetails: (details: string | null) => void

  /**
   * Update progress with item count (convenience method)
   * @param current Current item number (1-based)
   * @param total Total number of items
   * @param itemName Optional name of current item
   */
  updateItemProgress: (current: number, total: number, itemName?: string) => void
}

export interface MigrationProgressState {
  isOpen: boolean
  migrationName: string
  stage: string
  progress: number | null // null = indeterminate
  currentItem: string | null
  details: string | null
  isComplete: boolean
  error: string | null
}

interface MigrationProgressContextType {
  state: MigrationProgressState
  /**
   * Run a migration with automatic progress modal.
   * This is the ONLY way to run migrations - ensures progress is always shown.
   */
  runMigrationWithProgress: <T extends MigrationResultBase>(
    migrationName: string,
    migrationFn: (reporter: ProgressReporter) => Promise<T>
  ) => Promise<T>
  /**
   * Close the progress modal (only works when migration is complete)
   */
  closeModal: () => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const MigrationProgressContext = createContext<MigrationProgressContextType | null>(null)

const initialState: MigrationProgressState = {
  isOpen: false,
  migrationName: '',
  stage: '',
  progress: null,
  currentItem: null,
  details: null,
  isComplete: false,
  error: null,
}

export function MigrationProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MigrationProgressState>(initialState)

  const createProgressReporter = useCallback((): ProgressReporter => {
    return {
      setStage: (stage: string) => {
        setState(prev => ({ ...prev, stage }))
      },
      setProgress: (percent: number | null) => {
        setState(prev => ({ ...prev, progress: percent }))
      },
      setCurrentItem: (item: string | null) => {
        setState(prev => ({ ...prev, currentItem: item }))
      },
      setDetails: (details: string | null) => {
        setState(prev => ({ ...prev, details: details }))
      },
      updateItemProgress: (current: number, total: number, itemName?: string) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0
        setState(prev => ({
          ...prev,
          progress: percent,
          currentItem: itemName || `Item ${current} of ${total}`,
          details: `${current} / ${total} complete`,
        }))
      },
    }
  }, [])

  const runMigrationWithProgress = useCallback(async <T extends MigrationResultBase>(
    migrationName: string,
    migrationFn: (reporter: ProgressReporter) => Promise<T>
  ): Promise<T> => {
    // Open modal and reset state
    setState({
      isOpen: true,
      migrationName,
      stage: 'Starting migration...',
      progress: null,
      currentItem: null,
      details: null,
      isComplete: false,
      error: null,
    })

    const reporter = createProgressReporter()

    try {
      // Run the migration with the progress reporter
      const result = await migrationFn(reporter)

      // Always clear caches after migration completes
      clearAllCaches()

      // Mark as complete
      setState(prev => ({
        ...prev,
        isComplete: true,
        stage: 'Migration complete',
        progress: 100,
        details: result.errors.length > 0
          ? `Completed with ${result.errors.length} error(s)`
          : 'All operations successful',
      }))

      return result
    } catch (error) {
      // Clear caches even on failure - we might have partial writes
      clearAllCaches()

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      setState(prev => ({
        ...prev,
        isComplete: true,
        error: errorMessage,
        stage: 'Migration failed',
        progress: null,
      }))

      throw error
    }
  }, [createProgressReporter])

  const closeModal = useCallback(() => {
    // Only allow closing when migration is complete
    setState(prev => {
      if (!prev.isComplete) {
        console.warn('[MigrationProgress] Cannot close modal while migration is running')
        return prev
      }
      return initialState
    })
  }, [])

  const contextValue: MigrationProgressContextType = {
    state,
    runMigrationWithProgress,
    closeModal,
  }

  return (
    <MigrationProgressContext.Provider value={contextValue}>
      {children}
    </MigrationProgressContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access the migration progress system.
 *
 * IMPORTANT: All migrations MUST use runMigrationWithProgress from this hook.
 * This ensures progress is always shown in a modal.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useMigrationProgress() {
  const context = useContext(MigrationProgressContext)
  if (!context) {
    throw new Error('useMigrationProgress must be used within MigrationProgressProvider')
  }
  return context
}

