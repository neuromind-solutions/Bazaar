import { describe, it, expect } from 'vitest';
import {
  getProductPriceForCustomer,
  convertUnitQuantity,
} from '@bazaar/shared-utils';

describe('Pricing & Customer Tier Engine (@bazaar/shared-utils)', () => {
  const baseProduct = {
    id: 'P-1',
    name: 'Basmati Rice 1kg',
    sellingPrice: 100,
    wholesalePrice: 85,
    distributorPrice: 78,
    vipPrice: 92,
  };

  describe('Customer Tier Pricing Resolution', () => {
    it('returns standard selling price for walk-in or undefined customer', () => {
      expect(getProductPriceForCustomer(baseProduct, null)).toBe(100);
      expect(getProductPriceForCustomer(baseProduct, undefined)).toBe(100);
    });

    it('returns standard selling price for regular tagged customer', () => {
      const regularCust = { id: 'C-1', name: 'Ramesh', phone: '9876500001', tag: 'Regular' as const };
      expect(getProductPriceForCustomer(baseProduct, regularCust)).toBe(100);
    });

    it('returns VIP tier price when customer is VIP', () => {
      const vipCust = { id: 'C-2', name: 'VIP Guest', phone: '9876500002', tag: 'VIP' as const };
      expect(getProductPriceForCustomer(baseProduct, vipCust)).toBe(92);
    });

    it('returns Wholesale tier price when customer is Wholesale', () => {
      const wsCust = { id: 'C-3', name: 'Wholesale Store', phone: '9876500003', tag: 'Wholesale' as const };
      expect(getProductPriceForCustomer(baseProduct, wsCust)).toBe(85);
    });

    it('returns Distributor tier price when customer is Distributor', () => {
      const distCust = { id: 'C-4', name: 'Regional Distributor', phone: '9876500004', tag: 'Distributor' as const };
      expect(getProductPriceForCustomer(baseProduct, distCust)).toBe(78);
    });

    it('falls back to standard sellingPrice if tier price is 0 or undefined', () => {
      const productNoTiers = { id: 'P-2', name: 'Salt', sellingPrice: 28 };
      const vipCust = { id: 'C-2', name: 'VIP Guest', phone: '9876500002', tag: 'VIP' as const };
      expect(getProductPriceForCustomer(productNoTiers, vipCust)).toBe(28);
    });

    it('applies variant price when variant item is evaluated', () => {
      const variant = { id: 'V-1', name: '5kg Bag', sellingPrice: 480 };
      expect(getProductPriceForCustomer(variant, null)).toBe(480);
    });
  });

  describe('Unit Conversions', () => {
    it('converts kilograms to grams accurately', () => {
      expect(convertUnitQuantity(1.5, 'kg', 'g')).toBe(1500);
      expect(convertUnitQuantity(250, 'g', 'kg')).toBe(0.25);
    });

    it('converts litres to millilitres accurately with aliases (l, liter, litre)', () => {
      expect(convertUnitQuantity(2, 'litre', 'ml')).toBe(2000);
      expect(convertUnitQuantity(2, 'l', 'ml')).toBe(2000);
      expect(convertUnitQuantity(2, 'liter', 'ml')).toBe(2000);
      expect(convertUnitQuantity(500, 'ml', 'litre')).toBe(0.5);
      expect(convertUnitQuantity(500, 'ml', 'l')).toBe(0.5);
      expect(convertUnitQuantity(500, 'ml', 'liter')).toBe(0.5);
    });

    it('returns original quantity when units are identical or conversion unknown', () => {
      expect(convertUnitQuantity(5, 'pcs', 'pcs')).toBe(5);
      expect(convertUnitQuantity(10, 'unknown', 'unknown')).toBe(10);
    });
  });
});
