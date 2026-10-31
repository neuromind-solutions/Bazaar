/**
 * @bazaar/shared-utils — Smart Reorder & Sales Velocity Engine
 *
 * Truthful calculations based on historical sales logs, lead times, and safety stock buffers.
 * Zero Math.random().
 */

export interface ProductInventoryInfo {
  id: string;
  name: string;
  category: string;
  barcode: string;
  quantity: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  purchasePrice: number;
  sellingPrice: number;
  supplierName?: string;
  unit?: string;
}

export interface HistoricalSaleItem {
  productId: string;
  quantity: number;
  dateTime: string;
}

export interface SupplierLeadTime {
  name: string;
  id?: string;
  leadTimeDays?: number;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  category: string;
  barcode: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  purchasePrice: number;
  supplierName: string;
  dailyVelocity: number;
  avgDailySales?: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedQty: number;
  estimatedCost: number;
  daysOfStockLeft: number;
  unit: string;
}

/**
 * Compute 30-day velocity, lead-time buffer, and reorder suggestions for inventory.
 */
export function calculateSmartReorderSuggestions(params: {
  products: ProductInventoryInfo[];
  salesItems: HistoricalSaleItem[];
  suppliers?: SupplierLeadTime[];
  daysWindow?: number;
  defaultLeadTimeDays?: number;
}): ReorderSuggestion[] {
  const {
    products,
    salesItems,
    suppliers = [],
    daysWindow = 30,
    defaultLeadTimeDays = 3,
  } = params;

  const now = Date.now();
  const windowMs = daysWindow * 24 * 60 * 60 * 1000;
  const cutoffTime = now - windowMs;

  // Build 30-day sales map per product
  const salesMap = new Map<string, number>();
  for (const item of salesItems) {
    const saleTime = new Date(item.dateTime).getTime();
    if (saleTime >= cutoffTime) {
      salesMap.set(item.productId, (salesMap.get(item.productId) || 0) + item.quantity);
    }
  }

  // Build supplier lead time lookup
  const leadTimeMap = new Map<string, number>();
  for (const s of suppliers) {
    if (s.name) leadTimeMap.set(s.name.toLowerCase(), s.leadTimeDays ?? defaultLeadTimeDays);
    if (s.id) leadTimeMap.set(s.id, s.leadTimeDays ?? defaultLeadTimeDays);
  }

  const suggestions: ReorderSuggestion[] = [];

  for (const product of products) {
    const totalSoldInWindow = salesMap.get(product.id) || 0;
    // Daily velocity V
    const dailyVelocity = Math.round((totalSoldInWindow / daysWindow) * 100) / 100;

    const supplierLeadTime =
      (product.supplierName ? leadTimeMap.get(product.supplierName.toLowerCase()) : undefined) ||
      defaultLeadTimeDays;

    // Safety stock: half-lead buffer based on velocity
    const safetyStock = Math.max(2, Math.ceil(dailyVelocity * supplierLeadTime * 0.5));
    // Reorder Point
    const minLevel = product.minStockLevel || 10;
    const reorderPoint = Math.max(minLevel, Math.ceil(dailyVelocity * supplierLeadTime) + safetyStock);

    const currentStock = product.quantity || 0;

    // Trigger suggestion when current stock is at or below reorder point
    if (currentStock <= reorderPoint) {
      const maxLevel = product.maxStockLevel || Math.max(minLevel * 3, Math.ceil(dailyVelocity * 30));
      // Suggested order qty
      const neededToMax = maxLevel - currentStock + Math.ceil(dailyVelocity * supplierLeadTime);
      const suggestedQty = Math.max(10, Math.ceil(neededToMax));

      const daysOfStockLeft =
        dailyVelocity > 0
          ? Math.max(0, Math.round((currentStock / dailyVelocity) * 10) / 10)
          : currentStock > 0 ? 999 : 0;

      suggestions.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        barcode: product.barcode,
        currentStock,
        minStockLevel: minLevel,
        maxStockLevel: maxLevel,
        purchasePrice: product.purchasePrice || 0,
        supplierName: product.supplierName || 'General Supplier',
        dailyVelocity,
        avgDailySales: dailyVelocity,
        leadTimeDays: supplierLeadTime,
        safetyStock,
        reorderPoint,
        suggestedQty,
        estimatedCost: Math.round(suggestedQty * (product.purchasePrice || 0) * 100) / 100,
        daysOfStockLeft,
        unit: product.unit || 'pcs',
      });
    }
  }

  // Sort by urgency: lowest days of stock left first
  return suggestions.sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft);
}
