import type { ReactNode } from 'react'
import { pageContainer } from '../../styles/shared'

interface PageContainerProps {
  children: ReactNode
}

export function PageContainer({ children }: PageContainerProps) {
  return <div style={pageContainer}>{children}</div>
}

