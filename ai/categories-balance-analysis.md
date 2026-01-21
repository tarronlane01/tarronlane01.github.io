# Categories Page Balance Calculation Analysis

## Issue
On the settings/categories page, "Available Now" is not correct. The relationship should be:
**On Budget = Total Allocated + Available Now**

## Current Calculations

### 1. On Budget (`getOnBudgetTotal()`)
**Location:** `budget-app/src/hooks/useBudgetData.ts:152-161`

**Calculation:**
```typescript
getOnBudgetTotal() = sum of all on-budget, active account balances
```

**When calculated:**
- Computed on-demand via `useCallback` hook
- Recalculates when `accounts` or `accountGroups` change
- Uses account balances directly from budget document

**What it represents:**
- Total money in all on-budget, active accounts

---

### 2. Available Now (`totalAvailableNow`)
**Location:** `budget-app/src/pages/budget/settings/Categories.tsx:108`

**Current Calculation:**
```typescript
totalAvailableNow = sum of categoryBalances[catId].current for all categories
```

**Where `categoryBalances.current` comes from:**
- `useCategoryBalances` hook → `calculateCategoryBalances()` → `calculateCurrentBalances()`
- `calculateCurrentBalances()` walks backwards through months to find valid starting point
- Returns `end_balance` from current month's `category_balances`, or computes forward from last valid month
- Includes ALL category balances (positive and negative)

**When calculated:**
- Calculated in `useCategoryBalances` hook via `useEffect` when:
  - `budgetId`, `currentYear`, `currentMonth`, or `categories` change
- Uses async `calculateCategoryBalances()` which:
  - Fetches month documents
  - Walks backwards to find valid starting point
  - Computes forward to current month

**What it currently represents:**
- Sum of all category balances (current month end_balance)
- Includes negative balances (debt/overspending)
- This is NOT the same as "money available to assign"

**Problem:**
- This value includes negative category balances, so it doesn't represent "available to assign"
- Should match `budget.total_available` which is the "Ready to Assign" amount

---

### 3. Total Allocated (`totalAllocatedAllTime`)
**Location:** `budget-app/src/pages/budget/settings/Categories.tsx:109`

**Current Calculation:**
```typescript
totalAllocatedAllTime = sum of categoryBalances[catId].total for all categories
```

**Where `categoryBalances.total` comes from:**
- `useCategoryBalances` hook → `calculateCategoryBalances()` → `calculateTotalBalances()`
- `calculateTotalBalances()`:
  - Starts with current balances
  - Walks forward through future months (up to MAX_FUTURE_MONTHS)
  - Adds finalized allocations from future months
  - Subtracts expenses from future months
- Includes ALL category balances (positive and negative)

**When calculated:**
- Same as `current` - calculated in same `useEffect` in `useCategoryBalances`
- Uses async `calculateTotalBalances()` which:
  - Fetches future month documents
  - Processes up to MAX_FUTURE_MONTHS ahead

**What it currently represents:**
- Sum of all category balances including future allocations
- Includes negative balances (debt/overspending)
- This represents total money in categories (current + future), not just "allocated"

**Problem:**
- This includes negative balances, so it doesn't represent "money allocated"
- Should only count positive category balances (money actually in categories)

---

### 4. Budget `total_available` (The Correct "Available Now")
**Location:** `budget-app/src/data/recalculation/triggerRecalculationHelpers.ts:88-100`

**Calculation:**
```typescript
total_available = onBudgetAccountTotal - totalPositiveCategoryBalances
```

Where:
- `onBudgetAccountTotal` = sum of on-budget, active account balances
- `totalPositiveCategoryBalances` = sum of only POSITIVE category balances

**When calculated:**
- Calculated during recalculation process
- Stored in budget document
- Updated when:
  - Recalculation runs
  - Account balances change (via `recalculateBudgetAccountBalances`)
  - Category balances change (during recalculation)

**What it represents:**
- "Ready to Assign" money
- Money in accounts minus money already allocated to categories (positive balances only)
- This is the CORRECT "Available Now" value

---

## The Problem

### Current State:
1. **On Budget** = `getOnBudgetTotal()` = sum of account balances ✓ (correct)
2. **Available Now** = `totalAvailableNow` = sum of ALL category balances (current) ✗ (WRONG)
3. **Total Allocated** = `totalAllocatedAllTime` = sum of ALL category balances (total) ✗ (WRONG)

### Expected Relationship:
```
On Budget = Total Allocated + Available Now
```

Where:
- **On Budget** = Total money in on-budget accounts
- **Total Allocated** = Money allocated to categories (positive balances only)
- **Available Now** = Money not yet allocated (should be `total_available`)

### Current Issue:
- `totalAvailableNow` sums ALL category balances including negatives
- `totalAllocatedAllTime` sums ALL category balances including negatives
- This means: `On Budget ≠ Total Allocated + Available Now`

