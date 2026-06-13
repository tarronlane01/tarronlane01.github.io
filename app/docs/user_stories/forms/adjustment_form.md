# Adjustment Form - User Stories

This document captures the expected user experience for the Adjustment form, which allows users to make corrections to account balances and/or category balances.

> **Note**: Adjustments appear on the Transactions > Adjustments tab on the Month page.

---

## Purpose of Adjustments

Adjustments serve several purposes:
1. **Account-only adjustments**: Correct an account balance without affecting any category (non-income money deposited, or non-spend money leaving)
2. **Category-only adjustments**: Correct a category balance without affecting any account (e.g., fix allocation error)
3. **Combined adjustments**: Correct both an account and category balance together (e.g., starting balance with category assignment)

---

## Validation Rules

### At Least One Must Be Real
- Cannot have both "No Account" AND "No Category" selected
- At least one must be a real account or real category
- Error message: "Cannot select both 'No Category' and 'No Account' — at least one must be a real category or account."

### Text Without Selection
- If text is entered in an autocomplete field but no option is selected from dropdown, validation fails
- Shows error border on the invalid field

---

## Autocomplete Behavior

For detailed behavior of the Account and Category autocomplete dropdowns, see [Autocomplete Dropdown](./autocomplete_dropdown.md).

For detailed behavior of the Payee autocomplete dropdown, see [Payee Autocomplete](./payee_autocomplete.md).

Key points for adjustments:
- "No Account" / "No Category" options are available and valid
- Empty input defaults to the "No" option
- Typed text without selection is invalid (shows error border)
- At least one must be a real account/category (can't have both as "No")

---

## Sign Toggle (+/−)

### Positive Adjustments (+)
- Adds to the account balance and/or category balance
- Use cases: interest earned, found money, starting balance, correction for under-counted amount
- Button shows "+" in green

### Negative Adjustments (−)
- Subtracts from the account balance and/or category balance
- Use cases: bank fees, correction for over-counted amount
- Button shows "−" in red

### Default Behavior
- New adjustments default to positive (+)
- When editing, preserves the original sign

---

## Optimistic Updates

### Add Adjustment
- Form closes immediately on submit
- New row appears instantly in the list (before server save completes)
- Background: Server read/write happens asynchronously
- If save fails, error message is shown

### Edit Adjustment
- Edit form closes immediately on save
- Changes reflect instantly in the row
- Background save happens asynchronously

### Delete Adjustment
- Row disappears instantly on confirmation
- Background delete happens asynchronously

---

## Form Fields

- **Date**: Pre-filled with first of current month
- **Amount**: Currency input with sign toggle (required, must be > 0)
- **Category**: Autocomplete with "No Category" option
- **Account**: Autocomplete with "No Account" option
- **Description**: Optional text field (placeholder: "e.g., Starting balance, Correction")
- **Cleared**: Checkbox to mark if transaction appeared in bank account

---

## Responsive Layouts

### Mobile (Stacked)
- Date and Amount (with sign toggle) side-by-side on first row
- Category field
- Account field
- Description field
- Cleared checkbox with label
- Action buttons at bottom

### Wide Desktop (Single Row)
- All fields in one row for efficient data entry
- Date | Payee (hidden) | Category | Account | Amount (with sign) | Description | Cleared | Actions

---

## Use Case Examples

### Starting Balance
- **Scenario**: Setting up a new account with existing balance
- **Setup**: Select real account, select "No Category", positive amount
- **Result**: Account balance increases, no category affected

### Bank Fee
- **Scenario**: Recording a monthly bank fee
- **Setup**: Select real account, select "No Category", negative amount
- **Result**: Account balance decreases, no category affected

### Category Correction
- **Scenario**: Fixing an allocation mistake
- **Setup**: Select "No Account", select real category, positive or negative amount
- **Result**: Category balance adjusted, no account affected

### Reconciliation Adjustment
- **Scenario**: Account balance doesn't match bank statement
- **Setup**: Select real account, optionally select category, amount to match difference
- **Result**: Account balance corrected, optionally category affected

---

## Error States

- Validation errors appear in a red banner below the form
- Individual field errors show as red border on the field
- Failed background saves show error banner at top of section

