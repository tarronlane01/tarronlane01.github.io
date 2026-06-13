# Autocomplete Dropdown - User Stories

This document captures the expected user experience for the autocomplete dropdown components used for Account and Category selection throughout the app.

> **Note**: This behavior applies to `AccountAutocomplete` and `CategoryAutocomplete` components used in Transfer, Adjustment, Spend, and Income forms.

---

## Smart Highlighting

### On Focus
- **Empty field (showing placeholder)**: Highlights "No Account" / "No Category" option
- **Field with existing selection**: Highlights first suggestion in the filtered list

### While Typing
- **Empty input (cleared)**: Highlights "No Account" / "No Category" option
- **Text entered**: Highlights first matching suggestion

---

## "No Account" / "No Category" Behavior

### When Value Should Be NO_ACCOUNT_ID / NO_CATEGORY_ID (Valid)
- Input field is empty (cleared or never filled)
- User selected "No Account" / "No Category" option from dropdown

### When Value Should Be Empty String (Invalid)
- User typed text but hasn't selected an option from dropdown
- Shows error border indicating selection required

---

## Keyboard Behavior

### Tab Key
- Only selects the highlighted item if user explicitly navigated with arrow keys
- If user just focused and tabs away without interacting, keeps current value
- Does NOT auto-select the first suggestion

### Arrow Keys
- Navigate through dropdown options
- Highlights the selected option visually

### Enter Key
- Selects the currently highlighted option (if any)
- Does nothing if no option is highlighted

### Escape Key
- Closes dropdown without changing selection
- Restores input text to match current selection

---

## Mouse Behavior

### Click on Option
- Selects that option immediately
- Closes dropdown
- Updates displayed value

### Mouse Hover
- Highlights the hovered option
- Does not select until clicked

---

## Typing Behavior

### First Character
- Should appear immediately (not eaten by focus/state handlers)

### Filtering
- Filters suggestions based on typed text
- Matching is fuzzy on **item name only** (not group name)
- This prevents false positives where typing "Ren" would show all items in "Monthly Recurring" group

### Selection State
- Typing clears the underlying selection (sets to empty string)
- User must select from dropdown to set a valid value
- Empty input with `showNoAccountOption`/`showNoCategoryOption` enabled defaults to the "No" option

---

## Dropdown Display

### Structure
- "No Account" / "No Category" option at top (when enabled)
- Items grouped by their group (Account Group / Category Group)
- Group headers shown in uppercase
- Items indented under their group

### Sorting
- Groups sorted by sort_order
- Items sorted by sort_order within their group
- Ungrouped items appear at the end

---

## Visual States

### Error State
- Red border when `required` is true and no valid selection
- Appears when user has typed text but not selected from dropdown

### Placeholder
- Shows "No Account" / "No Category" when that option is selected
- Grayed out, italic text

