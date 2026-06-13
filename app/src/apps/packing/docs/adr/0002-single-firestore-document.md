# All packing data in a single Firestore document

All packing data — taxonomies, items, tasks, trips, and packed/skipped state — lives in one document (`packing/shared`). This is feasible because the data volume is small (hundreds of items, dozens of trips) and well within Firestore's 1 MB document limit. The single-document approach enables real-time sync via a single `onSnapshot` listener and keeps the data model simple with no cross-document references.

Access is controlled by a `userIds` array on the document. Firestore rules validate `request.auth.uid in resource.data.userIds`, with admin override. This mirrors the budget app's access pattern.

## Considered Options

- **One document per trip** — avoids write contention across trips, but adds cross-document reads for master list data and complicates the real-time listener setup
- **Separate collections for items, tasks, trips** — normalized, scales better, but massive overkill for a family packing app with one shared dataset
- **Single document** (chosen) — simple, one listener gets everything, concurrent writes to different field paths don't conflict. Risk of write contention is low for a small-user-count family app
