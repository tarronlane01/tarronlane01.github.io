# Code Organization Refactor

## Overview
Large refactor to improve code organization, reduce duplication, and improve maintainability.

## Related Items

**CRUD process review**
Let's take a step back and look at our CRUD processes, with this new system, and see if we can refine. Is there anything redundant or round-about that we can simplify without sacrificing functionality? Are there redundant hooks that we can combine without going over the 400 line limit? Are we doing similar things in multiple places that we should combine to avoid too much spaghetti?

**Transaction form component sharing**
Let's make sure the multiple transaction form components share component components so that we don't duplicate logic or have possibility for shared behavior to deviate.

**Mobile and desktop view separation**
Separate mobile and desktop views into two files in the same folder, have the other logic in another file (or set of files) so that both desktop and mobile can share the functionality. So I can open the file and see all the parts of the page in nice separate files to easily find the part I want to tweak.

**Utils organization**
Can we make sure all utils are in the utils folder (these are things that are independent functions that can be isolated to take logic out of other places and avoid needing to repeat it)

**Mobile friendly analysis and consistent behavior**
Add an AI maintenance about mobile friendly analysis and consistent behavior
