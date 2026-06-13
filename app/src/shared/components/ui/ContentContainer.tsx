import type { CSSProperties, ReactNode } from 'react'

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
 * Width is controlled by --content-max-width CSS variable in index.css.
 */
export function ContentContainer({ children, style }: ContentContainerProps) {
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

