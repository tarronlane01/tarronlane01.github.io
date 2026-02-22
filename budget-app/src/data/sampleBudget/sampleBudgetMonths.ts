/**
 * Sample Budget Month Templates
 * 
 * Defines transactions for each month using RELATIVE month offsets:
 * - monthOffset 0 = current month
 * - monthOffset -1 = last month  
 * - monthOffset -2 = two months ago
 * etc.
 * 
 * The day is day-of-month (1-28 to avoid month-length issues).
 * These templates are used to generate actual dated transactions.
 */

export interface SampleTransaction {
  idSuffix: string
  account_id: string
  payee: string
  description: string
  amount: number
  category_id?: string
  day: number
  cleared: boolean
}

export interface SampleTransfer {
  idSuffix: string
  from_account_id: string
  to_account_id: string
  from_category_id: string
  to_category_id: string
  amount: number
  description: string
  day: number
}

export interface SampleAdjustment {
  idSuffix: string
  account_id: string
  category_id: string
  amount: number
  description: string
  day: number
}

export interface SampleAllocation {
  category_id: string
  amount: number
}

export interface SampleMonthTemplate {
  monthOffset: number
  income: SampleTransaction[]
  expenses: SampleTransaction[]
  transfers: SampleTransfer[]
  adjustments: SampleAdjustment[]
  allocations: SampleAllocation[]
  areAllocationsFinalized: boolean
}

