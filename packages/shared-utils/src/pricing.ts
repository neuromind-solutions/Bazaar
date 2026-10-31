/**
 * @bazaar/shared-utils — Unit Conversions & Customer Pricing
 *
 * Pure, platform-free calculation functions.
 */

export interface UnitConversionRule {
  fromUnit: string;
  toUnit: string;
  factor: number;
}

export const UNIT_CONVERSIONS: UnitConversionRule[] = [
  { fromUnit: 'kg', toUnit: 'g', factor: 1000 },
  { fromUnit: 'g', toUnit: 'kg', factor: 0.001 },
  { fromUnit: 'litre', toUnit: 'ml', factor: 1000 },
  { fromUnit: 'ml', toUnit: 'litre', factor: 0.001 },
  { fromUnit: 'liter', toUnit: 'ml', factor: 1000 },
  { fromUnit: 'ml', toUnit: 'liter', factor: 0.001 },
  { fromUnit: 'l', toUnit: 'ml', factor: 1000 },
  { fromUnit: 'ml', toUnit: 'l', factor: 0.001 },
  { fromUnit: 'l', toUnit: 'litre', factor: 1 },
  { fromUnit: 'litre', toUnit: 'l', factor: 1 },
  { fromUnit: 'sack', toUnit: 'kg', factor: 50 },
  { fromUnit: 'box', toUnit: 'pcs', factor: 10 },
  { fromUnit: 'packet', toUnit: 'pcs', factor: 1 },
];

/**
 * Convert a quantity from one unit of measure to another.
 */
export function convertUnitQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
  customRules: UnitConversionRule[] = UNIT_CONVERSIONS
): number {
  if (!fromUnit || !toUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) {
    return qty;
  }

  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();

  const direct = customRules.find(
    r => r.fromUnit.toLowerCase() === from && r.toUnit.toLowerCase() === to
  );
  if (direct) return qty * direct.factor;

  const inverse = customRules.find(
    r => r.fromUnit.toLowerCase() === to && r.toUnit.toLowerCase() === from
  );
  if (inverse) return qty / inverse.factor;

  return qty;
}

/**
 * Compute the effective price for a customer based on customer tier tag.
 */
export function getProductPriceForCustomer(
  product: {
    sellingPrice: number;
    wholesalePrice?: number;
    distributorPrice?: number;
    vipPrice?: number;
  },
  customerOrTag?: string | { tag?: string } | null
): number {
  if (!customerOrTag) return product.sellingPrice;

  const rawTag = typeof customerOrTag === 'string' ? customerOrTag : customerOrTag.tag;
  if (!rawTag || typeof rawTag !== 'string') return product.sellingPrice;

  const tag = rawTag.trim().toLowerCase();

  if (tag === 'wholesale' && product.wholesalePrice && product.wholesalePrice > 0) {
    return product.wholesalePrice;
  }
  if (tag === 'distributor' && product.distributorPrice && product.distributorPrice > 0) {
    return product.distributorPrice;
  }
  if (tag === 'vip' && product.vipPrice && product.vipPrice > 0) {
    return product.vipPrice;
  }

  return product.sellingPrice;
}
