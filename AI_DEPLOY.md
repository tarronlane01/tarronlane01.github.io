# Deploy

## Session Summary: Cache-Aware Month Mutations

### What Changed
Implemented cache-aware reads for all month mutations to avoid unnecessary Firestore reads when React Query cache is fresh.

**New file created:**
- `src/data/mutations/month/cacheAwareMonthRead.ts` - Helper utilities for cache-aware month reads

**Pattern implemented across all month mutations:**
- Income: add, update, delete
- Expenses: add, update, delete
- Transfers: add, update, delete
- Adjustments: add, update, delete
- Allocations: save draft, finalize, delete

**How it works:**
1. Check if cache is fresh via `isMonthCacheFresh()` before mutation
2. If fresh (< 5 min): use cached data directly (0 Firestore reads)
3. If stale: fetch fresh data from Firestore (1 read)
4. UI always updates immediately via optimistic updates

**ESLint enforcement added:**
- Direct `readMonthForEdit` imports blocked in mutation files
- Must use `cacheAwareMonthRead.ts` utilities instead

**Also enabled:**
- `logFirebaseSource: true` in feature flags for better debugging

---

**Manual review before deploying:**
- Remove any dead code introduced in this session
- Restruture any code that should conform to newly created patterns or systems

**Then**
Deploy using the publish script from the budget-app directory, ensuring commit message is 10 words or less:

```bash
cd budget-app && ./scripts/publish.sh "cache-aware month mutations to reduce Firestore reads"
```

The script automatically checks:
- ✅ ESLint passes
- ✅ File line count under limit (400 lines)
- ✅ No rogue console statements (only allowed in logging/admin files)
- ✅ No deep relative imports (use path aliases)
- ✅ Build succeeds
