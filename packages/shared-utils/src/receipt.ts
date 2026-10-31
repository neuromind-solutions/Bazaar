/**
 * @bazaar/shared-utils — Pure Receipt Model & Scanning Helpers
 *
 * Platform-independent receipt formatting and barcode resolution.
 * Pure logic — zero DOM, zero React, zero Electron dependencies.
 */

export interface ReceiptLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barcode?: string;
  variantName?: string;
}

export interface ReceiptModel {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopGst?: string;
  invoiceNumber: string;
  dateTime: string;
  cashierName: string;
  customerName: string;
  customerPhone?: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  paymentMode: string;
  receivedAmount: number;
  changeDue: number;
  splitPayments?: Array<{ mode: string; amount: number }>;
  upiQrPayload?: string;
  footerMessage?: string;
  currencySymbol: string;
  receiptSize: '58mm' | '80mm' | 'a4';
}

/**
 * Generate UPI payment payload URI compliant with NPCI specification.
 */
export function buildUpiPayload(params: {
  upiId: string;
  merchantName: string;
  amount: number;
  invoiceNumber: string;
  note?: string;
}): string {
  const { upiId, merchantName, amount, invoiceNumber, note } = params;
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(merchantName.trim() || 'Merchant');
  const cleanRef = encodeURIComponent(invoiceNumber.trim());
  const cleanNote = encodeURIComponent(note?.trim() || `Invoice ${invoiceNumber}`);
  const cleanAmount = amount.toFixed(2);

  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&tr=${cleanRef}&tn=${cleanNote}&cu=INR`;
}

/**
 * Build a structured receipt model from sale data and store settings.
 */
export function buildReceiptModel(
  sale: {
    id: string;
    invoiceNumber: string;
    dateTime: string;
    customerName: string;
    customerPhone?: string;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      barcode?: string;
      unitSellingPrice: number;
      quantity: number;
      totalPrice: number;
      variantName?: string;
    }>;
    subtotal: number;
    discountAmount: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
    paymentMode: string;
    receivedAmount: number;
    changeAmount: number;
    splitPayments?: Array<{ mode: string; amount: number }>;
    cashierName?: string;
    notes?: string;
  },
  settings: {
    shopName: string;
    address: string;
    phone: string;
    gstNumber?: string;
    currencySymbol?: string;
    receiptType?: 'thermal' | 'A4' | 'a4';
    receiptSize?: '58mm' | '80mm' | 'a4';
    upiId?: string;
    merchantName?: string;
    enableUpiPayments?: boolean;
    defaultPaymentNote?: string;
    upiReceiptFooter?: string;
  }
): ReceiptModel {
  const isUpiInvolved =
    sale.paymentMode === 'UPI' ||
    (sale.paymentMode === 'Split' && sale.splitPayments?.some(sp => sp.mode === 'UPI')) ||
    (settings.enableUpiPayments && !!settings.upiId);

  let upiQrPayload: string | undefined;
  if (isUpiInvolved && settings.upiId) {
    upiQrPayload = buildUpiPayload({
      upiId: settings.upiId,
      merchantName: settings.merchantName || settings.shopName,
      amount: sale.totalAmount,
      invoiceNumber: sale.invoiceNumber,
      note: settings.defaultPaymentNote || `Bill ${sale.invoiceNumber}`,
    });
  }

  const items: ReceiptLineItem[] = sale.items.map(item => ({
    id: item.id,
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitSellingPrice,
    totalPrice: item.totalPrice,
    barcode: item.barcode,
    variantName: item.variantName,
  }));

  const receiptSize = settings.receiptSize === '58mm' ? '58mm' : (settings.receiptType === 'a4' || settings.receiptType === 'A4' || settings.receiptSize === 'a4' ? 'a4' : '80mm');

  return {
    shopName: settings.shopName || 'Grocery Store',
    shopAddress: settings.address || '',
    shopPhone: settings.phone || '',
    shopGst: settings.gstNumber,
    invoiceNumber: sale.invoiceNumber,
    dateTime: sale.dateTime,
    cashierName: sale.cashierName || 'Cashier',
    customerName: sale.customerName || 'Walk-in Customer',
    customerPhone: sale.customerPhone,
    items,
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    taxPercent: sale.taxPercent,
    taxAmount: sale.taxAmount,
    totalAmount: sale.totalAmount,
    paymentMode: sale.paymentMode,
    receivedAmount: sale.receivedAmount,
    changeDue: sale.changeAmount,
    splitPayments: sale.splitPayments,
    upiQrPayload,
    footerMessage: settings.upiReceiptFooter || 'Thank you for your visit!',
    currencySymbol: settings.currencySymbol || '₹',
    receiptSize,
  };
}

/**
 * Shared scan resolution helper: resolves a raw scan code against a product list.
 */
export function resolveScan<T extends { barcode?: string; id?: string; name: string }>(
  code: string,
  products: T[]
): T | undefined {
  const cleaned = (code || '').trim();
  if (!cleaned) return undefined;

  return products.find(
    p =>
      (p.barcode && p.barcode.trim() === cleaned) ||
      (p.id && p.id.trim() === cleaned) ||
      p.name.toLowerCase() === cleaned.toLowerCase()
  );
}
