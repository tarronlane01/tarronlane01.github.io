# Month Income - User Stories

This document captures the expected user experience for the Income section on the Month page, which allows users to record and manage income transactions.

> **Note**: This is part of the Month page. Users navigate using tabs: Income | Balances | Spend

---

## Navigation & Layout

- The Income tab is in the first position (Income | Balances | Spend) following a logical flow from receiving money to allocating to spending
- The Income tab is highlighted when active

---

## Summary Header

- A summary header shows "Total" with the sum of all income for the month, displayed in green (success color)
- An "+ Add Income" button appears in the header (hidden when form is open)
- The "Add Income" button is disabled when no accounts are configured for income deposits

---

## Prerequisites & Empty States

- When no accounts exist, show a message explaining accounts are needed first, with a link to manage accounts
- When accounts exist but none are set up for income deposits, show a message explaining how to enable "Show in income deposit list" on an account, with a link to manage accounts
- When no income is recorded and not adding new income, show "No income recorded for this month" placeholder

---

## Adding Income

- Clicking "+ Add Income" shows an inline form below the header
- Form fields:
  - **Date**: Pre-filled with the first of the current month
  - **Amount**: Currency input (required)
  - **Payee**: Autocomplete with suggestions from previous payees (placeholder: "e.g., Employer, Client name")
  - **Deposit To**: Dropdown of income-enabled accounts, with default income account pre-selected
  - **Description**: Optional text field (placeholder: "e.g., January paycheck")
- Payee autocomplete shows fuzzy-matched suggestions from previously used payees
- Accounts in the dropdown are organized by account group
- The default income account is pre-selected for new entries
- Clicking "Add Income" (or ✓ on desktop) saves the income and closes the form
- Cancel closes the form without saving

---

## Viewing Income List

- Income entries are sorted by date (oldest first within the month)
- **Desktop Table Header (Wide)**: Date | Payee | Account | Amount | Description | (Actions)
- **Desktop Table Header (Medium)**: Date | Payee | Account | Amount | (Actions)
- **Desktop Row (Wide)** shows:
  - Date in "Mon DD" format (monospace)
  - Payee name (or "—")
  - Account name with group prefix if grouped
  - Amount in green with "+" prefix (monospace, right-aligned)
  - Description (or "—")
  - Edit (✏️) and Delete (🗑️) buttons
- **Desktop Row (Medium)** shows compact row with description below payee in smaller text
- **Mobile Card** shows:
  - Date and Payee on line 1
  - "→ Account" on line 2
  - Amount in green with "+" on the right
- Mobile cards are tappable to edit (large touch target)
- Desktop rows have subtle highlight on hover

---

## Editing Income

- Click edit button (✏️) to open editing form
- Edit form shows same fields as add, pre-filled with existing values
- Saving updates the entry in the list
- Cancel closes without saving

---

## Deleting Income

- Click delete button (🗑️) to delete
- Confirmation dialog: "Are you sure you want to delete this income entry?"
- Delete button also available in edit form (🗑️ Delete)

---

## Responsive Form Layouts

- **Mobile**: Stacked vertically with Date/Amount side-by-side on top, large buttons at bottom
- **Medium Desktop**: Two rows - Row 1: Date | Payee | Account; Row 2: Amount | Description | Action buttons
- **Wide Desktop**: Single row with all fields for efficient data entry

---

## Loading & Error States

- When month data is loading, entire section appears dimmed/disabled
- Failed operations show error message in red banner at top of section

---

## Data Effects

- Adding/editing/deleting income recalculates account balances
- Adding/editing/deleting income updates available funds for allocation
- New payee names are saved for future autocomplete suggestions
