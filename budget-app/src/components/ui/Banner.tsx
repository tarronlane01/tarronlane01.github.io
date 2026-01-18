/**
 * Banner Component
 *
 * Reusable banner for showing alerts, errors, and confirmations.
 * Can be used for feedback confirmations, save errors, sync errors, etc.
 */

import { useEffect, useState } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type BannerType = 'success' | 'error' | 'warning' | 'info'

export interface BannerItem {
  id: string
  type: BannerType
  message: string
  /** Auto-dismiss after this many milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number
}

interface BannerProps {
  item: BannerItem | null
  onDismiss: (id: string) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

const BANNER_STYLES: Record<BannerType, { bgColor: string; color: string; icon: string }> = {
  success: {
    bgColor: 'rgba(46, 213, 115, 0.95)',
    color: 'white',
    icon: '✓',
  },
  error: {
    bgColor: 'rgba(255, 71, 87, 0.95)',
    color: 'white',
    icon: '✕',
  },
  warning: {
    bgColor: 'rgba(255, 165, 2, 0.95)',
    color: 'white',
    icon: '⚠',
  },
  info: {
    bgColor: 'rgba(30, 144, 255, 0.95)',
    color: 'white',
    icon: 'ℹ',
  },
}

export function Banner({ item, onDismiss }: BannerProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (item) {
      // Fade in - setState in effect is intentional for animation
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true)

      // Auto-dismiss if configured
      if (item.autoDismissMs && item.autoDismissMs > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false)
          setTimeout(() => onDismiss(item.id), 200) // Wait for fade out
        }, item.autoDismissMs)

        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
    }
  }, [item, onDismiss])

  if (!item || !isVisible) {
    return null
  }

  const style = BANNER_STYLES[item.type]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        left: '1.5rem',
        maxWidth: '600px',
        margin: '0 auto',
        background: style.bgColor,
        color: style.color,
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        animation: isVisible ? 'fadeInUp 0.2s ease-out' : 'fadeOut 0.2s ease-out',
        cursor: 'pointer',
      }}
      onClick={() => {
        setIsVisible(false)
        setTimeout(() => onDismiss(item.id), 200)
      }}
    >
      <span>{style.icon}</span>
      <span style={{ flex: 1 }}>{item.message}</span>
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>×</span>
    </div>
  )
}

// ============================================================================
// BANNER QUEUE MANAGER
// ============================================================================

/**
 * Manages a queue of banner items, showing one at a time.
 */
export class BannerQueue {
  private items: BannerItem[] = []
  private listeners: Set<(item: BannerItem | null) => void> = new Set()
  private nextId = 1

  /**
   * Add a banner item to the queue
   */
  add(item: Omit<BannerItem, 'id'>): string {
    const id = `banner-${this.nextId++}`
    const bannerItem: BannerItem = { ...item, id }
    this.items.push(bannerItem)
    this.notify()
    return id
  }

  /**
   * Remove a banner item from the queue
   */
  remove(id: string): void {
    this.items = this.items.filter(item => item.id !== id)
    this.notify()
  }

  /**
   * Get the current (top) banner item
   */
  getCurrent(): BannerItem | null {
    return this.items[0] || null
  }

  /**
   * Subscribe to banner changes
   */
  subscribe(listener: (item: BannerItem | null) => void): () => void {
    this.listeners.add(listener)
    listener(this.getCurrent()) // Initial call
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const current = this.getCurrent()
    this.listeners.forEach(listener => listener(current))
  }
}

// Global banner queue instance
// eslint-disable-next-line react-refresh/only-export-components
export const bannerQueue = new BannerQueue()

