# Transfer Form - User Stories

This document captures the expected user experience for the Transfer form, which allows users to move money between accounts and/or budget allocation between categories.

> **Note**: Transfers appear on the Transactions > Transfers tab on the Month page.

---

## Purpose of Transfers

Transfers serve two purposes:
1. **Account-to-account transfers**: Move money between bank accounts (e.g., checking to savings)
2. **Category-to-category transfers**: Move budget allocation between categories (e.g., from "Dining Out" to "Groceries")
3. **Combined transfers**: Move both money and budget allocation simultaneously

---

## Validation Rules

### Accounts Must Be Paired
Both account fields must be real accounts OR both must be "No Account":
- ✅ Real Account → Real Account (valid account-to-account transfer)
- ✅ No Account → No Account (valid category-only transfer)
- ❌ Real Account → No Account (invalid - money can't disappear)
- ❌ No Account → Real Account (invalid - money can't appear from nothing)

### Categories Must Be Paired
Both category fields must be real categories OR both must be "No Category":
- ✅ Real Category → Real Category (valid category-to-category transfer)
- ✅ No Category → No Category (valid account-only transfer)
- ❌ Real Category → No Category (invalid - budget can't disappear)
- ❌ No Category → Real Category (invalid - budget can't appear from nothing)

### Something Must Move
- All 4 fields cannot be "No" options - at least one pair must be real values
- Error message: "A transfer must move between real categories or real accounts — not all 'No' options."

### Text Without Selection
- If text is entered in an autocomplete field but no option is selected from dropdown, validation fails
- Shows error border on the invalid field

---

## Autocomplete Behavior

For detailed behavior of the Account and Category autocomplete dropdowns, see [Autocomplete Dropdown](./autocomplete_dropdown.md).

Key points for transfers:
- "No Account" / "No Category" options are available and valid
- Empty input defaults to the "No" option
- Typed text without selection is invalid (shows error border)

---

## Optimistic Updates

### Add Transfer
- Form closes immediately on submit
- New row appears instantly in the list (before server save completes)
- Background: Server read/write happens asynchronously
- If save fails, error message is shown

### Edit Transfer
- Edit form closes immediately on save
- Changes reflect instantly in the row
- Background save happens asynchronously

### Delete Transfer
- Row disappears instantly on confirmation
- Background delete happens asynchronously

---

## Form Fields

- **Date**: Pre-filled with first of current month
- **Amount**: Currency input (required, must be > 0)
- **From Category**: Autocomplete with "No Category" option
- **From Account**: Autocomplete with "No Account" option
- **To Category**: Autocomplete with "No Category" option
- **To Account**: Autocomplete with "No Account" option
- **Description**: Optional text field
- **Cleared**: Checkbox to mark if transaction appeared in bank account

---

## Responsive Layouts

### Mobile (Stacked)
- Date and Amount side-by-side on first row
- From Category and From Account in a shaded box
- Arrow indicator (↓)
- To Category and To Account in same shaded box
- Description field
- Cleared checkbox with label
- Action buttons at bottom

### Wide Desktop (Two Rows)
- Row 1: Date | Amount | From Category | From Account | Description
- Row 2: Arrow | (empty) | To Category | To Account | Cleared + Actions

---

## Error States

- Validation errors appear in a red banner below the form
- Individual field errors show as red border on the field
- Failed background saves show error banner at top of section

