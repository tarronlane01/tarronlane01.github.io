import type { CSSProperties, ReactNode } from 'react'

const MAX_WIDTH = '900px'

interface ContentContainerProps {
  children: ReactNode
  style?: CSSProperties
}

/**
 * A container component that ensures consistent width for page content.
 * Use this to wrap related content (navigation, tabs, sections) to ensure
 * they all share the same max-width and stay aligned.
 *
 * Takes up full width up to a max size, and centers on wider screens.
 */
export function ContentContainer({ children, style }: ContentContainerProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: MAX_WIDTH,
        marginLeft: 'auto',
        marginRight: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

