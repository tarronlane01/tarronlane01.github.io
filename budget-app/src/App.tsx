import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'

import UserContext from './contexts/user_context'
import { QueryProvider } from './data'
import { BudgetProvider } from './contexts/budget_context'
import useFirebaseAuth from './hooks/useFirebaseAuth'

import Home from './pages/Home'
import SqlTest from './pages/SqlTest'
import Account from './pages/Account'
import Budget from './pages/budget/Budget'
import Analytics from './pages/budget/Analytics'
import Accounts from './pages/budget/Accounts'
import Categories from './pages/budget/Categories'
import Admin from './pages/budget/Admin'
import AdminUsers from './pages/budget/AdminUsers'
import AdminMigration from './pages/budget/AdminMigration'
import AdminFeedback from './pages/budget/AdminFeedback'
import AdminTests from './pages/budget/AdminTests'
import AdminMyBudgets from './pages/budget/AdminMyBudgets'
import ProtectedRoute from './components/ProtectedRoute'
import BudgetLayout from './components/BudgetLayout'
import { FeedbackButton } from './components/ui'
import type { type_user_context } from './types/type_user_context'

const initial_user_context: type_user_context = {
  is_logged_in: false,
  is_auth_checked: false,
  username: "",
  set_user_context: () => {},
}

function App() {
  const [user_context, set_user_context] = useState<type_user_context>(initial_user_context)
  const firebase_auth_hook = useFirebaseAuth()

  useEffect(function() {
    firebase_auth_hook.set_user_listener((user: any) => {
      set_user_context({
        is_logged_in: user != null,
        is_auth_checked: true,
        username: user?.email ?? "",
        set_user_context: set_user_context,
      })
    })
  }, [])

  if (!user_context.is_auth_checked) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
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
                  <Route path="analytics" element={<Analytics />} />

                  {/* Admin routes */}
                  <Route path="admin" element={<Admin />}>
                    <Route path="my-budgets" element={<AdminMyBudgets />} />
                    <Route path="accounts" element={<Accounts />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="migration" element={<AdminMigration />} />
                    <Route path="feedback" element={<AdminFeedback />} />
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
