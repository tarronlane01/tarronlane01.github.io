/**
 * One-Time Migrations Section
 *
 * Contains migrations that should typically only be run once.
 * Each displays as a compact row with check/apply buttons.
 *
 * To add a new migration:
 * 1. Create a migration hook in hooks/migrations/ (see useEnsureUngroupedGroups.ts as example)
 * 2. Create a migration row component in this folder (see EnsureUngroupedGroupsRow.tsx as example)
 * 3. Add the migration hook to hooks/migrations/index.ts
 * 4. Add the migration hook to hooks/index.ts
 * 5. Import and use the migration row component below
 * 6. Add the migration hook usage in pages/budget/admin/Migration.tsx
 * 7. Pass the migration props to this OnetimeSection component
 */

import { MigrationSection } from '../common'
// Import migration row components here when adding new migrations
// Example: import { MyNewMigrationRow } from './MyNewMigrationRow'

interface OnetimeSectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean
  // Add migration props here when adding new migrations
  // Example: myNewMigration: { ... }
}

export function OnetimeSection({
  // These props are part of the interface and will be used when migrations are added
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disabled: _disabled,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDownloadBackup: _onDownloadBackup,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isDownloadingBackup: _isDownloadingBackup,
}: OnetimeSectionProps) {
  // Track if any migration is running
  const isAnyRunning = false // Set to true when migrations are running

  // Add backup prompts for migrations here
  // Example:
  // const myNewMigrationBackup = useBackupPrompt({
  //   migrationName: 'My New Migration',
  //   isDestructive: false,
  //   onDownloadBackup,
  // })

  return (
    <>
      <MigrationSection
        title="One-Time Migrations"
        icon="🎯"
        description="Migrations that typically only need to be run once. Check status first, then apply if needed."
        type="onetime"
        isAnyRunning={isAnyRunning}
      >
        {/* Add migration rows here */}
        {/* Example:
        <MyNewMigrationRow
          status={myNewMigration.status}
          hasData={myNewMigration.hasData}
          needsMigration={myNewMigration.needsMigration}
          totalBudgetsToUpdate={myNewMigration.totalBudgetsToUpdate}
          isChecking={myNewMigration.isScanning}
          isRunning={myNewMigration.isRunning}
          result={myNewMigration.result}
          onCheck={myNewMigration.scanStatus}
          onRun={() => myNewMigrationBackup.promptBeforeAction(myNewMigration.runMigration)}
          disabled={_disabled}
        />
        */}
        {null}
      </MigrationSection>

      {/* Add backup prompts here */}
      {/* Example: <BackupPrompt {...myNewMigrationBackup.promptProps} isDownloading={isDownloadingBackup} /> */}
    </>
  )
}

