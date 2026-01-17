const fs = require('fs');
const path = require('path');

// Account name mappings from TSV to JSON account IDs
const accountMappings = {
  'Capital One Credit Card': 'account_1766289004108_7ps0slg4g',
  'Capital One Platinum': 'account_1766289015844_afauk11gp',
  'Charles Schwab Checking': 'IO0iUrZNOLB125YrvUaF',
  'Charles Schwab Shop Checking': 'ZByDH9Vmv2BbQrfAWSq7',
  'Golden1 Savings': 'account_1766289996367_pzpaad94s',
  'Golden1 Checking': 'FR91hqtm3olrgHn8aYDt',
  'N/A': null, // For budget allocations and category transfers
};

// Payee name variations (TSV name -> possible JSON names)
const payeeVariations = {
  'Grill Creamery': ['Creamery', 'Grill Creamery'],
  'Golden 1': ['Golden 1', 'Golden1'],
  'Dr Cooper Loan': ['Dr Cooper Loan', 'Mr. Cooper Mortgage', 'Dr Coop'],
  'Transfer': ['Transfer', 'Vanguard'], // Transfer payee can be Vanguard for retirement expenses
};

// Category name mappings from TSV to JSON category IDs
const categoryMappings = {
  'Groceries/supplies': 'pPQqTWxWz4IjeHW5Z1iX',
  'Trip': 'category_1766288820785_zhtwle8xm',
  'Subscriptions': 'category_1766265351648_ru851obn1',
  'Housing Improvements': 'category_1766288625999_zpi9ppeqw',
  'Retirement': 'category_1766288765095_ew8htogil',
  'Dates': 'category_1766288816655_pee1xcbk6',
  'Fuel': 'category_1766265437406_yihi892i4',
  'Car Insurance': 'category_1766265432185_pysvj7ymm',
  'Tithing': '69LUQGMJrYlIPoixIkng',
  'Fast Offerings': 'lvRJzTnpe7HkaAzJwmOn',
  'Rent': 'Zfr8EwlTWLmsk7vYirAT',
  'Emergency Prep': 'category_1766265047006_n028ssip1',
  'Utilities': 'category_1766265357718_y7lydlt9a',
  'Car Repairs': 'category_1766265369105_ehvqlgukb',
  'Medical': 'category_1766288615238_l94bjlz89',
  'Car Payments': 'category_1766288731002_5v1826ijc',
  'Six Month Savings': 'category_1766288738225_b60g12x67',
  'Big Purchases': 'category_1766288743633_wkkcxygrr',
  'Kids': 'category_1766288746550_763eaiy62',
  'House Repairs': 'category_1766288771747_qek6wlmy8',
  'Clothing': 'category_1766288810298_429f26vq2',
  'Holiday': 'category_1766288812979_he1q3x8jy',
  'Tarron\'s': 'category_1766288825592_glvgzh2u4',
  'Kami\'s': 'category_1766288829038_0ygxsees9',
  'Service': 'category_1766288833773_gbqpud8im',
  'Transfer': null, // Special handling for transfers
  'Income': null, // Special handling for income
};

// Read the TSV file
const tsvPath = '/Users/tlane/Downloads/budget_budget_1766261512410_nhb6ye0e7/months/month_2026_01/Untitled-1.tsv';
const budgetFolder = '/Users/tlane/repos/learning/tarronlane01.github.io/budget_budget_1766261512410_nhb6ye0e7 2';

function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseAmount(amountStr) {
  // Remove $ and commas, then parse
  return parseFloat(amountStr.replace(/[$,]/g, ''));
}

function getMonthKey(dateStr) {
  const date = parseDate(dateStr);
  const [year, month] = date.split('-');
  return `month_${year}_${month}`;
}

function normalizeAmount(amount) {
  return Math.round(amount * 100) / 100;
}

