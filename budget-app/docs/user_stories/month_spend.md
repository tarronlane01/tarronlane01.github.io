# Month Spend (Expenses) - User Stories

This document captures the expected user experience for the Spend section on the Month page, which allows users to record and manage expense transactions.

> **Note**: This is part of the Month page. Users navigate using tabs: Income | Balances | Spend

---

## Navigation & Layout

- The Spend tab is in the last position (Income | Balances | Spend) following a logical flow from receiving money to allocating to spending
- The Spend tab is highlighted when active

---

## Summary Header

- A summary header shows "Total Expenses" with the sum of all expenses, displayed in red with "-" prefix when > 0
- An "+ Add Expense" button appears in the header (hidden when form is open)
- The "Add Expense" button is disabled when no accounts are configured for expenses OR when no categories exist

---

## Prerequisites & Empty States

- When no accounts exist, show a message explaining accounts are needed first, with a link to manage accounts
- When accounts exist but none are set up for expenses, show a message explaining how to enable "Show in expense list" on an account, with a link to manage accounts
- When no categories exist, show a message explaining categories are needed, with a link to create categories
- When no expenses are recorded and not adding new expense, show "No expenses recorded for this month" placeholder

---

## Adding Expenses

- Clicking "+ Add Expense" shows an inline form below the header
- Form fields:
  - **Date**: Pre-filled with the first of the current month
  - **Amount**: Currency input (required)
  - **Payee**: Autocomplete with suggestions from previous payees (placeholder: "e.g., Grocery Store")
  - **Category**: Searchable autocomplete dropdown (required)
  - **Pay From**: Dropdown of expense-enabled accounts, with default expense account pre-selected
  - **Description**: Optional text field (placeholder: "e.g., Weekly groceries")
  - **Cleared**: Checkbox to mark if transaction appeared in bank account
- Payee autocomplete shows fuzzy-matched suggestions from previously used payees
- Category autocomplete shows fuzzy-matched suggestions organized by category group
- Accounts in the dropdown are organized by account group
- The default expense account is pre-selected for new entries
- Form prevents submission until a category is selected
- Clicking "Add Expense" (or ✓ on desktop) saves the expense and closes the form
- Cancel closes the form without saving

---

## Viewing Expense List

- Expense entries are sorted by date (oldest first within the month)
- **Desktop Table Header (Wide)**: Date | Payee | Category | Account | Amount | Description | Clr | (Actions)
- **Desktop Table Header (Medium)**: Date | Payee | Category | Account | Amount | Clr | (Actions)
- **Desktop Row (Wide)** shows:
  - Date in "Mon DD" format (monospace)
  - Payee name (or "—")
  - Category as styled badge (primary color)
  - Account name with group prefix if grouped
  - Amount in red with "-" prefix (monospace, right-aligned)
  - Description (or "—")
  - Cleared indicator: ✓ (green) if cleared, ○ (dim) if not
  - Edit (✏️) and Delete (🗑️) buttons
- **Desktop Row (Medium)** shows compact row with description below payee in smaller text
- **Mobile Card** shows:
  - Date, Payee, and Cleared indicator (✓) on line 1
  - Category badge and "← Account" on line 2
  - Amount in red with "-" on the right
- Mobile cards are tappable to edit (large touch target)
- Desktop rows have subtle highlight on hover

---

## Editing Expenses

- Click edit button (✏️) to open editing form
- Edit form shows same fields as add, pre-filled with existing values including cleared status
- Saving updates the entry in the list
- Cancel closes without saving

---

## Deleting Expenses

- Click delete button (🗑️) to delete
- Confirmation dialog: "Are you sure you want to delete this expense?"
- Delete button also available in edit form (🗑️ Delete)

---

## Cleared Status

- "Cleared" checkbox indicates transaction appeared in bank statement (for reconciliation)
- Cleared expenses show green checkmark (✓), uncleared show dim circle (○)
- On mobile, cleared checkmark appears inline with date and payee

---

## Responsive Form Layouts

- **Mobile**: Stacked vertically with Date/Amount side-by-side on top, cleared checkbox with label, large buttons at bottom
- **Medium Desktop**: Two rows - Row 1: Date | Payee | Category | Account; Row 2: Amount | Description | Clr | Action buttons
- **Wide Desktop**: Single row with all fields for efficient data entry

---

## Loading & Error States

- When month data is loading, entire section appears dimmed/disabled
- Failed operations show error message in red banner at top of section

---

## Data Effects

- Adding/editing/deleting expenses recalculates account balances
- Adding/editing/deleting expenses updates category "Spent" amounts and end balances
- Changing an expense's category updates both old and new category balances
- Total Expenses in header updates immediately on changes
- New payee names are saved for future autocomplete suggestions

---

## Category Display

- Category names appear as styled badges with primary color scheme
- Badges are visually distinct from other text in the row
