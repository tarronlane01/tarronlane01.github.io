# New Features

## Account Management

**Add a highlight to accounts on the account page that haven't been updated**
Add a highlight to accounts on the account page that haven't been updated in a couple months, so I know to check on them and update the balance

**Add ability to mark accounts as inactive**
Add ability to mark accounts as inactive, to stop alerting me when they haven't been updated in a while

## Reminders and Notifications

**Have a reminder or banner for forgotten monthly recurring bills**
Have a reminder or banner or something, if we've forgotten to pay certain monthly recurring bills, like tithing, fast offerings, etc.

## Analytics and Reporting

**Graph to show income by month, maybe on an analytics page**
Graph to show income by month, maybe on an analytics page

## Core Features

**Show net worth on account page**
Show net worth on account page

**Show totals by budget, off budget**
Show totals by budget, off budget

**Make sure we've planned out what should happen if we delete an account or category**
Make sure we've planned out what should happen if we delete an account or category

**Sample Budget and sample data**
Sample Budget and sample data

**Fully-fleshed out restore from download functionality**
Fully-fleshed out restore from download functionality

## Budget Management

**Split unallocated by month earned**
Split unallocated by month earned

**Export Budget feature, to back things up before messing with stuff**
Export Budget feature, to back things up before messing with stuff.

## Category Features

**Zero out button for some categories like tithing and fast offerings**
Zero out button for some categories like tithing and fast offerings

**Filter spend by category**
Filter spend by category

**Ability to favorite a category to show on landing page**
Ability to favorite a category to show on landing page

## Transfers

**Allow transfers to off budget accounts, make it easy with zero-out account click**
Allow transfers to off budget accounts, make it easy with zero-out account click

**Off-budget transfers**
Off-budget transfers

## Testing and Feedback

**Add a test flag to the feedback**
Add a test flag to the feedback, to represent things we want to double check are working the way we think they should be

## Account Reconciliation
- Set up the seed in the repo with a fresh download with the new format
- Make sure our import works with our download format, so I could download, edit, zip, then reupload to change budget values en-mass if I wanted to.
- Remove the month download feature, and just make sure it's easy to find the month we're after in the main admin download.

**Add a download month doc on the month dropdown (for admins)**
Add a download month doc on the month dropdown (for admins). Have it download separate files for all the transaction types, to make it easier to parse the long json lists. Have each file prefixed with the same thing so I can easily group them together when scanning through the downloads. Include the date in the prefix. Can it also open those downloads in new tabs so I can look through the json quickly.

**Sample budget create-data and upload**
Sample budget create-data and upload (replace the seed files) Have files for each doc we'd upload, in folders by doc type, and update the import function to use this structure. Months should be folders with separate docs for the lists of transaction types, to make it easier to find the data I want to edit or review.
