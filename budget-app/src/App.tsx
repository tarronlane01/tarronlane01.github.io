import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import type { User } from 'firebase/auth'
import { useQueryClient } from '@tanstack/react-query'

import { AppProvider, useApp, UserContext, BudgetProvider, SyncProvider, useBudget } from '@contexts'
import { QueryProvider } from '@data'
import { useFirebaseAuth, MigrationProgressProvider } from '@hooks'
import { MigrationProgressModal } from './components/budget/Admin'

import Home from './pages/Home'
import Account from './pages/Account'
import Budget from './pages/budget/Budget'
import Analytics from './pages/budget/Analytics'
import MyBudgets from './pages/budget/MyBudgets'
import { Settings, General, Accounts, Categories, Users as SettingsUsers } from './pages/budget/settings'
import { Admin, AdminBudget, AdminFeedback, AdminMigration, AdminTests } from './pages/budget/admin'
import ProtectedRoute from './components/ProtectedRoute'
import BudgetLayout from './components/BudgetLayout'
import { FeedbackButton, Banner, bannerQueue } from './components/ui'
import { LoadingOverlay } from './components/app/LoadingOverlay'
import { useBackgroundSave } from './hooks/useBackgroundSave'
import { useSyncCheck } from './hooks/useSyncCheck'
import type { type_user_context } from '@types'

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

/** Budget app content with sync and save functionality */
function BudgetAppContent() {
  const { selectedBudgetId, isInitialized } = useBudget()
  const queryClient = useQueryClient()

  // Check if initial data load is complete
  // Initial data load query key: ['initialDataLoad', budgetId]
  const initialDataLoadKey = selectedBudgetId ? ['initialDataLoad', selectedBudgetId] : null
  const initialDataLoadComplete = initialDataLoadKey
    ? queryClient.getQueryState(initialDataLoadKey)?.status === 'success'
    : false

  // Background save - only saves current document immediately (no periodic/navigation saves)
  // Transactions are saved immediately after optimistic updates
  useBackgroundSave()

  // Navigation saves removed - transactions are saved immediately, no need to save on navigation
  // useNavigationSave() // Removed - transactions save immediately

  // Set up sync check - only after initial load completes (we're already synced on initial load)
  useSyncCheck(selectedBudgetId, initialDataLoadComplete && isInitialized)

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />

        {/* Protected budget routes */}
        <Route path="/budget" element={<ProtectedRoute />}>
          <Route element={<BudgetLayout />}>
            <Route index element={<Budget />} />
            <Route path=":year/:month/:tab/:view?" element={<Budget />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="my-budgets" element={<MyBudgets />} />

            {/* Budget Settings routes */}
            <Route path="settings" element={<Settings />}>
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<General />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="categories" element={<Categories />} />
              <Route path="users" element={<SettingsUsers />} />
            </Route>

            {/* Admin routes (admin-only) */}
            <Route path="admin" element={<Admin />}>
              <Route path="budget" element={<AdminBudget />} />
              <Route path="feedback" element={<AdminFeedback />} />
              <Route path="migration" element={<AdminMigration />} />
              <Route path="tests" element={<AdminTests />} />
            </Route>
          </Route>
        </Route>
      </Routes>
      <FeedbackButton />
      <MigrationProgressModal />
      <GlobalBanner />
    </>
  )
}

/** Main app content with auth handling */
function AppContent() {
  const [user_context, set_user_context] = useState<type_user_context>(initial_user_context)
  const firebase_auth_hook = useFirebaseAuth()
  const listenerSetRef = useRef(false)
  const { addLoadingHold, removeLoadingHold } = useApp()

  useEffect(function() {
    // Only set up listener once (firebase_auth_hook is stable but ESLint doesn't know that)
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

  // Add loading hold during auth check
  useEffect(() => {
    if (!user_context.is_auth_checked) {
      addLoadingHold('auth', 'Authenticating...')
    } else {
      removeLoadingHold('auth')
    }
  }, [user_context.is_auth_checked, addLoadingHold, removeLoadingHold])

  // Don't render routes until auth is checked
  if (!user_context.is_auth_checked) return null

  return (
    <UserContext.Provider value={user_context}>
      <QueryProvider>
        <BudgetProvider>
          <SyncProvider>
            <MigrationProgressProvider>
              <BrowserRouter>
                <BudgetAppContent />
              </BrowserRouter>
            </MigrationProgressProvider>
          </SyncProvider>
        </BudgetProvider>
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
