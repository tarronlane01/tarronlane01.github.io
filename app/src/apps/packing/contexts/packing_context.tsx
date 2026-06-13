import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useFirebaseAuth } from '@hooks'
import { fetchAdminStatus } from '@packing/data'

interface PackingContextType {
  currentUserId: string | null
  isInitialized: boolean
  isAdmin: boolean
  pageTitle: string
  setPageTitle: (title: string) => void
}

const PackingContext = createContext<PackingContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function usePacking(): PackingContextType {
  const context = useContext(PackingContext)
  if (!context) {
    throw new Error('usePacking must be used within a PackingProvider')
  }
  return context
}

export function PackingProvider({ children }: { children: ReactNode }) {
  const { get_current_firebase_user } = useFirebaseAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [pageTitle, setPageTitle] = useState('Packing')

  const currentUser = get_current_firebase_user()
  const currentUserId = currentUser?.uid ?? null

  useEffect(() => {
    async function checkAdmin() {
      if (!currentUserId) {
        setIsAdmin(false)
        setIsInitialized(true)
        return
      }
      try {
        const admin = await fetchAdminStatus(currentUserId)
        setIsAdmin(admin)
      } catch {
        setIsAdmin(false)
      }
      setIsInitialized(true)
    }
    checkAdmin()
  }, [currentUserId])

  const value: PackingContextType = {
    currentUserId,
    isInitialized,
    isAdmin,
    pageTitle,
    setPageTitle,
  }

  return (
    <PackingContext.Provider value={value}>
      {children}
    </PackingContext.Provider>
  )
}
