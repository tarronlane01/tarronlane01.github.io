# Recalculation Optimization Refactor

## Overview
Large refactor to optimize the recalculation system for better performance and reliability.

## Related Items

**Read-write recalc months in a batch to speed up recalc time**
Read-write recalc months in a batch to speed up recalc time?

**Speed up imports and recalcs by fetching all months at once**
Speed up imports and recalcs by fetching all months at once, and writing all months at once.

**Further optimize recalc method to avoid having to wait for recalc**
Further optimize recalc method to avoid having to wait for recalc. Maybe constantly be doing recalc locally, and only save in background to firestore when we go to the pages that require recalc, maybe showing a header banner saving notification

**Have the recalculating loading show the months that are getting recalculated**
Have the recalculating loading show the months that are getting recalculated

**Session persistence concern**
I'm worried about what happens if a user closes the browser and ends their session before the recalculations are saved. The actual direct edits should be saved no matter once since those happen immediately when the edit is saved, but the recalculated values won't have been saved. Could we solve this by including a local recalc or all months locally whenever we first load the app? What are potential issues with that approach to solve this problem?

**Background timer for recalculating months**
Background timer for recalculating months, that gets reset if we make an update (like adding a new income line) to support adding lots of lines in short succession

**Account reconciliation - confirm we aren't re-summing**
Confirm we aren't re-summing all months when we recalculate the account/category balances on the budget doc
