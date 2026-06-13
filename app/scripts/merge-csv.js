#!/usr/bin/env node
/**
 * Merge raw.csv into combined CSV format
 * - Converts raw.csv (no type column) to combined format (with type column)
 * - Identifies missing rows
 * - Detects suspicious "poison" dates (too early with gaps)
 * - Outputs updated combined file with headers and poison.csv for review
 */

const fs = require('fs');
const path = require('path');

const SEEDS_DIR = path.join(__dirname, '../src/seeds');
const RAW_FILE = path.join(SEEDS_DIR, 'raw.csv');
const COMBINED_FILE = path.join(SEEDS_DIR, 'combined_2026-01-02.csv');
const POISON_FILE = path.join(SEEDS_DIR, 'poison.csv');

const HEADERS = 'type,date,payee,category,account,amount,description,flag';

/**
 * Parse a CSV line, handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse date string M/D/YYYY to { year, month, day }
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return { year, month, day };
}

/**
 * Convert date to sortable number YYYYMMDD
 */
function dateToNum(year, month, day) {
  return year * 10000 + month * 100 + day;
}

/**
 * Determine record type from raw row data
 */
function inferType(payee, category, amount) {
  // Budget Allocation payee = allocation
  if (payee === 'Budget Allocation') return 'allocation';
  // Income category = income
  if (category === 'Income') return 'income';
  // Starting Balance = starting_balance (special handling)
  if (payee === 'Starting Balance') return 'starting_balance';
  // Transfer category = transfer (we'll mark as spend for now)
  // Everything else = spend
  return 'spend';
}

/**
 * Create a unique key for a row to detect duplicates
 */
function createRowKey(type, date, payee, category, account, amount, description) {
  // Normalize for comparison
  return `${type}|${date}|${payee}|${category}|${account}|${amount}|${description}`.toLowerCase();
}

/**
 * Parse raw.csv (no type column, no header)
 * Format: date,payee,category,account,amount,description,flag
 */
function parseRawCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const rows = [];

  for (const line of lines) {
    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;

    const [dateStr, payee, category, account, amount, description, flag] = fields;

    // Skip if it looks like a header
    if (dateStr.toLowerCase() === 'date') continue;

    const parsedDate = parseDate(dateStr);
    if (!parsedDate) continue;

    const type = inferType(payee, category, amount);

    rows.push({
      type,
      date: dateStr,
      payee,
      category,
      account,
      amount,
      description: description || '',
      flag: flag || 'TRUE',
      parsedDate,
      rawLine: line,
    });
  }

  return rows;
}

/**
 * Parse combined CSV (has type column, has header)
 * Format: type,date,payee,category,account,amount,description,flag
 */
function parseCombinedCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const rows = [];

  for (const line of lines) {
    const fields = parseCSVLine(line);
    if (fields.length < 6) continue;

    const [type, dateStr, payee, category, account, amount, description, flag] = fields;

    // Skip header row
    if (type.toLowerCase() === 'type') continue;

    const parsedDate = parseDate(dateStr);
    if (!parsedDate) continue;

    rows.push({
      type,
      date: dateStr,
      payee,
      category,
      account,
      amount,
      description: description || '',
      flag: flag || 'TRUE',
      parsedDate,
      rawLine: line,
    });
  }

  return rows;
}

/**
 * Format a row as CSV line
 */
function formatRow(row) {
  // Escape fields that contain commas
  const escape = (val) => {
    if (val && val.includes(',')) return `"${val}"`;
    return val || '';
  };
  return [
    row.type,
    row.date,
    escape(row.payee),
    escape(row.category),
    escape(row.account),
    escape(row.amount),
    escape(row.description),
    row.flag
  ].join(',');
}

/**
 * Find monthly date ranges in the data
 */
function findMonthlyRanges(rows) {
  const monthCounts = {};

  for (const row of rows) {
    const { year, month } = row.parsedDate;
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  }

  return monthCounts;
}

/**
 * Identify poison rows - dates that seem out of place
 * Look for months with very few transactions that are isolated from other months
 */
