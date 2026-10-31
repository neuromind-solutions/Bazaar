/**
 * @bazaar/shared-utils
 *
 * Pure, platform-free business logic shared between desktop and mobile.
 * No DOM, no Electron, no expo-* imports allowed in this package.
 */

export const SHARED_UTILS_VERSION = '1.0.0';

export {
  buildUpiPayload,
  buildReceiptModel,
  resolveScan,
  type ReceiptModel,
  type ReceiptLineItem,
} from './receipt';

export {
  UNIT_CONVERSIONS,
  convertUnitQuantity,
  getProductPriceForCustomer,
  type UnitConversionRule,
} from './pricing';

export {
  getOldestAvailableBatch,
  deductFifoBatches,
  explodeComboForStock,
  type ProductBatch,
  type ComboItem,
} from './batches';

export {
  calculateRunningBalance,
  recomputeLedgerBalances,
  type CustomerLedgerEntryModel,
} from './ledger';

export {
  calculateSmartReorderSuggestions,
  type ReorderSuggestion,
  type ProductInventoryInfo,
  type HistoricalSaleItem,
  type SupplierLeadTime,
} from './velocity';

export {
  generateSampleCsvContent,
  generateSampleExcelXmlContent,
  generateSampleXlsxBinary,
  parseDelimitedText,
  validateImportRows,
  exportProductsToCsv,
  exportProductsToExcelXml,
  exportProductsToXlsxBinary,
  SAMPLE_TEMPLATE_HEADERS,
  SAMPLE_TEMPLATE_ROWS,
  type ParsedImportRow,
  type ImportValidationResult,
  type ImportableProduct,
} from './excelImport';

export { buildXlsxWorkbook } from './xlsxBuilder';

export {
  sha256Hex,
  hashPin,
  verifyPin,
} from './security';

/**
 * Universal safe blob downloader
 */
export function downloadBlob(blob: any, filename: string): void {
  const g = globalThis as any;
  if (!g || !g.document || !g.URL) return;
  const url = g.URL.createObjectURL(blob);
  const link = g.document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  link.setAttribute('download', filename);
  link.setAttribute('rel', 'noopener noreferrer');
  g.document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    try {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      g.URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup error
    }
  }, 10000);
}
export {
  PHONE_REGEX,
  EMAIL_REGEX,
  GSTIN_REGEX,
  PIN_REGEX,
  BARCODE_REGEX,
  validatePhone,
  validateEmail,
  validateGstin,
  validatePin,
  validateBarcode,
  validatePrice,
  validateQuantity,
  validateDiscount,
  sanitizeNumericInput,
  sanitizeDecimalInput,
  blockInvalidNumberKeys,
  blockNonDigitKeys,
  generateEAN13,
  validateEAN13,
  type ValidationResult,
  type KeyboardLikeEvent,
} from './validation';

