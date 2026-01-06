import { Link } from 'react-router-dom'
import { colors } from '@styles/shared'
import { logUserAction } from '@utils'

export interface Tab {
  id: string
  label: string
  icon?: string
  /** If true, shows a green checkmark after the label */
  checkmark?: boolean
  hidden?: boolean
}

interface BaseProps {
  tabs: Tab[]
  activeTab: string
  accentColor?: string
  /** Visual style variant: 'primary' for main tabs, 'secondary' for sub-tabs, 'segmented' for full-width sections */
  variant?: 'primary' | 'secondary' | 'segmented'
}

interface ButtonTabsProps extends BaseProps {
  mode: 'button'
  onTabChange: (tabId: string) => void
}

interface LinkTabsProps extends BaseProps {
  mode: 'link'
  linkPrefix: string
}

export type TabNavigationProps = ButtonTabsProps | LinkTabsProps

// Breakpoints for when tabs should wrap to balanced rows
// Based on ~100px per tab + some padding
const getBreakpoint = (tabCount: number): number => {
  switch (tabCount) {
    case 2: return 220   // 2 tabs: never wrap (too few)
    case 3: return 320   // 3 tabs: wrap at 320px
    case 4: return 420   // 4 tabs: wrap to 2+2 at 420px
    case 5: return 520   // 5 tabs: wrap to 3+2 at 520px
    case 6: return 620   // 6 tabs: wrap to 3+3 at 620px
    default: return tabCount * 100 + 20
  }
}

const getColumnsOnWrap = (tabCount: number): number => {
  if (tabCount <= 4) return 2
  if (tabCount <= 6) return 3
  return Math.ceil(tabCount / 2)
}

