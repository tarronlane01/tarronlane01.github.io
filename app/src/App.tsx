import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import type { User } from 'firebase/auth'

import { AppProvider, useApp, UserContext } from '@contexts'
import { QueryProvider } from '@data'
import { useFirebaseAuth } from '@hooks'
import { Banner, bannerQueue } from '@components/ui'
import { LoadingOverlay } from '@components/app/LoadingOverlay'
import ProtectedRoute from '@components/ProtectedRoute'
import type { type_user_context } from '@types'

import Home from './pages/Home'
import Account from './pages/Account'
import BudgetApp from './apps/budget/BudgetApp'
import PackingApp from './apps/packing/PackingApp'

const initial_user_context: type_user_context = {
  is_logged_in: false,
  is_auth_checked: false,
  username: "",
  set_user_context: () => {},
}

/** Global loading overlay - renders when any loading holds exist */
function GlobalLoadingOverlay() {
  const { isLoading, loadingMessage } = useApp()
  if (!isLoading) return null
  return <LoadingOverlay message={loadingMessage} />
}

/** Banner display - shows current banner from queue */
function GlobalBanner() {
  const [currentBanner, setCurrentBanner] = useState<ReturnType<typeof bannerQueue.getCurrent>>(null)

  useEffect(() => {
    return bannerQueue.subscribe(setCurrentBanner)
  }, [])

  if (!currentBanner) return null

  return (
    <Banner
      item={currentBanner}
      onDismiss={(id) => bannerQueue.remove(id)}
    />
  )
}

/** Main app content with auth handling */
function AppContent() {
  const [user_context, set_user_context] = useState<type_user_context>(initial_user_context)
  const firebase_auth_hook = useFirebaseAuth()
  const listenerSetRef = useRef(false)
  const { addLoadingHold, removeLoadingHold } = useApp()

  useEffect(function() {
    if (listenerSetRef.current) return
    listenerSetRef.current = true

    firebase_auth_hook.set_user_listener((user: User | null) => {
      set_user_context({
        is_logged_in: user != null,
        is_auth_checked: true,
        username: user?.email ?? "",
        set_user_context: set_user_context,
      })
    })
  }, [firebase_auth_hook])

  useEffect(() => {
    if (!user_context.is_auth_checked) {
      addLoadingHold('auth', 'Authenticating...')
    } else {
      removeLoadingHold('auth')
    }
  }, [user_context.is_auth_checked, addLoadingHold, removeLoadingHold])

  if (!user_context.is_auth_checked) return null

  return (
    <UserContext.Provider value={user_context}>
      <QueryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/account" element={<Account />} />

            {/* Budget app (protected) */}
            <Route path="/budget/*" element={<ProtectedRoute />}>
              <Route path="*" element={<BudgetApp />} />
            </Route>

            {/* Packing app (protected) */}
            <Route path="/packing/*" element={<ProtectedRoute />}>
              <Route path="*" element={<PackingApp />} />
            </Route>
          </Routes>
          <GlobalBanner />
        </BrowserRouter>
      </QueryProvider>
    </UserContext.Provider>
  )
}

function App() {
  return (
    <AppProvider>
      <GlobalLoadingOverlay />
      <AppContent />
    </AppProvider>
  )
}

export default App