export const SAMPLE_MONTH_TEMPLATES: SampleMonthTemplate[] = [
  {
    monthOffset: -5,
    areAllocationsFinalized: true,
    income: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 15, cleared: true },
      { idSuffix: '02', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 28, cleared: true },
      { idSuffix: '03', account_id: 'account_main_checking', payee: 'Side Gig Client', description: 'Freelance work', amount: 450, day: 20, cleared: true },
      { idSuffix: '04', account_id: 'account_emergency_fund', payee: 'Interest', description: 'Savings interest', amount: 12.50, day: 28, cleared: true },
    ],
    expenses: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'Landlord', description: 'Rent', amount: -1500, category_id: 'category_rent', day: 1, cleared: true },
      { idSuffix: '02', account_id: 'account_credit_card', payee: 'Electric Company', description: '', amount: -95.42, category_id: 'category_utilities', day: 5, cleared: true },
      { idSuffix: '03', account_id: 'account_credit_card', payee: 'Water Utility', description: '', amount: -45.18, category_id: 'category_utilities', day: 8, cleared: true },
      { idSuffix: '04', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -127.84, category_id: 'category_groceries', day: 3, cleared: true },
      { idSuffix: '05', account_id: 'account_credit_card', payee: 'Costco', description: 'Monthly stock up', amount: -189.45, category_id: 'category_groceries', day: 10, cleared: true },
      { idSuffix: '06', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -98.32, category_id: 'category_groceries', day: 17, cleared: true },
      { idSuffix: '07', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -112.67, category_id: 'category_groceries', day: 24, cleared: true },
      { idSuffix: '08', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -48.92, category_id: 'category_transportation', day: 6, cleared: true },
      { idSuffix: '09', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -52.15, category_id: 'category_transportation', day: 20, cleared: true },
      { idSuffix: '10', account_id: 'account_credit_card', payee: 'Netflix', description: '', amount: -15.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '11', account_id: 'account_credit_card', payee: 'Spotify', description: '', amount: -11.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '12', account_id: 'account_credit_card', payee: 'AT&T', description: 'Phone bill', amount: -65.00, category_id: 'category_phone_internet', day: 12, cleared: true },
      { idSuffix: '13', account_id: 'account_credit_card', payee: 'Comcast', description: 'Internet', amount: -55.00, category_id: 'category_phone_internet', day: 15, cleared: true },
      { idSuffix: '14', account_id: 'account_credit_card', payee: 'Movie Theater', description: 'Date night', amount: -32.50, category_id: 'category_entertainment', day: 18, cleared: true },
      { idSuffix: '15', account_id: 'account_credit_card', payee: 'Local Restaurant', description: 'Dinner out', amount: -67.89, category_id: 'category_dining_out', day: 11, cleared: true },
      { idSuffix: '16', account_id: 'account_credit_card', payee: 'Coffee Shop', description: '', amount: -12.45, category_id: 'category_dining_out', day: 14, cleared: true },
      { idSuffix: '17', account_id: 'account_credit_card', payee: 'Local Restaurant', description: 'Lunch', amount: -24.30, category_id: 'category_dining_out', day: 22, cleared: true },
      { idSuffix: '18', account_id: 'account_credit_card', payee: 'Amazon', description: 'Books', amount: -34.99, category_id: 'category_personal', day: 9, cleared: true },
      { idSuffix: '19', account_id: 'account_credit_card', payee: 'Target', description: 'Winter jacket', amount: -79.99, category_id: 'category_clothing', day: 25, cleared: true },
    ],
    transfers: [
      { idSuffix: '01', from_account_id: 'account_main_checking', to_account_id: 'account_emergency_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 200, description: 'Monthly savings', day: 20 },
      { idSuffix: '02', from_account_id: 'account_main_checking', to_account_id: 'account_vacation_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 100, description: 'Vacation savings', day: 20 },
      { idSuffix: '03', from_account_id: 'account_main_checking', to_account_id: 'account_credit_card', from_category_id: 'no_category', to_category_id: 'no_category', amount: 1200, description: 'Credit card payment', day: 25 },
    ],
    adjustments: [],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 49 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 75 },
      { category_id: 'category_clothing', amount: 100 },
    ],
  },
  {
    monthOffset: -4,
    areAllocationsFinalized: true,
    income: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 15, cleared: true },
      { idSuffix: '02', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 28, cleared: true },
      { idSuffix: '03', account_id: 'account_emergency_fund', payee: 'Interest', description: 'Savings interest', amount: 13.25, day: 28, cleared: true },
    ],
    expenses: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'Landlord', description: 'Rent', amount: -1500, category_id: 'category_rent', day: 1, cleared: true },
      { idSuffix: '02', account_id: 'account_credit_card', payee: 'Electric Company', description: '', amount: -102.18, category_id: 'category_utilities', day: 5, cleared: true },
      { idSuffix: '03', account_id: 'account_credit_card', payee: 'Water Utility', description: '', amount: -43.92, category_id: 'category_utilities', day: 8, cleared: true },
      { idSuffix: '04', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -134.56, category_id: 'category_groceries', day: 4, cleared: true },
      { idSuffix: '05', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -108.23, category_id: 'category_groceries', day: 11, cleared: true },
      { idSuffix: '06', account_id: 'account_credit_card', payee: 'Costco', description: 'Monthly stock up', amount: -167.89, category_id: 'category_groceries', day: 15, cleared: true },
      { idSuffix: '07', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -92.45, category_id: 'category_groceries', day: 25, cleared: true },
      { idSuffix: '08', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -45.67, category_id: 'category_transportation', day: 7, cleared: true },
      { idSuffix: '09', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -51.23, category_id: 'category_transportation', day: 21, cleared: true },
      { idSuffix: '10', account_id: 'account_credit_card', payee: 'Netflix', description: '', amount: -15.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '11', account_id: 'account_credit_card', payee: 'Spotify', description: '', amount: -11.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '12', account_id: 'account_credit_card', payee: 'AT&T', description: 'Phone bill', amount: -65.00, category_id: 'category_phone_internet', day: 12, cleared: true },
      { idSuffix: '13', account_id: 'account_credit_card', payee: 'Comcast', description: 'Internet', amount: -55.00, category_id: 'category_phone_internet', day: 15, cleared: true },
      { idSuffix: '14', account_id: 'account_credit_card', payee: 'Local Restaurant', description: 'Valentine dinner', amount: -89.50, category_id: 'category_dining_out', day: 14, cleared: true },
      { idSuffix: '15', account_id: 'account_credit_card', payee: 'Coffee Shop', description: '', amount: -15.80, category_id: 'category_dining_out', day: 19, cleared: true },
    ],
    transfers: [
      { idSuffix: '01', from_account_id: 'account_main_checking', to_account_id: 'account_emergency_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 200, description: 'Monthly savings', day: 20 },
      { idSuffix: '02', from_account_id: 'account_main_checking', to_account_id: 'account_vacation_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 150, description: 'Vacation savings', day: 20 },
      { idSuffix: '03', from_account_id: 'account_main_checking', to_account_id: 'account_credit_card', from_category_id: 'no_category', to_category_id: 'no_category', amount: 1100, description: 'Credit card payment', day: 25 },
    ],
    adjustments: [],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 44 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 75 },
      { category_id: 'category_clothing', amount: 100 },
    ],
  },
  {
    monthOffset: -3,
    areAllocationsFinalized: true,
    income: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 15, cleared: true },
      { idSuffix: '02', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 28, cleared: true },
      { idSuffix: '03', account_id: 'account_main_checking', payee: 'Side Gig Client', description: 'Freelance project', amount: 600, day: 10, cleared: true },
      { idSuffix: '04', account_id: 'account_emergency_fund', payee: 'Interest', description: 'Savings interest', amount: 13.75, day: 28, cleared: true },
    ],
    expenses: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'Landlord', description: 'Rent', amount: -1500, category_id: 'category_rent', day: 1, cleared: true },
      { idSuffix: '02', account_id: 'account_credit_card', payee: 'Electric Company', description: '', amount: -88.76, category_id: 'category_utilities', day: 5, cleared: true },
      { idSuffix: '03', account_id: 'account_credit_card', payee: 'Water Utility', description: '', amount: -44.50, category_id: 'category_utilities', day: 8, cleared: true },
      { idSuffix: '04', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -118.92, category_id: 'category_groceries', day: 2, cleared: true },
      { idSuffix: '05', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -125.34, category_id: 'category_groceries', day: 9, cleared: true },
      { idSuffix: '06', account_id: 'account_credit_card', payee: 'Costco', description: 'Monthly stock up', amount: -198.67, category_id: 'category_groceries', day: 16, cleared: true },
      { idSuffix: '07', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -87.21, category_id: 'category_groceries', day: 23, cleared: true },
      { idSuffix: '08', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -49.88, category_id: 'category_transportation', day: 5, cleared: true },
      { idSuffix: '09', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -53.42, category_id: 'category_transportation', day: 19, cleared: true },
      { idSuffix: '10', account_id: 'account_credit_card', payee: 'Netflix', description: '', amount: -15.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '11', account_id: 'account_credit_card', payee: 'Spotify', description: '', amount: -11.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '12', account_id: 'account_credit_card', payee: 'AT&T', description: 'Phone bill', amount: -65.00, category_id: 'category_phone_internet', day: 12, cleared: true },
      { idSuffix: '13', account_id: 'account_credit_card', payee: 'Comcast', description: 'Internet', amount: -55.00, category_id: 'category_phone_internet', day: 15, cleared: true },
      { idSuffix: '14', account_id: 'account_credit_card', payee: 'Movie Theater', description: 'Movies', amount: -28.00, category_id: 'category_entertainment', day: 22, cleared: true },
      { idSuffix: '15', account_id: 'account_credit_card', payee: 'Local Restaurant', description: 'Dinner', amount: -54.32, category_id: 'category_dining_out', day: 8, cleared: true },
      { idSuffix: '16', account_id: 'account_credit_card', payee: 'Target', description: 'Spring clothes', amount: -124.99, category_id: 'category_clothing', day: 12, cleared: true },
    ],
    transfers: [
      { idSuffix: '01', from_account_id: 'account_main_checking', to_account_id: 'account_emergency_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 250, description: 'Monthly savings', day: 20 },
      { idSuffix: '02', from_account_id: 'account_main_checking', to_account_id: 'account_vacation_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 150, description: 'Vacation savings', day: 20 },
      // Dec (month -3) payoff: start balance 1469 + CC expenses this month through day 25 (1122) = 2592
      { idSuffix: '03', from_account_id: 'account_main_checking', to_account_id: 'account_credit_card', from_category_id: 'no_category', to_category_id: 'no_category', amount: 2592, description: 'Credit card payoff', day: 25 },
    ],
    adjustments: [],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 50 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 75 },
      { category_id: 'category_clothing', amount: 150 },
    ],
  },
  {
    monthOffset: -2,
    areAllocationsFinalized: true,
    income: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 15, cleared: true },
      { idSuffix: '02', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 28, cleared: true },
      { idSuffix: '03', account_id: 'account_emergency_fund', payee: 'Interest', description: 'Savings interest', amount: 14.00, day: 28, cleared: true },
    ],
    expenses: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'Landlord', description: 'Rent', amount: -1500, category_id: 'category_rent', day: 1, cleared: true },
      { idSuffix: '02', account_id: 'account_credit_card', payee: 'Electric Company', description: '', amount: -78.45, category_id: 'category_utilities', day: 5, cleared: true },
      { idSuffix: '03', account_id: 'account_credit_card', payee: 'Water Utility', description: '', amount: -42.30, category_id: 'category_utilities', day: 8, cleared: true },
      { idSuffix: '04', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -132.45, category_id: 'category_groceries', day: 3, cleared: true },
      { idSuffix: '05', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -98.76, category_id: 'category_groceries', day: 10, cleared: true },
      { idSuffix: '06', account_id: 'account_credit_card', payee: 'Costco', description: 'Monthly stock up', amount: -175.23, category_id: 'category_groceries', day: 17, cleared: true },
      { idSuffix: '07', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -105.89, category_id: 'category_groceries', day: 24, cleared: true },
      { idSuffix: '08', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -47.56, category_id: 'category_transportation', day: 6, cleared: true },
      { idSuffix: '09', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -50.89, category_id: 'category_transportation', day: 20, cleared: true },
      { idSuffix: '10', account_id: 'account_credit_card', payee: 'Netflix', description: '', amount: -15.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '11', account_id: 'account_credit_card', payee: 'Spotify', description: '', amount: -11.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '12', account_id: 'account_credit_card', payee: 'AT&T', description: 'Phone bill', amount: -65.00, category_id: 'category_phone_internet', day: 12, cleared: true },
      { idSuffix: '13', account_id: 'account_credit_card', payee: 'Comcast', description: 'Internet', amount: -55.00, category_id: 'category_phone_internet', day: 15, cleared: true },
      { idSuffix: '14', account_id: 'account_credit_card', payee: 'Local Restaurant', description: 'Birthday dinner', amount: -78.90, category_id: 'category_dining_out', day: 18, cleared: true },
      { idSuffix: '15', account_id: 'account_credit_card', payee: 'Coffee Shop', description: '', amount: -18.45, category_id: 'category_dining_out', day: 7, cleared: true },
      { idSuffix: '16', account_id: 'account_credit_card', payee: 'Amazon', description: 'Household items', amount: -45.67, category_id: 'category_personal', day: 14, cleared: true },
    ],
    // No credit card payment this month (balance carries)
    transfers: [
      { idSuffix: '01', from_account_id: 'account_main_checking', to_account_id: 'account_emergency_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 200, description: 'Monthly savings', day: 20 },
      { idSuffix: '02', from_account_id: 'account_main_checking', to_account_id: 'account_vacation_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 100, description: 'Vacation savings', day: 20 },
    ],
    adjustments: [
      { idSuffix: '01', account_id: 'account_main_checking', category_id: 'category_personal', amount: -25.00, description: 'Cash withdrawal', day: 22 },
    ],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 44 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 100 },
      { category_id: 'category_clothing', amount: 100 },
    ],
  },
  {
    monthOffset: -1,
    areAllocationsFinalized: true,
    income: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 15, cleared: true },
      { idSuffix: '02', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 28, cleared: true },
      { idSuffix: '03', account_id: 'account_main_checking', payee: 'Side Gig Client', description: 'Freelance work', amount: 350, day: 12, cleared: true },
      { idSuffix: '04', account_id: 'account_emergency_fund', payee: 'Interest', description: 'Savings interest', amount: 14.50, day: 28, cleared: true },
    ],
    expenses: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'Landlord', description: 'Rent', amount: -1500, category_id: 'category_rent', day: 1, cleared: true },
      { idSuffix: '02', account_id: 'account_credit_card', payee: 'Electric Company', description: '', amount: -85.32, category_id: 'category_utilities', day: 5, cleared: true },
      { idSuffix: '03', account_id: 'account_credit_card', payee: 'Water Utility', description: '', amount: -46.78, category_id: 'category_utilities', day: 8, cleared: true },
      { idSuffix: '04', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -115.67, category_id: 'category_groceries', day: 2, cleared: true },
      { idSuffix: '05', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -128.34, category_id: 'category_groceries', day: 9, cleared: true },
      { idSuffix: '06', account_id: 'account_credit_card', payee: 'Costco', description: 'Monthly stock up', amount: -182.56, category_id: 'category_groceries', day: 16, cleared: true },
      { idSuffix: '07', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -94.23, category_id: 'category_groceries', day: 23, cleared: true },
      { idSuffix: '08', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -52.34, category_id: 'category_transportation', day: 4, cleared: true },
      { idSuffix: '09', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -48.76, category_id: 'category_transportation', day: 18, cleared: true },
      { idSuffix: '10', account_id: 'account_credit_card', payee: 'Netflix', description: '', amount: -15.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '11', account_id: 'account_credit_card', payee: 'Spotify', description: '', amount: -11.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '12', account_id: 'account_credit_card', payee: 'AT&T', description: 'Phone bill', amount: -65.00, category_id: 'category_phone_internet', day: 12, cleared: true },
      { idSuffix: '13', account_id: 'account_credit_card', payee: 'Comcast', description: 'Internet', amount: -55.00, category_id: 'category_phone_internet', day: 15, cleared: true },
      { idSuffix: '14', account_id: 'account_credit_card', payee: 'Movie Theater', description: 'Movies', amount: -35.50, category_id: 'category_entertainment', day: 21, cleared: true },
      { idSuffix: '15', account_id: 'account_credit_card', payee: 'Local Restaurant', description: 'Dinner', amount: -62.45, category_id: 'category_dining_out', day: 10, cleared: true },
      { idSuffix: '16', account_id: 'account_credit_card', payee: 'Coffee Shop', description: '', amount: -14.25, category_id: 'category_dining_out', day: 19, cleared: true },
    ],
    transfers: [
      { idSuffix: '01', from_account_id: 'account_main_checking', to_account_id: 'account_emergency_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 200, description: 'Monthly savings', day: 20 },
      { idSuffix: '02', from_account_id: 'account_main_checking', to_account_id: 'account_vacation_fund', from_category_id: 'no_category', to_category_id: 'no_category', amount: 150, description: 'Vacation savings', day: 20 },
      { idSuffix: '03', from_account_id: 'account_main_checking', to_account_id: 'account_credit_card', from_category_id: 'no_category', to_category_id: 'no_category', amount: 950, description: 'Credit card payment', day: 25 },
    ],
    adjustments: [],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 48 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 75 },
      { category_id: 'category_clothing', amount: 100 },
    ],
  },
  {
    // Month 0 (current month): Finalized with typical spending
    monthOffset: 0,
    areAllocationsFinalized: true,
    income: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 15, cleared: true },
      { idSuffix: '02', account_id: 'account_main_checking', payee: 'ABC Corp', description: 'Paycheck', amount: 2200, day: 28, cleared: true },
    ],
    expenses: [
      { idSuffix: '01', account_id: 'account_main_checking', payee: 'Landlord', description: 'Rent', amount: -1500, category_id: 'category_rent', day: 1, cleared: true },
      { idSuffix: '02', account_id: 'account_credit_card', payee: 'Electric Company', description: '', amount: -92.15, category_id: 'category_utilities', day: 5, cleared: true },
      { idSuffix: '03', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -122.34, category_id: 'category_groceries', day: 3, cleared: true },
      { idSuffix: '04', account_id: 'account_credit_card', payee: 'Grocery Mart', description: 'Weekly groceries', amount: -108.56, category_id: 'category_groceries', day: 10, cleared: true },
      { idSuffix: '05', account_id: 'account_credit_card', payee: 'Shell Gas', description: '', amount: -54.23, category_id: 'category_transportation', day: 7, cleared: true },
      { idSuffix: '06', account_id: 'account_credit_card', payee: 'Netflix', description: '', amount: -15.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '07', account_id: 'account_credit_card', payee: 'Spotify', description: '', amount: -11.99, category_id: 'category_subscriptions', day: 1, cleared: true },
      { idSuffix: '08', account_id: 'account_credit_card', payee: 'AT&T', description: 'Phone bill', amount: -65.00, category_id: 'category_phone_internet', day: 12, cleared: true },
      { idSuffix: '09', account_id: 'account_credit_card', payee: 'Coffee Shop', description: '', amount: -16.75, category_id: 'category_dining_out', day: 8, cleared: true },
    ],
    transfers: [],
    adjustments: [],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 44 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 75 },
      { category_id: 'category_clothing', amount: 100 },
    ],
  },
  {
    // Month +1: Finalized allocations only, no income or spending
    // Represents a typical "next month" where allocations are finalized but nothing else
    monthOffset: 1,
    areAllocationsFinalized: true,
    income: [],
    expenses: [],
    transfers: [],
    adjustments: [],
    allocations: [
      { category_id: 'category_rent', amount: 1500 },
      { category_id: 'category_utilities', amount: 150 },
      { category_id: 'category_groceries', amount: 550 },
      { category_id: 'category_transportation', amount: 120 },
      { category_id: 'category_subscriptions', amount: 30 },
      { category_id: 'category_phone_internet', amount: 120 },
      { category_id: 'category_entertainment', amount: 48 },
      { category_id: 'category_dining_out', amount: 100 },
      { category_id: 'category_personal', amount: 75 },
      { category_id: 'category_clothing', amount: 50 },
    ],
  },
]
