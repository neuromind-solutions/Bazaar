/**
 * Comprehensive System Verification & Mathematical Operations Test Suite
 * 
 * Tests all core functions, cross-page data dependencies, Khata ledger,
 * FIFO inventory depletion, Cash Register drawer, Returns/Refunds,
 * Pricing tiers, and Reactive notifications.
 */

// 1. Ensure localStorage polyfill for Node / tsx environment
const storageBackend = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageBackend.get(key) || null,
    setItem: (key: string, val: string) => storageBackend.set(key, val),
    removeItem: (key: string) => storageBackend.delete(key),
    clear: () => storageBackend.clear(),
    key: (i: number) => Array.from(storageBackend.keys())[i] || null,
    get length() { return storageBackend.size; },
  };
}

import { LegacyLocalStorageEngine, safeStorage } from './db/sqliteStorage';
import { Product, Customer, CartItem, ProductBatch } from './types';
import { generateEAN13, validateEAN13, validatePhone } from '@bazaar/shared-utils';
import { deductFifoBatches } from '@bazaar/shared-utils';
import { getProductPriceForCustomer } from '@bazaar/shared-utils';
import { calculateSmartReorderSuggestions } from '@bazaar/shared-utils';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
    console.log(`  ✓ [PASS] ${suite} -> ${name}`);
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed', details });
    console.error(`  ✗ [FAIL] ${suite} -> ${name} ${details ? `(${details})` : ''}`);
  }
}

