import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import type { User } from 'firebase/auth'

import UserContext from './contexts/user_context'
import { QueryProvider } from './data'
import { BudgetProvider } from './contexts/budget_context'
import useFirebaseAuth from './hooks/useFirebaseAuth'
import { pageContainer } from './styles/shared'

import Home from './pages/Home'
import SqlTest from './pages/SqlTest'
import Account from './pages/Account'
import Budget from './pages/budget/Budget'
import Analytics from './pages/budget/Analytics'
import Accounts from './pages/budget/Accounts'
import Categories from './pages/budget/Categories'
import Settings from './pages/budget/Settings'
import SettingsUsers from './pages/budget/SettingsUsers'
import Admin from './pages/budget/Admin'
import AdminBudget from './pages/budget/SettingsBudget'
import AdminMigration from './pages/budget/SettingsMigration'
import AdminFeedback from './pages/budget/SettingsFeedback'
import AdminTests from './pages/budget/SettingsTests'
import MyBudgets from './pages/budget/MyBudgets'
import ProtectedRoute from './components/ProtectedRoute'
import BudgetLayout from './components/BudgetLayout'
import { FeedbackButton } from './components/ui'
import type { type_user_context } from '@types'

const initial_user_context: type_user_context = {
  is_logged_in: false,
  is_auth_checked: false,
  username: "",
  set_user_context: () => {},
}

function App() {
  const [user_context, set_user_context] = useState<type_user_context>(initial_user_context)
  const firebase_auth_hook = useFirebaseAuth()
  const listenerSetRef = useRef(false)

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

  if (!user_context.is_auth_checked) {
    return (
      <div style={pageContainer}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <UserContext.Provider value={user_context}>
      <QueryProvider>
        <BudgetProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/account" element={<Account />} />
              <Route path="/sql-test" element={<SqlTest />} />

              {/* Protected budget routes */}
              <Route path="/budget" element={<ProtectedRoute />}>
                <Route element={<BudgetLayout />}>
                  <Route index element={<Budget />} />
                  <Route path=":year/:month/:tab" element={<Budget />} />
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
          </BrowserRouter>
        </BudgetProvider>
      </QueryProvider>
    </UserContext.Provider>
  )
}

export default App
