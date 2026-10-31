import { describe, it, expect } from 'vitest';
import {
  calculateSmartReorderSuggestions,
  ProductInventoryInfo,
  HistoricalSaleItem,
  SupplierLeadTime,
} from '@bazaar/shared-utils';

describe('Smart Reorder 30-Day Velocity Engine (@bazaar/shared-utils)', () => {
  const products: ProductInventoryInfo[] = [
    {
      id: 'P1',
      name: 'Sunflower Oil 1L',
      quantity: 5,
      minStockLevel: 10,
      purchasePrice: 135,
      supplierName: 'Fortune Distributors',
    },
    {
      id: 'P2',
      name: 'Tata Salt 1kg',
      quantity: 120, // High stock
      minStockLevel: 10,
      purchasePrice: 22,
      supplierName: 'Tata Consumer',
    },
  ];

  // 30 units sold in last 30 days = 1.0 units/day velocity
  const historicalSales: HistoricalSaleItem[] = [
    { productId: 'P1', quantity: 15, dateTime: new Date(Date.now() - 5 * 86400000).toISOString() },
    { productId: 'P1', quantity: 15, dateTime: new Date(Date.now() - 15 * 86400000).toISOString() },
  ];

  const leadTimes: SupplierLeadTime[] = [
    { supplierName: 'Fortune Distributors', leadTimeDays: 3 },
  ];

  it('suggests reorder when current stock is below lead-time demand buffer', () => {
    const suggestions = calculateSmartReorderSuggestions({
      products,
      salesItems: historicalSales,
      suppliers: leadTimes,
      daysWindow: 30,
    });
    expect(suggestions.length).toBeGreaterThan(0);

    const p1Suggestion = suggestions.find(s => s.productId === 'P1');
    expect(p1Suggestion).toBeDefined();
    expect(p1Suggestion?.dailyVelocity).toBeGreaterThan(0);
    expect(p1Suggestion?.suggestedQty).toBeGreaterThan(0);
  });

  it('does not suggest reorder for well-stocked products', () => {
    const suggestions = calculateSmartReorderSuggestions({
      products,
      salesItems: historicalSales,
      suppliers: leadTimes,
      daysWindow: 30,
    });
    const p2Suggestion = suggestions.find(s => s.productId === 'P2');
    expect(p2Suggestion).toBeUndefined();
  });

  it('handles empty historical sales without NaN or division by zero', () => {
    const suggestions = calculateSmartReorderSuggestions({
      products,
      salesItems: [],
      suppliers: leadTimes,
      daysWindow: 30,
    });
    expect(Array.isArray(suggestions)).toBe(true);
    // Even with 0 velocity, stock (5) is below minStockLevel (10)
    const p1 = suggestions.find(s => s.productId === 'P1');
    expect(p1?.dailyVelocity).toBe(0);
    expect(isNaN(p1?.suggestedReorderQty || 0)).toBe(false);
  });
});
