/**
 * @bazaar/shared-utils — Batch FIFO Picking & Combo Explosion
 *
 * Pure functions for FIFO inventory allocation and composite product explosion.
 */

import { convertUnitQuantity } from './pricing';

export interface ProductBatch {
  id?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  mfgDate?: string;
}

export interface ComboItem {
  productId: string;
  productName?: string;
  quantity: number;
  unit?: string;
}

/**
 * Find the oldest available batch for a product based on FIFO (earliest expiry date first).
 */
export function getOldestAvailableBatch(
  batches: ProductBatch[]
): ProductBatch | undefined {
  if (!batches || batches.length === 0) return undefined;

  const available = batches.filter(b => (b.quantity || 0) > 0);
  if (available.length === 0) return undefined;

  return [...available].sort((a, b) => {
    const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    return dateA - dateB;
  })[0];
}

/**
 * Deduct a sold quantity across batches in FIFO order.
 * Returns the updated batches array and the actual weighted cost of goods sold.
 */
export function deductFifoBatches(
  batches: ProductBatch[],
  quantityToDeduct: number
): { updatedBatches: ProductBatch[]; totalCost: number; exhaustedBatches: ProductBatch[] } {
  let remaining = quantityToDeduct;
  let totalCost = 0;
  const exhaustedBatches: ProductBatch[] = [];

  const sorted = [...batches].sort((a, b) => {
    const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    return dateA - dateB;
  });

  const updatedBatches = sorted.map(batch => {
    if (remaining <= 0 || batch.quantity <= 0) return { ...batch };

    const take = Math.min(batch.quantity, remaining);
    remaining -= take;
    totalCost += take * (batch.purchasePrice || 0);
    const newQty = batch.quantity - take;
    const updated = {
      ...batch,
      quantity: newQty,
    };
    if (newQty === 0) {
      exhaustedBatches.push(updated);
    }
    return updated;
  });

  return { updatedBatches, totalCost, exhaustedBatches };
}

/**
 * Explode a combo/loose product sale into stock deductions on underlying components.
 */
export function explodeComboForStock(
  product: {
    id: string;
    isCombo?: boolean;
    comboItems?: ComboItem[];
    unit?: string;
  },
  quantitySold: number,
  findProductUnit?: (id: string) => string | undefined
): Array<{ productId: string; quantityToDeduct: number }> {
  if (product.isCombo && product.comboItems && product.comboItems.length > 0) {
    return product.comboItems.map(item => {
      const baseUnit = findProductUnit ? findProductUnit(item.productId) : item.unit;
      const componentQty = item.quantity * quantitySold;
      const convertedQty = baseUnit && item.unit
        ? convertUnitQuantity(componentQty, item.unit, baseUnit)
        : componentQty;

      return {
        productId: item.productId,
        quantityToDeduct: convertedQty,
      };
    });
  }

  // Not a combo — deduct from self
  return [{ productId: product.id, quantityToDeduct: quantitySold }];
}
