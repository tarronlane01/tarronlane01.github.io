import type { CSSProperties } from 'react'

// Colors
export const colors = {
  primary: '#646cff',
  primaryLight: '#a5b4fc',
  error: '#f87171',
  errorBg: 'rgba(220, 38, 38, 0.1)',
  errorBorder: 'rgba(220, 38, 38, 0.3)',
  success: '#4ade80',
  danger: '#f87171',
  warning: '#facc15',
  // Debt color (orange) - used for negative category balances
  debt: '#fb923c',
  debtBg: 'rgba(251, 146, 60, 0.1)',
  debtBorder: 'rgba(251, 146, 60, 0.5)',
  // Neutral grey for zero values
  zero: 'rgba(255, 255, 255, 0.4)',
}

// Layout styles - uses CSS variables from index.css for easy customization
export const pageContainer: CSSProperties = {
  maxWidth: 'var(--page-max-width, 85rem)',
  margin: '0 auto',
  padding: 'var(--page-padding, 2rem)',
}

export const navBar: CSSProperties = {
  marginBottom: '1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

// Card styles
export const card: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 8%, transparent)',
  padding: '1rem 1.25rem',
  borderRadius: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
}

// Mobile-optimized card (smaller padding/height)
export const cardMobile: CSSProperties = {
  ...card,
  padding: '0.6rem 0.875rem',
  gap: '0.5rem',
}

export const statsCard: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 5%, transparent)',
  padding: '1rem 1.5rem',
  borderRadius: '8px',
  marginBottom: '1.5rem',
}

// Shared table header style
export const tableHeaderStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// Table row alternating backgrounds
export const tableRowEven: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 3%, transparent)',
}

export const tableRowOdd: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 6%, transparent)',
}

// Form styles
export const form: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 8%, transparent)',
  padding: '1.25rem',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}

export const formGroup: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
}

export const label: CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 500,
}

export const input: CSSProperties = {
  padding: '0.6rem 0.8rem',
  borderRadius: '6px',
  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
  background: 'color-mix(in srgb, currentColor 5%, transparent)',
  fontSize: '1rem',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

export const select: CSSProperties = {
  ...input,
  cursor: 'pointer',
}

// Button styles
export const buttonBase: CSSProperties = {
  padding: '0.6rem 1.25rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.9rem',
  transition: 'opacity 0.15s',
}

export const buttonPrimary: CSSProperties = {
  ...buttonBase,
  background: colors.primary,
  color: 'white',
  border: 'none',
}

export const buttonPrimaryLarge: CSSProperties = {
  ...buttonPrimary,
  padding: '0.75rem 1.5rem',
  borderRadius: '8px',
}

export const buttonSecondary: CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
}

export const buttonDanger: CSSProperties = {
  ...buttonBase,
  background: 'transparent',
  border: `1px solid ${colors.errorBorder}`,
  color: colors.error,
}

export const buttonSmall: CSSProperties = {
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  padding: '0.35rem 0.75rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  opacity: 0.8,
  transition: 'opacity 0.15s',
}

export const buttonGroup: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
}

// Mobile button group (stacks vertically on small screens)
export const buttonGroupMobile: CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
}

// Icon button for compact mobile actions
export const iconButton: CSSProperties = {
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
  padding: '0.35rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2rem',
  minHeight: '2rem',
  transition: 'opacity 0.15s, border-color 0.15s',
}

export const iconButtonDanger: CSSProperties = {
  ...iconButton,
  borderColor: colors.errorBorder,
  color: colors.error,
}

// Reorder buttons (up/down arrows)
export const reorderButton: CSSProperties = {
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
  padding: '0.25rem 0.35rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.75rem',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.6,
  transition: 'opacity 0.15s, background 0.15s',
}

export const reorderButtonGroup: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

export const buttonGroupForm: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginTop: '0.5rem',
}

// Drag and drop styles
export const dragHandle: CSSProperties = {
  opacity: 0.4,
  cursor: 'grab',
}

export const dropIndicator: CSSProperties = {
  position: 'absolute',
  top: '-4px',
  left: 0,
  right: 0,
  height: '3px',
  background: colors.primary,
  borderRadius: '2px',
  transition: 'opacity 0.15s',
}

export const dropZoneEnd: CSSProperties = {
  position: 'relative',
  height: '2rem',
  marginTop: '-0.25rem',
}

export const dropZoneLine: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 0,
  right: 0,
  height: '3px',
  background: colors.primary,
  borderRadius: '2px',
  transition: 'opacity 0.15s',
}

export const dropZoneLabel: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: '0.75rem',
  opacity: 0.7,
  background: 'var(--background, #1a1a1a)',
  padding: '0 0.5rem',
  whiteSpace: 'nowrap',
}

// Alert styles
export const errorAlert: CSSProperties = {
  background: colors.errorBg,
  border: `1px solid ${colors.errorBorder}`,
  color: colors.error,
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  marginBottom: '1rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
}

export const errorAlertDismiss: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: colors.error,
  cursor: 'pointer',
  fontSize: '1.2rem',
  padding: '0 0.25rem',
  lineHeight: 1,
}

// Typography
export const pageTitle: CSSProperties = {
  margin: 0,
}

export const pageSubtitle: CSSProperties = {
  opacity: 0.7,
  marginBottom: '1.5rem',
}

export const sectionHeader: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  opacity: 0.6,
}

export const itemTitle: CSSProperties = {
  fontWeight: 500,
  fontSize: '1.1rem',
}

export const statLabel: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  opacity: 0.7,
}

export const statValue: CSSProperties = {
  margin: '0.25rem 0 0 0',
  fontSize: '1.5rem',
  fontWeight: 600,
}

// Badge styles
export const badge: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 15%, transparent)',
  padding: '0.2rem 0.6rem',
  borderRadius: '4px',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

// List styles
export const listContainer: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.5rem',
}

// Grid styles
export const quickLinksGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem',
  marginBottom: '2rem',
}

export const quickLinkCard: CSSProperties = {
  background: 'color-mix(in srgb, currentColor 8%, transparent)',
  padding: '1.25rem',
  borderRadius: '8px',
  textDecoration: 'none',
  color: 'inherit',
  display: 'block',
}

// Flex helpers
export const flexBetween: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

export const flexCenter: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
}

export const flexColumn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

