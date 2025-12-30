# Vibe Coding rules
- Check and understand code after each atomic change, to ensure we aren't creating tech debt or following anti patterns
- See `CHORE.md` for AI-assisted code maintenance prompts and patterns

# Current Chain
- What happens when we load account and the account flag is stale?
- [ ] Explain how budget recalculation flow is working, fix if needed
    - Also, have month recalculation do the same walk to get redone

# To do
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

- Tracking negative balances, and how does that work. Overspending in a budget, which rduces the total vailable, but ideally we would just reduce the allocated to that category until it's out of the hole.
    - Have a "Debt" note, and highlight that field. to explain how debt allocations work (reduce debt but doesn't reduce total available to spend, unless greaterthan the debt)