function findTransactionInJSON(tsvRow, monthData) {
  const date = parseDate(tsvRow.date);
  const amount = normalizeAmount(parseAmount(tsvRow.amount));
  const payee = tsvRow.payee.trim();
  const accountId = accountMappings[tsvRow.account] || null;
  const categoryId = categoryMappings[tsvRow.category] || null;
  const description = tsvRow.notes || '';
  const cleared = tsvRow.cleared === 'TRUE';

  // Determine transaction type
  const isTransfer = tsvRow.category === 'Transfer' || tsvRow.account === 'N/A';
  const isIncome = tsvRow.category === 'Income' || (amount > 0 && !isTransfer && tsvRow.payee === 'Gunderson' && tsvRow.category !== 'Holiday');
  const isBudgetAllocation = tsvRow.payee === 'Budget Allocation';
  const isPositiveExpense = amount > 0 && !isIncome && !isTransfer && !isBudgetAllocation;

  if (isBudgetAllocation) {
    // Budget allocations are not stored in JSON files, skip them
    return { found: true, reason: 'Budget allocation (not stored in JSON)' };
  }

  if (isTransfer && accountId !== null) {
    // Account-to-account transfer
    return findInTransfers(date, amount, accountId, monthData.transfers);
  } else if (isTransfer && accountId === null) {
    // Category-to-category transfer
    return findInTransfers(date, amount, null, monthData.transfers, categoryId);
  } else if (isIncome) {
    // First check income.json, then expenses.json (for positive amounts that might be refunds)
    const incomeResult = findInIncome(date, amount, payee, accountId, description, monthData.income);
    if (incomeResult.found) {
      return incomeResult;
    }
    // Also check expenses.json for positive amounts (refunds, etc.)
    return findInExpenses(date, amount, payee, accountId, categoryId, description, monthData.expenses);
  } else {
    // Check expenses.json (includes both negative and positive amounts)
    return findInExpenses(date, amount, payee, accountId, categoryId, description, monthData.expenses);
  }
}

function getPayeeVariations(payee) {
  if (!payee) return [''];
  const variations = payeeVariations[payee] || [payee];
  // Add case-insensitive variations
  const allVariations = new Set(variations);
  variations.forEach(v => {
    if (v) {
      allVariations.add(v.toLowerCase());
      allVariations.add(v.toUpperCase());
      allVariations.add(v.charAt(0).toUpperCase() + v.slice(1).toLowerCase());
    }
  });
  return Array.from(allVariations);
}

function payeeMatches(payee1, payee2) {
  if (!payee1 && !payee2) return true;
  if (!payee1 || !payee2) return false;
  const variations1 = getPayeeVariations(payee1);
  const variations2 = getPayeeVariations(payee2);
  return variations1.some(v1 => variations2.some(v2 => v1.toLowerCase() === v2.toLowerCase()));
}

function findInExpenses(date, amount, payee, accountId, categoryId, description, expenses) {
  for (const exp of expenses) {
    const matchesDate = exp.date === date;
    const matchesAmount = normalizeAmount(exp.amount) === amount;
    const matchesPayee = payeeMatches(payee, exp.payee);
    const matchesAccount = exp.account_id === accountId;
    const matchesCategory = categoryId === null || exp.category_id === categoryId;

    if (matchesDate && matchesAmount && matchesPayee && matchesAccount && matchesCategory) {
      // Description is optional - don't require exact match
      return { found: true, match: exp };
    }
  }
  return { found: false, reason: 'Not found in expenses.json' };
}

function findInIncome(date, amount, payee, accountId, description, income) {
  for (const inc of income) {
    const matchesDate = inc.date === date;
    const matchesAmount = normalizeAmount(inc.amount) === amount;
    const matchesPayee = !inc.payee || payeeMatches(payee, inc.payee); // Allow missing payee
    const matchesAccount = inc.account_id === accountId;

    if (matchesDate && matchesAmount && matchesPayee && matchesAccount) {
      return { found: true, match: inc };
    }
  }
  return { found: false, reason: 'Not found in income.json' };
}

function findInTransfers(date, amount, accountId, transfers, categoryId = null) {
  for (const trans of transfers) {
    const matchesAmount = normalizeAmount(Math.abs(trans.amount)) === normalizeAmount(Math.abs(amount));
    const matchesDate = trans.date === date;

    if (matchesAmount && matchesDate) {
      if (accountId !== null) {
        // Account-to-account transfer
        if ((trans.from_account_id === accountId && amount < 0) ||
            (trans.to_account_id === accountId && amount > 0)) {
          return { found: true, match: trans };
        }
      } else if (categoryId !== null) {
        // Category-to-category transfer
        if ((trans.from_category_id === categoryId && amount < 0) ||
            (trans.to_category_id === categoryId && amount > 0)) {
          return { found: true, match: trans };
        }
      }
    }
  }
  return { found: false, reason: 'Not found in transfers.json' };
}

