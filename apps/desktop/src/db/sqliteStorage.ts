/**
 * Local Offline Storage Engine simulating SQLite schema tables.
 * Fully persistent, zero external dependencies, supports backup/restore as .sqlite / .db / .json.
 */

import { 
  ShopSettings, 
  Product, 
  Sale, 
  SaleItem, 
  IncomingStockLog, 
  DashboardMetrics, 
  CartItem,
  Customer,
  Supplier,
  PurchaseOrder,
  Expense,
  Employee,
  AttendanceRecord,
  HeldBill,
  SaleReturn,
  AuditLog,
  Branch,
  ProductBatch,
  UnitConversion,
  CashRegisterShift,
  CashTransaction,
  PriceHistoryRecord,
  CategoryNode,
  CustomerLedgerEntry,
  RecycleBinItem,
  UpdatePackage
} from '../types';

import { 
  hashPin, 
  verifyPin, 
  generateEAN13, 
  deductFifoBatches, 
  calculateSmartReorderSuggestions 
} from '@bazaar/shared-utils';

const STORAGE_KEYS = {
  SETTINGS: 'grocery_pos_settings_v2',
  PRODUCTS: 'grocery_pos_products_v2',
  SALES: 'grocery_pos_sales_v2',
  STOCK_LOGS: 'grocery_pos_stock_logs_v2',
  CUSTOMERS: 'grocery_pos_customers_v2',
  SUPPLIERS: 'grocery_pos_suppliers_v2',
  PURCHASE_ORDERS: 'grocery_pos_purchase_orders_v2',
  EXPENSES: 'grocery_pos_expenses_v2',
  EMPLOYEES: 'grocery_pos_employees_v2',
  ATTENDANCE: 'grocery_pos_attendance_v2',
  HELD_BILLS: 'grocery_pos_held_bills_v2',
  RETURNS: 'grocery_pos_returns_v2',
  AUDIT_LOGS: 'grocery_pos_audit_logs_v2',
  BRANCHES: 'grocery_pos_branches_v2',
  CASH_SHIFTS: 'grocery_pos_cash_shifts_v2',
  CASH_TXNS: 'grocery_pos_cash_txns_v2',
  PRICE_HISTORY: 'grocery_pos_price_history_v2',
  CATEGORIES: 'grocery_pos_categories_v2',
  CUSTOMER_LEDGERS: 'grocery_pos_customer_ledgers_v2',
  RECYCLE_BIN: 'grocery_pos_recycle_bin_v2',
  UPDATES: 'grocery_pos_updates_v2',
};

export const INITIAL_SAMPLE_BRANCHES: Branch[] = [
  {
    id: 'BRANCH-01',
    name: 'Main Store',
    code: 'MAIN',
    address: '',
    phone: '',
    isPrimary: true,
  }
];

export const INITIAL_SAMPLE_CATEGORIES: CategoryNode[] = [
  { id: 'CAT-1', name: 'Grains & Atta', description: 'Flours, rice, wheat and grains' },
  { id: 'CAT-2', name: 'Oils & Ghee', description: 'Cooking oils, mustard oil, pure ghee' },
  { id: 'CAT-3', name: 'Rice & Pulses', description: 'Basmati rice, sona masoori, lentils' },
  { id: 'CAT-4', name: 'Spices & Salt', description: 'Powdered spices, whole spices, rock salt' },
  { id: 'CAT-5', name: 'Beverages', description: 'Tea, coffee, juices, soft drinks' },
  { id: 'CAT-6', name: 'Dairy & Bakery', description: 'Milk, butter, cheese, bread' },
  { id: 'CAT-7', name: 'Snacks & Biscuits', description: 'Cookies, chips, namkeen' },
  { id: 'CAT-8', name: 'Household', description: 'Detergents, soaps, cleaners' },
  { id: 'CAT-9', name: 'Personal Care', description: 'Shampoos, soaps, toothpaste' },
  { id: 'CAT-10', name: 'Combos & Packs', description: 'Special festival and daily bundles' }
];

export const UNIT_CONVERSIONS: UnitConversion[] = [
  { fromUnit: 'kg', toUnit: 'g', factor: 1000 },
  { fromUnit: 'g', toUnit: 'kg', factor: 0.001 },
  { fromUnit: 'litre', toUnit: 'ml', factor: 1000 },
  { fromUnit: 'ml', toUnit: 'litre', factor: 0.001 },
  { fromUnit: 'sack', toUnit: 'kg', factor: 50 },
  { fromUnit: 'box', toUnit: 'pcs', factor: 10 },
  { fromUnit: 'packet', toUnit: 'pcs', factor: 1 }
];

export const INITIAL_SAMPLE_UPDATES: UpdatePackage[] = [
  {
    version: '2.0.0 Commercial',
    releaseDate: '2026-07-28',
    releaseNotes: [
      'Added Multi-Branch support architecture',
      'Implemented FIFO Batch & Lot expiry warnings',
      'Added Cash Register drawer shifts & daily reconciliation',
      'Added Smart Reorder calculations and printable reports',
      'Full offline performance and diagnostics health monitor'
    ],
    isApplied: true,
  }
];

// Initial default shop settings
export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Green Grocery & Supermarket',
  ownerName: 'Store Admin',
  address: '',
  phone: '',
  gstNumber: '',
  invoicePrefix: 'INV',
  currencySymbol: '₹',
  defaultTaxPercent: 0,
  lowStockThreshold: 10,
  receiptType: 'thermal',
  receiptSize: '80mm',
  enableCameraScanner: true,
  theme: 'light',
  isSetupCompleted: true,
  backupFrequency: 'daily',
  requireManagerPinForDiscount: true,
  discountThresholdPercent: 15,
  enableLoyalty: true,
  loyaltyPointRatio: 100, // 1 pt per ₹100
  // UPI Payment Default Settings
  enableUpiPayments: true,
  merchantName: 'Green Grocery & Supermarket',
  upiId: 'merchant@upi',
  defaultPaymentNote: 'Thank you for your purchase!',
  upiReceiptFooter: 'QR Payment Completed via Dynamic UPI',
  merchantLogo: '',
};

// Initial sample grocery products for immediate testing
export const INITIAL_SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'PRD-1001',
    name: 'Fortune Sunlite Sunflower Oil 1L',
    category: 'Oils & Ghee',
    barcode: '8901234001011',
    purchasePrice: 135,
    sellingPrice: 160,
    quantity: 45,
    supplierName: 'Fortune Distributors',
    expiryDate: '2027-01-15',
    unit: 'packet',
    shelfLocation: 'Rack A - Shelf 2',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1002',
    name: 'Aashirvaad Shuddh Chakki Atta 5kg',
    category: 'Grains & Atta',
    barcode: '8901234001028',
    purchasePrice: 240,
    sellingPrice: 285,
    quantity: 30,
    supplierName: 'ITC Wholesale',
    expiryDate: '2026-12-30',
    unit: 'bag',
    shelfLocation: 'Rack B - Ground Floor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1003',
    name: 'Tata Salt Vacuum Evaporated 1kg',
    category: 'Spices & Salt',
    barcode: '8901234001035',
    purchasePrice: 22,
    sellingPrice: 28,
    quantity: 120,
    supplierName: 'Tata Consumer Products',
    unit: 'packet',
    shelfLocation: 'Rack C - Shelf 1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1004',
    name: 'Royal Sona Masoori Rice 5kg',
    category: 'Rice & Pulses',
    barcode: '8901234001042',
    purchasePrice: 320,
    sellingPrice: 380,
    quantity: 8, // Low stock on purpose
    supplierName: 'Sri Laxmi Rice Mill',
    unit: 'bag',
    shelfLocation: 'Rack B - Row 3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1005',
    name: 'Toor Dal Premium 1kg',
    category: 'Rice & Pulses',
    barcode: '8901234001059',
    purchasePrice: 140,
    sellingPrice: 168,
    quantity: 25,
    supplierName: 'Karnataka Pulses Traders',
    unit: 'kg',
    shelfLocation: 'Rack C - Shelf 3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1006',
    name: 'Tata Tea Premium 250g',
    category: 'Beverages',
    barcode: '8901234001066',
    purchasePrice: 110,
    sellingPrice: 135,
    quantity: 50,
    supplierName: 'Tata Consumer Products',
    unit: 'packet',
    shelfLocation: 'Rack A - Shelf 1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1007',
    name: 'Amul Butter Pasteurized 100g',
    category: 'Dairy & Bakery',
    barcode: '8901234001073',
    purchasePrice: 50,
    sellingPrice: 58,
    quantity: 18,
    supplierName: 'Amul Milk Dairy',
    expiryDate: '2026-08-20',
    unit: 'pcs',
    shelfLocation: 'Refrigerator 1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1008',
    name: 'Surf Excel Easy Wash Detergent Powder 1kg',
    category: 'Household',
    barcode: '8901234001080',
    purchasePrice: 115,
    sellingPrice: 142,
    quantity: 35,
    supplierName: 'Hindustan Unilever',
    unit: 'packet',
    shelfLocation: 'Rack D - Shelf 4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1009',
    name: 'Dettol Original Soap 125g (Pack of 3)',
    category: 'Personal Care',
    barcode: '8901234001097',
    purchasePrice: 120,
    sellingPrice: 148,
    quantity: 5, // Low stock
    supplierName: 'Reckitt Benckiser',
    unit: 'box',
    shelfLocation: 'Rack D - Shelf 1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1010',
    name: 'Colgate Strong Teeth Toothpaste 100g',
    category: 'Personal Care',
    barcode: '8901234001103',
    purchasePrice: 52,
    sellingPrice: 65,
    quantity: 40,
    supplierName: 'Colgate-Palmolive',
    unit: 'pcs',
    shelfLocation: 'Rack D - Shelf 2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1011',
    name: 'Britannia Good Day Butter Biscuits 100g',
    category: 'Snacks & Biscuits',
    barcode: '8901234001110',
    purchasePrice: 22,
    sellingPrice: 30,
    quantity: 60,
    supplierName: 'Britannia Agency',
    unit: 'packet',
    shelfLocation: 'Front Counter Display',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1012',
    name: 'Catch Turmeric Powder (Haldi) 100g',
    category: 'Spices & Salt',
    barcode: '8901234001127',
    purchasePrice: 32,
    sellingPrice: 42,
    quantity: 28,
    supplierName: 'Catch Spices',
    unit: 'packet',
    shelfLocation: 'Rack C - Shelf 2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'PRD-1013',
    name: 'Breakfast Festival Combo Pack (Tea + Biscuits)',
    category: 'Combos & Packs',
    barcode: '8901234009999',
    purchasePrice: 132,
    sellingPrice: 155,
    quantity: 15,
    supplierName: 'In-House Combo',
    unit: 'box',
    isCombo: true,
    comboItems: [
      { productId: 'PRD-1006', productName: 'Tata Tea Premium 250g', qty: 1 },
      { productId: 'PRD-1011', productName: 'Britannia Good Day Butter Biscuits 100g', qty: 1 }
    ],
    shelfLocation: 'Special Offer Display',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const INITIAL_SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-1001',
    name: 'Suresh Raina',
    phone: '9845011223',
    email: 'suresh.r@example.com',
    address: 'Flat 302, Green Acres Apt, Sector 4, Bangalore',
    gstNumber: '29AAACG1234H1Z1',
    birthday: '1988-11-27',
    notes: 'Regular morning customer. Prefers organic rice.',
    totalSpent: 12450,
    loyaltyPoints: 124,
    storeCredit: 250,
    outstandingDues: 0,
    tag: 'VIP',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'CUST-1002',
    name: 'Priya Sharma',
    phone: '9876500112',
    email: 'priya.sharma@example.com',
    address: 'House 45, Rosewood Layout, Sector 4',
    birthday: '1992-05-14',
    notes: 'Wholesale order customer for apartment canteen.',
    totalSpent: 28900,
    loyaltyPoints: 289,
    storeCredit: 0,
    outstandingDues: 1200,
    tag: 'Wholesale',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'CUST-1003',
    name: 'Anil Deshmukh',
    phone: '9900112233',
    address: 'Near Temple Gate, Sector 3',
    totalSpent: 3400,
    loyaltyPoints: 34,
    storeCredit: 100,
    outstandingDues: 450,
    tag: 'Regular',
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  }
];

