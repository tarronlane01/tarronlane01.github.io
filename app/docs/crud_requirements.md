# Functionality

- All data writes should be optimistic when affecting data show on current page
- All data should be cached on read to avoid rereading, and should default to read from the cache if the cache is valid
- Don't require pre-write reads, but do a firebase merge strategy to write updated data to documents
- Data writes that will also affect data shown on other pages should use a common mark-for-recalculation system to mark all future months as neededing recalculated
- Recalculation should trigger whenever a user views a month or budget marked as needing recalc
- All caches should expire when either
    - they are over 5 minutes old
- All firebase operations that hit firebase need to output a common-format logging output that indicates what operation and what doc count, with app-level feature flags that determines if it will also output a description, or a full doc path

# Organization

- ESLint rules to enforce app-wide compliance with CRUD pattern
- Common functions to handle all firebase logic with baked-in logging, and restricted imports to only be used by valid common functions
- common crud functions for each doc, trying to be organized by one operation per file, and then imported into wherever that operation is needed