// Read TSV file
const tsvContent = fs.readFileSync(tsvPath, 'utf-8');
const lines = tsvContent.split('\n').filter(line => line.trim());

// Parse TSV header (assuming first line is header or data)
const headers = ['date', 'payee', 'category', 'account', 'amount', 'notes', 'cleared'];
const tsvRows = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const parts = line.split('\t');
  if (parts.length >= 5) {
    const row = {
      date: parts[0],
      payee: parts[1] || '',
      category: parts[2] || '',
      account: parts[3] || '',
      amount: parts[4] || '',
      notes: parts[5] || '',
      cleared: parts[6] || 'TRUE',
    };

    // Only process rows from October 2025 onwards
    const date = parseDate(row.date);
    if (date >= '2025-10-01') {
      tsvRows.push(row);
    }
  }
}

console.log(`Found ${tsvRows.length} transactions in TSV from October 2025 onwards\n`);

// Group by month
const byMonth = {};
for (const row of tsvRows) {
  const monthKey = getMonthKey(row.date);
  if (!byMonth[monthKey]) {
    byMonth[monthKey] = [];
  }
  byMonth[monthKey].push(row);
}

// Compare each month
const missing = [];
const issues = [];

for (const [monthKey, rows] of Object.entries(byMonth)) {
  const monthPath = path.join(budgetFolder, 'months', monthKey);

  if (!fs.existsSync(monthPath)) {
    console.log(`⚠️  Month folder ${monthKey} does not exist!`);
    continue;
  }

  const expensesPath = path.join(monthPath, 'expenses.json');
  const incomePath = path.join(monthPath, 'income.json');
  const transfersPath = path.join(monthPath, 'transfers.json');

  const monthData = {
    expenses: fs.existsSync(expensesPath) ? JSON.parse(fs.readFileSync(expensesPath, 'utf-8')) : [],
    income: fs.existsSync(incomePath) ? JSON.parse(fs.readFileSync(incomePath, 'utf-8')) : [],
    transfers: fs.existsSync(transfersPath) ? JSON.parse(fs.readFileSync(transfersPath, 'utf-8')) : [],
  };

  console.log(`\n📅 Checking ${monthKey} (${rows.length} transactions in TSV)...`);

  for (const row of rows) {
    const result = findTransactionInJSON(row, monthData);

    if (!result.found && result.reason !== 'Budget allocation (not stored in JSON)') {
      const date = parseDate(row.date);
      const amount = parseAmount(row.amount);

      missing.push({
        month: monthKey,
        date,
        payee: row.payee,
        category: row.category,
        account: row.account,
        amount,
        notes: row.notes,
        reason: result.reason,
      });

      console.log(`  ❌ Missing: ${date} | ${row.payee} | ${row.category} | ${row.account} | $${amount.toFixed(2)} | ${result.reason}`);
    } else if (result.found && result.match) {
      // Check if cleared status matches (only for expenses, not income)
      // Income doesn't use cleared field in balance calculations, so it's not an issue
      const isIncome = row.category === 'Income' || (parseAmount(row.amount) > 0 && !row.category.includes('Transfer') && row.payee === 'Gunderson' && row.category !== 'Holiday');
      if (!isIncome && result.match.cleared !== undefined && result.match.cleared !== (row.cleared === 'TRUE')) {
        issues.push({
          month: monthKey,
          date: parseDate(row.date),
          payee: row.payee,
          issue: `Cleared status mismatch: TSV=${row.cleared}, JSON=${result.match.cleared}`,
        });
        console.log(`  ⚠️  Issue: ${row.payee} - Cleared status mismatch`);
      }
    }
  }
}

console.log(`\n\n📊 Summary:`);
console.log(`Total missing transactions: ${missing.length}`);
console.log(`Total issues: ${issues.length}`);

if (missing.length > 0) {
  console.log(`\n\n🔍 Missing Transactions:`);
  for (const item of missing) {
    console.log(`${item.date} | ${item.payee} | ${item.category} | ${item.account} | $${item.amount.toFixed(2)} | ${item.reason}`);
  }
}

if (issues.length > 0) {
  console.log(`\n\n⚠️  Issues:`);
  for (const item of issues) {
    console.log(`${item.date} | ${item.payee} | ${item.issue}`);
  }
}