function assertEquals<T>(actual: T, expected: T, suite: string, name: string) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    results.push({ suite, name, passed: true, details: `Value: ${JSON.stringify(actual)}` });
    console.log(`  ✓ [PASS] ${suite} -> ${name}`);
  } else {
    results.push({
      suite,
      name,
      passed: false,
      error: `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    });
    console.error(`  ✗ [FAIL] ${suite} -> ${name} (Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
  }
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('STARTING COMPREHENSIVE POS MATHEMATICAL & DEPENDENCY AUDIT');
  console.log('===============================================================\n');

  // Initialize fresh engine instance with clean mock store
  safeStorage.clear();
  const db = new LegacyLocalStorageEngine();

  // -------------------------------------------------------------
  // SUITE 1: Reactive Notifications & Observer Pattern
  // -------------------------------------------------------------
  console.log('\n--- SUITE 1: Reactive Storage Engine Subscriptions ---');
  let notifiedCount = 0;
  const initialVersion = db.getVersion();
  const unsubscribe = db.subscribe(() => {
    notifiedCount++;
  });

  const p1 = db.saveProduct({
    name: 'Basmati Rice Premium 1kg',
    barcode: '', // Should trigger EAN-13 auto-generation
    category: 'Grains',
    purchasePrice: 60,
    sellingPrice: 100,
    quantity: 50,
    minStockLevel: 10,
    unit: 'kg',
  });

  assert(notifiedCount > 0, 'Reactivity', 'Listener fired on product mutation');
  assert(db.getVersion() > initialVersion, 'Reactivity', 'db.getVersion() bumped on mutation');
  unsubscribe();

  // -------------------------------------------------------------
  // SUITE 2: Product Creation, EAN-13 Barcode Math & Tier Pricing
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Product Barcode Math & Tier Pricing ---');
  assert(p1.barcode.length === 13, 'Barcodes', 'Auto-generated barcode has 13 digits', `Barcode: ${p1.barcode}`);
  assert(validateEAN13(p1.barcode), 'Barcodes', 'Auto-generated barcode passes official EAN-13 checksum validation');

  // Configure tiered prices on p1
  p1.vipPrice = 90;
  p1.wholesalePrice = 80;
  p1.distributorPrice = 75;
  db.saveProduct(p1);

  const regularCustomer: Customer = { id: 'c1', name: 'Regular Guy', phone: '9876543210', outstandingDues: 0, tag: 'Regular', totalSpent: 0, loyaltyPoints: 0, storeCredit: 0 };
  const vipCustomer: Customer = { id: 'c2', name: 'VIP Buyer', phone: '9876543211', outstandingDues: 0, tag: 'VIP', totalSpent: 0, loyaltyPoints: 0, storeCredit: 0 };
  const wholesaleCustomer: Customer = { id: 'c3', name: 'Wholesaler Trader', phone: '9876543212', outstandingDues: 0, tag: 'Wholesale', totalSpent: 0, loyaltyPoints: 0, storeCredit: 0 };
  const distributorCustomer: Customer = { id: 'c4', name: 'Mega Distributor', phone: '9876543213', outstandingDues: 0, tag: 'Distributor', totalSpent: 0, loyaltyPoints: 0, storeCredit: 0 };

  assertEquals(getProductPriceForCustomer(p1, regularCustomer), 100, 'TierPricing', 'Regular Customer receives standard selling price (₹100)');
  assertEquals(getProductPriceForCustomer(p1, vipCustomer), 90, 'TierPricing', 'VIP Customer receives VIP tier price (₹90)');
  assertEquals(getProductPriceForCustomer(p1, wholesaleCustomer), 80, 'TierPricing', 'Wholesale Customer receives wholesale tier price (₹80)');
  assertEquals(getProductPriceForCustomer(p1, distributorCustomer), 75, 'TierPricing', 'Distributor Customer receives distributor tier price (₹75)');

  // -------------------------------------------------------------
  // SUITE 3: Customer Khata Ledger & Opening Dues Calculation
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: Customer Khata Ledger & Opening Dues ---');
  const createdCust = db.saveCustomer({
    name: 'Ramesh Sharma',
    phone: '9876500001',
    outstandingDues: 500, // Opening balance of ₹500
    creditLimit: 2000,
  });

  assertEquals(createdCust.outstandingDues, 500, 'CustomerLedger', 'Customer registered with ₹500 opening dues');
  const ledgers1 = db.getCustomerLedger(createdCust.id);
  assert(ledgers1.length === 1, 'CustomerLedger', 'Opening balance automatically created 1 ledger entry');
  assertEquals(ledgers1[0].type, 'Adjustment', 'CustomerLedger', 'Opening entry recorded as Adjustment');
  assertEquals(ledgers1[0].debit, 500, 'CustomerLedger', 'Opening entry debit is ₹500');
  assertEquals(ledgers1[0].balance, 500, 'CustomerLedger', 'Running balance is ₹500');

  // -------------------------------------------------------------
  // SUITE 4: FIFO Batch Depletion & Inventory Allocation
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: FIFO Inventory Batch Allocation ---');
  const sampleBatches: ProductBatch[] = [
    { id: 'b1', batchNumber: 'BATCH-JAN', expiryDate: '2026-06-01', quantity: 10, purchasePrice: 50 },
    { id: 'b2', batchNumber: 'BATCH-FEB', expiryDate: '2026-07-01', quantity: 15, purchasePrice: 55 },
    { id: 'b3', batchNumber: 'BATCH-MAR', expiryDate: '2026-08-01', quantity: 20, purchasePrice: 60 },
  ];

  // Request 18 units: 10 from BATCH-JAN (cost 50*10=500), 8 from BATCH-FEB (cost 55*8=440). Total cost = 940.
  const fifoResult = deductFifoBatches(sampleBatches, 18);
  assertEquals(fifoResult.totalCost, 940, 'FIFOBatches', 'FIFO total cost calculated accurately (10*50 + 8*55 = 940)');
  assertEquals(fifoResult.exhaustedBatches.length, 1, 'FIFOBatches', '1 batch exhausted (BATCH-JAN)');
  assertEquals(fifoResult.updatedBatches[0].quantity, 0, 'FIFOBatches', 'Exhausted batch retained with qty 0 for audit trail');
  assertEquals(fifoResult.updatedBatches[1].quantity, 7, 'FIFOBatches', 'Second batch remaining qty is 7 (15 - 8)');
  assertEquals(fifoResult.updatedBatches[2].quantity, 20, 'FIFOBatches', 'Third batch untouched with qty 20');

  // -------------------------------------------------------------
  // SUITE 5: POS Cash Billing & Register Dependencies
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: POS Cash Sale -> Stock Deduction & Cash Drawer ---');
  // Open cash shift with ₹1,000 opening cash
  const shift = db.openCashShift(1000, 'Cashier John');
  assertEquals(shift.openingCash, 1000, 'CashRegister', 'Shift opened with ₹1,000 opening float');

  const initialStock = p1.quantity; // 50
  const cart: CartItem[] = [
    {
      product: p1,
      quantity: 5,
      unitSellingPrice: 100,
      totalPrice: 500, // 5 * 100
    }
  ];

  // Bill: Subtotal = 500, Discount = 50, Tax = 5% on 450 = 22.5, Grand Total = 473
  const discount = 50;
  const taxPercent = 5;
  const expectedTax = (500 - 50) * 0.05; // 22.5
  const expectedGrandTotal = Math.round(500 - 50 + expectedTax); // 473

  const cashSale = db.recordSale(
    cart,
    'Walk-in Customer',
    '',
    'Cash',
    500, // Received 500 cash
    discount,
    taxPercent,
    'Cash sale test'
  );

  assertEquals(cashSale.subtotal, 500, 'POSBilling', 'Sale subtotal matches (₹500)');
  assertEquals(cashSale.discountAmount, 50, 'POSBilling', 'Sale discount matches (₹50)');
  assertEquals(cashSale.taxAmount, expectedTax, 'POSBilling', 'Sale tax matches (₹22.5)');
  assertEquals(cashSale.totalAmount, expectedGrandTotal, 'POSBilling', 'Sale grand total matches (₹473)');
  assertEquals(cashSale.changeAmount, 500 - expectedGrandTotal, 'POSBilling', 'Change given matches (₹27)');

  // Check product stock deduction
  const updatedP1 = db.getProductById(p1.id);
  assertEquals(updatedP1?.quantity, initialStock - 5, 'POSBilling', 'Product stock decreased by 5 in catalog');

  // Check Cash Drawer register
  const currentShift = db.getCurrentCashShift()!;
  const shiftCashSales = db.getShiftCashSales(currentShift);
  const shiftExpected = db.getShiftExpectedCash(currentShift);
  assertEquals(shiftCashSales, expectedGrandTotal, 'CashRegister', 'Cash sales in register reflects exact sale amount (₹473)');
  assertEquals(shiftExpected.expectedCash, 1000 + expectedGrandTotal, 'CashRegister', 'Expected cash equals opening + sale (₹1,473)');

  // -------------------------------------------------------------
  // SUITE 6: Credit (Khata) Sale -> Customer Ledger & Outstanding Dues
  // -------------------------------------------------------------
  console.log('\n--- SUITE 6: POS Credit Sale -> Customer Khata Integration ---');
  const duesBeforeCredit = createdCust.outstandingDues; // 500
  const creditCart: CartItem[] = [
    {
      product: p1,
      quantity: 2,
      unitSellingPrice: 100,
      totalPrice: 200,
    }
  ];

  const creditSale = db.recordSale(
    creditCart,
    createdCust.name,
    createdCust.phone,
    'Credit',
    0, // Received ₹0
    0, // No discount
    0, // 0% tax
    'Monthly khata credit purchase',
    createdCust.id
  );

  const reloadedCust = db.getCustomerById(createdCust.id);
  assertEquals(
    reloadedCust?.outstandingDues,
    duesBeforeCredit + 200,
    'KhataLedger',
    'Customer dues increased from ₹500 to ₹700 on Credit Sale'
  );

  const customerLedgersAfterCredit = db.getCustomerLedger(createdCust.id);
  assertEquals(customerLedgersAfterCredit.length, 2, 'KhataLedger', 'Customer now has 2 ledger records');
  const creditLedgerEntry = customerLedgersAfterCredit[0];
  assertEquals(creditLedgerEntry.type, 'SaleCredit', 'KhataLedger', 'Latest entry type is SaleCredit');
  assertEquals(creditLedgerEntry.debit, 200, 'KhataLedger', 'SaleCredit debit is ₹200');
  assertEquals(creditLedgerEntry.balance, 700, 'KhataLedger', 'Running balance updated to ₹700');

  // -------------------------------------------------------------
  // SUITE 7: Customer Dues Payment -> Ledger Update & Cash Register Inflow
  // -------------------------------------------------------------
  console.log('\n--- SUITE 7: Customer Khata Payment -> Dues Reduction & Cash Inflow ---');
  const payResult = db.payCustomerDues(createdCust.id, 300, 'Cash', 'Partial Khata clearance');
  assert(payResult, 'KhataPayment', 'payCustomerDues returned true');

  const custAfterPayment = db.getCustomerById(createdCust.id);
  assertEquals(custAfterPayment?.outstandingDues, 400, 'KhataPayment', 'Customer dues reduced from ₹700 to ₹400');

  const ledgersAfterPay = db.getCustomerLedger(createdCust.id);
  assertEquals(ledgersAfterPay.length, 3, 'KhataPayment', 'Third ledger entry created');
  const payEntry = ledgersAfterPay[0];
  assertEquals(payEntry.type, 'PaymentReceived', 'KhataPayment', 'Latest entry type is PaymentReceived');
  assertEquals(payEntry.credit, 300, 'KhataPayment', 'Payment credit is ₹300');
  assertEquals(payEntry.balance, 400, 'KhataPayment', 'Running balance decreased to ₹400');

  // Verify that cash drawer recorded the inflow
  const shiftAfterPayment = db.getCurrentCashShift()!;
  assertEquals(
    shiftAfterPayment.cashInTotal,
    300,
    'CashRegister',
    'Cash shift recorded ₹300 cashInTotal from customer Khata dues clearance'
  );
  const expectedAfterPay = db.getShiftExpectedCash(shiftAfterPayment).expectedCash;
  assertEquals(
    expectedAfterPay,
    1000 + expectedGrandTotal + 300,
    'CashRegister',
    'Expected drawer cash reflects Opening + Sale + Khata Collection'
  );

  // -------------------------------------------------------------
  // SUITE 8: Split Payment Billing (Cash + Credit Split)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 8: Split Payment Billing (Cash + Store Credit) ---');
  const splitCart: CartItem[] = [
    {
      product: p1,
      quantity: 4,
      unitSellingPrice: 100,
      totalPrice: 400,
    }
  ];

  // Bill: ₹400 split -> ₹250 Cash, ₹150 Store Credit
  const duesBeforeSplit = custAfterPayment!.outstandingDues; // 400
  const shiftBeforeSplit = db.getCurrentCashShift()!;
  const cashSalesBeforeSplit = db.getShiftCashSales(shiftBeforeSplit);

  const splitSale = db.recordSale(
    splitCart,
    createdCust.name,
    createdCust.phone,
    'Split',
    400,
    0,
    0,
    'Split payment test',
    createdCust.id,
    [
      { mode: 'Cash', amount: 250 },
      { mode: 'Store Credit', amount: 150 },
    ]
  );

  const custAfterSplit = db.getCustomerById(createdCust.id);
  assertEquals(
    custAfterSplit?.outstandingDues,
    duesBeforeSplit + 150,
    'SplitPayment',
    'Customer dues increased by exact Store Credit portion (+₹150 -> ₹550)'
  );

  const shiftAfterSplit = db.getCurrentCashShift()!;
  const cashSalesAfterSplit = db.getShiftCashSales(shiftAfterSplit);
  assertEquals(
    cashSalesAfterSplit,
    cashSalesBeforeSplit + 250,
    'CashRegister',
    'Cash shift increased by exact Cash portion (+₹250)'
  );

  // -------------------------------------------------------------
  // SUITE 9: Returns & Refunds -> Stock Restoral, Khata & Cash Out
  // -------------------------------------------------------------
  console.log('\n--- SUITE 9: Returns & Refunds -> Stock Restoral & Drawer Cash-Out ---');
  const stockBeforeReturn = db.getProductById(p1.id)!.quantity;
  const shiftBeforeReturn = db.getCurrentCashShift()!;
  const cashBeforeReturn = db.getShiftExpectedCash(shiftBeforeReturn).expectedCash;

  // Process return for cashSale: return 2 units of p1
  const returnRes = db.recordReturn(
    cashSale.id,
    [
      {
        productId: p1.id,
        productName: p1.name,
        qty: 2,
        unitPrice: 100,
      }
    ],
    200,
    'Customer Changed Mind'
  );

  const stockAfterReturn = db.getProductById(p1.id)!.quantity;
  assertEquals(stockAfterReturn, stockBeforeReturn + 2, 'Returns', 'Inventory stock restored (+2)');

  const shiftAfterReturn = db.getCurrentCashShift()!;
  assertEquals(shiftAfterReturn.cashOutTotal, 200, 'CashRegister', 'Shift cashOutTotal logged ₹200 Cash-Out');
  const cashAfterReturn = db.getShiftExpectedCash(shiftAfterReturn).expectedCash;
  assertEquals(
    cashAfterReturn,
    cashBeforeReturn - 200,
    'CashRegister',
    'Expected drawer cash reduced by ₹200 refund'
  );

  // -------------------------------------------------------------
  // SUITE 10: Expenses Management & Cash Drawer Deduction
  // -------------------------------------------------------------
  console.log('\n--- SUITE 10: Store Expenses -> Cash Drawer Deduction ---');
  const shiftBeforeExpense = db.getCurrentCashShift()!;
  const cashBeforeExpense = db.getShiftExpectedCash(shiftBeforeExpense).expectedCash;
  const initialCashOut = shiftBeforeExpense.cashOutTotal;

  db.saveExpense({
    title: 'Tea & Refreshments',
    amount: 80,
    category: 'Food & Pantry',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    notes: 'Evening store snacks',
  });

  const shiftAfterExpense = db.getCurrentCashShift()!;
  assertEquals(shiftAfterExpense.cashOutTotal, initialCashOut + 80, 'Expenses', 'Shift expenses recorded ₹80 CashOut');
  const cashAfterExpense = db.getShiftExpectedCash(shiftAfterExpense).expectedCash;
  assertEquals(
    cashAfterExpense,
    cashBeforeExpense - 80,
    'Expenses',
    'Expected cash drawer reduced by ₹80 expense'
  );

  // -------------------------------------------------------------
  // SUITE 11: Parked (Held) Bills Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- SUITE 11: Parked (Held) Bills Lifecycle ---');
  const heldBill = db.saveHeldBill(
    'Mrs. Kapoor',
    '9988776655',
    cart,
    'Customer forgot wallet'
  );

  assert(db.getHeldBills().length === 1, 'HeldBills', 'Parked bill saved to local storage');
  assertEquals(db.getHeldBills()[0].id, heldBill.id, 'HeldBills', 'Held bill ID retrieved accurately');

  db.deleteHeldBill(heldBill.id);
  assertEquals(db.getHeldBills().length, 0, 'HeldBills', 'Held bill removed upon recall or discard');

  // -------------------------------------------------------------
  // SUITE 12: Smart Reorder Algorithm & Velocity Math
  // -------------------------------------------------------------
  console.log('\n--- SUITE 12: Smart Reorder 30-Day Velocity Math ---');
  const reorderSuggestions = db.getSmartReorderSuggestions();
  assert(Array.isArray(reorderSuggestions), 'SmartReorder', 'getSmartReorderSuggestions returns array');
  // Check that p1 is evaluated with its daily velocity
  const p1Suggestion = reorderSuggestions.find(s => s.productId === p1.id);
  if (p1Suggestion) {
    assert(p1Suggestion.dailyVelocity >= 0, 'SmartReorder', 'Daily velocity is a positive number');
    assert(p1Suggestion.suggestedQty >= 0, 'SmartReorder', 'Suggested quantity calculated non-negative');
    assert(p1Suggestion.daysOfStockLeft >= 0, 'SmartReorder', 'Days of stock left computed non-negative');
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log(`TEST EXECUTION COMPLETE: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
