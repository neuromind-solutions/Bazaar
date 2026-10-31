import { describe, it, expect, vi } from 'vitest';
import QRCode from 'qrcode';
import { UPIPaymentService, PaymentServiceFactory } from '@/src/services/paymentService';
import { DEFAULT_SETTINGS } from '@/src/db/sqliteStorage';

describe('UPIPaymentService (@bazaar/desktop/services)', () => {
  it('validates UPI ID correctly according to NPCI VPA format', () => {
    // Empty validation
    expect(UPIPaymentService.validateUPIId('')).toEqual({
      valid: false,
      error: 'UPI ID cannot be empty.',
    });
    expect(UPIPaymentService.validateUPIId('   ')).toEqual({
      valid: false,
      error: 'UPI ID cannot be empty.',
    });

    // Missing '@'
    expect(UPIPaymentService.validateUPIId('invalidvpa')).toEqual({
      valid: false,
      error: 'UPI ID must contain "@" (e.g., shopname@okaxis).',
    });

    // Malformed parts
    expect(UPIPaymentService.validateUPIId('@bank')).toEqual({
      valid: false,
      error: 'Invalid UPI VPA format. Example: name@bank',
    });
    expect(UPIPaymentService.validateUPIId('name@')).toEqual({
      valid: false,
      error: 'Invalid UPI VPA format. Example: name@bank',
    });
    expect(UPIPaymentService.validateUPIId('a@b@c')).toEqual({
      valid: false,
      error: 'Invalid UPI VPA format. Example: name@bank',
    });

    // Valid formats
    expect(UPIPaymentService.validateUPIId('shop@okaxis')).toEqual({ valid: true });
    expect(UPIPaymentService.validateUPIId('owner.name@upi')).toEqual({ valid: true });
  });

  it('determines availability based on store settings', () => {
    const service = new UPIPaymentService({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: true,
      upiId: 'bazaar@upi',
    });
    expect(service.isAvailable()).toBe(true);

    // Explicitly disabled
    service.updateSettings({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: false,
      upiId: 'bazaar@upi',
    });
    expect(service.isAvailable()).toBe(false);

    // Empty UPI ID
    service.updateSettings({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: true,
      upiId: '',
    });
    expect(service.isAvailable()).toBe(false);

    // Short UPI ID (<= 3 chars, e.g. "a@b")
    service.updateSettings({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: true,
      upiId: 'a@b',
    });
    expect(service.isAvailable()).toBe(false);

    // UPI ID without '@'
    service.updateSettings({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: true,
      upiId: 'abcd',
    });
    expect(service.isAvailable()).toBe(false);
  });

  it('generates standard NPCI UPI payload string with parameters and fallbacks', () => {
    const service = new UPIPaymentService({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: true,
      upiId: 'merchant@upi',
      merchantName: 'Supermarket',
    });

    const payload = service.generateUPIString({
      amount: 499.50,
      invoiceNumber: 'INV-2026-001',
      customerName: 'Aman',
      note: 'Groceries!@#$%^',
    });

    expect(payload.startsWith('upi://pay?')).toBe(true);
    const url = new URL(payload);
    expect(url.searchParams.get('pa')).toBe('merchant@upi');
    expect(url.searchParams.get('pn')).toBe('Supermarket');
    expect(url.searchParams.get('am')).toBe('499.50');
    expect(url.searchParams.get('cu')).toBe('INR');
    expect(url.searchParams.get('tn')).toBe('Groceries');
  });

  it('handles merchant name, currency, and note fallbacks properly', () => {
    // Fallback to shopName when merchantName is missing
    const serviceWithShop = new UPIPaymentService({
      ...DEFAULT_SETTINGS,
      upiId: 'shop@upi',
      merchantName: undefined,
      shopName: 'Corner Store',
      defaultPaymentNote: 'Store Purchase',
    });

    const payload1 = serviceWithShop.generateUPIString({
      amount: 100,
      invoiceNumber: 'INV-001',
      currency: 'USD',
    });
    const url1 = new URL(payload1);
    expect(url1.searchParams.get('pn')).toBe('Corner Store');
    expect(url1.searchParams.get('cu')).toBe('USD');
    expect(url1.searchParams.get('tn')).toBe('Store Purchase');

    // Fallback to 'Grocery Store' and default invoice note
    const serviceDefault = new UPIPaymentService({
      ...DEFAULT_SETTINGS,
      upiId: '',
      merchantName: '',
      shopName: '',
      defaultPaymentNote: undefined,
    });
    const payload2 = serviceDefault.generateUPIString({
      amount: 25,
      invoiceNumber: 'INV-777',
    });
    const url2 = new URL(payload2);
    expect(url2.searchParams.get('pa')).toBe('');
    expect(url2.searchParams.get('pn')).toBe('Grocery Store');
    expect(url2.searchParams.get('tn')).toBe('Invoice INV-777');

    // Note truncation to 50 characters
    const longNote = 'A'.repeat(70);
    const payload3 = serviceDefault.generateUPIString({
      amount: 25,
      invoiceNumber: 'INV-888',
      note: longNote,
    });
    const url3 = new URL(payload3);
    expect(url3.searchParams.get('tn')).toBe('A'.repeat(50));
  });

  it('generates valid base64 QR code data URL and calls QRCode with exact options', async () => {
    const spy = vi.spyOn(QRCode, 'toDataURL');
    const service = new UPIPaymentService({
      ...DEFAULT_SETTINGS,
      enableUpiPayments: true,
      upiId: 'merchant@upi',
      merchantName: 'Supermarket',
    });

    const dataUrl = await service.generateQRCodeDataUrl({
      amount: 150,
      invoiceNumber: 'INV-101',
    });

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('pa=merchant%40upi'),
      expect.objectContaining({
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 360,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
    );
    spy.mockRestore();
  });

  it('throws descriptive error if QRCode generation fails', async () => {
    const spy = vi.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(new Error('Canvas failure'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = new UPIPaymentService({
      ...DEFAULT_SETTINGS,
      upiId: 'merchant@upi',
    });

    await expect(service.generateQRCodeDataUrl({
      amount: 50,
      invoiceNumber: 'INV-ERR',
    })).rejects.toThrow('Failed to render offline QR Code');

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('PaymentServiceFactory creates standard UPI provider', () => {
    const provider = PaymentServiceFactory.getUPIProvider(DEFAULT_SETTINGS);
    expect(provider).toBeInstanceOf(UPIPaymentService);
    expect(provider.id).toBe('dynamic-upi-offline');
    expect(provider.name).toBe('Dynamic UPI (Offline NPCI Specification)');
  });
});
