# Bugs

## Data Synchronization and Display

**When saving income, there's still a delay between saving and having it show up**
When saving income, there's still a delay between saving and having it show up

**When going to a month that isn't loaded yet, it flashes the name of the month**
When going to a month that isn't loaded yet, it flashes the name of the month for split second before showing the loading screen. Let's show the loading overlay before we even update the month name or anything on the page, when switching months.

**Month name still flashes for a second before it shows the loading overlay**
Month name still flashes for a second before it shows the loading overlay, when creating or loading a month

**Double-check that account balances match**
Double-check that account balances match

**Account balance does not match up for Charles Schwab and Capital One**
Account balance does not match up for Charles Schwab and Capital One

**On main budget page, available now and total available are always matching**
On main budget page, the available now and the total available are always matching, but available now should show based on the current month, which is usually different than the total allocated for all time.

## UI and Interaction

**Click on account or category to edit**
Click on account or category to edit

**Feedback submit not showing confirmations**
Feedback submit not showing confirmations

**Order of columns should match on all budget category views**
Order of columns should match on all budget category views

**Modals need to show up above the sticky headers**
Modals need to show up above the sticky headers

**When you save a category as hidden, then go to the bottom section and expand, it still shows the open form**
When you save a category as hidden, then go to the bottom section and expand, it still shows the open form.

**Can't drag-select account values because drag to move is triggering even when outside the drag button**
Can't drag-select account values because drag to move is triggering even when outside the drag button

## Data Validation

**We shouldn't allow accounts to go negative**
We shouldn't allow accounts to go negative. We should flag as an error and require it to be fixed. If this happens during an import, we should also flag it, but allow the import and callout the accounts that are negative for any period of time.

**Transfer form doesn't allow leaving account form blank**
Transfer form doesn't allow leaving account form blank

**Logging out doesn't invalidate all local storage**
Logging out doesn't invalidate all local storage

## Transaction Behavior

**Only have expenses change the account balance if "cleared"**
Only have expenses change the account balance if "cleared".
