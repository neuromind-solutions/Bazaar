import { describe, it, expect } from 'vitest';
import {
  buildUpiPayload,
  buildReceiptModel,
} from '@bazaar/shared-utils';

describe('Receipt & Dynamic UPI Formatting (@bazaar/shared-utils)', () => {
  it('constructs an NPCI-compliant standard UPI URI string', () => {
    const upiUri = buildUpiPayload({
      upiId: 'grocery@upi',
      merchantName: 'Green Grocery',
      amount: 450,
      invoiceNumber: 'INV-2026-0001',
      note: 'INV-2026-0001',
    });

    expect(upiUri.startsWith('upi://pay?')).toBe(true);
    expect(upiUri).toContain('pa=grocery@upi');
    expect(upiUri).toContain('pn=Green%20Grocery');
    expect(upiUri).toContain('am=450.00');
    expect(upiUri).toContain('cu=INR');
  });

  it('formats receipt model line items and totals cleanly', () => {
    const sale = {
      id: 'S-1',
      invoiceNumber: 'INV-100',
      dateTime: '2026-01-01T12:00:00Z',
      customerName: 'Walk-in Customer',
      items: [
        {
          id: 'I-1',
          productId: 'P-1',
          productName: 'Atta 5kg',
          unitSellingPrice: 285,
          quantity: 2,
          totalPrice: 570,
        },
      ],
      subtotal: 570,
      discountAmount: 20,
      taxPercent: 0,
      taxAmount: 0,
      totalAmount: 550,
      paymentMode: 'Cash',
      receivedAmount: 600,
      changeAmount: 50,
    };

    const settings = {
      shopName: 'Green Grocery',
      address: 'Bangalore',
      phone: '9876500000',
      currencySymbol: '₹',
      receiptSize: '80mm' as const,
      enableUpiPayments: false,
    };

    const model = buildReceiptModel(sale, settings);

    expect(model.shopName).toBe('Green Grocery');
    expect(model.items).toHaveLength(1);
    expect(model.totalAmount).toBe(550);
    expect(model.changeDue).toBe(50);
  });
});
