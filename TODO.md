
Noticed QOL
- add a download month doc on the month dropdown (for admins). Have it download separate files for all the transaction types, to make it easier to parse the long json lists

- Add pluses and equals in the month grid to help it easier to identify what values I'm looking at. For example (parenthesis around the components of the net change)

- can we make sure all utils are in the utils folder (these are things that are independent functions that can bo isolated to take logic out of other places and avoid needing to repeat it)

- separate mobile and desktkop vies into two files in the same folder, have the other logic in an other file (or set of files) so that both desktop and mobile can share the functionality. So I can open the file and see all the parts of the page in nice separate files to easily find the part I want to tweak.




# Background timer for recalculating months, that get's reset if we make an update (like adding an ew income line) to support adding lots of lines in short succession

# Easier schema evolution

Make it easier to add/remove data fields, but consllidating logic that specifies the full field list, or colocating files so that the logic is all near it, to make it easier to find all the places we need to udpate when we add/remove fields. Make sure all our logic will never accidentally delete things if we edit schema to add new fields and test it in the app, and that we've structured things so that the parsing will always save with defaults for new fields )instead of undefined, etc), so that as we change things we automatically keep up without breaking things.

# Migration Organization

Organize / combine migrations into better secdtions. Let's put one-time migraitons into a card that has them organized as one-line permigration with a button to check if applied or not, and then a button to apply again (have them still display the modal). Have Database re-runnable scripts in a maintenance section that I can click one button at the top to validate all the mainteance onces and show which ones need to be run to resolve. Then have a Utility seciton that includes things like downloading data (one row per specific configured download), deleting months, invalidating cache, etc.

The re-suable section should include the account/category validation, the orphaned ID cleanup, the expense the adjustment migration, and the adjustments to transfers, just with modifications to make them more easily, but combined into one called transaction type audit. Currency precision should also be in this section, but a separate row.

Database cleanup, hidden field, consolidate feedback, etc should be in the onetime.

Make sure to still preserve common components so that each of these sections uses common code and behaves in the same way that forces the behavior for these that we are currently trying to enforce.

Each migration type should have it's own folder ,with a file per migration line, to keep things organized

Each migration script should auto prompt to download a backup before executing, to remind us to back things up. Bake this into the architecture so it's very hard for migrations to miss this step.