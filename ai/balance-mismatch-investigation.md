# Balance Mismatch Investigation

## Problem
The UI shows a "Balance calculation mismatch: $9,274.68 difference between stored and calculated balances."

## Root Cause
The stored category balances in `categories.json` are **out of sync** with the calculated balances from month data.

## Findings from Budget Data Analysis

### Stored Balances (from categories.json)
- **Total positive category balances (stored)**: $96,087.34
- These are the `category.balance` values stored in the budget document

### Calculated Balances (from month_2025_12/category_balances.json)
- **Total positive category balances (calculated)**: $75,185.54
- These are the `end_balance` values from the most recent month's data

### Difference
- **Difference**: $20,901.80
- The stored balances are **$20,901.80 higher** than what they should be based on month data

## Why This Happens

1. **Stored balances are stale**: The `category.balance` values in the budget document are not automatically updated when transactions occur
2. **Recalculation needed**: The budget needs to be recalculated to sync stored balances with actual month data
3. **The UI error shows $9,274.68**: This might be from a different calculation (possibly using a different month or including some categories differently), but the core issue is the same - stored vs calculated mismatch

## Categories with Significant Differences

The following categories show large discrepancies between stored and calculated balances:

| Category | Stored | Calculated | Difference |
|----------|--------|------------|------------|
| Trip | $6,004.79 | $112.63 | **-$5,892.16** |
| Rent | $4,166.32 | $1.83 | **-$4,164.49** |
| Six-Month Savings | $36,025.23 | $33,515.23 | **-$2,510.00** |
| Medical | $11,269.19 | $10,119.19 | **-$1,150.00** |
| Groceries/Supplies | $1,144.26 | $14.21 | **-$1,130.05** |
| Car Payments | $17,609.15 | $16,609.15 | **-$1,000.00** |
| Retirement | $1,090.64 | $4.64 | **-$1,086.00** |
| Utilities | $988.28 | $85.21 | **-$903.07** |
| House Repairs | $9,744.03 | $8,894.03 | **-$850.00** |

Most categories show **negative differences**, meaning stored balances are higher than calculated. This suggests:
- Money was spent from these categories but stored balances weren't updated
- Allocations were made but not properly reflected in stored balances
- The budget needs a full recalculation

## Solution

The budget needs to be **recalculated** to:
1. Walk through all months and calculate accurate category balances
2. Update the stored `category.balance` values in the budget document
3. Recalculate `total_available` based on the updated balances
4. Sync everything so stored balances match calculated balances

## Why the Error Detection is Important

The error detection we added is working correctly - it's detecting that:
- `allocatedFromStored` (sum of positive `category.balance`) ≠ `allocatedFromCalculated` (sum of positive `categoryBalances.current`)

This mismatch indicates the budget data is inconsistent and needs recalculation.

## Next Steps

1. **Run a full recalculation** - This will update all stored category balances to match the calculated values from month data
2. **Verify the relationship holds** - After recalculation, `On Budget = Allocated + Unallocated` should hold true
3. **The error will disappear** - Once stored and calculated balances match, the mismatch error will no longer appear
