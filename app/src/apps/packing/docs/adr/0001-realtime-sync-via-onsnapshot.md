# Real-time sync via onSnapshot piped into React Query

The packing app needs concurrent editing — two family members packing and checking off items simultaneously. The budget app uses one-time Firestore reads cached by React Query, but that pattern would require manual refreshing to see another user's changes.

We use Firestore's `onSnapshot` listener on the single packing document and pipe incoming snapshots into the React Query cache via `queryClient.setQueryData`. Components consume data from React Query as usual, unaware of the real-time source. Packed state is stored as a map (`{ [itemId]: true }`) so concurrent writes to different items hit different field paths and don't conflict.

## Considered Options

- **One-time reads + polling/refetch-on-focus** — simpler, matches budget app pattern, but stale data during simultaneous packing sessions
- **onSnapshot directly in context** — bypasses React Query, creates a second state management pattern
- **onSnapshot → React Query cache** (chosen) — real-time updates with consistent data layer, but diverges from budget app's read pattern
