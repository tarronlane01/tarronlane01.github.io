# Plan: Inline Category/Phase creation from Item/Task modals

## Summary

Add a "+ New" link next to the Category dropdown in `ItemModal` and the Phase dropdown in `TaskModal`. Clicking it opens a quick inline form (name only, no Section assignment) that creates the taxonomy entry and auto-selects it in the dropdown.

## Changes

### 1. `ItemModal.tsx` — Add inline Category creation

- Add state for showing an inline "new category" input (`showNewCategory`, `newCategoryName`)
- Add a "+ New" link/button next to the Category `<SelectInput>`
- When submitted: call `onAddCategory(name)` callback, receive the new ID back, set `categoryId` to it
- New prop: `onAddCategory: (name: string) => string` (returns the new category's ID)

### 2. `TaskModal.tsx` — Add inline Phase creation

- Same pattern as ItemModal: `showNewPhase`, `newPhaseName`
- "+ New" link next to Phase `<SelectInput>`
- New prop: `onAddPhase: (name: string) => string` (returns the new phase's ID)

### 3. `MasterList.tsx` — Wire up the new callbacks

- Import `useCategoryMutations` and `usePhaseMutations`
- Pass `onAddCategory` to `ItemModal`, calling `addCategory(name)` (no sectionId)
- Pass `onAddPhase` to `TaskModal`, calling `addPhase(name)` (no sectionId)
- After mutation, the React Query cache updates and the new entry appears in the sorted lists passed to the modals

### 4. Verify mutation return values

- Check that `addCategory` and `addPhase` return the generated ID so we can auto-select. If they don't, adjust to capture the ID from the mutation.

## Design decisions

- **Create only** — no edit/delete from the modal. Settings remains the home for full taxonomy management.
- **Name only** — no Section assignment in quick-create. User can assign a Section later from Settings.
- **Auto-select** — newly created Category/Phase is immediately selected in the dropdown.
