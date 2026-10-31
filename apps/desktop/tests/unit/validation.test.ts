import { describe, it, expect } from 'vitest';
import {
  generateEAN13,
  validateEAN13,
  validatePhone,
  validateEmail,
  validateGstin,
  validatePin,
  validatePrice,
  validateQuantity,
  validateDiscount,
  sanitizeNumericInput,
  sanitizeDecimalInput,
} from '@bazaar/shared-utils';

describe('Validation & Barcode Engine (@bazaar/shared-utils)', () => {
  describe('EAN-13 Mathematical Calculations', () => {
    it('generates a 13-digit barcode with correct prefix', () => {
      const barcode = generateEAN13('890');
      expect(barcode).toHaveLength(13);
      expect(barcode.startsWith('890')).toBe(true);
      expect(/^\d{13}$/.test(barcode)).toBe(true);
    });

    it('generates barcodes that pass official EAN-13 checksum validation', () => {
      for (let i = 0; i < 20; i++) {
        const barcode = generateEAN13();
        expect(validateEAN13(barcode)).toBe(true);
      }
    });

    it('validates known valid EAN-13 barcodes', () => {
      expect(validateEAN13('8901234001035')).toBe(true); // Tata Salt
      expect(validateEAN13('8901234001011')).toBe(true); // Fortune Oil
      expect(validateEAN13('8901234001028')).toBe(true); // Atta
    });

    it('rejects invalid or corrupted EAN-13 barcodes', () => {
      expect(validateEAN13('8901234001030')).toBe(false); // wrong checksum
      expect(validateEAN13('12345')).toBe(false); // too short
      expect(validateEAN13('89012340010350')).toBe(false); // too long
      expect(validateEAN13('890123400103A')).toBe(false); // alphanumeric
      expect(validateEAN13('')).toBe(false); // empty
    });
  });

  describe('Contact & Tax Identifier Validators', () => {
    it('validates standard 10-digit Indian phone numbers', () => {
      expect(validatePhone('9876543210').isValid).toBe(true);
      expect(validatePhone('1234567890').isValid).toBe(false); // does not start with 6-9
      expect(validatePhone('98765').isValid).toBe(false); // too short
      expect(validatePhone('abcdefghij').isValid).toBe(false);
    });

    it('validates standard email addresses', () => {
      expect(validateEmail('customer@gmail.com').isValid).toBe(true);
      expect(validateEmail('owner.shop@bazaar.co.in').isValid).toBe(true);
      expect(validateEmail('', true).isValid).toBe(false);
      expect(validateEmail('', false).isValid).toBe(true);
    });

    it('validates GSTIN structure', () => {
      expect(validateGstin('29ABCDE1234F1Z5').isValid).toBe(true);
      expect(validateGstin('invalidgst').isValid).toBe(false);
      expect(validateGstin('29ABCDE1234F1Z').isValid).toBe(false); // 14 chars
    });

    it('validates 4-digit security PIN', () => {
      expect(validatePin('1234').isValid).toBe(true);
      expect(validatePin('0000').isValid).toBe(true);
      expect(validatePin('9999').isValid).toBe(true);
      expect(validatePin('123').isValid).toBe(false); // 3 digits
      expect(validatePin('12345').isValid).toBe(false); // 5 digits
      expect(validatePin('abcd').isValid).toBe(false);
    });
  });

  describe('Numeric Sanitizers & Price Bounds', () => {
    it('sanitizes pure numeric string input with max length', () => {
      expect(sanitizeNumericInput('98a76b5', 5)).toBe('98765');
      expect(sanitizeNumericInput('123456789012', 10)).toBe('1234567890');
    });

    it('sanitizes decimal currency inputs', () => {
      expect(sanitizeDecimalInput('123.456', 2)).toBe('123.45');
      expect(sanitizeDecimalInput('99.9.9')).toBe('99.99');
      expect(sanitizeDecimalInput('abc10.50xyz')).toBe('10.50');
    });

    it('validates price, quantity, and discount bounds', () => {
      expect(validatePrice(100).isValid).toBe(true);
      expect(validatePrice(0).isValid).toBe(true);
      expect(validatePrice(-10).isValid).toBe(false);
      expect(validatePrice(NaN).isValid).toBe(false);

      expect(validateQuantity(5).isValid).toBe(true);
      expect(validateQuantity(0).isValid).toBe(true);
      expect(validateQuantity(-1).isValid).toBe(false);

      expect(validateDiscount(15, 100).isValid).toBe(true);
      expect(validateDiscount(0, 100).isValid).toBe(true);
      expect(validateDiscount(-5, 100).isValid).toBe(false);
      expect(validateDiscount(150, 100).isValid).toBe(false); // Exceeds total
    });
  });
});
