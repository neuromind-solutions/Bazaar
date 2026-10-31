import { describe, it, expect, beforeEach } from 'vitest';
import { LegacyLocalStorageEngine, safeStorage } from '@/src/db/sqliteStorage';
import { CartItem } from '@/src/types';

describe('Local Reactive SQLite Storage Engine (sqliteStorage.ts)', () => {
  let db: LegacyLocalStorageEngine;

  beforeEach(() => {
    safeStorage.clear();
    db = new LegacyLocalStorageEngine();
  });

  describe('Reactivity & Versioning', () => {
    it('notifies subscribers and increments version counter on write operations', () => {
      let callbackCount = 0;
      const initialVersion = db.getVersion();

      const unsubscribe = db.subscribe(() => {
        callbackCount++;
      });

      db.saveProduct({
        name: 'Organic Wheat Flour 1kg',
        barcode: '8909999000011',
        purchasePrice: 40,
        sellingPrice: 55,
        quantity: 20,
        category: 'Grains',
      });

      expect(callbackCount).toBeGreaterThan(0);
      expect(db.getVersion()).toBeGreaterThan(initialVersion);
      unsubscribe();
    });
  });

  describe('Product Catalog CRUD & Stock Deduction', () => {
    it('creates product and automatically assigns EAN-13 when barcode is empty', () => {
      const p = db.saveProduct({
        name: 'Loose Jeera 100g',
        barcode: '',
        purchasePrice: 30,
        sellingPrice: 45,
        quantity: 15,
        category: 'Spices',
      });

      expect(p.id).toBeDefined();
      expect(p.barcode).toHaveLength(13);
      expect(p.barcode.startsWith('890')).toBe(true);

      const found = db.getProductById(p.id);
      expect(found?.name).toBe('Loose Jeera 100g');
    });

    it('adds stock and updates cost price', () => {
      const p = db.saveProduct({
        name: 'Mustard Oil 1L',
        barcode: '8901234001999',
        purchasePrice: 120,
        sellingPrice: 150,
        quantity: 10,
        category: 'Oils',
      });

      db.addStock(p.id, 5, 125, 155, 'Patanjali Distributor');
      const updated = db.getProductById(p.id);
      expect(updated?.quantity).toBe(15);
      expect(updated?.purchasePrice).toBe(125);
    });

    it('deletes product from catalog', () => {
      const p = db.saveProduct({
        name: 'Discontinued Snack',
        barcode: '8901111222233',
        purchasePrice: 10,
        sellingPrice: 15,
        quantity: 5,
        category: 'Snacks',
      });

      expect(db.getProductById(p.id)).toBeDefined();
      db.deleteProduct(p.id);
      expect(db.getProductById(p.id)).toBeUndefined();
    });
  });

  describe('POS Sales Recording & Inventory Depletion', () => {
    it('records sale, creates invoice, and deducts inventory stock', () => {
      const p = db.saveProduct({
        name: 'Premium Tea 250g',
        barcode: '8901234009876',
        purchasePrice: 100,
        sellingPrice: 140,
        quantity: 20,
        category: 'Beverages',
      });

      const cart: CartItem[] = [
        {
          product: p,
          quantity: 3,
          unitSellingPrice: 140,
          totalPrice: 420,
        },
      ];

      const sale = db.recordSale(
        cart,
        'Walk-in',
        '9876543210',
        'Cash',
        500, // received
        20,  // discount
        0,   // tax
        'Test sale note'
      );

      expect(sale.id).toBeDefined();
      expect(sale.invoiceNumber).toContain('INV');
      expect(sale.subtotal).toBe(420);
      expect(sale.discountAmount).toBe(20);
      expect(sale.totalAmount).toBe(400);
      expect(sale.changeAmount).toBe(100);

      // Verify stock was reduced by 3
      const updatedProduct = db.getProductById(p.id);
      expect(updatedProduct?.quantity).toBe(17);
    });
  });

  describe('Cash Drawer Shifts', () => {
    it('opens shift with float and tracks expected cash drawer balance', () => {
      const shift = db.openCashShift(1000, 'Morning shift');
      expect(shift.status).toBe('Open');
      expect(shift.openingCash).toBe(1000);

      // Add cash in
      db.addCashTransaction('CashIn', 200, 'Drawer change restock');
      const activeShift = db.getCurrentCashShift();
      expect(activeShift?.cashInTotal).toBe(200);

      // Close shift
      const closed = db.closeCashShift(1200, 'All balanced');
      expect(closed?.status).toBe('Closed');
      expect(closed?.closingCash).toBe(1200);
    });
  });

  describe('Customers & Khata CRM Ledger', () => {
    it('creates customer with opening dues and tracks Khata payment ledger', () => {
      const customer = db.saveCustomer({
        name: 'Sharma Kirana',
        phone: '9876543211',
        outstandingDues: 500,
        tag: 'Regular',
      });

      expect(customer.id).toBeDefined();
      expect(customer.outstandingDues).toBe(500);

      const ledger = db.getCustomerLedger(customer.id);
      expect(ledger.length).toBeGreaterThan(0);
      expect(ledger[0].type).toBe('Adjustment');

      // Pay ₹300 dues in cash
      const paid = db.payCustomerDues(customer.id, 300, 'Cash', 'Partial dues clearance');
      expect(paid).toBe(true);

      const updatedCustomer = db.getCustomerById(customer.id);
      expect(updatedCustomer?.outstandingDues).toBe(200);

      const updatedLedger = db.getCustomerLedger(customer.id);
      expect(updatedLedger.length).toBe(2);
      expect(updatedLedger[0].credit).toBe(300);
    });
  });

  describe('Held Bills Management', () => {
    it('holds and restores or deletes pending cart orders', () => {
      const p = db.saveProduct({
        name: 'Atta 10kg',
        barcode: '8901234000001',
        purchasePrice: 300,
        sellingPrice: 380,
        quantity: 50,
        category: 'Flour',
      });

      const held = db.saveHeldBill('Gupta Ji', '9876500099', [
        { product: p, quantity: 2, unitSellingPrice: 380, totalPrice: 760 },
      ], 'Customer stepped out for wallet');

      expect(held.id).toBeDefined();
      expect(db.getHeldBills()).toHaveLength(1);

      db.deleteHeldBill(held.id);
      expect(db.getHeldBills()).toHaveLength(0);
    });
  });

  describe('Returns & Refund Restocking', () => {
    it('processes refund and restores inventory stock', () => {
      const p = db.saveProduct({
        name: 'Cooking Oil 1L',
        barcode: '8901234000002',
        purchasePrice: 110,
        sellingPrice: 140,
        quantity: 20,
        category: 'Oils',
      });

      const cart: CartItem[] = [
        { product: p, quantity: 4, unitSellingPrice: 140, totalPrice: 560 },
      ];

      const sale = db.recordSale(cart, 'Walk-in', '', 'Cash', 560, 0, 0);
      expect(db.getProductById(p.id)?.quantity).toBe(16);

      // Return 2 defective units
      const returnRec = db.recordReturn(
        sale.id,
        [{ productId: p.id, productName: p.name, qty: 2, unitPrice: 140 }],
        280,
        'Defective'
      );

      expect(returnRec).toBeDefined();
      expect(returnRec?.refundAmount).toBe(280);
      expect(db.getProductById(p.id)?.quantity).toBe(18); // Restocked 16 + 2 = 18
      expect(db.getReturns()).toHaveLength(1);
    });
  });

  describe('Expenses & Suppliers', () => {
    it('records store expense and tracks supplier catalog', () => {
      const initialExpCount = db.getExpenses().length;
      const exp = db.saveExpense({
        title: 'Electricity Bill',
        category: 'Utilities',
        amount: 850,
        date: new Date().toISOString(),
        paymentMode: 'Cash',
      });

      expect(exp.id).toBeDefined();
      expect(db.getExpenses()).toHaveLength(initialExpCount + 1);

      const initialSupCount = db.getSuppliers().length;
      const supplier = db.saveSupplier({
        name: 'Ashok Kumar',
        companyName: 'ITC Distribution Hub',
        phone: '9876500088',
      });

      expect(supplier.id).toBeDefined();
      expect(db.getSuppliers()).toHaveLength(initialSupCount + 1);
      expect(db.getSupplierById(supplier.id)?.companyName).toBe('ITC Distribution Hub');
    });
  });

  describe('Diagnostics, Optimization & Backups', () => {
    it('returns healthy system diagnostics', () => {
      const diag = db.getHealthDiagnostics();
      expect(diag.status).toBe('Healthy');
      expect(diag.databaseName).toBe('grocery_pos_sqlite_v2.db');
      expect(diag.dbSizeKb).toBeGreaterThan(0);
    });

    it('runs storage vacuum and returns compaction result', () => {
      const result = db.optimizeStorage();
      expect(result.dbSizeKb).toBeGreaterThan(0);
      expect(typeof result.freedRecords).toBe('number');
    });

    it('exports and re-imports complete JSON backup without data corruption', () => {
      const backupJson = db.exportBackupJSON();
      expect(backupJson).toContain('2.0 Enterprise');
      expect(backupJson).toContain('"products":');

      const restored = db.importBackupJSON(backupJson);
      expect(restored).toBe(true);
    });
  });
});
