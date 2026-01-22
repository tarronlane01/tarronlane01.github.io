For spent/transfer/adjust, if zero, just show without a positive or negative sign.\

Make spent, transfers, and ajust, and income links to those pages (underlined, or with a go-to arrow). Making it clear those are clickable on mobile and desktop. Apply to month balances categoires and accounts

Set account balances up to look like an equation, where you have Total = ( cleared + uncleared ) in both the header and the individual rows. Maybe add these signs in their own grid columns so they have good spacing from the values. If the cleared and uncleared would be dashes (meaning there is no uncleared abalances), then don't show the equation. Apply this to both the settings/accounts as well as the month/balance/accounts pages

When showing OFF BUDGET badge, don't show (type). Same to any other of these badges on the settings/account page

Let's right-align the buttons on the settins account/category groups, so they are more aligned with the "actions" columns that the individual rows use

Should we not save balances and things on the firestore documents that we can re-calculate locally?

Make the budget settings account/category edit/create forms full-page instead of inline

Let's change the blue check mark to a button that says either add or save, depending on if this is editing or adding a row. this applies to the income / spend / adjustments etc, (basically all forms)

For mobile views, let's not have an edit button but just open the edit form if a user clicks on a row (for budget settings accounts / categories, as well as month income / spend / adjustments / transfers). Is there a way we can do this while still allowing mobile users to hold to highlight / copy amounts?

When we're on the month that page that matches the current month (based on the calendar), then instead of end for the column name we should say current.

When looking at future months, let's avoid showing the start and end month values, since those are practically guaranteed to change before we actually get to that month.

Have download have date instead of timestamp in download, to make it easier to human read

Don't auto-focus amount when creating adjustments

On the my-budgets page (since it's the landing page) Give a go-to-budget button on the budget line, or when creating a budget, auto-take them to that budget

**On month categories or accounts page, give a button to quickly go to settings**
On the month categories or accounts page, give a button to quickly take to the account settings page to edit the lists

**Have spend be the default page to land on when going to transactions**
Have spend be the default page to land on when going to transactions

### Display Improvements

**Hidden categories and how should they behave if they have positive balances**
Hidden categories and how should they behave if they have positive balances

**Show cleared and uncleared balances for accounts**
Show cleared and uncleared balances for accounts

### Admin and Migration

**Have all migrations trigger a diagnostic download backup**
Have all migrations trigger a diagnostic download backup, required by architecture

**Have migrations show loading overlay when they're checking status**
Have migrations show loading overlay when they're checking status

**New user with new user flow, and migration to fully reset the user**
New user with new user flow, and migration to fully reset the user

**Search on feedback**
Search on feedback

**Add pluses and equals in the month grid**
Add pluses and equals in the month grid to help it easier to identify what values I'm looking at. For example (parenthesis around the components of the net change)

**Better not-found page**
Better not-found page when going to page with no routes matching location warning would appear in the console

**When no accounts or categories, don't show the ungrouped section**
When no accounts or categories, don't show the ungrouped section. Only show if we have ungrouped accounts/categories.

**Add off-budget to the account totals**
Add off-budget to the account totals
