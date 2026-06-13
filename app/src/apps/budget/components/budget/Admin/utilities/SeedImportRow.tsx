/**
 * Seed Import Row
 *
 * Wrapper that embeds the existing SeedImportCard functionality in a row-like format.
 * Since seed import has complex UI (file upload, mapping), we keep it as an expandable card.
 */

import { useState } from 'react'
import { SeedImportCard } from '../SeedImportCard'

interface SeedImportRowProps {
  disabled: boolean
}

export function SeedImportRow({ disabled }: SeedImportRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '8px',
      margin: '0.25rem 0',
      overflow: 'hidden',
    }}>
      {/* Main Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          gap: '1rem',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status Indicator */}
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--color-success) 20%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          flexShrink: 0,
        }}>
          📥
        </div>

        {/* Name and Description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 500,
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Seed Data Import
          </div>
          <div style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Import historical data from CSV with category/account mapping
          </div>
        </div>

        {/* Status */}
        <div style={{
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          fontWeight: 500,
          flexShrink: 0,
        }}>
          {isExpanded ? 'Expanded' : 'Click to expand'}
        </div>

        {/* Expand Button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
          style={{
            background: 'transparent',
            color: 'inherit',
            border: 'none',
            padding: '0.35rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            opacity: 0.6,
          }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Expandable Card Content */}
      {isExpanded && (
        <div style={{
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          padding: '1rem',
          background: 'color-mix(in srgb, currentColor 2%, transparent)',
        }}>
          {/* Re-use existing SeedImportCard but without the outer MigrationCard wrapper */}
          <SeedImportCardInner disabled={disabled} />
        </div>
      )}
    </div>
  )
}

// Inner component that renders SeedImportCard content without double-wrapping
function SeedImportCardInner({ disabled }: { disabled: boolean }) {
  // We just render the full SeedImportCard - it will have its own styling
  // but since it's embedded in our expandable row, it looks integrated
  return <SeedImportCard disabled={disabled} />
}