export const INITIAL_SAMPLE_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-101',
    name: 'ITC Wholesale Ltd',
    companyName: 'ITC Agro Products',
    phone: '+91 98765 00002',
    email: 'orders@example-supplier.com',
    gstin: '29AAACI1234A1Z9',
    address: 'ITC Industrial Park, Peenya, Bangalore',
    paymentTerms: '15 Days Credit',
    outstandingBalance: 14500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'SUP-102',
    name: 'Fortune Distributors',
    companyName: 'Adani Wilmar Logistics',
    phone: '+91 98765 00003',
    email: 'supply@example-supplier.com',
    gstin: '29AAACA9876B1Z2',
    address: 'Godown 12, APMC Yard, Yeshwanthpur, Bangalore',
    paymentTerms: 'Immediate / Cash',
    outstandingBalance: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'SUP-103',
    name: 'Tata Consumer Products',
    companyName: 'Tata Consumer Brands',
    phone: '+91 98765 00004',
    email: 'distributor@example-supplier.com',
    gstin: '29AAACT5544C1Z0',
    address: 'Tower B, Electronic City, Bangalore',
    paymentTerms: '30 Days Net',
    outstandingBalance: 8200,
    createdAt: new Date().toISOString(),
  }
];

export const INITIAL_SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: 'EMP-01',
    name: 'Store Admin',
    phone: '',
    address: '',
    salary: 0,
    joiningDate: new Date().toISOString().split('T')[0],
    role: 'Owner',
    pin: '1234',
    status: 'Active',
  }
];

export const INITIAL_SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'EXP-101',
    title: 'Shop Monthly Rent',
    category: 'Rent',
    amount: 18000,
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Bank',
    notes: 'Paid to shop landlord Mr. Varma via NEFT',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'EXP-102',
    title: 'BESCOM Electricity Bill',
    category: 'Electricity',
    amount: 3200,
    date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    paymentMode: 'UPI',
    notes: 'Refrigeration and shop lights bill',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'EXP-103',
    title: 'Airtel Broadband Internet',
    category: 'Internet',
    amount: 999,
    date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    paymentMode: 'UPI',
    notes: 'Monthly high speed plan',
    createdAt: new Date().toISOString(),
  }
];

export const INITIAL_SAMPLE_SALES: Sale[] = [
  {
    id: 'SALE-101',
    invoiceNumber: 'INV-2026-0001',
    dateTime: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    customerId: 'CUST-1001',
    customerName: 'Suresh Raina',
    customerPhone: '9845011223',
    items: [
      {
        id: 'SI-1',
        productId: 'PRD-1001',
        productName: 'Fortune Sunlite Sunflower Oil 1L',
        barcode: '8901234001011',
        unitPurchasePrice: 135,
        unitSellingPrice: 160,
        quantity: 2,
        totalPrice: 320,
      },
      {
        id: 'SI-2',
        productId: 'PRD-1003',
        productName: 'Tata Salt Vacuum Evaporated 1kg',
        barcode: '8901234001035',
        unitPurchasePrice: 22,
        unitSellingPrice: 28,
        quantity: 1,
        totalPrice: 28,
      }
    ],
    subtotal: 348,
    taxPercent: 0,
    taxAmount: 0,
    discountAmount: 8,
    totalAmount: 340,
    receivedAmount: 500,
    changeAmount: 160,
    paymentMode: 'Cash',
    totalProfit: 48,
    status: 'Completed',
    cashierName: 'Kavitha S',
  },
  {
    id: 'SALE-102',
    invoiceNumber: 'INV-2026-0002',
    dateTime: new Date(Date.now() - 3600 * 1000 * 1.5).toISOString(),
    customerId: 'CUST-1002',
    customerName: 'Priya Sharma',
    customerPhone: '9876500112',
    items: [
      {
        id: 'SI-3',
        productId: 'PRD-1002',
        productName: 'Aashirvaad Shuddh Chakki Atta 5kg',
        barcode: '8901234001028',
        unitPurchasePrice: 240,
        unitSellingPrice: 285,
        quantity: 1,
        totalPrice: 285,
      },
      {
        id: 'SI-4',
        productId: 'PRD-1007',
        productName: 'Amul Butter Pasteurized 100g',
        barcode: '8901234001073',
        unitPurchasePrice: 50,
        unitSellingPrice: 58,
        quantity: 2,
        totalPrice: 116,
      }
    ],
    subtotal: 401,
    taxPercent: 0,
    taxAmount: 0,
    discountAmount: 1,
    totalAmount: 400,
    receivedAmount: 400,
    changeAmount: 0,
    paymentMode: 'UPI',
    totalProfit: 61,
    status: 'Completed',
    cashierName: 'Rajesh Kumar',
  }
];

const memoryStorage = new Map<string, string>();
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch {}
    return memoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStorage.delete(key);
  },
  clear: (): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
        return;
      }
    } catch {}
    memoryStorage.clear();
  }
};

export class LegacyLocalStorageEngine {
  private settings: ShopSettings;
  private products: Product[];
  private sales: Sale[];
  private stockLogs: IncomingStockLog[];
  private customers: Customer[];
  private suppliers: Supplier[];
  private purchaseOrders: PurchaseOrder[];
  private expenses: Expense[];
  private employees: Employee[];
  private attendance: AttendanceRecord[];
  private heldBills: HeldBill[];
  private returns: SaleReturn[];
  private auditLogs: AuditLog[];
  private branches: Branch[];
  private cashShifts: CashRegisterShift[];
  private cashTxns: CashTransaction[];
  private priceHistory: PriceHistoryRecord[];
  private categories: CategoryNode[];
  private customerLedgers: CustomerLedgerEntry[];
  private recycleBin: RecycleBinItem[];
  private updates: UpdatePackage[];
  private currentUser: Employee | null = null;

