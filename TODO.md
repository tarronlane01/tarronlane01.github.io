I'm worried about what happens if a user closes the browser and ends their session before the recalculations are saved. The actual direct edits should be saved no matter once since those happen immediately when the edit is saved, but the recalculated values won't have been saved. Could we solve this by including a local recalc or all months locally whenever we first load the app? What are potential issues with that approach to sovle this problem? Just tell me, don't make any changes yet.

--- Bookmark

Make sure our cache is all set up to use a sonsistent 5 minute timeout for most updates, unless we have a valid reason to change that.

Make sure the background saving won't trigger if we're in the process of saving locally or recalculating locally.

Let's take a step back and look at our CRUD processes, with this new system, and see if we can refine. Is there anything redundant or round-about that we can simplify without sacrificing functionality? Are the redundant hooks that we can combine without going over the 400 line limit? Are we doing similar things in multiple places that we should combine to avoid too much spaghetti?

Expand the feedback saved bottom banner so it it an also be used to show errors. Any console errors should show up on the page in red with the bottom banner. That way we can show the user if there was any errors in saving to firestore, or with syncing, etc.

Create a global background-saving bottom floating banner/icon, that has a queue just like the global loading overlay, and components can hook into it to add items to the global background saving queue and they will make it show up with certain text, and they have a callback they can use to remove items from the queue once they're resolved. The floating bottom queue-loading indicator should display a throbber and the text of the top-most item in the queue, then as things resolve it should display the next-down item, until all items are resolved / removed from the queue at which point the floating loader should disappear.



# Account Reconcilliation

- set up the seed in the repo with a fresh download with the new format
- Make sure our import works with out download format, so I could download, edit, zip, then reupload to change budget values en-mass if I wanted to.
- Remove the month download feature, and just make sure it's easy to find the month we're after in the main admin download.
- confirm we aren't re-summing all months when we recalculate the account/category balances on the budget doc

# Other

- let's make sure the multiple transactorion form components share component components so that we don't duplicate logic or have possibility for shared behavior to deviate.

- add a download month doc on the month dropdown (for admins). Have it download separate files for all the transaction types, to make it easier to parse the long json lists. Have each file prefixed with the same thing so I can easily group them together when scanning through the downloads. include the date in the prfix. Can it also open those downloads in new tabs so I can look through the josn quickly.

- Add pluses and equals in the month grid to help it easier to identify what values I'm looking at. For example (parenthesis around the components of the net change)

- can we make sure all utils are in the utils folder (these are things that are independent functions that can bo isolated to take logic out of other places and avoid needing to repeat it)

- separate mobile and desktkop vies into two files in the same folder, have the other logic in an other file (or set of files) so that both desktop and mobile can share the functionality. So I can open the file and see all the parts of the page in nice separate files to easily find the part I want to tweak.

- download button for feedback, so I can save the code as todo-lists, merge, etc.

- Sample budget create-data and upload (replace the seed files) Have files for each doc we'd upload, in folders by doc type, and update the import function to use this structure. Months should be folders with separate docs for the lists of transaction types, to make it easier to find the data I want to edit or review.

- Better not-found page when going to page with no routes matching location warning would appear in the console

- When no accounts or categories, don't show the ungruoped section. Only show if we have ungrouped accounts/categories.

- Add off-budget to the account totals

# Background timer for recalculating months, that get's reset if we make an update (like adding an ew income line) to support adding lots of lines in short succession

# Easier schema evolution

Make it easier to add/remove data fields, but consllidating logic that specifies the full field list, or colocating files so that the logic is all near it, to make it easier to find all the places we need to udpate when we add/remove fields. Make sure all our logic will never accidentally delete things if we edit schema to add new fields and test it in the app, and that we've structured things so that the parsing will always save with defaults for new fields )instead of undefined, etc), so that as we change things we automatically keep up without breaking things.