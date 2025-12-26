# Month Account Balances - User Stories

This document captures the expected user experience for the Account Balances view on the Balances page, which allows users to see how their account balances changed during a specific month.

> **Note**: This is part of the Balances page. Users can toggle between Category Balances and Account Balances (this view) using the view toggle button.

---

## Navigation & View Toggle

### US-AB-1: View Toggle Button
**As a user**, I want a "Switch to Account Balances" button on the Balances page so I can toggle from the category view to see my account balances for the month.

### US-AB-2: View Persistence in URL
**As a user**, I want the selected view (categories vs accounts) to be saved in the URL query parameter (`?view=accounts`) so that when I reload the page, I stay on the same view.

### US-AB-3: View Persistence Across Navigation
**As a user**, I want the selected view to be remembered when I navigate to other pages and come back, so I don't have to re-select it each time.

### US-AB-4: Hidden Allocation Controls
**As a user**, when viewing account balances, I don't want to see the "Edit Allocations" button since allocations are a category concept, not an account concept.

---

## Summary Grid (FourStatGrid)

### US-AB-5: Account Summary Display
**As a user**, when viewing account balances, I want the 4-cell summary grid to show:
- Start of Month (total account balances at month start)
- Income (total income deposited across all accounts)
- Expenses (total expenses from all accounts)
- End of Month (total account balances at month end)

so I can quickly understand my overall cash flow for the month.

### US-AB-6: Color Coding
**As a user**, I want income shown in green and expenses shown in red in the summary grid, so I can quickly distinguish between money coming in and going out.

---

## Totals Summary Bar

### US-AB-7: Equation Display
**As a user**, I want to see an equation bar showing:
- Start + Income − Expenses = End

with the actual values, so I understand how my account balances changed.

---

## Account List Display

### US-AB-8: Account Group Organization
**As a user**, I want to see my accounts organized by account group, with each group showing:
- Group name and account count
- Net change for the group (income - expenses)
- Total end balance for the group

so I can see how each group of accounts performed.

### US-AB-9: Desktop Account Table
**As a user** on desktop, I want to see a table for each account with columns:
- Account name (with income/expense breakdown as subtitle)
- Start balance
- Net change
- End balance

so I can see the full picture for each account.

### US-AB-10: Mobile Account Display
**As a user** on mobile, I want to see each account as a card with:
- Account name on top
- Three values (Start, Net Change, End) in a row below
- Income/expense breakdown below if there was any activity

so I can see all the information without excessive scrolling.

### US-AB-11: Net Change Color Coding
**As a user**, I want the net change displayed in green if positive (more income than expenses) and red if negative (more expenses than income), so I can quickly see which accounts grew vs shrank.

### US-AB-12: Income/Expense Breakdown
**As a user**, for accounts that had activity during the month, I want to see the income and expense amounts that contributed to the net change, so I understand where the money came from and went.

---

## Ungrouped Accounts

### US-AB-13: Ungrouped Section
**As a user**, if I have accounts that aren't assigned to any group, I want them displayed in an "Ungrouped" section at the bottom, so I can still see their balances.

---

## Empty States

### US-AB-14: No Accounts State
**As a user**, if I haven't created any accounts yet, I want to see a message with a link to add accounts, so I know how to get started.

---

## Data Staleness & Caching

### US-AB-15: Stale Balance Detection
**As a user**, when income or expenses are added/edited/deleted, I want the account balances to be marked as stale so they will be recalculated, ensuring I always see accurate data.

### US-AB-16: Cross-Month Staleness
**As a user**, when I edit income or expenses in a previous month, I want all future months' account balances to be marked as stale, since my starting balances depend on previous months' ending balances.

---

## Technical Implementation Notes

### Data Sources
- **Start Balance**: From `previous_month_snapshot.account_balances_end` or the account's current balance if first month
- **Income**: Sum of all income transactions for this account in this month
- **Expenses**: Sum of all expense transactions from this account in this month
- **Net Change**: Income - Expenses
- **End Balance**: Start Balance + Net Change

### Stale Tracking
- `account_balances_stale` flag on MonthDocument
- `AccountBalancesSnapshot` on Budget document for caching
- Stale helpers mark cache and Firestore when income/expenses change

