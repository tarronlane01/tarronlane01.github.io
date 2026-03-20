/**
 * One-Time Migrations Section
 *
 * Contains migrations that should typically only be run once.
 * Each displays as a compact row with check/apply buttons.
 */

import { MigrationSection } from '../common'
import { RemoveActiveHiddenFieldsRow } from './RemoveActiveHiddenFieldsRow'

import type { RemoveActiveHiddenFieldsMigrationStatus, RemoveActiveHiddenFieldsMigrationResult } from '@hooks/migrations/useRemoveActiveHiddenFieldsMigration'

interface OnetimeSectionProps {
  disabled: boolean
  removeActiveHiddenFieldsMigration: {
    status: RemoveActiveHiddenFieldsMigrationStatus | null
    hasData: boolean
    needsMigration: boolean
    totalItemsToFix: number
    isScanning: boolean
    isRunning: boolean
    result: RemoveActiveHiddenFieldsMigrationResult | null
    scanStatus: () => void
    runMigration: () => void
  }
}

export function OnetimeSection({
  disabled,
  removeActiveHiddenFieldsMigration,
}: OnetimeSectionProps) {
  const isAnyRunning = removeActiveHiddenFieldsMigration.isRunning

  return (
    <>
      <MigrationSection
        title="One-Time Migrations"
        icon="🎯"
        description="Migrations that typically only need to be run once. Check status first, then apply if needed."
        type="onetime"
        isAnyRunning={isAnyRunning}
      >
        {/* Remove Active/Hidden Fields Migration */}
        <RemoveActiveHiddenFieldsRow
          status={removeActiveHiddenFieldsMigration.status}
          hasData={removeActiveHiddenFieldsMigration.hasData}
          needsMigration={removeActiveHiddenFieldsMigration.needsMigration}
          totalItemsToFix={removeActiveHiddenFieldsMigration.totalItemsToFix}
          isChecking={removeActiveHiddenFieldsMigration.isScanning}
          isRunning={removeActiveHiddenFieldsMigration.isRunning}
          result={removeActiveHiddenFieldsMigration.result}
          onCheck={removeActiveHiddenFieldsMigration.scanStatus}
          onRun={removeActiveHiddenFieldsMigration.runMigration}
          disabled={disabled}
        />
      </MigrationSection>
    </>
  )
}
