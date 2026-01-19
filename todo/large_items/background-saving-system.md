# Background Saving System Refactor

## Overview
Large refactor to implement a comprehensive background saving system with queue management and error handling.

## Related Items

**Global background-saving bottom floating banner/icon**
Create a global background-saving bottom floating banner/icon, that has a queue just like the global loading overlay, and components can hook into it to add items to the global background saving queue and they will make it show up with certain text, and they have a callback they can use to remove items from the queue once they're resolved. The floating bottom queue-loading indicator should display a throbber and the text of the top-most item in the queue, then as things resolve it should display the next-down item, until all items are resolved / removed from the queue at which point the floating loader should disappear.

**Background saving won't trigger during local operations**
Make sure the background saving won't trigger if we're in the process of saving locally or recalculating locally.

**Error handling in feedback banner**
Expand the feedback saved bottom banner so it can also be used to show errors. Any console errors should show up on the page in red with the bottom banner. That way we can show the user if there was any errors in saving to firestore, or with syncing, etc.
