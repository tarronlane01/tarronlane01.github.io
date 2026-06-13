import { Routes, Route, Navigate } from 'react-router-dom'

import { BudgetProvider } from '@budget/contexts'
import { useBackgroundSave, MigrationProgressProvider } from '@budget/hooks'
import { MigrationProgressModal } from '@budget/components/budget/Admin'
import { FeedbackButton } from '@budget/components/ui'
import BudgetLayout from '@budget/components/BudgetLayout'

import Budget from '@budget/pages/Budget'
import Analytics from '@budget/pages/Analytics'
import MyBudgets from '@budget/pages/MyBudgets'
import { Settings, General, Accounts, Categories, Users as SettingsUsers } from '@budget/pages/settings'
import { Admin, AdminBudget, AdminFeedback, AdminMigration, AdminTests } from '@budget/pages/admin'

/** Budget app content with background save */
function BudgetRoutes() {
  useBackgroundSave()

  return (
    <>
      <Routes>
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
      </Routes>
      <FeedbackButton />
      <MigrationProgressModal />
    </>
  )
}

/** Budget app wrapper with budget-specific providers */
export default function BudgetApp() {
  return (
    <BudgetProvider>
      <MigrationProgressProvider>
        <BudgetRoutes />
      </MigrationProgressProvider>
    </BudgetProvider>
  )
}
