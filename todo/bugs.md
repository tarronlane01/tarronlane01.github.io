

# This Session

Getting an access denied message when going to the settings/budget page, because user was stale. We should either keep the user from getting stale, or show a loading screen if the user is stale while we're refetching so we don't show the access denied error. Apply this fix anywhere else this scenario could happen.

Have all pages, including homepage and sql test page, etc, use the same component container for the content tht the budget has, with the same header component so they all behave the same way, with the icon on the left, the ellipse menu on the right, the title in the middle, and all page content staying within the main containe that sets the left and right spacing. Make sure these are all using the same components so that they are forced to have the same behavior and don't have to be separately maintained.

Catch if we ever get a firebase quota error when trying to read/write to firebase, and show that error in the common error banner.

---

Maybe we take all the totals and balances and never save those to firebase, instead always recalculating them on inital app load, storing them elsewhere for just the app session. That would save us having to do periodic saves and reconcilliations and manage cache for balances and cascading tracking of what needs resaved because the balance is new, right? Any issues in this plan? Don't make any changes yet, just let me know what this plan misses.

# Other

Click on account or category to edit

Order of columns should match on all budget category views

Modals need to show up above the sticky headers

When you save a category as hidden, then go to the bottom section and expand, it still shows the open form.

Can't drag-select account values because drag to move is triggering even when outside the drag button

We shouldn't allow accounts to go negative. We should flag as an error and require it to be fixed. If this happens during an import, we should also flag it, but allow the import and callout the accounts that are negative for any period of time.

Transfer form doesn't allow leaving account form blank

Logging out doesn't invalidate all local storage

Only have expenses change the account balance if "cleared".

