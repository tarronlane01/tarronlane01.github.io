import { Link } from 'react-router-dom'
import { colors } from '../../styles/shared'

export interface Tab {
  id: string
  label: string
  icon?: string
  badge?: {
    text: string
    color?: string
  }
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

export function TabNavigation(props: TabNavigationProps) {
  const { tabs, activeTab, accentColor = colors.primary } = props
  const visibleTabs = tabs.filter(tab => !tab.hidden)

  const getTabStyle = (isActive: boolean) => ({
    flex: 1,
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
    background: isActive
      ? `color-mix(in srgb, ${accentColor} 15%, transparent)`
      : 'color-mix(in srgb, currentColor 8%, transparent)',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 400,
    fontSize: '0.95rem',
    color: 'inherit',
    transition: 'all 0.15s',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
  })

  const renderBadge = (badge: Tab['badge']) => {
    if (!badge) return null
    return (
      <span style={{
        marginLeft: '0.5rem',
        fontSize: '0.7rem',
        background: badge.color || colors.success,
        color: 'white',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
      }}>
        {badge.text}
      </span>
    )
  }

  const renderTabContent = (tab: Tab) => (
    <>
      {tab.icon && <span>{tab.icon}</span>}
      <span>{tab.label}</span>
      {renderBadge(tab.badge)}
    </>
  )

  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    }}>
      {visibleTabs.map(tab => {
        const isActive = activeTab === tab.id

        if (props.mode === 'link') {
          return (
            <Link
              key={tab.id}
              to={`${props.linkPrefix}/${tab.id}`}
              style={getTabStyle(isActive)}
            >
              {renderTabContent(tab)}
            </Link>
          )
        }

        return (
          <button
            key={tab.id}
            onClick={() => props.onTabChange(tab.id)}
            style={getTabStyle(isActive)}
          >
            {renderTabContent(tab)}
          </button>
        )
      })}
    </div>
  )
}

