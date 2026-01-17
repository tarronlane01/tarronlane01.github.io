#!/usr/bin/env node
/**
 * Analyze TSV file to find $15 discrepancy
 *
 * Usage: node analyze-tsv-discrepancy.cjs <tsv-file-path> <account-name>
 */

const fs = require('fs');
const path = require('path');

function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

function parseAmount(amountStr) {
  if (!amountStr || amountStr.trim() === '') return 0;
  // Remove $, commas, and whitespace
  const cleaned = amountStr.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node analyze-tsv-discrepancy.cjs <tsv-file-path> [account-name]');
    console.error('');
    console.error('Example: node analyze-tsv-discrepancy.cjs transactions.tsv "Charles Schwab"');
    process.exit(1);
  }

  const tsvFilePath = args[0];
  const accountFilter = args[1] || null;

  if (!fs.existsSync(tsvFilePath)) {
    console.error(`Error: TSV file not found: ${tsvFilePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(tsvFilePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    console.error('Error: TSV file is empty');
    process.exit(1);
  }

  // Parse header (assuming first line is header)
  const header = lines[0].split('\t');
  console.log('TSV Columns:', header);
  console.log('');

  // Find column indices
  const dateIdx = header.findIndex(h => h.toLowerCase().includes('date'));
  const typeIdx = header.findIndex(h => h.toLowerCase().includes('type') || h.toLowerCase().includes('transaction'));
  const accountIdx = header.findIndex(h => h.toLowerCase().includes('account'));
  const categoryIdx = header.findIndex(h => h.toLowerCase().includes('category'));
  const payeeIdx = header.findIndex(h => h.toLowerCase().includes('payee') || h.toLowerCase().includes('description'));
  const amountIdx = header.findIndex(h => h.toLowerCase().includes('amount'));
  const memoIdx = header.findIndex(h => h.toLowerCase().includes('memo') || h.toLowerCase().includes('note'));

  console.log('Column Mapping:');
  console.log(`  Date: ${dateIdx >= 0 ? header[dateIdx] : 'NOT FOUND'}`);
  console.log(`  Type: ${typeIdx >= 0 ? header[typeIdx] : 'NOT FOUND'}`);
  console.log(`  Account: ${accountIdx >= 0 ? header[accountIdx] : 'NOT FOUND'}`);
  console.log(`  Category: ${categoryIdx >= 0 ? header[categoryIdx] : 'NOT FOUND'}`);
  console.log(`  Payee: ${payeeIdx >= 0 ? header[payeeIdx] : 'NOT FOUND'}`);
  console.log(`  Amount: ${amountIdx >= 0 ? header[amountIdx] : 'NOT FOUND'}`);
  console.log('');

  if (dateIdx < 0 || amountIdx < 0) {
    console.error('Error: Required columns (date, amount) not found');
    process.exit(1);
  }

  // Parse transactions
  const transactions = [];
  let skippedLines = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split('\t');
    if (cols.length < Math.max(dateIdx, amountIdx) + 1) {
      skippedLines++;
      continue;
    }

    const date = cols[dateIdx]?.trim();
    const type = typeIdx >= 0 ? cols[typeIdx]?.trim() : '';
    const account = accountIdx >= 0 ? cols[accountIdx]?.trim() : '';
    const category = categoryIdx >= 0 ? cols[categoryIdx]?.trim() : '';
    const payee = payeeIdx >= 0 ? cols[payeeIdx]?.trim() : '';
    const amountStr = cols[amountIdx]?.trim() || '';
    const memo = memoIdx >= 0 ? cols[memoIdx]?.trim() : '';

    const amount = parseAmount(amountStr);

    // Skip if no amount or date
    if (!amount && !date) {
      skippedLines++;
      continue;
    }

    // Filter by account if specified
    if (accountFilter && account && !account.toLowerCase().includes(accountFilter.toLowerCase())) {
      continue;
    }

    transactions.push({
      date,
      type,
      account,
      category,
      payee,
      amount: roundCurrency(amount),
      memo,
      lineNumber: i + 1,
    });
  }

  console.log(`Parsed ${transactions.length} transactions`);
  if (skippedLines > 0) {
    console.log(`Skipped ${skippedLines} lines`);
  }
  console.log('');

  // Group by transaction type
  const byType = {
    income: [],
    expense: [],
    transfer: [],
    adjustment: [],
    other: [],
  };

  for (const txn of transactions) {
    const typeLower = txn.type.toLowerCase();
    if (typeLower.includes('income') || typeLower.includes('deposit')) {
      byType.income.push(txn);
    } else if (typeLower.includes('expense') || typeLower.includes('spend') || typeLower.includes('payment')) {
      byType.expense.push(txn);
    } else if (typeLower.includes('transfer')) {
      byType.transfer.push(txn);
    } else if (typeLower.includes('adjustment')) {
      byType.adjustment.push(txn);
    } else {
      byType.other.push(txn);
    }
  }

  // Calculate totals
  const totals = {
    income: roundCurrency(byType.income.reduce((sum, t) => sum + t.amount, 0)),
    expense: roundCurrency(byType.expense.reduce((sum, t) => sum + t.amount, 0)),
    transfer: roundCurrency(byType.transfer.reduce((sum, t) => sum + t.amount, 0)),
    adjustment: roundCurrency(byType.adjustment.reduce((sum, t) => sum + t.amount, 0)),
    other: roundCurrency(byType.other.reduce((sum, t) => sum + t.amount, 0)),
  };

  const grandTotal = roundCurrency(
    totals.income + totals.expense + totals.transfer + totals.adjustment + totals.other
  );

  console.log('Transaction Summary:');
  console.log(`  Income:      $${totals.income.toFixed(2)} (${byType.income.length} transactions)`);
  console.log(`  Expense:     $${totals.expense.toFixed(2)} (${byType.expense.length} transactions)`);
  console.log(`  Transfer:    $${totals.transfer.toFixed(2)} (${byType.transfer.length} transactions)`);
  console.log(`  Adjustment:  $${totals.adjustment.toFixed(2)} (${byType.adjustment.length} transactions)`);
  console.log(`  Other:       $${totals.other.toFixed(2)} (${byType.other.length} transactions)`);
  console.log(`  ──────────────────────────────`);
  console.log(`  Grand Total: $${grandTotal.toFixed(2)}`);
  console.log('');

  // Look for $15 transactions
  console.log('Looking for $15.00 transactions...');
  const fifteenDollarTxns = transactions.filter(t => Math.abs(Math.abs(t.amount) - 15) < 0.01);
  if (fifteenDollarTxns.length > 0) {
    console.log(`Found ${fifteenDollarTxns.length} transaction(s) with $15.00:`);
    for (const txn of fifteenDollarTxns.slice(0, 10)) {
      console.log(`  Line ${txn.lineNumber}: ${txn.date} | ${txn.type} | ${txn.account} | ${txn.payee} | $${txn.amount.toFixed(2)}`);
    }
    if (fifteenDollarTxns.length > 10) {
      console.log(`  ... and ${fifteenDollarTxns.length - 10} more`);
    }
  } else {
    console.log('  No $15.00 transactions found');
  }
  console.log('');

  // Look for transactions that might be missing
  console.log('Checking for potential issues:');

  // Check for transactions with zero amount
  const zeroAmountTxns = transactions.filter(t => Math.abs(t.amount) < 0.01);
  if (zeroAmountTxns.length > 0) {
    console.log(`  Found ${zeroAmountTxns.length} transaction(s) with $0.00 amount`);
  }

  // Check for unparsed amounts
  const unparsedAmounts = transactions.filter(t => !t.amount && t.date);
  if (unparsedAmounts.length > 0) {
    console.log(`  Found ${unparsedAmounts.length} transaction(s) with unparsed amounts`);
  }

  // Show sample transactions
  console.log('');
  console.log('Sample transactions (first 10):');
  for (const txn of transactions.slice(0, 10)) {
    console.log(`  Line ${txn.lineNumber}: ${txn.date} | ${txn.type} | ${txn.account} | $${txn.amount.toFixed(2)}`);
  }

  // Expected total from previous analysis
  const expectedTotal = 97955.42;
  const difference = roundCurrency(grandTotal - expectedTotal);
  console.log('');
  console.log(`Expected total (from app): $${expectedTotal.toFixed(2)}`);
  console.log(`Calculated from TSV:      $${grandTotal.toFixed(2)}`);
  console.log(`Difference:               $${difference.toFixed(2)}`);
}

main();