function identifyPoisonRows(rows, monthCounts) {
  const sortedMonths = Object.keys(monthCounts).sort();
  const poisonRows = [];
  const validRows = [];

  // Find gaps in months - if a month has transactions but surrounding months don't
  // and it has very few transactions, it might be suspicious

  // For now, identify rows before August 2020 as suspicious (based on starting balances)
  const earliestValidDate = dateToNum(2020, 8, 1);

  for (const row of rows) {
    const rowDateNum = dateToNum(row.parsedDate.year, row.parsedDate.month, row.parsedDate.day);

    // Check if date is before expected start
    if (rowDateNum < earliestValidDate && row.payee !== 'Starting Balance') {
      poisonRows.push(row);
    } else {
      validRows.push(row);
    }
  }

  // Also check for isolated months with gaps
  // A month is suspicious if it has < 5 transactions and the previous/next months have gaps > 1 month
  for (let i = 0; i < sortedMonths.length; i++) {
    const month = sortedMonths[i];
    const count = monthCounts[month];

    // Skip if month has substantial transactions
    if (count >= 10) continue;

    // Check for gaps
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);

    // Calculate expected previous and next months
    const prevMonth = monthNum === 1
      ? `${year - 1}-12`
      : `${year}-${(monthNum - 1).toString().padStart(2, '0')}`;
    const nextMonth = monthNum === 12
      ? `${year + 1}-01`
      : `${year}-${(monthNum + 1).toString().padStart(2, '0')}`;

    const hasPrev = monthCounts[prevMonth];
    const hasNext = monthCounts[nextMonth];

    // If isolated (no adjacent months), mark as suspicious
    if (!hasPrev && !hasNext && count < 5) {
      console.log(`Suspicious isolated month: ${month} with ${count} transactions`);
    }
  }

  return { validRows, poisonRows };
}

// Main execution
function main() {
  console.log('Reading files...');

  const rawContent = fs.readFileSync(RAW_FILE, 'utf-8');
  const combinedContent = fs.readFileSync(COMBINED_FILE, 'utf-8');

  console.log('Parsing raw.csv...');
  const rawRows = parseRawCSV(rawContent);
  console.log(`  Found ${rawRows.length} rows in raw.csv`);

  console.log('Parsing combined CSV...');
  const combinedRows = parseCombinedCSV(combinedContent);
  console.log(`  Found ${combinedRows.length} rows in combined CSV`);

  // Create keys for combined rows
  const combinedKeys = new Set();
  for (const row of combinedRows) {
    const key = createRowKey(row.type, row.date, row.payee, row.category, row.account, row.amount, row.description);
    combinedKeys.add(key);
  }

  // Find rows in raw that aren't in combined
  const missingRows = [];
  for (const row of rawRows) {
    const key = createRowKey(row.type, row.date, row.payee, row.category, row.account, row.amount, row.description);
    if (!combinedKeys.has(key)) {
      missingRows.push(row);
    }
  }

  console.log(`\nFound ${missingRows.length} rows in raw.csv not in combined:`);
  for (const row of missingRows) {
    console.log(`  ${row.date} | ${row.payee} | ${row.category} | ${row.amount}`);
  }

  // Combine all rows
  const allRows = [...combinedRows, ...missingRows];

  // Find monthly ranges
  const monthCounts = findMonthlyRanges(allRows);
  console.log('\nMonthly transaction counts:');
  const sortedMonths = Object.keys(monthCounts).sort();
  // Show first and last few months
  const showMonths = [...sortedMonths.slice(0, 5), '...', ...sortedMonths.slice(-5)];
  for (const month of showMonths) {
    if (month === '...') {
      console.log('  ...');
    } else {
      console.log(`  ${month}: ${monthCounts[month]} transactions`);
    }
  }

  // Identify poison rows
  const { validRows, poisonRows } = identifyPoisonRows(allRows, monthCounts);

  console.log(`\nFound ${poisonRows.length} suspicious rows for poison.csv`);

  // Sort valid rows by date
  validRows.sort((a, b) => {
    const dateA = dateToNum(a.parsedDate.year, a.parsedDate.month, a.parsedDate.day);
    const dateB = dateToNum(b.parsedDate.year, b.parsedDate.month, b.parsedDate.day);
    return dateA - dateB;
  });

  // Write updated combined file
  const combinedOutput = [HEADERS, ...validRows.map(formatRow)].join('\n');
  fs.writeFileSync(COMBINED_FILE, combinedOutput + '\n');
  console.log(`\nWrote ${validRows.length} rows to ${COMBINED_FILE}`);

  // Write poison file if there are suspicious rows
  if (poisonRows.length > 0) {
    const poisonOutput = [HEADERS, ...poisonRows.map(formatRow)].join('\n');
    fs.writeFileSync(POISON_FILE, poisonOutput + '\n');
    console.log(`Wrote ${poisonRows.length} rows to ${POISON_FILE}`);
  } else {
    console.log('No poison rows found.');
  }
}

main();

