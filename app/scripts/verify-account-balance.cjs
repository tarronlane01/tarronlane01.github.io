#!/usr/bin/env node
/**
 * Verify Account Balance Script
 *
 * Sums all transactions (income, expenses, transfers, adjustments) for a specific account
 * from the budget JSON file to verify the account balance matches what's stored.
 *
 * Usage: node verify-account-balance.cjs <budget-file-path> <account-name>
 */

const fs = require('fs');
const path = require('path');

function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

function findAccountId(accounts, accountName) {
  for (const [id, account] of Object.entries(accounts)) {
    if (account.nickname === accountName || account.description === accountName) {
      return id;
    }
  }
  return null;
}

function sumAccountTransactions(months, accountId) {
  let total = 0;
  let startBalance = 0;
  const breakdown = {
    income: 0,
    expenses: 0,
    transfers: 0,
    adjustments: 0,
  };

  // Sort months chronologically
  months.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Get start_balance from first month's account_balances
  if (months.length > 0) {
    const firstMonth = months[0];
    if (firstMonth.account_balances) {
      const firstBalance = firstMonth.account_balances.find(ab => ab.account_id === accountId);
      if (firstBalance) {
        startBalance = firstBalance.start_balance || 0;
        total = startBalance;
      }
    }
  }

  for (const month of months) {
    // Sum income
    if (month.income) {
      for (const inc of month.income) {
        if (inc.account_id === accountId) {
          total += inc.amount;
          breakdown.income += inc.amount;
        }
      }
    }

    // Sum expenses (note: expenses are negative in CSV convention)
    if (month.expenses) {
      for (const exp of month.expenses) {
        if (exp.account_id === accountId) {
          total += exp.amount; // Already negative
          breakdown.expenses += exp.amount;
        }
      }
    }

    // Sum transfers
    if (month.transfers) {
      for (const transfer of month.transfers) {
        if (transfer.to_account_id === accountId) {
          total += transfer.amount;
          breakdown.transfers += transfer.amount;
        }
        if (transfer.from_account_id === accountId) {
          total -= transfer.amount;
          breakdown.transfers -= transfer.amount;
        }
      }
    }

    // Sum adjustments
    if (month.adjustments) {
      for (const adj of month.adjustments) {
        if (adj.account_id === accountId) {
          total += adj.amount;
          breakdown.adjustments += adj.amount;
        }
      }
    }
  }

  return {
    total: roundCurrency(total),
    startBalance: roundCurrency(startBalance),
    breakdown: {
      income: roundCurrency(breakdown.income),
      expenses: roundCurrency(breakdown.expenses),
      transfers: roundCurrency(breakdown.transfers),
      adjustments: roundCurrency(breakdown.adjustments),
    },
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node verify-account-balance.cjs <budget-file-path> <account-name>');
    console.error('');
    console.error('Example: node verify-account-balance.cjs budget_123/budget.json "Charles Schwab Checking"');
    process.exit(1);
  }

  const budgetFilePath = args[0];
  const accountName = args[1];

  if (!fs.existsSync(budgetFilePath)) {
    console.error(`Error: Budget file not found: ${budgetFilePath}`);
    process.exit(1);
  }

  // Try to read accounts from budget.json first, then accounts.json
  let accounts = {};
  const budgetData = JSON.parse(fs.readFileSync(budgetFilePath, 'utf8'));
  if (budgetData.accounts) {
    accounts = budgetData.accounts;
  } else {
    // If not in budget.json, try accounts.json in the same directory
    const budgetDir = path.dirname(budgetFilePath);
    const accountsPath = path.join(budgetDir, 'accounts.json');
    if (fs.existsSync(accountsPath)) {
      accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    } else {
      console.error(`Error: Could not find accounts in budget.json or accounts.json`);
      process.exit(1);
    }
  }

  // Find account ID
  const accountId = findAccountId(accounts, accountName);
  if (!accountId) {
    console.error(`Error: Account "${accountName}" not found in budget.`);
    console.error('Available accounts:');
    Object.entries(accounts).forEach(([id, acc]) => {
      console.error(`  - ${acc.nickname || acc.description || id}`);
    });
    process.exit(1);
  }

  const account = accounts[accountId];
  const storedBalance = account.balance || 0;

  console.log(`\nAccount: ${account.nickname || account.description || accountId}`);
  console.log(`Account ID: ${accountId}`);
  console.log(`Stored balance in budget: $${storedBalance.toFixed(2)}`);
  console.log('');

  // Load all months
  const budgetDir = path.dirname(budgetFilePath);
  const monthsDir = path.join(budgetDir, 'months');

  if (!fs.existsSync(monthsDir)) {
    console.error(`Error: Months directory not found: ${monthsDir}`);
    process.exit(1);
  }

  const monthFolders = fs.readdirSync(monthsDir)
    .filter(f => f.startsWith('month_'))
    .sort();

  const months = [];
  for (const monthFolder of monthFolders) {
    const monthPath = path.join(monthsDir, monthFolder);
    const metadataPath = path.join(monthPath, 'metadata.json');

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const month = {
        year: metadata.year,
        month: metadata.month,
        income: [],
        expenses: [],
        transfers: [],
        adjustments: [],
      };

      // Load transaction files
      const incomePath = path.join(monthPath, 'income.json');
      const expensesPath = path.join(monthPath, 'expenses.json');
      const transfersPath = path.join(monthPath, 'transfers.json');
      const adjustmentsPath = path.join(monthPath, 'adjustments.json');
      const accountBalancesPath = path.join(monthPath, 'account_balances.json');

      if (fs.existsSync(incomePath)) {
        month.income = JSON.parse(fs.readFileSync(incomePath, 'utf8'));
      }
      if (fs.existsSync(expensesPath)) {
        month.expenses = JSON.parse(fs.readFileSync(expensesPath, 'utf8'));
      }
      if (fs.existsSync(transfersPath)) {
        month.transfers = JSON.parse(fs.readFileSync(transfersPath, 'utf8'));
      }
      if (fs.existsSync(adjustmentsPath)) {
        month.adjustments = JSON.parse(fs.readFileSync(adjustmentsPath, 'utf8'));
      }
      if (fs.existsSync(accountBalancesPath)) {
        month.account_balances = JSON.parse(fs.readFileSync(accountBalancesPath, 'utf8'));
      }

      months.push(month);
    }
  }

  console.log(`Found ${months.length} month(s) to process\n`);

  // Sum all transactions
  const result = sumAccountTransactions(months, accountId);

  console.log('Transaction Summary:');
  console.log(`  Starting Balance: $${result.startBalance.toFixed(2)}`);
  console.log(`  Income:           $${result.breakdown.income.toFixed(2)}`);
  console.log(`  Expenses:         $${result.breakdown.expenses.toFixed(2)}`);
  console.log(`  Transfers:        $${result.breakdown.transfers.toFixed(2)}`);
  console.log(`  Adjustments:      $${result.breakdown.adjustments.toFixed(2)}`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Calculated:       $${result.total.toFixed(2)}`);
  console.log(`  Stored:           $${storedBalance.toFixed(2)}`);
  console.log(`  Difference:       $${(result.total - storedBalance).toFixed(2)}`);
  console.log('');

  if (Math.abs(result.total - storedBalance) < 0.01) {
    console.log('✅ Balance matches!');
  } else {
    console.log(`❌ Balance mismatch detected!`);
    console.log(`   Expected: $${result.total.toFixed(2)}`);
    console.log(`   Actual:   $${storedBalance.toFixed(2)}`);
  }
}

main();

