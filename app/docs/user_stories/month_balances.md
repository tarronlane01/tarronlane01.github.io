# Month Category Balances - User Stories

This document captures the expected user experience for the Category Balances view on the Balances page, which allows users to view category balances and edit allocations in one unified interface.

> **Note**: This is part of the Balances page. Users can toggle between Category Balances (this view) and Account Balances using the view toggle button.

---

## Navigation & Layout

### US-1: Tab Position
**As a user**, I want the Balances tab to be in the middle position (Income | Balances | Spend) so that I have a logical flow from income to allocation to spending.

### US-2: Tab Checkmark
**As a user**, I want to see a checkmark on the Balances tab when allocations have been applied, so I know at a glance that my allocations are finalized for the month.

---

## Summary Grid (FourStatGrid)

### US-3: Balance Summary Display
**As a user**, I want to see a 4-cell summary grid at the top showing:
- Start of Month (previous month's ending balance)
- Allocated (or "Draft Allocations" when editing)
- Spent
- End of Month

so I can quickly understand my overall category balance position.

### US-4: Edit Link in Summary
**As a user**, when allocations are applied, I want to see an "edit" link below the Allocated amount in the summary grid, so I have a single, clear entry point to modify my allocations.

### US-5: Draft Label
**As a user**, when I'm editing allocations (either new or modifying applied ones), I want the summary to show "Draft Allocations" instead of "Allocated", so I know my changes aren't saved yet.

---

## Viewing Balances (Read Mode)

### US-6: Category Group Display
**As a user**, I want to see my categories organized by group, with each group showing:
- Group name and category count
- Total allocated for the group
- Total end balance for the group

so I can understand my allocation distribution.

### US-7: Desktop Balance Table
**As a user** on desktop, I want to see a table for each category with columns:
- Category name
- Allocated amount
- Start balance
- Spent amount
- End balance

so I can see the full equation for each category's balance.

### US-8: Mobile Balance Display
**As a user** on mobile, I want to see each category as a card with:
- Category name on top
- All four values (Start, Alloc, Spent, End) in a single row below

so I can see all the information without excessive scrolling.

---

## Editing Allocations

### US-9: Entering Edit Mode
**As a user**, when I click the "edit" link in the summary grid, I want to enter editing mode where I can modify my allocations.

### US-10: Editing Header
**As a user**, when editing allocations, I want to see a header bar with:
- "Editing Allocations" label (when modifying applied) or "Draft Allocations" (when new)
- Apply/Save button
- Cancel button (X) when editing applied allocations
- Delete button (🗑️) when editing applied allocations

so I have clear actions available.

### US-11: Draft Equation Display
**As a user**, when editing allocations, I want to see an equation showing:
- Available funds
- Draft/Change amount
- Result if applied

so I understand how my allocations affect my available money.

### US-12: Allocation Input Fields
**As a user**, when editing allocations on desktop, I want input fields in the Allocated column for each category, so I can easily enter amounts.

### US-13: Mobile Allocation Input
**As a user**, when editing allocations on mobile, I want an "Allocate:" input field below each category's balance row, so I can modify allocations without cluttering the balance display.

### US-14: Percentage-Based Allocations
**As a user**, for categories with percentage-based allocations, I want to see the full equation displayed:
- `{previous month income} × {percent}% = {calculated amount}`

so I understand how the allocation is calculated.

### US-15: Suggested Amounts
**As a user**, when editing allocations for categories with default amounts, I want to see "Suggested: $X.XX" below the category name, so I remember what I typically allocate.

---

## Saving & Applying Allocations

### US-16: Save Draft
**As a user**, I want to save my draft allocations without applying them, so I can come back and finish later.

### US-17: Apply Allocations
**As a user**, I want to apply my allocations with a single click, which saves and finalizes them, updating my category balances.

### US-18: Cancel Editing
**As a user**, when editing applied allocations, I want to cancel and revert to the previously applied values.

### US-19: Delete Allocations
**As a user**, when editing applied allocations, I want the option to delete all allocations for the month, reverting category balances.

---

## Draft Status Banner

### US-20: Unapplied Allocations Warning
**As a user**, when I have draft allocations that haven't been applied yet (not editing existing ones), I want to see a warning banner with:
- "⏳ Allocations Not Applied" message
- "Apply to update category balances" explanation
- "✓ Save & Apply" button

so I'm reminded to finalize my allocations.

---

## Live Balance Preview

### US-21: Real-time Balance Updates
**As a user**, when editing allocations, I want the End balance for each category to update in real-time as I type, so I can see the immediate impact of my allocation decisions.

### US-22: Summary Updates
**As a user**, when editing allocations, I want the summary grid totals to update in real-time, so I can see the overall impact on my budget.