The correct calculation should be:
- **Available Now** = `budget.total_available` (already calculated and stored)
- **Total Allocated** = sum of only POSITIVE `categoryBalances[catId].current` values

---

## Better Approach

### Option 1: Use Pre-calculated Values (Most Efficient)
**Available Now:**
- Use `budget.total_available` directly from budget document
- Already calculated during recalculation
- No async computation needed
- Consistent across all pages

**Total Allocated:**
- Sum of only POSITIVE `categoryBalances[catId].current` values
- Or use: `getOnBudgetTotal() - budget.total_available`
- This ensures: On Budget = Total Allocated + Available Now

**Pros:**
- Fast (no async calculations)
- Uses pre-calculated, consistent values
- Matches the accounting relationship
- Less error-prone (single source of truth)

**Cons:**
- Requires `total_available` to be up-to-date (but it's already maintained)

### Option 2: Calculate from Category Balances (Current Approach, Fixed)
**Available Now:**
- Calculate: `getOnBudgetTotal() - sum of positive categoryBalances[catId].current`
- This matches how `total_available` is calculated

**Total Allocated:**
- Sum of only POSITIVE `categoryBalances[catId].current` values

**Pros:**
- Uses live category balance calculations
- Works even if `total_available` is stale

**Cons:**
- Requires async balance calculations
- More complex
- Potential for inconsistency if calculations differ

### Option 3: Hybrid (Recommended)
**Available Now:**
- Use `budget.total_available` when available and budget doesn't need recalculation
- Fall back to calculation if `is_needs_recalculation = true`

**Total Allocated:**
- Calculate: `getOnBudgetTotal() - availableNow`
- This ensures the relationship always holds

**Pros:**
- Best of both worlds
- Fast when data is fresh
- Accurate when data is stale
- Guarantees: On Budget = Total Allocated + Available Now

---

## When Each Value is Calculated

### `getOnBudgetTotal()`
- **When:** On-demand via `useCallback`
- **Trigger:** When `accounts` or `accountGroups` change
- **Sync/Async:** Synchronous (reads from cache)
- **Performance:** Fast (O(n) where n = number of accounts)

### `categoryBalances.current` and `.total`
- **When:** In `useCategoryBalances` hook via `useEffect`
- **Trigger:** When `budgetId`, `currentYear`, `currentMonth`, or `categories` change
- **Sync/Async:** Async (fetches month documents)
- **Performance:** Slow (multiple Firestore reads, walks through months)
- **Caching:** Uses React Query cache for month documents

### `budget.total_available`
- **When:** During recalculation process
- **Trigger:**
  - Full recalculation
  - Account balance changes
  - Category balance updates
- **Sync/Async:** Calculated synchronously during recalculation, stored in document
- **Performance:** Fast (reads from budget document cache)

---

## Recommendations

1. **Use `budget.total_available` for "Available Now"**
   - It's already calculated and maintained
   - It's the correct "Ready to Assign" value
   - It's fast (no async computation)
   - It's consistent with other pages (like allocations page)

2. **Calculate "Total Allocated" as: `getOnBudgetTotal() - budget.total_available`**
   - This ensures the relationship: On Budget = Total Allocated + Available Now
   - Only counts positive category balances (money actually allocated)
   - Fast calculation

3. **Alternative: Sum only positive category balances**
   - If you want to show "Total Allocated" as sum of category balances
   - Filter to only positive values: `sum of max(0, categoryBalances[catId].current)`
   - Then: Available Now = On Budget - Total Allocated

4. **Keep `categoryBalances` for per-category display**
   - The individual category balance calculations are still useful
   - They show per-category available/allocated amounts
   - But totals should use the simpler, more efficient approach

---

## Code Changes Needed

### In `Categories.tsx`:
```typescript
// Instead of:
const totalAvailableNow = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.current, 0)
const totalAllocatedAllTime = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.total, 0)

// Use:
// Option A: Get totalAvailable directly (if useCategoriesPage doesn't expose it)
const { totalAvailable } = useBudgetData()
const totalAvailableNow = totalAvailable
const totalAllocatedAllTime = getOnBudgetTotal() - totalAvailable

// Option B: Add totalAvailable to useCategoriesPage return value, then use:
const { totalAvailable, getOnBudgetTotal } = useCategoriesPage()
const totalAvailableNow = totalAvailable
const totalAllocatedAllTime = getOnBudgetTotal() - totalAvailable
```

Or if you want to show "Total Allocated" as sum of positive category balances:
```typescript
const totalAvailableNow = totalAvailable
const totalAllocatedAllTime = Object.values(categoryBalances).reduce(
  (sum, bal) => sum + Math.max(0, bal.current),
  0
)
```

This ensures: `getOnBudgetTotal() === totalAllocatedAllTime + totalAvailableNow`
