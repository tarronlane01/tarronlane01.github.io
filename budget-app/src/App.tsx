import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'

import UserContext from './contexts/user_context'
import useFirebaseAuth from './hooks/useFirebaseAuth'

import Home from './pages/Home'
import SqlTest from './pages/SqlTest'
import Budget from './pages/Budget'
import Account from './pages/Account'
import ProtectedRoute from './components/ProtectedRoute'
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/account" element={<Account />} />
          <Route path="/sql-test" element={<SqlTest />} />
          <Route path="/budget" element={
            <ProtectedRoute>
              <Budget />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  )
}

export default App
