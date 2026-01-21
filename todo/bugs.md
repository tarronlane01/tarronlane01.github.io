# This Session

When clicking between settings/accounts and settings/categories, there is aplit second on categories where all the values aren't populated yet (looks like maybe three dots). Why is this happening? Also, sometimes it looks like they are different values, and then they change a split second after the page loads. Why?

Have all pages, including homepage and sql test page, etc, use the same component container for the content tht the budget has, with the same header component so they all behave the same way, with the icon on the left, the ellipse menu on the right, the title in the middle, and all page content staying within the main containe that sets the left and right spacing. Make sure these are all using the same components so that they are forced to have the same behavior and don't have to be separately maintained.

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

