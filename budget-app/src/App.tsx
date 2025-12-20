import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'

import UserContext from './contexts/user_context'
import { BudgetProvider } from './contexts/budget_context'
import useFirebaseAuth from './hooks/useFirebaseAuth'

import Home from './pages/Home'
import SqlTest from './pages/SqlTest'
import Account from './pages/Account'
import Budget from './pages/budget/Budget'
import Accounts from './pages/budget/Accounts'
import Categories from './pages/budget/Categories'
import Admin from './pages/budget/Admin'
import AdminUsers from './pages/budget/AdminUsers'
import AdminMigration from './pages/budget/AdminMigration'
import ProtectedRoute from './components/ProtectedRoute'
import BudgetLayout from './components/BudgetLayout'
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

                {/* Admin routes */}
                <Route path="admin" element={<Admin />}>
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="migration" element={<AdminMigration />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </BudgetProvider>
    </UserContext.Provider>
  )
}

export default App
