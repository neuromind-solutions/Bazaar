import { describe, it, expect } from 'vitest';
import {
  deductFifoBatches,
  getOldestAvailableBatch,
  explodeComboForStock,
  ProductBatch,
} from '@bazaar/shared-utils';

describe('FIFO Batch Inventory Allocation Engine (@bazaar/shared-utils)', () => {
  const sampleBatches: ProductBatch[] = [
    {
      id: 'B1',
      batchNumber: 'BATCH-JAN',
      expiryDate: '2026-06-01',
      quantity: 10,
      purchasePrice: 50,
    },
    {
      id: 'B2',
      batchNumber: 'BATCH-FEB',
      expiryDate: '2026-07-01',
      quantity: 15,
      purchasePrice: 55,
    },
    {
      id: 'B3',
      batchNumber: 'BATCH-MAR',
      expiryDate: '2026-08-01',
      quantity: 20,
      purchasePrice: 60,
    },
  ];

  it('identifies the oldest available non-empty batch by expiry date', () => {
    const oldest = getOldestAvailableBatch(sampleBatches);
    expect(oldest?.id).toBe('B1');
    expect(oldest?.batchNumber).toBe('BATCH-JAN');
  });

  it('deducts stock from the oldest batch when quantity is less than batch size', () => {
    const result = deductFifoBatches(sampleBatches, 4);
    expect(result.totalCost).toBe(4 * 50); // 200
    expect(result.updatedBatches[0].quantity).toBe(6);
    expect(result.updatedBatches[1].quantity).toBe(15);
    expect(result.updatedBatches[2].quantity).toBe(20);
    expect(result.exhaustedBatches).toHaveLength(0);
  });

  it('exhausts first batch and depletes partially from second batch (multi-batch FIFO)', () => {
    // Deduct 18 units: 10 from B1 @ 50 + 8 from B2 @ 55 = 500 + 440 = 940
    const result = deductFifoBatches(sampleBatches, 18);
    expect(result.totalCost).toBe(940);
    expect(result.updatedBatches[0].quantity).toBe(0); // Exhausted retained for audit
    expect(result.updatedBatches[1].quantity).toBe(7);  // 15 - 8 = 7
    expect(result.updatedBatches[2].quantity).toBe(20); // Untouched
    expect(result.exhaustedBatches).toHaveLength(1);
    expect(result.exhaustedBatches[0].batchNumber).toBe('BATCH-JAN');
  });

  it('handles empty batch list gracefully without throwing', () => {
    const result = deductFifoBatches([], 5);
    expect(result.totalCost).toBe(0);
    expect(result.updatedBatches).toEqual([]);
    expect(result.exhaustedBatches).toEqual([]);
  });

  it('handles zero quantity deduction without mutating batches', () => {
    const result = deductFifoBatches(sampleBatches, 0);
    expect(result.totalCost).toBe(0);
    expect(result.updatedBatches[0].quantity).toBe(10);
    expect(result.exhaustedBatches).toEqual([]);
  });

  describe('Combo Item Explosion', () => {
    it('explodes combo bundle into constituent line items scaled by quantity', () => {
      const comboProduct = {
        id: 'COMBO-1',
        isCombo: true,
        comboItems: [
          { productId: 'P1', productName: 'Tea 250g', quantity: 2 },
          { productId: 'P2', productName: 'Sugar 1kg', quantity: 1 },
        ],
      };
      const exploded = explodeComboForStock(comboProduct, 3);
      expect(exploded).toEqual([
        { productId: 'P1', quantityToDeduct: 6 },
        { productId: 'P2', quantityToDeduct: 3 },
      ]);
    });
  });
});
