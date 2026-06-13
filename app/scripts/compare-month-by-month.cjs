#!/usr/bin/env node
/**
 * Compare month-by-month totals between downloaded budget and TSV file
 * to find where they diverge
 */

const fs = require('fs');
const path = require('path');

function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

function parseAmount(amountStr) {
  if (!amountStr || amountStr.trim() === '') return 0;
  const cleaned = amountStr.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateStr) {
  // Handle formats like "2/14/2025" or "2025-02-14"
  if (dateStr.includes('/')) {
    const [month, day, year] = dateStr.split('/').map(Number);
    return { year, month, day };
  } else if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node compare-month-by-month.cjs <tsv-file> <budget-dir> [account-name]');
    console.error('');
    console.error('Example: node compare-month-by-month.cjs transactions.tsv budget_dir "Charles Schwab"');
    process.exit(1);
  }

  const tsvFilePath = args[0];
  const budgetDir = args[1];
  const accountFilter = args[2] || 'Charles Schwab Checking';

  if (!fs.existsSync(tsvFilePath)) {
    console.error(`Error: TSV file not found: ${tsvFilePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(budgetDir)) {
    console.error(`Error: Budget directory not found: ${budgetDir}`);
    process.exit(1);
  }

  // Parse TSV
  const tsvContent = fs.readFileSync(tsvFilePath, 'utf8');
  const tsvLines = tsvContent.split('\n').filter(line => line.trim());

  if (tsvLines.length < 3) {
    console.error('Error: TSV file appears to be empty or invalid');
    process.exit(1);
  }

  // Skip header lines (first 2 lines)
  const header = tsvLines[0].split('\t');
  const dateIdx = header.findIndex(h => h.toLowerCase().includes('date'));
  const accountIdx = header.findIndex(h => h.toLowerCase().includes('account'));
  const amountIdx = header.findIndex(h => h.toLowerCase().includes('amount'));
  const typeIdx = header.findIndex(h => h.toLowerCase().includes('type') || h.toLowerCase().includes('transaction'));

  if (dateIdx < 0 || amountIdx < 0) {
    console.error('Error: Required columns (date, amount) not found');
    process.exit(1);
  }

  // Parse TSV transactions by month
  const tsvByMonth = {};
  let startingBalance = 0;

  for (let i = 2; i < tsvLines.length; i++) {
    const cols = tsvLines[i].split('\t');
    if (cols.length < Math.max(dateIdx, amountIdx) + 1) continue;

    const dateStr = cols[dateIdx]?.trim();
    const account = accountIdx >= 0 ? cols[accountIdx]?.trim() : '';
    const amountStr = cols[amountIdx]?.trim() || '';
    const type = typeIdx >= 0 ? cols[typeIdx]?.trim() : '';

    if (!account.includes(accountFilter)) continue;

    const amount = roundCurrency(parseAmount(amountStr));
    const date = parseDate(dateStr);

    if (type === 'Starting Balance') {
      startingBalance = amount;
      continue;
    }

    if (!date) continue;

    const monthKey = `${date.year}-${String(date.month).padStart(2, '0')}`;
    if (!tsvByMonth[monthKey]) {
      tsvByMonth[monthKey] = { income: 0, expenses: 0, transfers: 0, adjustments: 0, transactions: [] };
    }

    // Categorize transaction
    const typeLower = type.toLowerCase();
    if (typeLower.includes('income') || typeLower.includes('deposit') || (amount > 0 && !typeLower.includes('transfer'))) {
      tsvByMonth[monthKey].income += amount;
    } else if (typeLower.includes('transfer')) {
      tsvByMonth[monthKey].transfers += amount;
    } else if (typeLower.includes('adjustment')) {
      tsvByMonth[monthKey].adjustments += amount;
    } else {
      tsvByMonth[monthKey].expenses += amount;
    }

    tsvByMonth[monthKey].transactions.push({ date: dateStr, amount, type });
  }

  // Read budget months
  const monthsDir = path.join(budgetDir, 'months');
  if (!fs.existsSync(monthsDir)) {
    console.error(`Error: Months directory not found: ${monthsDir}`);
    process.exit(1);
  }

  const monthDirs = fs.readdirSync(monthsDir)
    .filter(f => f.startsWith('month_'))
    .sort();

  // Find account ID
  const accountsPath = path.join(budgetDir, 'accounts.json');
  if (!fs.existsSync(accountsPath)) {
    console.error(`Error: accounts.json not found: ${accountsPath}`);
    process.exit(1);
  }

  const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  const accountId = Object.keys(accounts).find(id =>
    accounts[id].name && accounts[id].name.includes(accountFilter)
  );

  if (!accountId) {
    console.error(`Error: Account "${accountFilter}" not found in accounts.json`);
    console.error('Available accounts:', Object.values(accounts).map(a => a.name).join(', '));
    process.exit(1);
  }

  console.log(`Found account: ${accounts[accountId].name} (${accountId})`);
  console.log(`Starting balance: $${startingBalance.toFixed(2)}`);
  console.log('');

  // Compare month by month
  let runningBalanceTsv = startingBalance;
  let runningBalanceBudget = startingBalance;
  let firstDivergence = null;

  console.log('Month-by-Month Comparison:');
  console.log('='.repeat(120));
  console.log(
    'Month'.padEnd(12) +
    'TSV Income'.padStart(15) +
    'TSV Exp'.padStart(15) +
    'TSV Net'.padStart(15) +
    'TSV Total'.padStart(15) +
    'Budget Net'.padStart(15) +
    'Budget Total'.padStart(15) +
    'Difference'.padStart(15)
  );
  console.log('='.repeat(120));

  for (const monthDir of monthDirs) {
    const match = monthDir.match(/month_(\d{4})_(\d{2})/);
    if (!match) continue;

    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const monthPath = path.join(monthsDir, monthDir);

    // Read budget month data
    let budgetIncome = 0;
    let budgetExpenses = 0;
    let budgetTransfers = 0;
    let budgetAdjustments = 0;

    const incomePath = path.join(monthPath, 'income.json');
    if (fs.existsSync(incomePath)) {
      const income = JSON.parse(fs.readFileSync(incomePath, 'utf8'));
      for (const inc of income) {
        if (inc.account_id === accountId) {
          budgetIncome += inc.amount;
        }
      }
    }

    const expensesPath = path.join(monthPath, 'expenses.json');
    if (fs.existsSync(expensesPath)) {
      const expenses = JSON.parse(fs.readFileSync(expensesPath, 'utf8'));
      for (const exp of expenses) {
        if (exp.account_id === accountId) {
          budgetExpenses += exp.amount;
        }
      }
    }

    const transfersPath = path.join(monthPath, 'transfers.json');
    if (fs.existsSync(transfersPath)) {
      const transfers = JSON.parse(fs.readFileSync(transfersPath, 'utf8'));
      for (const t of transfers) {
        if (t.to_account_id === accountId) {
          budgetTransfers += t.amount;
        }
        if (t.from_account_id === accountId) {
          budgetTransfers -= t.amount;
        }
      }
    }

    const adjustmentsPath = path.join(monthPath, 'adjustments.json');
    if (fs.existsSync(adjustmentsPath)) {
      const adjustments = JSON.parse(fs.readFileSync(adjustmentsPath, 'utf8'));
      for (const adj of adjustments) {
        if (adj.account_id === accountId) {
          budgetAdjustments += adj.amount;
        }
      }
    }

    const tsvData = tsvByMonth[monthKey] || { income: 0, expenses: 0, transfers: 0, adjustments: 0 };
    const tsvNet = roundCurrency(tsvData.income + tsvData.expenses + tsvData.transfers + tsvData.adjustments);
    const budgetNet = roundCurrency(budgetIncome + budgetExpenses + budgetTransfers + budgetAdjustments);

    runningBalanceTsv = roundCurrency(runningBalanceTsv + tsvNet);
    runningBalanceBudget = roundCurrency(runningBalanceBudget + budgetNet);

    const difference = roundCurrency(runningBalanceBudget - runningBalanceTsv);

    const monthLabel = `${year}-${String(month).padStart(2, '0')}`;
    const hasDivergence = Math.abs(difference) > 0.01;

    if (hasDivergence && !firstDivergence) {
      firstDivergence = monthKey;
    }

    const marker = hasDivergence ? ' ⚠️' : '';

    console.log(
      monthLabel.padEnd(12) +
      `$${roundCurrency(tsvData.income).toFixed(2)}`.padStart(15) +
      `$${roundCurrency(tsvData.expenses).toFixed(2)}`.padStart(15) +
      `$${tsvNet.toFixed(2)}`.padStart(15) +
      `$${runningBalanceTsv.toFixed(2)}`.padStart(15) +
      `$${budgetNet.toFixed(2)}`.padStart(15) +
      `$${runningBalanceBudget.toFixed(2)}`.padStart(15) +
      `$${difference.toFixed(2)}`.padStart(15) +
      marker
    );

    // Show details if there's a divergence
    if (hasDivergence && Math.abs(difference) > 0.01) {
      console.log(`  └─ TSV: Income=$${roundCurrency(tsvData.income).toFixed(2)}, Exp=$${roundCurrency(tsvData.expenses).toFixed(2)}, Trans=$${roundCurrency(tsvData.transfers).toFixed(2)}, Adj=$${roundCurrency(tsvData.adjustments).toFixed(2)}`);
      console.log(`  └─ Budget: Income=$${roundCurrency(budgetIncome).toFixed(2)}, Exp=$${roundCurrency(budgetExpenses).toFixed(2)}, Trans=$${roundCurrency(budgetTransfers).toFixed(2)}, Adj=$${roundCurrency(budgetAdjustments).toFixed(2)}`);
    }
  }

  console.log('='.repeat(120));
  console.log(`Final TSV Total:      $${runningBalanceTsv.toFixed(2)}`);
  console.log(`Final Budget Total:   $${runningBalanceBudget.toFixed(2)}`);
  console.log(`Final Difference:     $${roundCurrency(runningBalanceBudget - runningBalanceTsv).toFixed(2)}`);

  if (firstDivergence) {
    console.log(`\n⚠️  First divergence detected in: ${firstDivergence}`);
  }
}

main();

