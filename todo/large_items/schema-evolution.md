# Schema Evolution Refactor

## Overview
Large refactor to make schema changes easier and safer.

## Related Items

**Easier schema evolution**
Make it easier to add/remove data fields, but consolidating logic that specifies the full field list, or colocating files so that the logic is all near it, to make it easier to find all the places we need to update when we add/remove fields. Make sure all our logic will never accidentally delete things if we edit schema to add new fields and test it in the app, and that we've structured things so that the parsing will always save with defaults for new fields (instead of undefined, etc), so that as we change things we automatically keep up without breaking things.
