# CRUD Pattern Change

Let's change so we only store start month values on the month, for balances and categories. Only store these for the month athe beginning of our initial app load window, and before. Then on app load, we do our recalculations from the earlies month in our window onwards. If the earlist month in our window does NOT have saved beginning month balances, we walk backwards until we find them, then walk forward calculating and saving them until we get to the earlist month in our window. When using the app we just save line items (the thing we're editing) immediately to firebase like we do (in the background) after optimistic update as well as recalc from our earliest window month to the latest budget month, like we do now, but without the need for any periodic saves or 5 mintue timers, or saves when we navigate. the only time we need to save recalcs of start balances is if we make edits BEFORE our earlist window month. In those cases, we should show the global loading overlay while we apply the update, recalc, save to firestore, and then we can remove the global loading overlay once all that is one. It will take time, but making edits that early is infrequent. This will make sure most common uses (within the window) stay syced imeediately with minimal firestore load, and without the need to manage keeping totals and balances synec.

Allocations should be stored in the category map on a month, So each month will have a monthmap with start balance (if before or at the beginning of the window) and an allocation amount (applicable to all months, even ones within the window, etc). Allocations are not calculated on the fly.

Don't save start balances for any months after teh first month in the window, to avoid potential for sync issues.

All CRUD operations should just edit the saved source data and not directly udpate the calculated values. Those should just recalc as part of the save. Only exception is when editing before the window, which should have the process detailed elsewhere in this set of instructions.

For budget totals, calculate on the fly from the latest saved start balances and all the months after that (in the window).

Reset the window on app reload based on the current date. Keep stable for the session.

The first month in the window should have start balances saved, as well as ALL months in the budget before then.

- Update data structures in code to account for this
- Update download/import to account for this
- Make sure pattern is applied across all month and settings pages (where it makes sense)

Account balances should follow this same pattern as categories
total for spent, transfers, adjustments, etc should not be stored, but should be calculated from the months data. They should be really fast to calculate on the fly.

Window should always be based on the current calendar month, not the month we're editing.

Don't save end balances to the database, but you can keep them inmemory.

The code versions of the data structures should just have what is saved. Move inmemory totals and other things elsewhere so there's no confusion about what is saved vs what is calculated on the fly.

Use common calculation functions to make sure things get calculated in the same way when shown in different places in the app.

Do what we can to make sure these calculations are speedy so they can happen almost instantly to the user's perspective.

Don't worry about backwards compatibiltiy. We'll require migraiton first.

For calculated balances, use react query cache only to manage those. Meaning we redo them when we save something, or when we reload the page. But don't have to recalc them everytime the page re-renders.


---

# Review

- [ ] Going back load past

# Testing

- [ ] test adding / removing transactions behavior
- [ ] Test past month loading behavior

# Wrap

- [ ] review / deploy