import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import type { User } from 'firebase/auth'

import { AppProvider, useApp, UserContext, BudgetProvider } from '@contexts'
import { QueryProvider } from '@data'
import { useFirebaseAuth, MigrationProgressProvider } from '@hooks'
import { MigrationProgressModal } from './components/budget/Admin'

import Home from './pages/Home'
import Account from './pages/Account'
import Budget from './pages/budget/Budget'
import Analytics from './pages/budget/Analytics'
import MyBudgets from './pages/budget/MyBudgets'
import { Settings, Accounts, Categories, Users as SettingsUsers } from './pages/budget/settings'
import { Admin, AdminBudget, AdminFeedback, AdminMigration, AdminTests } from './pages/budget/admin'
import ProtectedRoute from './components/ProtectedRoute'
import BudgetLayout from './components/BudgetLayout'
import { FeedbackButton } from './components/ui'
import { LoadingOverlay } from './components/app/LoadingOverlay'
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
          <MigrationProgressProvider>
            <BrowserRouter>
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
                      <Route index element={<Navigate to="categories" replace />} />
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
            </BrowserRouter>
          </MigrationProgressProvider>
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
