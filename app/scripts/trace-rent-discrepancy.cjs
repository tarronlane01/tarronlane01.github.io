/**
 * Trace Rent Discrepancy
 * 
 * Walk through each month and show cumulative balance tracking.
 */

const fs = require('fs');
const path = require('path');

// Load the analysis
const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'rent-analysis.json'), 'utf-8'));

console.log('=== TRACING RENT BALANCE PROPAGATION ===\n');

// The app shows January 2023 starting at -$551.21
// The seed shows January 2023 starting at $713.79
// Difference: $1,265.00

// Let's find when $1,265 could have gone wrong

console.log('Key question: The app shows Jan 2023 Start = -$551.21');
console.log('             The seed shows Jan 2023 Start = $713.79');
console.log('             Difference: $1,265.00\n');

console.log('Looking for transactions close to $1,265...\n');

// Read the raw file and look for amounts near $1,265
const seedPath = path.join(__dirname, '../src/seeds/raw_cash_flow.csv');
const content = fs.readFileSync(seedPath, 'utf-8');
const lines = content.split('\n');

function parseAmount(str) {
  if (!str) return 0;
  let cleaned = str.replace(/[$\s"]/g, '');
  const isNeg = cleaned.startsWith('-') || cleaned.startsWith('(');
  cleaned = cleaned.replace(/[()-]/g, '').replace(/,/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : (isNeg ? -val : val);
}

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

console.log('Rent transactions with amounts near $1,265 (±$10):');
console.log('-'.repeat(100));

let lineNum = 0;
for (const line of lines) {
  lineNum++;
  if (!line.includes(',Rent,')) continue;
  
  const fields = parseCSVLine(line);
  const amount = parseAmount(fields[4]);
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1255 && absAmount <= 1275) {
    console.log(`Line ${lineNum}: ${fields[0].padEnd(12)} ${fields[1].padEnd(30)} ${fields[4].padStart(15)} ${fields[5] || ''}`);
  }
}

console.log('\n');

// Now let's look at what transactions exist around the discrepancy
console.log('=== MONTHLY BREAKDOWN Oct 2022 - Feb 2023 ===\n');

// Re-parse to get transactions with more detail
const rentTx = [];
lineNum = 0;
for (const line of lines) {
  lineNum++;
  if (!line.includes(',Rent,')) continue;
  
  const fields = parseCSVLine(line);
  const dateStr = fields[0];
  const parts = dateStr.split('/');
  if (parts.length !== 3) continue;
  
  const month = parseInt(parts[0]);
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  const amount = parseAmount(fields[4]);
  const payee = fields[1];
  const category = fields[2];
  
  // Infer type
  let type = 'spend';
  if (category.toLowerCase() === 'income') type = 'income';
  if (payee.toLowerCase() === 'budget allocation') type = 'allocation';
  
  rentTx.push({
    lineNum,
    dateStr,
    year,
    month,
    day,
    type,
    payee,
    amount,
    desc: fields[5] || ''
  });
}

// Filter to Oct 2022 - Feb 2023
const relevantTx = rentTx.filter(t => {
  if (t.year === 2022 && t.month >= 10) return true;
  if (t.year === 2023 && t.month <= 2) return true;
  return false;
});

// Group by month
const byMonth = {};
for (const t of relevantTx) {
  const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
  if (!byMonth[key]) byMonth[key] = [];
  byMonth[key].push(t);
}

// Show each month
for (const mk of Object.keys(byMonth).sort()) {
  const txs = byMonth[mk];
  
  const allocs = txs.filter(t => t.type === 'allocation');
  const spends = txs.filter(t => t.type === 'spend');
  
  const totalAlloc = allocs.reduce((s, t) => s + t.amount, 0);
  const totalSpend = spends.reduce((s, t) => s + t.amount, 0);
  
  console.log(`\n${mk}:`);
  console.log(`  Allocations (${allocs.length}):`);
  for (const t of allocs) {
    console.log(`    Line ${t.lineNum}: ${t.dateStr.padEnd(12)} $${t.amount.toFixed(2).padStart(12)}`);
  }
  console.log(`    TOTAL: $${totalAlloc.toFixed(2)}`);
  
  console.log(`  Spend (${spends.length}):`);
  for (const t of spends) {
    console.log(`    Line ${t.lineNum}: ${t.dateStr.padEnd(12)} $${t.amount.toFixed(2).padStart(12)}  ${t.payee.substring(0, 25).padEnd(25)} ${t.desc.substring(0, 30)}`);
  }
  console.log(`    TOTAL: $${totalSpend.toFixed(2)}`);
  console.log(`  NET: $${(totalAlloc + totalSpend).toFixed(2)}`);
}

console.log('\n\n=== HYPOTHESIS ===\n');
console.log('The $1,267 "Extra Payment" on 1/20/2023 (Line 2583) is very close to the $1,265 discrepancy.');
console.log('Possible issues:');
console.log('1. This transaction might be getting counted twice somewhere');
console.log('2. This transaction might be in the wrong month in the app');
console.log('3. There might be a data import issue where it wasn\'t recognized as "Rent" category');
console.log('');
console.log('TO INVESTIGATE:');
console.log('1. Check what transactions the app shows for January 2023 Rent');
console.log('2. Check if the 1/20/2023 $1,267 "Extra Payment" appears');
console.log('3. Check if the 1/3/2023 $3,446.21 mortgage payment appears');
console.log('4. Check if there are any duplicate transactions');
