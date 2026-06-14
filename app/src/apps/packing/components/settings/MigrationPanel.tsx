import { useState } from 'react'
import { CollapsibleSection, Button } from '@components/ui'
import { usePackingMigrations } from '@packing/data/mutations/migrate'
import type { PackingDocument } from '@packing/data/types'

interface MigrationPanelProps {
  packing: PackingDocument
}

export function MigrationPanel({ packing }: MigrationPanelProps) {
  const { migrateSectionsToPhases, migratePersonsToPerPerson } = usePackingMigrations()
  const [sectionStatus, setSectionStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [perPersonStatus, setPerPersonStatus] = useState<'idle' | 'running' | 'done'>('idle')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasSections = Object.keys((packing as any).sections ?? {}).length > 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasPerPersonField = Object.values(packing.items).some((item: any) => 'perPerson' in item)

  if (!hasSections && !hasPerPersonField && sectionStatus === 'idle' && perPersonStatus === 'idle') return null

  return (
    <CollapsibleSection title="Migration" defaultExpanded>
      {(hasSections || sectionStatus !== 'idle') && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Convert legacy sections to phases:
          </p>
          <ul style={{ fontSize: '0.85rem', margin: '0 0 0.75rem', paddingLeft: '1.5rem' }}>
            <li>Create a phase for each section</li>
            <li>Assign phaseId to items based on their category&apos;s section</li>
            <li>Simplify categories (remove section/sort fields)</li>
          </ul>
          {sectionStatus === 'done' ? (
            <p style={{ fontSize: '0.9rem', color: 'var(--color-success)' }}>Migration complete.</p>
          ) : (
            <Button
              variant="small"
              disabled={!hasSections || sectionStatus === 'running'}
              onClick={async () => { setSectionStatus('running'); await migrateSectionsToPhases(packing); setSectionStatus('done') }}
            >
              {sectionStatus === 'running' ? 'Running...' : 'Run Sections Migration'}
            </Button>
          )}
        </div>
      )}
      {(hasPerPersonField || perPersonStatus !== 'idle') && (
        <div>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Remove perPerson flag and convert non-per-person person references to features:
          </p>
          <ul style={{ fontSize: '0.85rem', margin: '0 0 0.75rem', paddingLeft: '1.5rem' }}>
            <li>Items with personIds but perPerson=false get persons converted to features</li>
            <li>Matching trips updated with new feature IDs</li>
            <li>perPerson field removed from all items</li>
          </ul>
          {perPersonStatus === 'done' ? (
            <p style={{ fontSize: '0.9rem', color: 'var(--color-success)' }}>Migration complete.</p>
          ) : (
            <Button
              variant="small"
              disabled={!hasPerPersonField || perPersonStatus === 'running'}
              onClick={async () => { setPerPersonStatus('running'); await migratePersonsToPerPerson(packing); setPerPersonStatus('done') }}
            >
              {perPersonStatus === 'running' ? 'Running...' : 'Run Per-Person Migration'}
            </Button>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}
