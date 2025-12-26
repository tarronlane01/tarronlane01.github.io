import type { ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

export interface StatGridItem {
  label: string
  value: ReactNode
  /** Optional subtitle text below the value */
  subtitle?: string
  /** Optional action element (e.g., edit button) */
  action?: ReactNode
}

interface FourStatGridProps {
  /**
   * Exactly 4 stat items. On mobile, they reorder into a 2x2 grid:
   * - Desktop row: [0] [1] [2] [3]
   * - Mobile grid:  [0] [3]
   *                 [1] [2]
   * This keeps "start" and "end" values in the top row on mobile.
   */
  items: [StatGridItem, StatGridItem, StatGridItem, StatGridItem]
}

/**
 * Responsive grid for displaying 4 summary statistics.
 * - Desktop: horizontal row of 4
 * - Mobile: 2x2 grid with items reordered (positions 0,3 on top, 1,2 on bottom)
 */
export function FourStatGrid({ items }: FourStatGridProps) {
  const isMobile = useIsMobile()

  // Order mapping: desktop [1,2,3,4], mobile [1,4,3,2] for 2x2 where row1=[0,3], row2=[1,2]
  // Using CSS order: item0=1, item1=mobile?3:2, item2=mobile?4:3, item3=mobile?2:4
  const getOrder = (index: number): number => {
    if (!isMobile) return index + 1
    // Mobile: 0→1, 1→3, 2→4, 3→2
    const mobileOrder = [1, 3, 4, 2]
    return mobileOrder[index]
  }

  // Border logic for each position
  const getBorders = (index: number) => {
    if (isMobile) {
      // Mobile 2x2: borders depend on visual position after ordering
      // Position 0 (order 1): top-left → right border, bottom border
      // Position 3 (order 2): top-right → bottom border only
      // Position 1 (order 3): bottom-left → right border only
      // Position 2 (order 4): bottom-right → no borders
      switch (index) {
        case 0: return { borderRight: true, borderBottom: true }
        case 3: return { borderRight: false, borderBottom: true }
        case 1: return { borderRight: true, borderBottom: false }
        case 2: return { borderRight: false, borderBottom: false }
        default: return { borderRight: false, borderBottom: false }
      }
    } else {
      // Desktop: all except last have right border
      return { borderRight: index < 3, borderBottom: false }
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      marginBottom: '1.5rem',
      overflow: 'hidden',
    }}>
      {items.map((item, index) => {
        const borders = getBorders(index)
        return (
          <div
            key={index}
            style={{
              padding: '0.75rem 1rem',
              borderRight: borders.borderRight ? '1px solid color-mix(in srgb, currentColor 10%, transparent)' : 'none',
              borderBottom: borders.borderBottom ? '1px solid color-mix(in srgb, currentColor 10%, transparent)' : 'none',
              textAlign: 'center',
              order: getOrder(index),
            }}
          >
            <p style={{
              margin: 0,
              fontSize: '0.75rem',
              opacity: 0.6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {item.label}
            </p>
            <div style={{
              margin: '0.25rem 0 0 0',
              fontSize: '1.1rem',
              fontWeight: 600,
            }}>
              {item.value}
            </div>
            {item.subtitle && (
              <p style={{
                margin: '0.1rem 0 0 0',
                fontSize: '0.65rem',
                opacity: 0.5
              }}>
                {item.subtitle}
              </p>
            )}
            {item.action && (
              <div style={{ marginTop: '0.25rem' }}>
                {item.action}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

