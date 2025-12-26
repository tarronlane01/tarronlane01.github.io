import type { CSSProperties, ReactNode } from 'react'

interface TabContentContainerProps {
  children: ReactNode
  style?: CSSProperties
}

/**
 * A container component for tab content that ensures consistent width.
 * Use this to wrap tab content to ensure alignment with tab navigation.
 *
 * Takes up full width up to a max size, and centers on wider screens.
 * Width is controlled by --content-max-width CSS variable in index.css.
 */
export function TabContentContainer({ children, style }: TabContentContainerProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 'var(--content-max-width, 900px)',
        marginLeft: 'auto',
        marginRight: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