export function TabNavigation(props: TabNavigationProps) {
  const { tabs, activeTab, variant = 'primary' } = props
  const visibleTabs = tabs.filter(tab => !tab.hidden)
  const tabCount = visibleTabs.length

  const breakpoint = getBreakpoint(tabCount)
  const columnsOnWrap = getColumnsOnWrap(tabCount)
  const widthPercent = Math.floor(100 / columnsOnWrap)

  // Generate unique class name based on tab count and variant
  const className = `tab-nav-${tabCount}-${variant}`

  const isPrimary = variant === 'primary'
  const isSecondary = variant === 'secondary'
  const isSegmented = variant === 'segmented'

  const getTabStyle = (isActive: boolean): React.CSSProperties => {
    // Shared shading values for consistency
    const selectedBg = 'color-mix(in srgb, currentColor 10%, transparent)'
    const unselectedBg = 'color-mix(in srgb, currentColor 3%, transparent)'

    if (isSegmented) {
      return {
        flex: '1 1 0',
        padding: '0.75rem 1rem',
        border: 'none',
        borderRadius: 0,
        background: isActive ? selectedBg : unselectedBg,
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 400,
        fontSize: '0.95rem',
        color: 'inherit',
        opacity: isActive ? 1 : 0.55,
        transition: 'all 0.15s',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem',
        position: 'relative',
        boxSizing: 'border-box',
        outline: 'none',
        borderBottom: isActive
          ? '2px solid currentColor'
          : '2px solid transparent',
      }
    }

    if (isSecondary) {
      return {
        flex: 'none',
        minWidth: '8.5rem', // Consistent width for all sub-tabs
        padding: '0.55rem 1rem 0.65rem',
        border: 'none',
        borderRadius: '10px 10px 0 0',
        background: 'transparent',
        cursor: 'pointer',
        fontWeight: 600, // Always bold to prevent size change
        fontSize: '0.85rem',
        color: isActive
          ? 'inherit'
          : 'color-mix(in srgb, currentColor 55%, transparent)',
        transition: 'color 0.15s',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.25rem',
        position: 'relative',
        boxSizing: 'border-box',
        outline: 'none',
        marginBottom: isActive ? '-1px' : '0',
        zIndex: isActive ? 1 : 0,
      }
    }

    // Primary (default)
    return {
      flex: '1 1 0',
      padding: '0.7rem 0.75rem',
      border: 'none',
      borderRadius: 0,
      background: 'transparent',
      cursor: 'pointer',
      fontWeight: isActive ? 600 : 400,
      fontSize: '1rem',
      letterSpacing: '0.01em',
      color: 'inherit',
      opacity: isActive ? 1 : 0.6,
      transition: 'all 0.15s',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.25rem',
      position: 'relative',
      boxSizing: 'border-box',
      outline: 'none',
    }
  }

  const renderTabContent = (tab: Tab, isActive: boolean) => (
    <>
      <span>{tab.label}</span>
      {tab.checkmark && (
        <span style={{ color: colors.success, fontWeight: 600 }}>✓</span>
      )}
      {/* Underline indicator for primary variant only */}
      {isPrimary && isActive && (
        <span style={{
          position: 'absolute',
          bottom: '-1px',
          left: '10%',
          right: '10%',
          height: '3px',
          background: 'white',
          borderRadius: '2px',
        }} />
      )}
    </>
  )

  const getContainerStyle = (): string => {
    if (isSegmented) {
      return `
        .${className} {
          display: flex;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
        }
      `
    }

    if (isSecondary) {
      return `
        .${className} {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 1rem;
          border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
          justify-content: flex-start;
          padding-left: 0.75rem;
          position: relative;
        }
        .${className} > button,
        .${className} > a {
          margin-right: -8px;
          isolation: isolate;
        }
        .${className} > button:last-child,
        .${className} > a:last-child {
          margin-right: 0;
        }
        .${className} > button::before,
        .${className} > a::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--tab-bg);
          border-radius: 10px 10px 0 0;
          z-index: -1;
          transform: perspective(50px) rotateX(5deg);
          transform-origin: bottom center;
          transition: background 0.15s;
        }
        .${className} > button.tab-active,
        .${className} > a.tab-active {
          z-index: 2;
        }
        .${className} > button.tab-active::before,
        .${className} > a.tab-active::before {
          background: var(--tab-bg-active);
        }
        .${className} > button:not(.tab-active):hover,
        .${className} > a:not(.tab-active):hover {
          color: color-mix(in srgb, currentColor 80%, transparent);
        }
        .${className} > button:not(.tab-active):hover::before,
        .${className} > a:not(.tab-active):hover::before {
          background: var(--tab-bg-hover);
        }
      `
    }

    // Primary
    return `
      .${className} {
        display: flex;
        flex-wrap: wrap;
        margin-bottom: 0;
        border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      }
      @media (max-width: ${breakpoint}px) {
        .${className} > * {
          flex: 1 1 ${widthPercent}% !important;
          min-width: ${widthPercent}% !important;
        }
      }
    `
  }

  return (
    <>
      <style>{`
        ${getContainerStyle()}
        .${className} > button,
        .${className} > a {
          border: none !important;
          border-radius: 0 !important;
          outline: none !important;
        }
        .${className} > button:hover,
        .${className} > button:focus,
        .${className} > a:hover,
        .${className} > a:focus {
          border: none !important;
          border-color: transparent !important;
          ${isPrimary ? 'opacity: 0.85;' : ''}
          ${isSegmented ? 'background: color-mix(in srgb, currentColor 7%, transparent);' : ''}
        }
      `}</style>
      <div className={className}>
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id

          if (props.mode === 'link') {
            return (
              <Link
                key={tab.id}
                to={`${props.linkPrefix}/${tab.id}`}
                onClick={() => logUserAction('NAVIGATE', `Tab: ${tab.label}`)}
                style={getTabStyle(isActive)}
                className={isActive ? 'tab-active' : ''}
              >
                {renderTabContent(tab, isActive)}
              </Link>
            )
          }

          return (
            <button
              key={tab.id}
              onClick={() => { logUserAction('NAVIGATE', `Tab: ${tab.label}`); props.onTabChange(tab.id) }}
              style={getTabStyle(isActive)}
              className={isActive ? 'tab-active' : ''}
            >
              {renderTabContent(tab, isActive)}
            </button>
          )
        })}
      </div>
    </>
  )
}

