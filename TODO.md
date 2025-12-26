- [ ] Use vite path aliases and barrel files to reduce import complexity
- [ ] Migraiont so all ID's have some human readable pattern to them, to help with tracking down issues
- [ ] Check difference between hooks in data and hooks in hooks
- [ ] admin.ts - why do admin pages need to avoid using query cache layer? L'ets see if we can consolidate to vaoid needing this
- [ ] Have all read/write opertions have a desxritpion mandatory field that will get output to theconsole, to help with debugging to understand why each read/write is being made
- [ ] Don't have the budget get loaded on the homepage, only when we're under budget. Do the same for the feedback button. It shouldn't show up on the homepage.
- [ ] When changing budget categories from the budget, mark current and all future months as stale if they aren't already marked as stale
- [ ] Go through the flow when changing the date of a transaction to a different month (for income / spend)

# Code Maintenance chores
- [ ] You're an expert front-end javascript / react / front-end / firebase engineer. Review this project and identify any design flaws applicable to low-user count architecture (max 1-5 users), drawing upon your knowledge of how to reduce complexity and avoid future code maintenance and evolution issues.
- [ ] You're a react expert who specializes in organizing react projects to stay under the recommended line counts for their files. Where can this project improve to break things into more modular files without balooning complexity or traceability? Where can we make use of 