# Payee Autocomplete - User Stories

This document captures the expected user experience for the payee autocomplete dropdown used for entering payee/source names in transaction forms.

> **Note**: This component is used in Income, Spend, and Adjustment forms via `PayeeAutocomplete`.

---

## Purpose

The payee field allows users to:
- Enter a free-form payee name (any text is valid)
- Get suggestions from previously used payees for faster entry
- Maintain consistency in payee naming across transactions

---

## Key Differences from Category/Account Autocomplete

| Aspect | Payee | Category/Account |
|--------|-------|------------------|
| Selection required | No - any text is valid | Yes - must select from dropdown |
| "No" option | None | Has "No Category" / "No Account" |
| Validation | None - empty is fine | Required in most cases |
| Data source | Previously used payees | Budget categories/accounts |

---

## Typing Behavior

### Free-form Input
- User can type any text as a payee name
- No validation - empty is valid, any string is valid
- Value is what the user typed (not an ID)

### Autocomplete Suggestions
- Suggestions appear as user types
- Filtered by fuzzy match on payee name
- Limited to 8 suggestions max
- Only shows when there are matching suggestions

---

## Keyboard Behavior

### Arrow Keys
- Navigate through suggestions when dropdown is open
- Does nothing if dropdown is closed or empty

### Enter Key
- Selects highlighted suggestion (if one is highlighted)
- Does nothing if no suggestion highlighted

### Escape Key
- Closes dropdown without changing value
- User can continue typing

### Tab Key
- Normal tab behavior (moves to next field)
- Does NOT auto-select a suggestion

---

## Mouse Behavior

### Click on Suggestion
- Selects that payee immediately
- Closes dropdown
- Updates input value to selected payee

### Mouse Hover
- Highlights the hovered suggestion
- Does not select until clicked

---

## Filtering

### Fuzzy Match
- Matches if query characters appear in order in payee name
- Case insensitive
- Scores higher for:
  - Direct substring matches (highest)
  - Matches at word start
  - Consecutive character matches

### Examples
- Query "ama" matches "Amazon", "Walmart" (contains a-m-a)
- Query "groc" matches "Grocery Store", "Trader Joe's Groceries"

---

## Dropdown Display

### Structure
- Simple flat list of matching payees
- No grouping or headers
- Shows up to 8 matches

### Styling
- Appears below the input field
- Highlighted item has accent background
- Standard dropdown shadow and border

---

## Form-Specific Placeholders

| Form | Placeholder |
|------|-------------|
| Income | "e.g., Employer, Client name" |
| Spend | "e.g., Grocery Store" |
| Adjustment | "e.g., Bank, Interest source" |

---

## Data Persistence

### Payee Collection
- All unique payees are stored in a budget-level payees collection
- Automatically updated when transactions are added
- Shared across all transaction types (income, expense, adjustment)

### Lazy Loading
- Payees are only fetched when a form is opened
- Uses React Query with `enabled` flag based on form visibility
- Reduces unnecessary API calls when forms are closed


