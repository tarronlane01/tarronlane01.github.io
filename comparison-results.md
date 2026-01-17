# TSV to Budget Folder Comparison Results

## Summary
- **Total transactions in TSV (Oct 2025 onwards)**: 288
- **Missing transactions**: 10
- **Issues found**: 2

## Missing Transactions

### January 2026
1. **2026-01-05 | Amazon | Service | Capital One Platinum | $-53.83**
   - **Status**: Exists in JSON but with date **2026-01-01** (4 days earlier)
   - **Location**: `month_2026_01/expenses.json` (line 88-96)

2. **2026-01-05 | Dividend | Income | Golden1 Savings | $0.12**
   - **Status**: Exists in JSON but **missing payee field** in income.json
   - **Location**: `month_2026_01/income.json` (line 12-16)

3. **2026-01-01 | Dividend | Income | Charles Schwab Checking | $2.65**
   - **Status**: Exists in JSON but **missing payee field** in income.json
   - **Location**: `month_2026_01/income.json` (line 19-23)

4. **2026-01-06 | Transfer | Retirement | Charles Schwab Checking | $-1250.00**
   - **Status**: Exists in JSON but payee is **"Vanguard"** not "Transfer"
   - **Location**: `month_2026_01/expenses.json` (line 142-150)

5. **2026-01-06 | Church of Jesus Christ | Fast Offerings | Charles Schwab Checking | $-110.00**
   - **Status**: Exists in JSON but with date **2026-01-01** (5 days earlier) and different account (Capital One Credit Card)
   - **Location**: `month_2026_01/expenses.json` (line 67-74)

6. **2026-01-06 | Church of Jesus Christ | Tithing | Charles Schwab Checking | $-3086.38**
   - **Status**: Exists in JSON but with date **2026-01-01** (5 days earlier)
   - **Location**: `month_2026_01/expenses.json` (line 57-64)

7. **2026-01-06 | Dividend | Income | Charles Schwab Shop Checking | $0.02**
   - **Status**: Exists in JSON but with date **2026-01-04** (2 days earlier) and **missing payee field**
   - **Location**: `month_2026_01/income.json` (line 26-30)

8. **2026-01-06 | Walmart | Groceries/supplies | Capital One Credit Card | $-27.75**
   - **Status**: Not found in JSON files
   - **Action needed**: Add this transaction

9. **2026-01-12 | Venmo | Kami's | Charles Schwab Checking | $-15.00**
   - **Status**: Not found in JSON files
   - **Note**: There's a similar transaction on 2026-01-15 for $15.00 (Bunco)
   - **Action needed**: Move the json date to match the date for the bunco line in the tsv

10. **2026-01-15 | Walmart | Groceries/supplies | Capital One Credit Card | $-64.42**
    - **Status**: Not found in JSON files (last transaction in TSV, marked as FALSE/not cleared)
    - **Action needed**: Add this transaction

## Issues Found

1. **2025-12-31 | chick fil a | Cleared status mismatch**
   - TSV: `TRUE` (cleared)
   - JSON: `false` (not cleared)
   - **Action needed**: Update cleared status in JSON

**Note**: Income transactions don't use the `cleared` field in account balance calculations (they're always included), so missing `cleared` fields on income transactions are not issues.

## Notes

- Most "missing" transactions actually exist but with:
  - Different dates (usually earlier in JSON)
  - Missing payee fields (dividends in income.json)
  - Different payee names (e.g., "Vanguard" vs "Transfer")
  - Different accounts (Fast Offerings in different account)

- The script successfully matched most transactions (278 out of 288, or 96.5%)

- Budget allocations are not stored in JSON files, so those are correctly excluded from the comparison

