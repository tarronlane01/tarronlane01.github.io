/**
 * Single source of truth for all theme colors.
 * Every color MUST have both light and dark values so backgrounds and text
 * stay in sync and we never get dark-on-dark or light-on-light.
 *
 * Usage:
 * - In CSS (index.css): Define :root and @media (prefers-color-scheme: light)
 *   using these values so var(--page-background) etc. work.
 * - In TS/TSX: Use CSS variables, e.g. background: 'var(--page-background)'.
 *
 * The check-colors script enforces that no hex/rgba colors appear anywhere
 * except in this file and in index.css (only when defining these variables).
 */

export type ThemeColorPair = { light: string; dark: string }

/** All theme colors with mandatory light and dark counterparts */
export const THEME_COLORS: Record<string, ThemeColorPair> = {
  // Page & layout
  pageBackground: { light: '#ffffff', dark: '#242424' },
  textPrimary: { light: '#213547', dark: 'rgba(255, 255, 255, 0.87)' },
  textMuted: { light: '#6b7280', dark: '#9ca3af' },
  linkHover: { light: '#747bff', dark: 'rgba(255, 255, 255, 0.8)' },

  // Surfaces (cards, sticky headers, inputs)
  surfaceBase: { light: '#ffffff', dark: '#1a1a1a' },
  surfaceRaised: { light: '#f9f9f9', dark: '#2d2d2d' },
  surfaceOverlay: { light: '#f0f0f0', dark: '#353535' },
  stickyHeaderBg: { light: '#ffffff', dark: '#242424' },

  // Tab bar (keep in sync with index.css --tab-bg*)
  tabBg: { light: '#e8e8e8', dark: '#2d2d2d' },
  tabBgHover: { light: '#e0e0e0', dark: '#353535' },
  tabBgActive: { light: '#f0f0f0', dark: '#3d3d3d' },

  // Borders
  borderSubtle: { light: 'rgba(0, 0, 0, 0.12)', dark: 'rgba(255, 255, 255, 0.1)' },
  borderMedium: { light: 'rgba(0, 0, 0, 0.2)', dark: 'rgba(255, 255, 255, 0.2)' },
  borderStrong: { light: 'rgba(0, 0, 0, 0.3)', dark: 'rgba(255, 255, 255, 0.3)' },
  borderMuted: { light: 'rgba(128, 128, 128, 0.4)', dark: 'rgba(128, 128, 128, 0.4)' },

  // Row alternating background
  rowAltBg: { light: 'rgba(0, 0, 0, 0.03)', dark: 'rgba(255, 255, 255, 0.04)' },

  // Buttons
  buttonBg: { light: '#f9f9f9', dark: '#1a1a1a' },
  focusRing: { light: '#007AFF', dark: '#007AFF' },

  // Semantic (same hue in both modes; use on appropriate backgrounds)
  primary: { light: '#646cff', dark: '#646cff' },
  primaryLight: { light: '#a5b4fc', dark: '#a5b4fc' },
  primaryOnPrimary: { light: '#ffffff', dark: '#ffffff' },
  error: { light: '#ef4444', dark: '#f87171' },
  errorBg: { light: 'rgba(220, 38, 38, 0.1)', dark: 'rgba(220, 38, 38, 0.1)' },
  errorBorder: { light: 'rgba(220, 38, 38, 0.3)', dark: 'rgba(220, 38, 38, 0.3)' },
  success: { light: '#16a34a', dark: '#4ade80' },
  successBg: { light: 'rgba(34, 197, 94, 0.1)', dark: 'rgba(34, 197, 94, 0.1)' },
  successBorder: { light: 'rgba(34, 197, 94, 0.3)', dark: 'rgba(34, 197, 94, 0.3)' },
  warning: { light: '#f59e0b', dark: '#facc15' },
  warningOnWarning: { light: '#000000', dark: '#000000' },
  warningBg: { light: 'rgba(245, 158, 11, 0.15)', dark: 'rgba(250, 204, 21, 0.15)' },
  warningBorder: { light: 'rgba(245, 158, 11, 0.4)', dark: 'rgba(250, 204, 21, 0.4)' },
  danger: { light: '#ef4444', dark: '#f87171' },
  debt: { light: '#fb923c', dark: '#fb923c' },
  debtBg: { light: 'rgba(251, 146, 60, 0.1)', dark: 'rgba(251, 146, 60, 0.1)' },
  debtBorder: { light: 'rgba(251, 146, 60, 0.5)', dark: 'rgba(251, 146, 60, 0.5)' },
  zero: { light: 'rgba(0, 0, 0, 0.4)', dark: 'rgba(255, 255, 255, 0.4)' },

  // Validation / form error (inline)
  validationError: { light: '#ff6b6b', dark: '#ff6b6b' },

  // Banner types (opaque for overlay)
  bannerSuccess: { light: 'rgba(46, 213, 115, 0.95)', dark: 'rgba(46, 213, 115, 0.95)' },
  bannerError: { light: 'rgba(255, 71, 87, 0.95)', dark: 'rgba(255, 71, 87, 0.95)' },
  bannerWarning: { light: 'rgba(255, 165, 2, 0.95)', dark: 'rgba(255, 165, 2, 0.95)' },
  bannerInfo: { light: 'rgba(30, 144, 255, 0.95)', dark: 'rgba(30, 144, 255, 0.95)' },

  // Shadows (for modals/dropdowns)
  shadowOverlay: { light: 'rgba(0, 0, 0, 0.2)', dark: 'rgba(0, 0, 0, 0.3)' },
  shadowPrimary: { light: 'rgba(100, 108, 255, 0.4)', dark: 'rgba(100, 108, 255, 0.6)' },

  // Migration/status UI
  migrationPurple: { light: '#a855f7', dark: '#a855f7' },
  migrationPurpleBg: { light: 'rgba(165, 94, 234, 0.15)', dark: 'rgba(165, 94, 234, 0.15)' },
  migrationBlue: { light: '#3b82f6', dark: '#3b82f6' },
  migrationBlueBg: { light: 'rgba(59, 130, 246, 0.15)', dark: 'rgba(59, 130, 246, 0.15)' },
  migrationBlueLight: { light: '#60a5fa', dark: '#60a5fa' },
  migrationGreen: { light: '#22c55e', dark: '#22c55e' },

  // Modal / overlay
  modalBackdrop: { light: 'rgba(0, 0, 0, 0.5)', dark: 'rgba(0, 0, 0, 0.7)' },
  overlayPanelBg: { light: '#f5f5f5', dark: '#1a1a2e' },

  // Loading overlay
  loadingOverlayBg: { light: 'rgba(0, 0, 0, 0.6)', dark: 'rgba(15, 15, 20, 0.95)' },
  loadingOverlayContentBg: { light: 'rgba(255, 255, 255, 0.95)', dark: 'rgba(255, 255, 255, 0.15)' },
  loadingOverlayContentBorder: { light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(255, 255, 255, 0.1)' },
  loadingOverlayText: { light: '#1a1a1a', dark: 'rgba(255, 255, 255, 0.87)' },
  loadingOverlayTextMuted: { light: 'rgba(0, 0, 0, 0.5)', dark: 'rgba(255, 255, 255, 0.5)' },
  loadingOverlaySpinnerPrimary: { light: '#646cff', dark: '#646cff' },
  loadingOverlaySpinnerSecondary: { light: '#8b5cf6', dark: '#8b5cf6' },

  // Soft semantic (for text on colored backgrounds)
  errorLight: { light: '#fca5a5', dark: '#fca5a5' },
  warningLight: { light: '#fcd34d', dark: '#fcd34d' },
  successEmerald: { light: '#10b981', dark: '#10b981' },
}

/** CSS variable names (use in style={{ background: 'var(--page-background)' }}) */
export const COLOR_VARS: Record<keyof typeof THEME_COLORS, string> = {
  pageBackground: '--page-background',
  textPrimary: '--text-primary',
  textMuted: '--text-muted',
  linkHover: '--link-hover',
  surfaceBase: '--surface-base',
  surfaceRaised: '--surface-raised',
  surfaceOverlay: '--surface-overlay',
  stickyHeaderBg: '--sticky-header-bg',
  tabBg: '--tab-bg',
  tabBgHover: '--tab-bg-hover',
  tabBgActive: '--tab-bg-active',
  borderSubtle: '--border-subtle',
  borderMedium: '--border-medium',
  borderStrong: '--border-strong',
  borderMuted: '--border-muted',
  rowAltBg: '--row-alt-bg',
  buttonBg: '--button-bg',
  focusRing: '--focus-ring',
  primary: '--color-primary',
  primaryLight: '--color-primary-light',
  primaryOnPrimary: '--color-primary-on-primary',
  error: '--color-error',
  errorBg: '--color-error-bg',
  errorBorder: '--color-error-border',
  success: '--color-success',
  successBg: '--color-success-bg',
  successBorder: '--color-success-border',
  warning: '--color-warning',
  warningOnWarning: '--color-warning-on-warning',
  warningBg: '--color-warning-bg',
  warningBorder: '--color-warning-border',
  danger: '--color-danger',
  debt: '--color-debt',
  debtBg: '--color-debt-bg',
  debtBorder: '--color-debt-border',
  zero: '--color-zero',
  validationError: '--color-validation-error',
  bannerSuccess: '--banner-success',
  bannerError: '--banner-error',
  bannerWarning: '--banner-warning',
  bannerInfo: '--banner-info',
  shadowOverlay: '--shadow-overlay',
  shadowPrimary: '--shadow-primary',
  migrationPurple: '--color-migration-purple',
  migrationPurpleBg: '--color-migration-purple-bg',
  migrationBlue: '--color-migration-blue',
  migrationBlueBg: '--color-migration-blue-bg',
  migrationBlueLight: '--color-migration-blue-light',
  migrationGreen: '--color-migration-green',
  modalBackdrop: '--modal-backdrop',
  overlayPanelBg: '--overlay-panel-bg',
  loadingOverlayBg: '--loading-overlay-bg',
  loadingOverlayContentBg: '--loading-overlay-content-bg',
  loadingOverlayContentBorder: '--loading-overlay-content-border',
  loadingOverlayText: '--loading-overlay-text',
  loadingOverlayTextMuted: '--loading-overlay-text-muted',
  loadingOverlaySpinnerPrimary: '--loading-overlay-spinner-primary',
  loadingOverlaySpinnerSecondary: '--loading-overlay-spinner-secondary',
  errorLight: '--color-error-light',
  warningLight: '--color-warning-light',
  successEmerald: '--color-success-emerald',
}