  constructor() {
    // Automatically purge old demo data from v1 when upgrading to production clean slate
    try {
      if (typeof localStorage !== 'undefined') {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('grocery_pos_') && k.endsWith('_v1')) {
            localStorage.removeItem(k);
          }
        });
      }
    } catch {}

    this.settings = this.loadData(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    this.products = this.loadData(STORAGE_KEYS.PRODUCTS, []);
    this.sales = this.loadData(STORAGE_KEYS.SALES, []);
    this.stockLogs = this.loadData(STORAGE_KEYS.STOCK_LOGS, []);
    this.customers = this.loadData(STORAGE_KEYS.CUSTOMERS, []);
    this.suppliers = this.loadData(STORAGE_KEYS.SUPPLIERS, []);
    this.purchaseOrders = this.loadData(STORAGE_KEYS.PURCHASE_ORDERS, []);
    this.expenses = this.loadData(STORAGE_KEYS.EXPENSES, []);
    this.employees = this.loadData(STORAGE_KEYS.EMPLOYEES, INITIAL_SAMPLE_EMPLOYEES);
    this.attendance = this.loadData(STORAGE_KEYS.ATTENDANCE, []);
    this.heldBills = this.loadData(STORAGE_KEYS.HELD_BILLS, []);
    this.returns = this.loadData(STORAGE_KEYS.RETURNS, []);
    this.auditLogs = this.loadData(STORAGE_KEYS.AUDIT_LOGS, []);
    this.branches = this.loadData(STORAGE_KEYS.BRANCHES, INITIAL_SAMPLE_BRANCHES);
    this.cashShifts = this.loadData(STORAGE_KEYS.CASH_SHIFTS, []);
    this.cashTxns = this.loadData(STORAGE_KEYS.CASH_TXNS, []);
    this.priceHistory = this.loadData(STORAGE_KEYS.PRICE_HISTORY, []);
    this.categories = this.loadData(STORAGE_KEYS.CATEGORIES, INITIAL_SAMPLE_CATEGORIES);
    this.customerLedgers = this.loadData(STORAGE_KEYS.CUSTOMER_LEDGERS, []);
    this.recycleBin = this.loadData(STORAGE_KEYS.RECYCLE_BIN, []);
    this.updates = this.loadData(STORAGE_KEYS.UPDATES, INITIAL_SAMPLE_UPDATES);

    this.currentUser = this.employees[0] || null;
    
    // Auto initialize an open cash register shift if none open today
    this.ensureActiveCashShift();
  }

  private loadData<T>(key: string, defaultValue: T): T {
    const raw = safeStorage.getItem(key);
    if (!raw) {
      safeStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  // --- Current Active User & Security PIN ---
  public getCurrentUser(): Employee | null {
    return this.currentUser;
  }

  public setCurrentUser(user: Employee | null): void {
    this.currentUser = user;
    if (user) {
      this.addAuditLog(user.name, 'User Login', `Logged in as ${user.role}`);
    }
  }

  public verifyEmployeePin(pin: string): Employee | null {
    if (!pin) return null;
    const cleanPin = pin.trim();

    // Check against employees with status !== 'Inactive'
    for (const emp of this.employees) {
      if (emp.status === 'Inactive') continue;
      if (verifyPin(cleanPin, emp.pin)) {
        return emp;
      }
    }
    return null;
  }

  // --- Settings ---
  public getSettings(): ShopSettings {
    return { ...this.settings };
  }

  public saveSettings(newSettings: Partial<ShopSettings>): ShopSettings {
    this.settings = { ...this.settings, ...newSettings };
    safeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    this.notify();
    this.addAuditLog(this.currentUser?.name || 'System', 'Update Settings', 'Shop settings updated');
    return this.settings;
  }

  // --- Products ---
  public getProducts(): Product[] {
    return [...this.products];
  }

  public getProductByBarcode(barcode: string): Product | undefined {
    const cleaned = barcode.trim();
    return this.products.find(p => p.barcode === cleaned || p.id === cleaned);
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  public saveProduct(productData: Partial<Product> & { name: string; barcode: string; purchasePrice: number; sellingPrice: number; quantity: number }): Product {
    const now = new Date().toISOString();
    let product: Product;

    if (productData.id) {
      const index = this.products.findIndex(p => p.id === productData.id);
      if (index !== -1) {
        const oldProduct = this.products[index];
        
        // Record Price History if price changed
        if (oldProduct.purchasePrice !== Number(productData.purchasePrice) || oldProduct.sellingPrice !== Number(productData.sellingPrice)) {
          this.recordPriceChange(
            oldProduct.id,
            oldProduct.name,
            oldProduct.purchasePrice,
            Number(productData.purchasePrice),
            oldProduct.sellingPrice,
            Number(productData.sellingPrice)
          );
        }

        product = {
          ...this.products[index],
          ...productData,
          updatedAt: now,
        };
        this.products[index] = product;
        this.addAuditLog(this.currentUser?.name || 'Admin', 'Update Product', `Updated product ${product.name}`);
      } else {
        product = {
          id: productData.id,
          name: productData.name,
          category: productData.category || 'General',
          barcode: productData.barcode,
          purchasePrice: Number(productData.purchasePrice),
          sellingPrice: Number(productData.sellingPrice),
          wholesalePrice: productData.wholesalePrice,
          distributorPrice: productData.distributorPrice,
          vipPrice: productData.vipPrice,
          quantity: Number(productData.quantity),
          supplierName: productData.supplierName || 'General Supplier',
          expiryDate: productData.expiryDate,
          mfgDate: productData.mfgDate,
          batchNumber: productData.batchNumber,
          shelfLocation: productData.shelfLocation || 'Main Display',
          unit: productData.unit || 'pcs',
          createdAt: now,
          updatedAt: now,
        };
        this.products.push(product);
        this.addAuditLog(this.currentUser?.name || 'Admin', 'Add Product', `Created product ${product.name}`);
      }
    } else {
      const nextId = `PRD-${1000 + this.products.length + 1}`;
      product = {
        id: nextId,
        name: productData.name,
        category: productData.category || 'General',
        barcode: productData.barcode || generateEAN13(),
        purchasePrice: Number(productData.purchasePrice),
        sellingPrice: Number(productData.sellingPrice),
        wholesalePrice: productData.wholesalePrice,
        distributorPrice: productData.distributorPrice,
        vipPrice: productData.vipPrice,
        quantity: Number(productData.quantity),
        supplierName: productData.supplierName || 'General Supplier',
        expiryDate: productData.expiryDate,
        mfgDate: productData.mfgDate,
        batchNumber: productData.batchNumber,
        shelfLocation: productData.shelfLocation || 'Main Display',
        unit: productData.unit || 'pcs',
        createdAt: now,
        updatedAt: now,
      };
      this.products.push(product);
      this.addAuditLog(this.currentUser?.name || 'Admin', 'Add Product', `Created product ${product.name}`);
    }

    this.persistProducts();
    return product;
  }

  public deleteProduct(id: string): boolean {
    const prod = this.getProductById(id);
    const initialLen = this.products.length;
    this.products = this.products.filter(p => p.id !== id);
    if (this.products.length !== initialLen) {
      this.persistProducts();
      if (prod) {
        this.moveToRecycleBin('Product', prod.id, prod.name, prod);
        this.addAuditLog(this.currentUser?.name || 'Admin', 'Delete Product', `Moved product ${prod.name} to Recycle Bin`);
      }
      return true;
    }
    return false;
  }

  // --- Incoming Stock ---
  public addStock(
    productId: string, 
    quantityToAdd: number, 
    newPurchasePrice?: number, 
    newSellingPrice?: number, 
    supplierName?: string
  ): Product | undefined {
    const product = this.getProductById(productId);
    if (!product) return undefined;

    const previousQuantity = product.quantity;
    const newQuantity = previousQuantity + Number(quantityToAdd);

    product.quantity = newQuantity;
    if (newPurchasePrice !== undefined && newPurchasePrice > 0) {
      product.purchasePrice = Number(newPurchasePrice);
    }
    if (newSellingPrice !== undefined && newSellingPrice > 0) {
      product.sellingPrice = Number(newSellingPrice);
    }
    if (supplierName) {
      product.supplierName = supplierName;
    }
    product.updatedAt = new Date().toISOString();

    const log: IncomingStockLog = {
      id: `LOG-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      quantityAdded: Number(quantityToAdd),
      previousQuantity,
      newQuantity,
      purchasePrice: product.purchasePrice,
      supplierName: supplierName || product.supplierName,
      dateTime: new Date().toISOString(),
    };

    this.stockLogs.unshift(log);
    this.persistProducts();
    this.persistStockLogs();
    this.addAuditLog(this.currentUser?.name || 'Staff', 'Add Stock', `Added ${quantityToAdd} units to ${product.name}`);

    return product;
  }

  // --- Customers ---
  public getCustomers(): Customer[] {
    return [...this.customers];
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find(c => c.id === id);
  }

  public saveCustomer(custData: Partial<Customer> & { name: string; phone: string }): Customer {
    let cust: Customer;
    if (custData.id) {
      const idx = this.customers.findIndex(c => c.id === custData.id);
      if (idx !== -1) {
        const oldDues = Number(this.customers[idx].outstandingDues || 0);
        cust = { ...this.customers[idx], ...custData };
        this.customers[idx] = cust;

        // If outstanding dues was manually adjusted, record ledger entry
        if (custData.outstandingDues !== undefined && Number(custData.outstandingDues) !== oldDues) {
          const duesDiff = Number(custData.outstandingDues) - oldDues;
          if (duesDiff > 0) {
            this.addCustomerLedgerEntry(cust.id, 'Adjustment', `ADJ-${Date.now()}`, duesDiff, 0, 'Manual dues balance increase');
          } else if (duesDiff < 0) {
            this.addCustomerLedgerEntry(cust.id, 'Adjustment', `ADJ-${Date.now()}`, 0, Math.abs(duesDiff), 'Manual dues balance decrease');
          }
        }
      } else {
        cust = {
          id: custData.id,
          name: custData.name,
          phone: custData.phone,
          email: custData.email,
          address: custData.address,
          gstNumber: custData.gstNumber,
          birthday: custData.birthday,
          notes: custData.notes,
          totalSpent: custData.totalSpent || 0,
          loyaltyPoints: custData.loyaltyPoints || 0,
          storeCredit: custData.storeCredit || 0,
          outstandingDues: custData.outstandingDues || 0,
          tag: custData.tag || 'Regular',
          createdAt: new Date().toISOString(),
        };
        this.customers.push(cust);

        if (cust.outstandingDues > 0) {
          this.addCustomerLedgerEntry(cust.id, 'Adjustment', `OPENING-${Date.now()}`, cust.outstandingDues, 0, 'Opening balance dues');
        }
      }
    } else {
      cust = {
        id: `CUST-${1000 + this.customers.length + 1}`,
        name: custData.name,
        phone: custData.phone,
        email: custData.email,
        address: custData.address,
        gstNumber: custData.gstNumber,
        birthday: custData.birthday,
        notes: custData.notes,
        totalSpent: 0,
        loyaltyPoints: 0,
        storeCredit: 0,
        outstandingDues: custData.outstandingDues || 0,
        tag: custData.tag || 'Regular',
        createdAt: new Date().toISOString(),
      };
      this.customers.push(cust);

      if (cust.outstandingDues > 0) {
        this.addCustomerLedgerEntry(cust.id, 'Adjustment', `OPENING-${Date.now()}`, cust.outstandingDues, 0, 'Opening balance dues');
      }
    }
    this.persistCustomers();
    this.addAuditLog(this.currentUser?.name || 'Staff', 'Save Customer', `Saved customer ${cust.name}`);
    return cust;
  }

  public deleteCustomer(id: string): boolean {
    const customer = this.getCustomerById(id);
    this.customers = this.customers.filter(c => c.id !== id);
    this.persistCustomers();
    if (customer) {
      this.addAuditLog(this.currentUser?.name || 'Admin', 'Delete Customer', `Deleted customer ${customer.name}`);
    }
    return true;
  }

  public payCustomerDues(
    customerId: string,
    amount: number,
    paymentMode: 'Cash' | 'UPI' | 'Card' = 'Cash',
    note?: string
  ): boolean {
    const cust = this.getCustomerById(customerId);
    if (!cust) return false;
    cust.outstandingDues = Math.max(0, cust.outstandingDues - amount);
    this.persistCustomers();

    // Also record a ledger entry for full Khata audit trail
    this.addCustomerLedgerEntry(
      customerId,
      'PaymentReceived',
      `PAY-${Date.now()}`,
      0,
      amount,
      note || `Payment received towards dues (${paymentMode})`
    );

    // If collected in cash, record inflow to active cash drawer shift
    if (paymentMode === 'Cash' && amount > 0) {
      this.addCashTransaction('CashIn', amount, `Khata dues collected from ${cust.name}`);
    }

    this.addAuditLog(this.currentUser?.name || 'Cashier', 'Customer Dues Payment', `Cleared ${amount} dues for ${cust.name}`);
    return true;
  }

  // --- Suppliers ---
  public getSuppliers(): Supplier[] {
    return [...this.suppliers];
  }

  public getSupplierById(id: string): Supplier | undefined {
    return this.suppliers.find(s => s.id === id);
  }

  public saveSupplier(supData: Partial<Supplier> & { name: string; companyName: string; phone: string }): Supplier {
    let sup: Supplier;
    if (supData.id) {
      const idx = this.suppliers.findIndex(s => s.id === supData.id);
      if (idx !== -1) {
        sup = { ...this.suppliers[idx], ...supData };
        this.suppliers[idx] = sup;
      } else {
        sup = {
          id: supData.id,
          name: supData.name,
          companyName: supData.companyName,
          phone: supData.phone,
          email: supData.email,
          gstin: supData.gstin,
          address: supData.address,
          paymentTerms: supData.paymentTerms,
          outstandingBalance: supData.outstandingBalance || 0,
          createdAt: new Date().toISOString(),
        };
        this.suppliers.push(sup);
      }
    } else {
      sup = {
        id: `SUP-${100 + this.suppliers.length + 1}`,
        name: supData.name,
        companyName: supData.companyName,
        phone: supData.phone,
        email: supData.email,
        gstin: supData.gstin,
        address: supData.address,
        paymentTerms: supData.paymentTerms || 'Cash on Delivery',
        outstandingBalance: 0,
        createdAt: new Date().toISOString(),
      };
      this.suppliers.push(sup);
    }
    this.persistSuppliers();
    return sup;
  }

  public deleteSupplier(id: string): boolean {
    const supplier = this.getSupplierById(id);
    this.suppliers = this.suppliers.filter(s => s.id !== id);
    this.persistSuppliers();
    if (supplier) {
      this.addAuditLog(this.currentUser?.name || 'Admin', 'Delete Supplier', `Deleted supplier ${supplier.name}`);
    }
    return true;
  }

  // --- Purchase Orders ---
  public getPurchaseOrders(): PurchaseOrder[] {
    return [...this.purchaseOrders];
  }

  public savePurchaseOrder(poData: Partial<PurchaseOrder> & { supplierId: string; supplierName: string; items: any[]; totalAmount: number }): PurchaseOrder {
    const poNumber = poData.poNumber || `PO-${new Date().getFullYear()}-${String(this.purchaseOrders.length + 1).padStart(4, '0')}`;
    const po: PurchaseOrder = {
      id: poData.id || `PO-${Date.now()}`,
      poNumber,
      supplierId: poData.supplierId,
      supplierName: poData.supplierName,
      orderDate: poData.orderDate || new Date().toISOString().split('T')[0],
      status: poData.status || 'Draft',
      items: poData.items,
      totalAmount: poData.totalAmount,
      notes: poData.notes,
    };

    if (poData.id) {
      const idx = this.purchaseOrders.findIndex(p => p.id === poData.id);
      if (idx !== -1) this.purchaseOrders[idx] = po;
      else this.purchaseOrders.unshift(po);
    } else {
      this.purchaseOrders.unshift(po);
    }

    this.persistPurchaseOrders();
    this.addAuditLog(this.currentUser?.name || 'Manager', 'Purchase Order', `Saved PO #${po.poNumber}`);
    return po;
  }

  public markPOAsReceived(poId: string): boolean {
    const po = this.purchaseOrders.find(p => p.id === poId);
    if (!po || po.status === 'Received') return false;

    // Automatically increase inventory stock for each item in the PO
    po.items.forEach(item => {
      this.addStock(item.productId, item.qty, item.purchasePrice, undefined, po.supplierName);
    });

    po.status = 'Received';
    po.receivedDate = new Date().toISOString().split('T')[0];
    this.persistPurchaseOrders();
    this.addAuditLog(this.currentUser?.name || 'Inventory Staff', 'Receive PO', `Marked PO #${po.poNumber} as Received`);
    return true;
  }

  // --- Expenses ---
  public getExpenses(): Expense[] {
    return [...this.expenses];
  }

  public saveExpense(expData: Partial<Expense> & { title: string; category: any; amount: number; date: string }): Expense {
    const exp: Expense = {
      id: expData.id || `EXP-${Date.now()}`,
      title: expData.title,
      category: expData.category,
      amount: Number(expData.amount),
      date: expData.date,
      paymentMode: expData.paymentMode || 'Cash',
      notes: expData.notes,
      createdAt: new Date().toISOString(),
    };

    if (expData.id) {
      const idx = this.expenses.findIndex(e => e.id === expData.id);
      if (idx !== -1) this.expenses[idx] = exp;
      else this.expenses.unshift(exp);
    } else {
      this.expenses.unshift(exp);
    }

    this.persistExpenses();
    if (exp.paymentMode === 'Cash' && exp.amount > 0) {
      this.addCashTransaction('CashOut', exp.amount, `Expense: ${exp.title}`);
    }
    this.addAuditLog(this.currentUser?.name || 'Accountant', 'Save Expense', `Recorded expense: ${exp.title} (${exp.amount})`);
    return exp;
  }

  public deleteExpense(id: string): boolean {
    const expense = this.expenses.find(e => e.id === id);
    this.expenses = this.expenses.filter(e => e.id !== id);
    this.persistExpenses();
    if (expense) {
      this.addAuditLog(this.currentUser?.name || 'Admin', 'Delete Expense', `Deleted expense ${expense.title || expense.category} (${expense.amount})`);
    }
    return true;
  }

  // --- Employees & Attendance ---
  public getEmployees(): Employee[] {
    return [...this.employees];
  }

  public saveEmployee(empData: Partial<Employee> & { name: string; phone: string; role: any; pin: string }): Employee {
    let emp: Employee;

    // Hash PIN if it is a new plain-text PIN, otherwise keep existing hash
    const rawPin = empData.pin || '1234';
    const finalPin = rawPin.startsWith('sha256:') ? rawPin : typeof hashPin !== 'undefined' ? hashPin(rawPin) : rawPin;

    if (empData.id) {
      const idx = this.employees.findIndex(e => e.id === empData.id);
      if (idx !== -1) {
        emp = { ...this.employees[idx], ...empData, pin: finalPin };
        this.employees[idx] = emp;
      } else {
        emp = {
          id: empData.id,
          name: empData.name,
          phone: empData.phone,
          address: empData.address || '',
          salary: empData.salary || 18000,
          joiningDate: empData.joiningDate || new Date().toISOString().split('T')[0],
          role: empData.role,
          pin: finalPin,
          photoUrl: empData.photoUrl,
          status: empData.status || 'Active',
        };
        this.employees.push(emp);
      }
    } else {
      emp = {
        id: `EMP-${String(this.employees.length + 1).padStart(2, '0')}`,
        name: empData.name,
        phone: empData.phone,
        address: empData.address || '',
        salary: empData.salary || 18000,
        joiningDate: empData.joiningDate || new Date().toISOString().split('T')[0],
        role: empData.role,
        pin: finalPin,
        photoUrl: empData.photoUrl,
        status: 'Active',
      };
      this.employees.push(emp);
    }
    this.persistEmployees();
    return emp;
  }

  public getAttendance(): AttendanceRecord[] {
    return [...this.attendance];
  }

  public checkInEmployee(employeeId: string): AttendanceRecord | null {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const existing = this.attendance.find(a => a.employeeId === employeeId && a.date === todayStr);

    if (existing) return existing;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isLate = now.getHours() >= 10;

    const record: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      date: todayStr,
      checkInTime: timeStr,
      status: isLate ? 'Late' : 'Present',
    };

    this.attendance.unshift(record);
    this.persistAttendance();
    this.addAuditLog(emp.name, 'Check In', `Checked in at ${timeStr}`);
    return record;
  }

  public checkOutEmployee(employeeId: string): AttendanceRecord | null {
    const todayStr = new Date().toISOString().split('T')[0];
    const record = this.attendance.find(a => a.employeeId === employeeId && a.date === todayStr);

    if (!record) return null;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    record.checkOutTime = timeStr;

    // Calculate actual working hours between check-in and check-out
    let hoursWorked = 8; // fallback default
    if (record.checkInTime) {
      const todayDate = record.date || todayStr;
      const checkInDate = new Date(`${todayDate} ${record.checkInTime}`);
      const checkOutDate = new Date(`${todayDate} ${timeStr}`);
      if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        const diffMs = checkOutDate.getTime() - checkInDate.getTime();
        if (diffMs > 0) {
          hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        }
      }
    }
    record.workingHours = hoursWorked;

    this.persistAttendance();
    this.addAuditLog(record.employeeName, 'Check Out', `Checked out at ${timeStr} (${hoursWorked} hrs)`);
    return record;
  }

  // --- Held Bills ---
  public getHeldBills(): HeldBill[] {
    return [...this.heldBills];
  }

  public saveHeldBill(customerName: string, customerPhone: string, cartItems: CartItem[], note?: string): HeldBill {
    const bill: HeldBill = {
      id: `HOLD-${Date.now()}`,
      customerName: customerName || 'Walk-in Customer',
      customerPhone,
      cartItems,
      timestamp: new Date().toISOString(),
      note,
      cashierName: this.currentUser?.name || 'Cashier',
    };
    this.heldBills.unshift(bill);
    this.persistHeldBills();
    this.addAuditLog(this.currentUser?.name || 'Cashier', 'Hold Bill', `Held bill with ${cartItems.length} items`);
    return bill;
  }

  public deleteHeldBill(id: string): void {
    this.heldBills = this.heldBills.filter(h => h.id !== id);
    this.persistHeldBills();
  }

  public getNextInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = `${this.settings.invoicePrefix}-${year}-`;

    // Find max existing invoice number for this year to prevent duplicates
    const yearSales = this.sales.filter(s => s.invoiceNumber?.startsWith(prefix));
    const maxNum = yearSales.reduce((max, sale) => {
      const numPart = sale.invoiceNumber?.split('-').pop();
      const num = numPart ? parseInt(numPart, 10) : 0;
      return Math.max(max, isNaN(num) ? 0 : num);
    }, 0);

    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
  }

  // --- POS Record Sale with Split Payments, Dues, and Loyalty ---
  public recordSale(
    cartItems: CartItem[],
    customerName: string = '',
    customerPhone: string = '',
    paymentMode: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Split' = 'Cash',
    receivedAmount: number = 0,
    discountAmount: number = 0,
    taxPercent: number = 0,
    notes: string = '',
    customerId?: string,
    splitPayments?: any[]
  ): Sale {
    const now = new Date();
    const invoiceNumber = this.getNextInvoiceNumber(); // Use the collision-safe method

    let subtotal = 0;
    let totalProfit = 0;

    const saleItems: SaleItem[] = cartItems.map((item, index) => {
      const lineTotal = item.totalPrice;
      subtotal += lineTotal;

      let lineProfit = (item.unitSellingPrice - item.product.purchasePrice) * item.quantity;

      // Automatically reduce stock quantity in inventory with FIFO batch depletion
      const product = this.getProductById(item.product.id);
      if (product) {
        // FIFO Batch depletion if batches exist
        if (product.batches && product.batches.length > 0) {
          const { updatedBatches, totalCost } = deductFifoBatches(product.batches, item.quantity);
          product.batches = updatedBatches.map(b => ({
            ...b,
            id: b.id || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          }));
          if (totalCost > 0) {
            lineProfit = lineTotal - totalCost;
          }
        }

        // Combo item component deduction
        if (product.isCombo && product.comboItems && product.comboItems.length > 0) {
          for (const ci of product.comboItems) {
            const compProduct = this.getProductById(ci.productId);
            if (compProduct) {
              const compQty = (ci.qty || 1) * item.quantity;
              compProduct.quantity = Math.max(0, compProduct.quantity - compQty);
              compProduct.updatedAt = now.toISOString();
            }
          }
        }

        product.quantity = Math.max(0, product.quantity - item.quantity);
        product.updatedAt = now.toISOString();
      }

      totalProfit += lineProfit;

      return {
        id: `SI-${index + 1}`,
        productId: item.product.id,
        productName: item.product.name,
        barcode: item.product.barcode,
        unitPurchasePrice: item.product.purchasePrice,
        unitSellingPrice: item.unitSellingPrice,
        quantity: item.quantity,
        totalPrice: lineTotal,
        variantName: item.selectedVariant?.name,
      };
    });

    const taxAmount = (subtotal - discountAmount) * (taxPercent / 100);
    const totalAmount = Math.round(subtotal - discountAmount + taxAmount);
    const actualReceived = receivedAmount > 0 ? receivedAmount : totalAmount;
    const changeAmount = Math.max(0, actualReceived - totalAmount);

    const sale: Sale = {
      id: `SALE-${Date.now()}`,
      invoiceNumber,
      dateTime: now.toISOString(),
      customerId,
      customerName: customerName || 'Walk-in Customer',
      customerPhone,
      items: saleItems,
      subtotal,
      taxPercent,
      taxAmount,
      discountAmount,
      totalAmount,
      receivedAmount: actualReceived,
      changeAmount,
      paymentMode,
      splitPayments,
      totalProfit: totalProfit - discountAmount,
      status: 'Completed',
      notes,
      cashierName: this.currentUser?.name || 'Cashier',
    };

    // Update customer stats if matched (prioritize customerId first)
    if (customerId || customerPhone) {
      const cust = customerId
        ? this.customers.find(c => c.id === customerId)
        : this.customers.find(c => customerPhone && c.phone === customerPhone);

      if (cust) {
        cust.totalSpent += totalAmount;
        if (this.settings.enableLoyalty) {
          cust.loyaltyPoints += Math.floor(totalAmount / (this.settings.loyaltyPointRatio || 100));
        }

        let creditDue = 0;
        if (paymentMode === 'Credit') {
          creditDue = Math.max(0, totalAmount - receivedAmount);
        } else if (paymentMode === 'Split' && Array.isArray(splitPayments)) {
          for (const sp of splitPayments) {
            if (sp.mode === 'Store Credit' || sp.mode === 'Credit') {
              creditDue += Number(sp.amount || 0);
            }
          }
        }

        if (creditDue > 0) {
          cust.outstandingDues += creditDue;
          this.addCustomerLedgerEntry(cust.id, 'SaleCredit', invoiceNumber, creditDue, 0, `Credit sale ${invoiceNumber}`);
        }
        this.persistCustomers();
      }
    }

    this.sales.unshift(sale);
    this.persistProducts();
    this.persistSales();
    this.addAuditLog(this.currentUser?.name || 'Cashier', 'New Sale', `Invoice ${invoiceNumber} total ${totalAmount}`);

    return sale;
  }

  // --- Returns & Refunds ---
  public getReturns(): SaleReturn[] {
    return [...this.returns];
  }

  public recordReturn(
    saleId: string,
    itemsToReturn: { productId: string; productName: string; qty: number; unitPrice: number }[],
    refundAmount: number,
    reason: 'Defective' | 'Expired' | 'Wrong Item' | 'Customer Changed Mind'
  ): SaleReturn | null {
    const sale = this.sales.find(s => s.id === saleId);
    if (!sale) return null;

    // Adjust product inventory back into stock
    itemsToReturn.forEach(item => {
      const prod = this.getProductById(item.productId);
      if (prod) {
        prod.quantity += item.qty;
        prod.updatedAt = new Date().toISOString();
      }
    });

    // Check if partial or full return
    const totalSaleItemsQty = (sale.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
    const returnedQty = itemsToReturn.reduce((acc, i) => acc + (i.qty || 0), 0);
    sale.status = returnedQty >= totalSaleItemsQty ? 'Refunded' : 'Partially Refunded';

    // Record cash drawer payout if shift is open
    const currentShift = this.getCurrentCashShift();
    if (currentShift && refundAmount > 0) {
      this.addCashTransaction(
        'CashOut',
        refundAmount,
        `Refund payout for invoice ${sale.invoiceNumber}: ${reason}`
      );
    }

    // Adjust customer dues if original sale was on Credit
    if (sale.customerId || sale.customerPhone) {
      const cust = sale.customerId
        ? this.customers.find(c => c.id === sale.customerId)
        : this.customers.find(c => sale.customerPhone && c.phone === sale.customerPhone);

      if (cust && (sale.paymentMode === 'Credit' || sale.paymentMode === 'Split')) {
        let creditPortion = 0;
        if (sale.paymentMode === 'Credit') {
          creditPortion = sale.totalAmount;
        } else if (sale.paymentMode === 'Split' && Array.isArray(sale.splitPayments)) {
          for (const sp of sale.splitPayments) {
            if (sp.mode === 'Store Credit') {
              creditPortion += Number(sp.amount || 0);
            }
          }
        }

        if (creditPortion > 0 && cust.outstandingDues > 0) {
          const duesReduction = Math.min(cust.outstandingDues, refundAmount);
          cust.outstandingDues = Math.max(0, cust.outstandingDues - duesReduction);
          this.addCustomerLedgerEntry(
            cust.id,
            'Adjustment',
            `RET-${sale.invoiceNumber}`,
            0,
            duesReduction,
            `Refund credit adjustment for invoice ${sale.invoiceNumber}`
          );
          this.persistCustomers();
        }
      }
    }

    const returnRec: SaleReturn = {
      id: `RET-${Date.now()}`,
      returnInvoiceNumber: `RET-${sale.invoiceNumber}`,
      originalInvoiceNumber: sale.invoiceNumber,
      saleId: sale.id,
      date: new Date().toISOString(),
      customerName: sale.customerName || 'Walk-in Customer',
      refundAmount,
      reason,
      items: itemsToReturn,
    };

    this.returns.unshift(returnRec);
    this.persistProducts();
    this.persistSales();
    this.persistReturns();
    this.addAuditLog(this.currentUser?.name || 'Cashier', 'Process Refund', `Refunded ${refundAmount} for bill ${sale.invoiceNumber} (${sale.status})`);

    return returnRec;
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public addAuditLog(user: string, action: string, details: string): void {
    const log: AuditLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      details,
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 200) this.auditLogs.pop(); // Keep latest 200 logs
    this.persistAuditLogs();
  }

  public getSales(): Sale[] {
    return [...this.sales];
  }

  public getSaleByInvoice(invoiceNumber: string): Sale | undefined {
    const q = (invoiceNumber || '').trim().toLowerCase();
    if (!q) return undefined;
    return this.sales.find(s => 
      s.invoiceNumber.trim().toLowerCase() === q || 
      s.id.trim().toLowerCase() === q
    );
  }

  public cancelSale(saleId: string): boolean {
    const sale = this.sales.find(s => s.id === saleId);
    if (!sale || sale.status === 'Cancelled') return false;

    // Restore stock back to products
    sale.items.forEach(item => {
      const product = this.getProductById(item.productId);
      if (product) {
        product.quantity += item.quantity;
        product.updatedAt = new Date().toISOString();
      }
    });

    // Reverse customer Khata debt and loyalty points if applicable
    if (sale.customerId || sale.customerPhone) {
      const cust = sale.customerId
        ? this.customers.find(c => c.id === sale.customerId)
        : this.customers.find(c => sale.customerPhone && c.phone === sale.customerPhone);

      if (cust) {
        let creditToReverse = 0;
        if (sale.paymentMode === 'Credit') {
          creditToReverse = Math.max(0, sale.totalAmount - sale.receivedAmount);
        } else if (sale.paymentMode === 'Split' && Array.isArray(sale.splitPayments)) {
          for (const sp of sale.splitPayments) {
            if (sp.mode === 'Store Credit') {
              creditToReverse += Number(sp.amount || 0);
            }
          }
        }

        if (creditToReverse > 0 && cust.outstandingDues > 0) {
          cust.outstandingDues = Math.max(0, cust.outstandingDues - creditToReverse);
          this.addCustomerLedgerEntry(
            cust.id,
            'Adjustment',
            `CANCEL-${sale.invoiceNumber}`,
            0,
            creditToReverse,
            `Reversal of dues for cancelled bill ${sale.invoiceNumber}`
          );
        }

        // Reverse loyalty points if awarded
        if (this.settings.enableLoyalty) {
          const pointsToDeduct = Math.floor(sale.totalAmount / (this.settings.loyaltyPointRatio || 100));
          cust.loyaltyPoints = Math.max(0, cust.loyaltyPoints - pointsToDeduct);
        }

        cust.totalSpent = Math.max(0, cust.totalSpent - sale.totalAmount);
        this.persistCustomers();
      }
    }

    sale.status = 'Cancelled';
    this.persistProducts();
    this.persistSales();
    this.addAuditLog(this.currentUser?.name || 'Cashier', 'Cancel Sale', `Cancelled invoice ${sale.invoiceNumber}`);

    return true;
  }

  public getStockLogs(): IncomingStockLog[] {
    return [...this.stockLogs];
  }

  // --- Metrics ---
  public getMetrics(): DashboardMetrics {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const todaySalesList = this.sales.filter(s => 
      s.status === 'Completed' && s.dateTime.startsWith(todayStr)
    );

    const todaySalesAmount = todaySalesList.reduce((acc, s) => acc + s.totalAmount, 0);
    const todaySalesCount = todaySalesList.length;
    const todayProfit = todaySalesList.reduce((acc, s) => acc + s.totalProfit, 0);

    const todayExpenses = this.expenses
      .filter(e => e.date === todayStr)
      .reduce((acc, e) => acc + e.amount, 0);

    const netProfitToday = todayProfit - todayExpenses;

    const totalProductsCount = this.products.length;
    const totalAvailableStock = this.products.reduce((acc, p) => acc + p.quantity, 0);
    const lowStockCount = this.products.filter(p => p.quantity <= (p.minStockLevel || this.settings.lowStockThreshold)).length;

    const expiringCount = this.products.filter(p => {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate).getTime();
      const thirtyDaysFromNow = Date.now() + 30 * 24 * 3600 * 1000;
      return exp <= thirtyDaysFromNow;
    }).length;

    const totalProfitAllTime = this.sales
      .filter(s => s.status === 'Completed')
      .reduce((acc, s) => acc + s.totalProfit, 0);

    const totalCustomerDues = this.customers.reduce((acc, c) => acc + (c.outstandingDues || 0), 0);

    return {
      todaySalesAmount,
      todaySalesCount,
      todayProfit,
      todayExpenses,
      netProfitToday,
      totalProductsCount,
      totalAvailableStock,
      lowStockCount,
      expiringCount,
      totalProfitAllTime,
      totalCustomerDues,
      heldBillsCount: this.heldBills.length,
    };
  }

  // --- MODULE 28: Multi-Branch ---
  public getBranches(): Branch[] {
    return [...this.branches];
  }

  public saveBranch(branchData: Partial<Branch> & { name: string; code: string }): Branch {
    let b: Branch;
    if (branchData.id) {
      const idx = this.branches.findIndex(item => item.id === branchData.id);
      if (idx !== -1) {
        b = { ...this.branches[idx], ...branchData };
        this.branches[idx] = b;
      } else {
        b = {
          id: branchData.id,
          name: branchData.name,
          code: branchData.code,
          address: branchData.address || '',
          phone: branchData.phone || '',
          isPrimary: branchData.isPrimary || false,
        };
        this.branches.push(b);
      }
    } else {
      b = {
        id: `BRANCH-${String(this.branches.length + 1).padStart(2, '0')}`,
        name: branchData.name,
        code: branchData.code,
        address: branchData.address || '',
        phone: branchData.phone || '',
        isPrimary: false,
      };
      this.branches.push(b);
    }
    this.persistBranches();
    this.addAuditLog(this.currentUser?.name || 'Admin', 'Branch Management', `Saved branch ${b.name}`);
    return b;
  }

  public deleteBranch(id: string): boolean {
    if (this.branches.length <= 1) return false;
    const branch = this.branches.find(b => b.id === id);
    this.branches = this.branches.filter(b => b.id !== id);
    this.persistBranches();
    if (branch) {
      this.addAuditLog(this.currentUser?.name || 'Admin', 'Delete Branch', `Deleted branch ${branch.name}`);
    }
    return true;
  }

  // --- MODULE 29: Batches & FIFO ---
  public getBatchesForProduct(productId: string): ProductBatch[] {
    const prod = this.getProductById(productId);
    return prod?.batches || [];
  }

  public addBatchToProduct(productId: string, batchData: Omit<ProductBatch, 'id'>): Product | undefined {
    const prod = this.getProductById(productId);
    if (!prod) return undefined;

    const newBatch: ProductBatch = {
      id: `BATCH-${Date.now()}`,
      ...batchData,
    };

    if (!prod.batches) prod.batches = [];
    prod.batches.push(newBatch);
    prod.quantity += batchData.quantity;
    prod.updatedAt = new Date().toISOString();

    this.persistProducts();
    this.addAuditLog(this.currentUser?.name || 'Inventory', 'Add Batch', `Added batch ${newBatch.batchNumber} to ${prod.name}`);
    return prod;
  }

  public getOldestAvailableBatch(productId: string): ProductBatch | undefined {
    const batches = this.getBatchesForProduct(productId).filter(b => b.quantity > 0);
    if (batches.length === 0) return undefined;
    return batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
  }

  // --- MODULE 30: Unit Conversion ---
  public convertUnitQuantity(qty: number, fromUnit: string, toUnit: string): number {
    if (!fromUnit || !toUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) return qty;
    const rule = UNIT_CONVERSIONS.find(
      u => u.fromUnit.toLowerCase() === fromUnit.toLowerCase() && u.toUnit.toLowerCase() === toUnit.toLowerCase()
    );
    if (rule) return qty * rule.factor;

    const inverse = UNIT_CONVERSIONS.find(
      u => u.fromUnit.toLowerCase() === toUnit.toLowerCase() && u.toUnit.toLowerCase() === fromUnit.toLowerCase()
    );
    if (inverse) return qty / inverse.factor;

    return qty;
  }

  // --- MODULE 32: Wholesale Pricing ---
  public getProductPriceForCustomer(product: Product, customerTag?: string): number {
    if (!customerTag) return product.sellingPrice;
    if (customerTag === 'Wholesale' && product.wholesalePrice && product.wholesalePrice > 0) {
      return product.wholesalePrice;
    }
    if (customerTag === 'Distributor' && product.distributorPrice && product.distributorPrice > 0) {
      return product.distributorPrice;
    }
    if (customerTag === 'VIP' && product.vipPrice && product.vipPrice > 0) {
      return product.vipPrice;
    }
    return product.sellingPrice;
  }

  // --- MODULE 33: Customer Credit & Ledgers ---
  public getCustomerLedger(customerId: string): CustomerLedgerEntry[] {
    return this.customerLedgers.filter(l => l.customerId === customerId);
  }

  public addCustomerLedgerEntry(
    customerId: string,
    type: 'SaleCredit' | 'PaymentReceived' | 'Adjustment',
    referenceNo: string,
    debit: number,
    credit: number,
    notes?: string
  ): CustomerLedgerEntry {
    const cust = this.getCustomerById(customerId);
    const prevLedger = this.getCustomerLedger(customerId);
    const currentBal = prevLedger.length > 0 ? prevLedger[0].balance : 0;
    const newBal = currentBal + debit - credit;

    const entry: CustomerLedgerEntry = {
      id: `LEDGER-${Date.now()}`,
      customerId,
      date: new Date().toISOString(),
      type,
      referenceNo,
      debit,
      credit,
      balance: Math.max(0, newBal),
      notes,
    };

    this.customerLedgers.unshift(entry);
    this.persistCustomerLedgers();
    return entry;
  }

  // --- MODULE 34: Cash Register Drawer Shifts ---
  private ensureActiveCashShift() {
    const openShift = this.cashShifts.find(s => s.status === 'Open');
    if (!openShift) {
      const newShift: CashRegisterShift = {
        id: `SHIFT-${Date.now()}`,
        cashierName: this.currentUser?.name || 'Main Cashier',
        startTime: new Date().toISOString(),
        openingCash: 2000,
        cashInTotal: 0,
        cashOutTotal: 0,
        safeDepositTotal: 0,
        status: 'Open',
      };
      this.cashShifts.unshift(newShift);
      this.persistCashShifts();
    }
  }

  public getCurrentCashShift(): CashRegisterShift | undefined {
    return this.cashShifts.find(s => s.status === 'Open');
  }

  public getCashShifts(): CashRegisterShift[] {
    return [...this.cashShifts];
  }

  public openCashShift(openingCash: number, notes?: string): CashRegisterShift {
    const open = this.getCurrentCashShift();
    if (open) {
      open.status = 'Closed';
      open.endTime = new Date().toISOString();
    }

    const newShift: CashRegisterShift = {
      id: `SHIFT-${Date.now()}`,
      cashierName: this.currentUser?.name || 'Cashier',
      startTime: new Date().toISOString(),
      openingCash: Number(openingCash),
      cashInTotal: 0,
      cashOutTotal: 0,
      safeDepositTotal: 0,
      status: 'Open',
      notes,
    };

    this.cashShifts.unshift(newShift);
    this.persistCashShifts();
    this.addAuditLog(newShift.cashierName, 'Open Cash Register', `Opened shift with ${openingCash} float`);
    return newShift;
  }

  public getShiftCashSales(shift: CashRegisterShift): number {
    const startTime = shift.startTime;
    const endTime = shift.endTime;

    return this.sales
      .filter(s => {
        if (s.status === 'Cancelled') return false;
        if (s.dateTime < startTime) return false;
        if (endTime && s.dateTime > endTime) return false;
        return true;
      })
      .reduce((totalCash, s) => {
        if (s.paymentMode === 'Cash') {
          const netCash = s.receivedAmount > 0 ? (s.receivedAmount - (s.changeAmount || 0)) : s.totalAmount;
          return totalCash + Math.max(0, netCash);
        } else if (s.paymentMode === 'Split' && Array.isArray(s.splitPayments)) {
          const cashSplit = s.splitPayments.find(sp => sp.mode === 'Cash');
          return totalCash + (cashSplit ? Number(cashSplit.amount || 0) : 0);
        }
        return totalCash;
      }, 0);
  }

  public getShiftPaymentBreakdown(shift: CashRegisterShift): {
    cashSales: number;
    upiSales: number;
    cardSales: number;
    creditSales: number;
    otherSales: number;
    totalSales: number;
  } {
    const startTime = shift.startTime;
    const endTime = shift.endTime;

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let creditSales = 0;
    let otherSales = 0;

    const shiftSales = this.sales.filter(s => {
      if (s.status === 'Cancelled') return false;
      if (s.dateTime < startTime) return false;
      if (endTime && s.dateTime > endTime) return false;
      return true;
    });

    for (const s of shiftSales) {
      if (s.paymentMode === 'Cash') {
        const netCash = s.receivedAmount > 0 ? (s.receivedAmount - (s.changeAmount || 0)) : s.totalAmount;
        cashSales += Math.max(0, netCash);
      } else if (s.paymentMode === 'UPI') {
        upiSales += s.totalAmount;
      } else if (s.paymentMode === 'Card') {
        cardSales += s.totalAmount;
      } else if (s.paymentMode === 'Credit') {
        creditSales += s.totalAmount;
      } else if (s.paymentMode === 'Split' && Array.isArray(s.splitPayments)) {
        for (const sp of s.splitPayments) {
          const amt = Number(sp.amount || 0);
          if (sp.mode === 'Cash') cashSales += amt;
          else if (sp.mode === 'UPI') upiSales += amt;
          else if (sp.mode === 'Card') cardSales += amt;
          else if (sp.mode === 'Store Credit') creditSales += amt;
          else otherSales += amt;
        }
      } else {
        otherSales += s.totalAmount;
      }
    }

    const totalSales = cashSales + upiSales + cardSales + creditSales + otherSales;
    return { cashSales, upiSales, cardSales, creditSales, otherSales, totalSales };
  }

  public getShiftExpectedCash(shift: CashRegisterShift): {
    openingCash: number;
    totalCashSales: number;
    cashInTotal: number;
    cashOutTotal: number;
    safeDepositTotal: number;
    expectedCash: number;
  } {
    const openingCash = shift.openingCash || 0;
    const totalCashSales = this.getShiftCashSales(shift);
    const cashInTotal = shift.cashInTotal || 0;
    const cashOutTotal = shift.cashOutTotal || 0;
    const safeDepositTotal = shift.safeDepositTotal || 0;

    const expectedCash = openingCash + totalCashSales + cashInTotal - cashOutTotal - safeDepositTotal;

    return {
      openingCash,
      totalCashSales,
      cashInTotal,
      cashOutTotal,
      safeDepositTotal,
      expectedCash,
    };
  }

  public closeCashShift(closingCash: number, notes?: string): CashRegisterShift | undefined {
    const shift = this.getCurrentCashShift();
    if (!shift) return undefined;

    const { expectedCash } = this.getShiftExpectedCash(shift);
    const diff = Number(closingCash) - expectedCash;

    shift.endTime = new Date().toISOString();
    shift.closingCash = Number(closingCash);
    shift.expectedCash = expectedCash;
    shift.cashDifference = diff;
    shift.status = 'Closed';
    shift.notes = notes;

    this.persistCashShifts();
    this.addAuditLog(shift.cashierName, 'Close Cash Register', `Closed shift. Count: ${closingCash}, Expected: ${expectedCash}, Diff: ${diff}`);
    return shift;
  }

  public addCashTransaction(type: 'CashIn' | 'CashOut' | 'SafeDeposit', amount: number, reason: string): CashTransaction {
    const shift = this.getCurrentCashShift();
    const txn: CashTransaction = {
      id: `CASHTXN-${Date.now()}`,
      shiftId: shift?.id || 'GLOBAL',
      timestamp: new Date().toISOString(),
      type,
      amount: Number(amount),
      reason,
      cashierName: this.currentUser?.name || 'Cashier',
    };

    if (shift) {
      if (type === 'CashIn') shift.cashInTotal += Number(amount);
      if (type === 'CashOut') shift.cashOutTotal += Number(amount);
      if (type === 'SafeDeposit') shift.safeDepositTotal += Number(amount);
      this.persistCashShifts();
    }

    this.cashTxns.unshift(txn);
    this.persistCashTxns();
    this.addAuditLog(txn.cashierName, `Drawer ${type}`, `${reason}: ${amount}`);
    return txn;
  }

  public getCashTransactions(): CashTransaction[] {
    return [...this.cashTxns];
  }

  // --- MODULE 37: Price History ---
  public getPriceHistory(productId?: string): PriceHistoryRecord[] {
    if (productId) return this.priceHistory.filter(p => p.productId === productId);
    return [...this.priceHistory];
  }

  public recordPriceChange(
    productId: string,
    productName: string,
    oldPurchasePrice: number,
    newPurchasePrice: number,
    oldSellingPrice: number,
    newSellingPrice: number
  ): void {
    if (oldPurchasePrice === newPurchasePrice && oldSellingPrice === newSellingPrice) return;
    const rec: PriceHistoryRecord = {
      id: `PH-${Date.now()}`,
      productId,
      productName,
      oldPurchasePrice,
      newPurchasePrice,
      oldSellingPrice,
      newSellingPrice,
      dateChanged: new Date().toISOString(),
      changedBy: this.currentUser?.name || 'Admin',
    };
    this.priceHistory.unshift(rec);
    this.persistPriceHistory();
  }

  // --- MODULE 38: Smart Reorder Engine ---
  public getSmartReorderSuggestions() {
    const historicalSaleItems = this.sales.flatMap(s => 
      (s.items || []).map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        dateTime: s.dateTime,
      }))
    );

    return calculateSmartReorderSuggestions({
      products: this.products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        barcode: p.barcode,
        quantity: p.quantity,
        minStockLevel: p.minStockLevel || this.settings.lowStockThreshold || 10,
        maxStockLevel: p.maxStockLevel,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        supplierName: p.supplierName,
        unit: p.unit,
      })),
      salesItems: historicalSaleItems,
      suppliers: this.suppliers.map(s => ({
        name: s.name,
        id: s.id,
        leadTimeDays: (s as any).leadTimeDays || 3,
      })),
      daysWindow: 30,
      defaultLeadTimeDays: 3,
    });
  }

  // --- MODULE 40: Product Categories ---
  public getCategories(): CategoryNode[] {
    return [...this.categories];
  }

  public saveCategory(catData: Partial<CategoryNode> & { name: string }): CategoryNode {
    let cat: CategoryNode;
    if (catData.id) {
      const idx = this.categories.findIndex(c => c.id === catData.id);
      if (idx !== -1) {
        cat = { ...this.categories[idx], ...catData };
        this.categories[idx] = cat;
      } else {
        cat = { id: catData.id, name: catData.name, parentId: catData.parentId, description: catData.description };
        this.categories.push(cat);
      }
    } else {
      cat = {
        id: `CAT-${this.categories.length + 1}`,
        name: catData.name,
        parentId: catData.parentId,
        description: catData.description,
      };
      this.categories.push(cat);
    }
    this.persistCategories();
    return cat;
  }

  public deleteCategory(id: string): boolean {
    const category = this.categories.find(c => c.id === id);
    this.categories = this.categories.filter(c => c.id !== id);
    this.persistCategories();
    if (category) {
      this.addAuditLog(this.currentUser?.name || 'Admin', 'Delete Category', `Deleted category ${category.name}`);
    }
    return true;
  }

  // --- MODULE 41: Favorites Pinning ---
  public togglePinProduct(productId: string): boolean {
    const p = this.getProductById(productId);
    if (!p) return false;
    p.isPinned = !p.isPinned;
    this.persistProducts();
    return p.isPinned;
  }

  // --- MODULE 45: Undo & Recovery Recycle Bin ---
  public getRecycleBin(): RecycleBinItem[] {
    return [...this.recycleBin];
  }

  public moveToRecycleBin(type: RecycleBinItem['type'], originalId: string, title: string, data: any): RecycleBinItem {
    const item: RecycleBinItem = {
      id: `BIN-${Date.now()}`,
      type,
      originalId,
      title,
      data,
      deletedAt: new Date().toISOString(),
      deletedBy: this.currentUser?.name || 'User',
    };
    this.recycleBin.unshift(item);
    this.persistRecycleBin();
    return item;
  }

  public restoreFromRecycleBin(id: string): boolean {
    const item = this.recycleBin.find(i => i.id === id);
    if (!item) return false;

    if (item.type === 'Product') {
      this.products.push(item.data);
      this.persistProducts();
    } else if (item.type === 'Customer') {
      this.customers.push(item.data);
      this.persistCustomers();
    } else if (item.type === 'Supplier') {
      this.suppliers.push(item.data);
      this.persistSuppliers();
    } else if (item.type === 'Expense') {
      this.expenses.push(item.data);
      this.persistExpenses();
    }

    this.recycleBin = this.recycleBin.filter(i => i.id !== id);
    this.persistRecycleBin();
    this.addAuditLog(this.currentUser?.name || 'User', 'Restore Item', `Restored ${item.type}: ${item.title}`);
    return true;
  }

  public emptyRecycleBin(): void {
    this.recycleBin = [];
    this.persistRecycleBin();
  }

  // --- MODULE 46: Health Diagnostics Monitor ---
  public getHealthDiagnostics() {
    const totalRecords = 
      this.products.length + 
      this.sales.length + 
      this.customers.length + 
      this.suppliers.length + 
      this.expenses.length + 
      this.employees.length + 
      this.auditLogs.length;

    const estimatedKb = Math.round((JSON.stringify(this.products).length + JSON.stringify(this.sales).length + 50000) / 1024);

    return {
      databaseName: 'grocery_pos_sqlite_v2.db',
      dbSizeKb: estimatedKb,
      totalRecords,
      totalProducts: this.products.length,
      totalInvoices: this.sales.length,
      totalCustomers: this.customers.length,
      lastBackupDate: this.settings.lastBackupDate || 'Never',
      storageEngine: 'Indexed Local DB / SQLite Simulation',
      status: 'Healthy',
      memoryUsage: 'Optimal',
      appVersion: '2.0 Commercial',
    };
  }

  public optimizeStorage(): { freedRecords: number; dbSizeKb: number } {
    let freed = 0;
    if (this.auditLogs.length > 1000) {
      freed += (this.auditLogs.length - 1000);
      this.auditLogs = this.auditLogs.slice(-1000);
      this.persistAuditLogs();
    }
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const initialRecycleCount = this.recycleBin.length;
    this.recycleBin = this.recycleBin.filter(item => {
      const deletedAt = new Date(item.deletedAt).getTime();
      return deletedAt > thirtyDaysAgo;
    });
    freed += (initialRecycleCount - this.recycleBin.length);
    if (initialRecycleCount !== this.recycleBin.length) {
      this.persistRecycleBin();
    }
    this.persistProducts();
    this.persistSales();
    this.persistCustomers();
    this.notify();

    const stats = this.getHealthDiagnostics();
    return { freedRecords: freed, dbSizeKb: stats.dbSizeKb };
  }

  // --- MODULE 47: Offline Updates ---
  public getUpdatePackages(): UpdatePackage[] {
    return [...this.updates];
  }

  public applyUpdatePackage(version: string): boolean {
    const pkg = this.updates.find(u => u.version === version);
    if (!pkg) return false;
    pkg.isApplied = true;
    this.persistUpdates();
    this.addAuditLog(this.currentUser?.name || 'Admin', 'Apply System Update', `Successfully updated system to ${version}`);
    return true;
  }

  // --- Event Subscription & Versioning ---
  private _version = 0;
  private _subscribers = new Set<() => void>();

  public getVersion(): number {
    return this._version;
  }

  public subscribe(callback: () => void): () => void {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  public notify(): void {
    this._version++;
    for (const callback of this._subscribers) {
      try {
        callback();
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }
  }

  // --- Persistence Handlers ---
  private persistSettings() { safeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings)); this.notify(); }
  private persistProducts() { safeStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products)); this.notify(); }
  private persistSales() { safeStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(this.sales)); this.notify(); }
  private persistStockLogs() { safeStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify(this.stockLogs)); this.notify(); }
  private persistCustomers() { safeStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(this.customers)); this.notify(); }
  private persistSuppliers() { safeStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(this.suppliers)); this.notify(); }
  private persistPurchaseOrders() { safeStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(this.purchaseOrders)); this.notify(); }
  private persistExpenses() { safeStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(this.expenses)); this.notify(); }
  private persistEmployees() { safeStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(this.employees)); this.notify(); }
  private persistAttendance() { safeStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(this.attendance)); this.notify(); }
  private persistHeldBills() { safeStorage.setItem(STORAGE_KEYS.HELD_BILLS, JSON.stringify(this.heldBills)); this.notify(); }
  private persistReturns() { safeStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify(this.returns)); this.notify(); }
  private persistAuditLogs() { safeStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs)); this.notify(); }
  private persistBranches() { safeStorage.setItem(STORAGE_KEYS.BRANCHES, JSON.stringify(this.branches)); this.notify(); }
  private persistCashShifts() { safeStorage.setItem(STORAGE_KEYS.CASH_SHIFTS, JSON.stringify(this.cashShifts)); this.notify(); }
  private persistCashTxns() { safeStorage.setItem(STORAGE_KEYS.CASH_TXNS, JSON.stringify(this.cashTxns)); this.notify(); }
  private persistPriceHistory() { safeStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(this.priceHistory)); this.notify(); }
  private persistCategories() { safeStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories)); this.notify(); }
  private persistCustomerLedgers() { safeStorage.setItem(STORAGE_KEYS.CUSTOMER_LEDGERS, JSON.stringify(this.customerLedgers)); this.notify(); }
  private persistRecycleBin() { safeStorage.setItem(STORAGE_KEYS.RECYCLE_BIN, JSON.stringify(this.recycleBin)); this.notify(); }
  private persistUpdates() { safeStorage.setItem(STORAGE_KEYS.UPDATES, JSON.stringify(this.updates)); this.notify(); }

  // --- Backup & Restore ---
  public exportBackupJSON(): string {
    const backupData = {
      version: '2.0 Enterprise',
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      products: this.products,
      sales: this.sales,
      stockLogs: this.stockLogs,
      customers: this.customers,
      suppliers: this.suppliers,
      purchaseOrders: this.purchaseOrders,
      expenses: this.expenses,
      employees: this.employees,
      attendance: this.attendance,
      heldBills: this.heldBills,
      returns: this.returns,
      auditLogs: this.auditLogs,
      branches: this.branches,
      cashShifts: this.cashShifts,
      cashTxns: this.cashTxns,
      priceHistory: this.priceHistory,
      categories: this.categories,
      customerLedgers: this.customerLedgers,
      recycleBin: this.recycleBin,
      updates: this.updates,
    };
    return JSON.stringify(backupData, null, 2);
  }

  public importBackupJSON(jsonContent: string): boolean {
    try {
      const parsed = JSON.parse(jsonContent);
      if (parsed.settings && parsed.products && parsed.sales) {
        this.settings = parsed.settings;
        this.products = parsed.products;
        this.sales = parsed.sales;
        this.stockLogs = parsed.stockLogs || [];
        this.customers = parsed.customers || INITIAL_SAMPLE_CUSTOMERS;
        this.suppliers = parsed.suppliers || INITIAL_SAMPLE_SUPPLIERS;
        this.purchaseOrders = parsed.purchaseOrders || [];
        this.expenses = parsed.expenses || INITIAL_SAMPLE_EXPENSES;
        this.employees = parsed.employees || INITIAL_SAMPLE_EMPLOYEES;
        this.attendance = parsed.attendance || [];
        this.heldBills = parsed.heldBills || [];
        this.returns = parsed.returns || [];
        this.auditLogs = parsed.auditLogs || [];
        this.branches = parsed.branches || INITIAL_SAMPLE_BRANCHES;
        this.cashShifts = parsed.cashShifts || [];
        this.cashTxns = parsed.cashTxns || [];
        this.priceHistory = parsed.priceHistory || [];
        this.categories = parsed.categories || [];
        this.customerLedgers = parsed.customerLedgers || [];
        this.recycleBin = parsed.recycleBin || [];
        this.updates = parsed.updates || [];

        this.persistSettings();
        this.persistProducts();
        this.persistSales();
        this.persistStockLogs();
        this.persistCustomers();
        this.persistSuppliers();
        this.persistPurchaseOrders();
        this.persistExpenses();
        this.persistEmployees();
        this.persistAttendance();
        this.persistHeldBills();
        this.persistReturns();
        this.persistAuditLogs();
        this.persistBranches();
        this.persistCashShifts();
        this.persistCashTxns();
        this.persistPriceHistory();
        this.persistCategories();
        this.persistCustomerLedgers();
        this.persistRecycleBin();
        this.persistUpdates();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to parse backup file', e);
      return false;
    }
  }

  public resetToSampleData(): void {
    this.settings = DEFAULT_SETTINGS;
    this.products = INITIAL_SAMPLE_PRODUCTS;
    this.sales = INITIAL_SAMPLE_SALES;
    this.customers = INITIAL_SAMPLE_CUSTOMERS;
    this.suppliers = INITIAL_SAMPLE_SUPPLIERS;
    this.expenses = INITIAL_SAMPLE_EXPENSES;
    this.employees = INITIAL_SAMPLE_EMPLOYEES;
    this.stockLogs = [];
    this.purchaseOrders = [];
    this.attendance = [];
    this.heldBills = [];
    this.returns = [];
    this.auditLogs = [];

    this.persistProducts();
    this.persistSales();
    this.persistStockLogs();
    this.persistCustomers();
    this.persistSuppliers();
    this.persistPurchaseOrders();
    this.persistExpenses();
    this.persistEmployees();
    this.persistAttendance();
    this.persistHeldBills();
    this.persistReturns();
    this.persistAuditLogs();
  }

  public clearAllDataForFreshStart(customSettings?: Partial<ShopSettings>): void {
    if (customSettings) {
      this.settings = { ...this.settings, ...customSettings, isSetupCompleted: true };
    } else {
      this.settings = { ...DEFAULT_SETTINGS, shopName: 'My Supermarket Store', ownerName: 'Store Owner', isSetupCompleted: true };
    }

    this.products = [];
    this.sales = [];
    this.customers = [];
    this.suppliers = [];
    this.expenses = [];
    this.purchaseOrders = [];
    this.stockLogs = [];
    this.attendance = [];
    this.heldBills = [];
    this.returns = [];
    this.cashShifts = [];
    this.cashTxns = [];
    this.priceHistory = [];
    this.customerLedgers = [];
    this.recycleBin = [];

    this.employees = [
      {
        id: 'EMP-01',
        name: this.settings.ownerName || 'Store Owner',
        role: 'Owner',
        phone: this.settings.phone || '+91 98765 00000',
        address: this.settings.address || 'Main Shop',
        joiningDate: new Date().toISOString().split('T')[0],
        pin: '1234',
        salary: 0,
        status: 'Active',
      }
    ];

    if (this.branches.length > 0) {
      this.branches[0].name = this.settings.shopName || 'Main Store';
      this.branches[0].address = this.settings.address || '';
      this.branches[0].phone = this.settings.phone || '';
    }

    this.auditLogs = [
      {
        id: `AUDIT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: this.settings.ownerName || 'Admin',
        action: 'Clean Slate Initialization',
        details: 'Wiped all demo sample data. Application is ready for fresh real-world store operations.',
      }
    ];

    this.persistSettings();
    this.persistProducts();
    this.persistSales();
    this.persistStockLogs();
    this.persistCustomers();
    this.persistSuppliers();
    this.persistPurchaseOrders();
    this.persistExpenses();
    this.persistEmployees();
    this.persistAttendance();
    this.persistHeldBills();
    this.persistReturns();
    this.persistAuditLogs();
    this.persistBranches();
    this.persistCashShifts();
    this.persistCashTxns();
    this.persistPriceHistory();
    this.persistCustomerLedgers();
    this.persistRecycleBin();
  }
}

// ================================================================
// LOCAL OFFLINE STORAGE ENGINE INSTANCE
// Zero cloud dependencies, fully synchronous, 100% offline-first.
// ================================================================

export const sqliteDB = new LegacyLocalStorageEngine();
export type SQLiteStorageEngine = LegacyLocalStorageEngine;

