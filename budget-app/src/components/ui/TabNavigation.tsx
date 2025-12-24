import { Link } from 'react-router-dom'
import { colors } from '../../styles/shared'

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
  const { tabs, activeTab } = props
  const visibleTabs = tabs.filter(tab => !tab.hidden)
  const tabCount = visibleTabs.length

  const breakpoint = getBreakpoint(tabCount)
  const columnsOnWrap = getColumnsOnWrap(tabCount)
  const widthPercent = Math.floor(100 / columnsOnWrap)

  // Generate unique class name based on tab count
  const className = `tab-nav-${tabCount}`

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    flex: '1 1 0',
    padding: '0.6rem 0.5rem',
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 400,
    fontSize: '0.9rem',
    color: 'inherit',
    opacity: isActive ? 1 : 0.5,
    transition: 'all 0.15s',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
    position: 'relative',
    boxSizing: 'border-box',
    outline: 'none',
  })

  const renderTabContent = (tab: Tab, isActive: boolean) => (
    <>
      <span>{tab.label}</span>
      {tab.checkmark && (
        <span style={{ color: colors.success, fontWeight: 600 }}>✓</span>
      )}
      {isActive && (
        <span style={{
          position: 'absolute',
          bottom: '-1px',
          left: '15%',
          right: '15%',
          height: '3px',
          background: 'white',
          borderRadius: '2px',
        }} />
      )}
    </>
  )

  return (
    <>
      <style>{`
        .${className} {
          display: flex;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
        }
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
        }
        @media (max-width: ${breakpoint}px) {
          .${className} > * {
            flex: 1 1 ${widthPercent}% !important;
            min-width: ${widthPercent}% !important;
          }
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
                style={getTabStyle(isActive)}
              >
                {renderTabContent(tab, isActive)}
              </Link>
            )
          }

          return (
            <button
              key={tab.id}
              onClick={() => props.onTabChange(tab.id)}
              style={getTabStyle(isActive)}
            >
              {renderTabContent(tab, isActive)}
            </button>
          )
        })}
      </div>
    </>
  )
}

