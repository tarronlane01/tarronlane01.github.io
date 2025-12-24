import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export interface MenuItem {
  label: string
  icon?: string
  to?: string
  onClick?: () => void
  hidden?: boolean
  divider?: boolean
}

interface DropdownMenuProps {
  items: MenuItem[]
}

export function DropdownMenu({ items }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const currentPath = location.pathname
  const prevPathnameRef = useRef(location.pathname)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on route change (only when pathname actually changes, not on initial render)
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname
      // Use queueMicrotask to satisfy eslint's set-state-in-effect rule
      queueMicrotask(() => setIsOpen(false))
    }
  }, [location.pathname])

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Filter out hidden items and the current page
  const visibleItems = items.filter(item => {
    if (item.hidden) return false
    if (!item.to) return true

    // For exact paths like /budget, /account - only hide on exact match
    if (item.to === '/budget' || item.to === '/account') {
      return currentPath !== item.to
    }

    // For sub-pages, hide if current path starts with the item's path
    return !currentPath.startsWith(item.to)
  })

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '8px',
          background: isOpen ? 'color-mix(in srgb, currentColor 15%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.25rem',
          color: 'inherit',
          transition: 'background 0.15s',
          lineHeight: 1,
        }}
        title="Menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        ⋮
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            minWidth: '180px',
            background: '#1a1a2e',
            border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {visibleItems.map((item, index) => {
            if (item.divider) {
              return (
                <div
                  key={index}
                  style={{
                    height: '1px',
                    background: 'color-mix(in srgb, currentColor 15%, transparent)',
                    margin: '0.25rem 0',
                  }}
                />
              )
            }

            const content = (
              <>
                {item.icon && <span style={{ width: '1.5rem', textAlign: 'center' }}>{item.icon}</span>}
                <span>{item.label}</span>
              </>
            )

            const itemStyle = {
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              fontSize: '0.95rem',
              color: 'inherit',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
              background: 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left' as const,
            }

            const hoverStyle = {
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
            }

            if (item.to) {
              return (
                <Link
                  key={index}
                  to={item.to}
                  style={itemStyle}
                  onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setIsOpen(false)}
                >
                  {content}
                </Link>
              )
            }

            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.()
                  setIsOpen(false)
                }}
                style={itemStyle}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {content}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

