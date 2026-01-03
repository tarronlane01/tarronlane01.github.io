/**
 * Quick Comparison Helper
 * 
 * Paste in app values for each month to find where discrepancy starts.
 * Usage: Modify the appValues object below with values from the app.
 */

const fs = require('fs');
const path = require('path');

// Load seed analysis
const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'rent-analysis.json'), 'utf-8'));

// Paste app values here as you navigate through months
// Format: 'YYYY-MM': { start, allocated, spent, end }
const appValues = {
  // Example - fill these in from the app:
  // '2020-08': { start: 0, allocated: 0, spent: -705, end: -705 },
  // '2020-09': { start: -705, allocated: 1200, spent: 300, end: 795 },
  
  // January 2023 values from app (from earlier conversation):
  '2023-01': { start: -551.21, allocated: null, spent: -713.21, end: -1264.42 },
};

console.log('\n=== RENT CATEGORY: SEED vs APP COMPARISON ===\n');
console.log('Month'.padEnd(10) + 'Field'.padEnd(12) + 'SEED'.padStart(14) + 'APP'.padStart(14) + 'DIFF'.padStart(14) + '  Status');
console.log('-'.repeat(75));

function fmt(n) {
  if (n === null || n === undefined) return 'N/A'.padStart(14);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`.padStart(14);
}

let firstDiscrepancyFound = false;

for (const month of seedData.months) {
  const appMonth = appValues[month.month];
  if (!appMonth) continue;
  
  const fields = [
    { name: 'Start', seed: month.start, app: appMonth.start },
    { name: 'Allocated', seed: month.allocated, app: appMonth.allocated },
    { name: 'Spent', seed: month.spent, app: appMonth.spent },
    { name: 'End', seed: month.end, app: appMonth.end },
  ];
  
  for (const f of fields) {
    if (f.app === null) continue;
    
    const diff = f.app !== null ? Math.round((f.app - f.seed) * 100) / 100 : null;
    const status = diff === 0 ? '✓ Match' : diff !== null ? '✗ DIFFERS' : '';
    
    console.log(
      month.month.padEnd(10) +
      f.name.padEnd(12) +
      fmt(f.seed) +
      fmt(f.app) +
      fmt(diff) +
      '  ' + status
    );
    
    if (diff !== 0 && diff !== null && !firstDiscrepancyFound) {
      firstDiscrepancyFound = true;
      console.log('\n>>> FIRST DISCREPANCY FOUND <<<\n');
    }
  }
  console.log('');
}

// Show months around January 2023 for manual comparison
console.log('\n=== SEED VALUES FOR MONTHS AROUND JAN 2023 (for manual comparison) ===\n');

const targetMonths = ['2022-10', '2022-11', '2022-12', '2023-01', '2023-02', '2023-03'];
for (const mk of targetMonths) {
  const m = seedData.months.find(x => x.month === mk);
  if (m) {
    console.log(`${m.month}: Start ${fmt(m.start)} | Alloc ${fmt(m.allocated)} | Spent ${fmt(m.spent)} | End ${fmt(m.end)}`);
  }
}

console.log('\n');
console.log('Instructions:');
console.log('1. Navigate to each month in the app');
console.log('2. Record the Rent category values');
console.log('3. Add them to appValues in this script');
console.log('4. Re-run to find the first discrepancy');
console.log('');
