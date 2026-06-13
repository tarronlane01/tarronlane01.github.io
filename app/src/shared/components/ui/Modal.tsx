import type { ReactNode } from 'react'
import { logUserAction } from '@utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}

export function Modal({ isOpen, onClose, title, children, width = '28rem' }: ModalProps) {
  if (!isOpen) return null

  function handleClose() {
    logUserAction('CLOSE', `${title} Modal`)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: '1rem',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--surface-base)',
          color: 'var(--text-primary)',
          borderRadius: '12px',
          padding: '1.5rem',
          width: width,
          maxWidth: 'calc(100vw - 2rem)',
          flexShrink: 0,
          boxSizing: 'border-box',
          boxShadow: '0 8px 32px var(--shadow-overlay)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '1.5rem',
              opacity: 0.6,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

