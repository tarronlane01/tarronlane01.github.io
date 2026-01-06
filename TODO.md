# Off-budget transfers.

Allow transfers to off-budget accounts, and update in the notes on that page and on the spend page to indicate where the correctd place is to put money going to off-budget accounts. Flag those accounts with maybe a differnet pill color so we can see them in the list more easily (as well as in the dropdown, maybe make their text a slighly different color that mirrors the differnece in the pill color as well).

make sure that those transfers will accurately impact the on-budget available (for example it should reduce that if we transfer fro man on-budget account to an off-budget account)

# Easier schema evolution

Make it easier to add/remove data fields, but consllidating logic that specifies the full field list, or colocating files so that the logic is all near it, to make it easier to find all the places we need to udpate when we add/remove fields.

# Migration Organization

Organize / combine migrations into better secdtions. Let's put one-time migraitons into a card that has them organized as one-line permigration with a button to check if applied or not, and then a button to apply again (have them still display the modal). Have Database re-runnable scripts in a maintenance section that I can click one button at the top to validate all the mainteance onces and show which ones need to be run to resolve. Then have a Utility seciton that includes things like downloading data (one row per specific configured download), deleting months, invalidating cache, etc.

The re-suable section should include the account/category validation, the orphaned ID cleanup, the expense the adjustment migration, and the adjustments to transfers, just with modifications to make them more easily, but combined into one called transaction type audit. Currency precision should also be in this section, but a separate row.

Database cleanup, hidden field, consolidate feedback, etc should be in the onetime.

Make sure to still preserve common components so that each of these sections uses common code and behaves in the same way that forces the behavior for these that we are currently trying to enforce.