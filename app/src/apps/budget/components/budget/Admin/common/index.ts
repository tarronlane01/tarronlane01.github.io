/**
 * Common Migration Components
 *
 * Shared components for the reorganized migration architecture.
 */

// Backup Prompt - enforces backup before migrations
export { BackupPrompt, type BackupChoice, type BackupPromptProps } from './BackupPrompt'
export { useBackupPrompt } from './useBackupPrompt'

// Section Container
export { MigrationSection, type SectionType } from './MigrationSection'

// Row Components
export { MigrationRow, UtilityRow, type MigrationRowStatus } from './MigrationRow'

