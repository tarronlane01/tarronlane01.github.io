# To do
- Let's also have consistent name for spend missing category and missing account (instead of no account vs adjustment). Maybe No Account, No Category to make it clear. Update this in the the import parsing migration, as well as anywhere else we display dropdowns for category/account so that the No options is available to be picked. For income, don't have the No Account availalble. And let's also add a form validation so that account and category can never be BOTH the No option.
- Move settingsMigration to an Admin subfolder, clean up the page files to be under folders per sub-page
- Prevent users from creating months too far into the future
- [ ] Migration so all ID's have some human readable pattern to them, to help with tracking down issues
- [ ] Check difference between hooks in data and hooks in hooks
- [ ] admin.ts - why do admin pages need to avoid using query cache layer? Let's see if we can consolidate to avoid needing this
- [ ] Have all read/write operations have a description mandatory field that will get output to the console, to help with debugging to understand why each read/write is being made
- [ ] Don't have the budget get loaded on the homepage, only when we're under budget. Do the same for the feedback button. It shouldn't show up on the homepage.
- [ ] When changing budget categories from the budget, mark current and all future months as stale if they aren't already marked as stale
- [ ] Go through the flow when changing the date of a transaction to a different month (for income / spend)
- [ ] Re-order balances page to have start, then allocations, even while editing
- [ ] Multiple reads when going to a next month after editing spend in previous
- [ ] Drop max file size down to 400

- [ ] To cut down on writes, maintain a month list with needs-recalculation flags on the budget document itself. that way we always have a month index we can reference instead of doing batch read/writes to know what months we have and to mark them as stale.