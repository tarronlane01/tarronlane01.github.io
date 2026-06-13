/**
 * Rent Category Month-by-Month Analysis Script
 * 
 * Calculates expected monthly balances from seed data for the Rent category.
 * Output can be compared against the app's displayed values to find discrepancies.
 */

const fs = require('fs');
const path = require('path');

// CSV parsing helpers
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

function parseAmount(str) {
  if (!str) return 0;
  let cleaned = str.replace(/[$\s"]/g, '');
  const isNeg = cleaned.startsWith('-') || cleaned.startsWith('(');
  cleaned = cleaned.replace(/[()-]/g, '').replace(/,/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : (isNeg ? -val : val);
}

function parseDate(str) {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  return { 
    month: parseInt(parts[0]), 
    day: parseInt(parts[1]), 
    year: parseInt(parts[2]) 
  };
}

function inferType(payee, category) {
  if (category.toLowerCase() === 'income') return 'income';
  if (payee.toLowerCase() === 'budget allocation') return 'allocation';
  return 'spend';
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatCurrency(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Read and parse the seed file
const seedPath = path.join(__dirname, '../src/seeds/raw_cash_flow.csv');
const content = fs.readFileSync(seedPath, 'utf-8');
const lines = content.split('\n');

// Collect all Rent transactions
const rentTransactions = [];
let lineNum = 0;

for (const line of lines) {
  lineNum++;
  if (!line.includes(',Rent,')) continue;
  
  const fields = parseCSVLine(line);
  const dateStr = fields[0];
  const payee = fields[1];
  const category = fields[2];
  const account = fields[3];
  const amount = parseAmount(fields[4]);
  const description = fields[5] || '';
  
  const date = parseDate(dateStr);
  if (!date) continue;
  
  const type = inferType(payee, category);
  
  rentTransactions.push({
    lineNum,
    dateStr,
    date,
    type,
    payee,
    account,
    amount,
    description,
    monthKey: monthKey(date.year, date.month)
  });
}

// Sort transactions by date
rentTransactions.sort((a, b) => {
  if (a.date.year !== b.date.year) return a.date.year - b.date.year;
  if (a.date.month !== b.date.month) return a.date.month - b.date.month;
  return a.date.day - b.date.day;
});

// Group by month and calculate monthly totals
const monthlyData = new Map();

for (const tx of rentTransactions) {
  if (!monthlyData.has(tx.monthKey)) {
    monthlyData.set(tx.monthKey, {
      monthKey: tx.monthKey,
      transactions: [],
      allocations: 0,
      spend: 0,
      allocationCount: 0,
      spendCount: 0
    });
  }
  
  const month = monthlyData.get(tx.monthKey);
  month.transactions.push(tx);
  
  if (tx.type === 'allocation') {
    month.allocations += tx.amount;
    month.allocationCount++;
  } else if (tx.type === 'spend') {
    month.spend += tx.amount;
    month.spendCount++;
  }
}

// Sort months chronologically
const sortedMonths = Array.from(monthlyData.keys()).sort();

// Calculate running balance month by month
let runningBalance = 0;
const monthlyAnalysis = [];

for (const mk of sortedMonths) {
  const month = monthlyData.get(mk);
  const startBalance = runningBalance;
  const netChange = month.allocations + month.spend;
  const endBalance = startBalance + netChange;
  
  monthlyAnalysis.push({
    monthKey: mk,
    startBalance,
    allocations: month.allocations,
    spend: month.spend,
    netChange,
    endBalance,
    allocationCount: month.allocationCount,
    spendCount: month.spendCount,
    transactions: month.transactions
  });
  
  runningBalance = endBalance;
}

// Output results
console.log('='.repeat(120));
console.log('RENT CATEGORY - MONTH-BY-MONTH SEED DATA ANALYSIS');
console.log('='.repeat(120));
console.log('');
console.log('Compare these values against the app\'s displayed values for each month.');
console.log('The first month where values differ is likely where the bug originates.');
console.log('');

// Summary table header
console.log('-'.repeat(120));
console.log(
  'Month'.padEnd(10) +
  'Start'.padStart(14) +
  'Allocated'.padStart(14) +
  'Spent'.padStart(14) +
  'Net Change'.padStart(14) +
  'End'.padStart(14) +
  'Alloc#'.padStart(8) +
  'Spend#'.padStart(8) +
  'Notes'.padStart(16)
);
console.log('-'.repeat(120));

for (const m of monthlyAnalysis) {
  // Flag any months with potential issues
  let notes = '';
  if (m.allocationCount > 1) notes = `${m.allocationCount} allocs!`;
  if (m.allocationCount === 0 && m.spendCount > 0) notes = 'no alloc';
  
  console.log(
    m.monthKey.padEnd(10) +
    formatCurrency(m.startBalance).padStart(14) +
    formatCurrency(m.allocations).padStart(14) +
    formatCurrency(m.spend).padStart(14) +
    formatCurrency(m.netChange).padStart(14) +
    formatCurrency(m.endBalance).padStart(14) +
    String(m.allocationCount).padStart(8) +
    String(m.spendCount).padStart(8) +
    notes.padStart(16)
  );
}

console.log('-'.repeat(120));
console.log('');

// Output as JSON for programmatic comparison
const jsonOutput = {
  summary: {
    totalMonths: monthlyAnalysis.length,
    finalBalance: runningBalance,
    totalAllocations: monthlyAnalysis.reduce((sum, m) => sum + m.allocations, 0),
    totalSpend: monthlyAnalysis.reduce((sum, m) => sum + m.spend, 0)
  },
  months: monthlyAnalysis.map(m => ({
    month: m.monthKey,
    start: Math.round(m.startBalance * 100) / 100,
    allocated: Math.round(m.allocations * 100) / 100,
    spent: Math.round(m.spend * 100) / 100,
    netChange: Math.round(m.netChange * 100) / 100,
    end: Math.round(m.endBalance * 100) / 100,
    allocationCount: m.allocationCount,
    spendCount: m.spendCount
  }))
};

// Write JSON file for comparison
const jsonPath = path.join(__dirname, 'rent-analysis.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
console.log(`JSON data written to: ${jsonPath}`);
console.log('');

// Show details for months with multiple allocations (potential issue)
const multiAllocMonths = monthlyAnalysis.filter(m => m.allocationCount > 1);
if (multiAllocMonths.length > 0) {
  console.log('='.repeat(120));
  console.log('MONTHS WITH MULTIPLE ALLOCATIONS (POTENTIAL DUPLICATES):');
  console.log('='.repeat(120));
  
  for (const m of multiAllocMonths) {
    console.log(`\n${m.monthKey}:`);
    const allocs = m.transactions.filter(t => t.type === 'allocation');
    for (const tx of allocs) {
      console.log(`  Line ${tx.lineNum}: ${tx.dateStr} - ${tx.payee} - ${formatCurrency(tx.amount)} - "${tx.description}"`);
    }
  }
  console.log('');
}

// Show first few months with detailed transaction breakdown
console.log('='.repeat(120));
console.log('DETAILED TRANSACTION BREAKDOWN (First 12 months):');
console.log('='.repeat(120));

for (let i = 0; i < Math.min(12, monthlyAnalysis.length); i++) {
  const m = monthlyAnalysis[i];
  console.log(`\n${m.monthKey} | Start: ${formatCurrency(m.startBalance)} → End: ${formatCurrency(m.endBalance)}`);
  console.log('-'.repeat(80));
  
  for (const tx of m.transactions) {
    const typeLabel = tx.type === 'allocation' ? '[ALLOC]' : '[SPEND]';
    console.log(`  ${tx.dateStr.padEnd(12)} ${typeLabel.padEnd(8)} ${formatCurrency(tx.amount).padStart(12)}  ${tx.payee.substring(0, 25).padEnd(25)} ${tx.description.substring(0, 30)}`);
  }
}

console.log('\n');
console.log('='.repeat(120));
console.log('TO COMPARE WITH APP:');
console.log('='.repeat(120));
console.log('1. Navigate to each month in the app');
console.log('2. Find the Rent category row');
console.log('3. Compare: Start, Allocated, Spent, End balances');
console.log('4. The first month where any value differs indicates where the bug started');
console.log('');
