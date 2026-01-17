# Integration Testing
- Organize page files into folder structure matching site URLs (e.g., settings/ for /budget/settings/*, admin/ for /budget/admin/*)
- Make Sure recalc writes happen effciently are won't happen more than once
- make sure all file sizes uner 500
- Make sure build is successful
- make sure if we've changed urls or nav that the nav menus all work correctly (like not showing same page in nav menu if we're on that page)
- Make sure we don't have any loading screens besides the globall oading screen, and we have a standard way to track progress / phases etc on this screen, and a standard interface that all importers use to control this screens behavior
- Remove all console logging except the firebase operations (read/write/query/etc)
- Make sure we have consistent number colors, with positive being red (except category debt which want orange) and positive being green, and zero being grey. Make sure we have the positive or negative sign before the dollar sign. Don't shade the cell green/red, but just keep the striping of the row it's on.
- Make sure we aren't disabling any linting or rules that we should be complying with

## General Architecture Review

You're an expert front-end JavaScript / React / Firebase engineer. Review this project and identify any design flaws (avoid issues specific to larger user counts, as this will be a low-user count architecture with max 10 users), drawing upon your knowledge of how to reduce complexity and avoid future code maintenance and evolution issues. Suggest better code organization and architecture standards to follow best practices, avoid redundant systems, combine code and features.

## React Organization

You're a React expert who specializes in organizing React projects to stay under the recommended line counts for their files. Where can this project improve to break things into more modular files without ballooning complexity or traceability? Where can we make use of shareable components to reduce repetition? How can we organize our CSS and styles better to consolidate our styles? Make sure components handle mostly UI logic, with data and other logic moved out into separate hooks. Make components small to keep file size small, breaking out into multiple components when needed.

- Reduce call depth (try to avoid unecessary import of import of import of.... ect) Ideally one level removed from the compoments it should be clear what is being done, in granular-enough methods to see the overall flow from there. In other words, the component should handle UI stuff like handleClick etc, and have the method calls shown there that detail what is being done from the click, so a develoer can se the impact of that click from there, with that set only being abstracted if multiple compoments need to follow the same algorithm

## UI/UX Review

You're a UI expert. How can we improve the usability of this website? What elements are unusual and clunky? What changes can we make to have the site behave how a user will want/expect it to behave?


- All actions should have instant feedback (optimistic) with async operations happening behind the scenes and showing errors if that doesn't work, to minimize loading screens unless we're directly fetching data we need to display.
- consistent styles, design elements, meaning, formats, etc with shared compoments to force conformity.

## CRUD Organization

Code organization:

You're a CRUD expert for react single-page firestore web applications whose goal is to keep things organized, maintainable, and avoid spaghetti CRUD code. All mutations should follow the main established common code, to avoid rogue patterns. Identify any issues with compliance with this and detail possible solutions.

- All caching (in-memory and local persistance) should be invalid after 5 minutes max, to ensure all users are synced at least every 5 minutes
- Each doc has it's structure stored in a well-organized place, with comments about what the fields are used for
- mutations and queries are consolidated and compoments will read/write using shared methods where possible.
- All writes should use optimisitc updates to immediately update values in cache before saving to firestore, to ensure we aren't looking at stale data, and don't need to refetch the exact values that we wrote.

## Data integrity

All user flow should result in "lazy" recalculation of budget values that need recalculation, while also ensuring that any data shown to the user is accurate while maintaining minimal read/write hits to the server.

- recalcing is redoing the month history from a changed month to ensure all month balances add up and the budet document is accurate.
- All operations that hit firebase should be logged, along with the count of record numbers, so we can track reads and writes to stay below the daily limit.
- Reads should be cached to avoid re-hitting the database unless necessary
- pre-write reads should bypass the cache
- edits that don't actually change anything should avoid firestore writes
- recalculation should trigger when saving allocations, or when going to ANY month or balance category/accounts view, and should resolve all needing-recalc-marked months. Make sure nothing in the spend or income pages requires current recalc, so that we can only worry about recalc if a user is not looking at those pages.
- writes to any month should mark current and all future months as needing recalculation
- recalculation logic should be to go the earlies not-marked-for-recalculation month, and then start from the next month and then walk through all months to get the final values and update the budget doc values as well. This should all happen in one batch read and one batch write
- All saving of number values to firestore should round values to two decimals.
- We should not attempt to update a local cache via optimistic write if there isn't a cache already there. That way we avoid a state were we write one item to create the local cache, but haven't pulled from the server with the full list, so we think we have a valid local cache but it never pulled.


---

## Firebase Security Rules

You're a Firebase expert, making sure my Firebase rules handle security for this app, making sure unauthorized users aren't able to create/edit/read any data they shouldn't. Check for any improvements we can make to the rules.