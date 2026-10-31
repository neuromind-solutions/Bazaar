import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  Check,
  FileText
} from 'lucide-react';
import { Product, ShopSettings } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import {
  generateSampleCsvContent,
  generateSampleExcelXmlContent,
  generateSampleXlsxBinary,
  parseDelimitedText,
  validateImportRows,
  ParsedImportRow,
  ImportValidationResult,
} from '@bazaar/shared-utils';
import { downloadBlob } from '../utils/download';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShopSettings;
  onImportComplete: (importedCount: number) => void;
}

type DuplicateStrategy = 'add_stock' | 'overwrite' | 'skip';

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  settings,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('add_stock');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currency = settings.currencySymbol || '₹';

  if (!isOpen) return null;

  // 1a. Download Native Excel Template (.xlsx)
  const handleDownloadExcel = () => {
    const xlsxBuffer = generateSampleXlsxBinary();
    const blob = new Blob([xlsxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, 'Bazaar_POS_Sample_Products_Template.xlsx');
  };

  // 1b. Download Sample CSV Template (.csv)
  const handleDownloadCsv = () => {
    const csvContent = generateSampleCsvContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'Bazaar_POS_Sample_Products_Template.csv');
  };

  // 2. Process Selected File
  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const rawRows = parseDelimitedText(content);
      const existingProducts = sqliteDB.getProducts();
      const result = validateImportRows(rawRows, existingProducts);
      setValidationResult(result);
    };

    reader.readAsText(selectedFile);
  };

  // 3. Commit Bulk Import to Database
  const handleCommitImport = async () => {
    if (!validationResult || validationResult.validRows === 0) return;

    setIsProcessing(true);
    setProgressPercent(10);

    const validRows = validationResult.rows.filter(r => r.isValid);
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const existingProducts = sqliteDB.getProducts();
    const barcodeMap = new Map<string, Product>();
    existingProducts.forEach(p => {
      if (p.barcode) barcodeMap.set(p.barcode.trim(), p);
    });

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const pData = row.product;
      const barcode = pData.barcode || '';
      const existing = barcodeMap.get(barcode);

      if (existing) {
        if (duplicateStrategy === 'skip') {
          skippedCount++;
          continue;
        } else if (duplicateStrategy === 'overwrite') {
          // Overwrite existing product
          sqliteDB.saveProduct({
            ...existing,
            name: pData.name || existing.name,
            category: pData.category || existing.category,
            unit: pData.unit || existing.unit,
            purchasePrice: pData.purchasePrice ?? existing.purchasePrice,
            sellingPrice: pData.sellingPrice ?? existing.sellingPrice,
            wholesalePrice: pData.wholesalePrice ?? existing.wholesalePrice,
            distributorPrice: pData.distributorPrice ?? existing.distributorPrice,
            vipPrice: pData.vipPrice ?? existing.vipPrice,
            quantity: pData.quantity ?? existing.quantity,
            minStockLevel: pData.minStockLevel ?? existing.minStockLevel,
            maxStockLevel: pData.maxStockLevel ?? existing.maxStockLevel,
            shelfLocation: pData.shelfLocation || existing.shelfLocation,
            supplierName: pData.supplierName || existing.supplierName || 'Bulk Import',
          });
          updatedCount++;
        } else if (duplicateStrategy === 'add_stock') {
          // Add stock to existing
          const additionalQty = pData.quantity || 0;
          if (additionalQty > 0) {
            sqliteDB.addStock(
              existing.id,
              additionalQty,
              pData.purchasePrice || existing.purchasePrice,
              pData.sellingPrice || existing.sellingPrice,
              'Bulk Excel Import'
            );
          }
          // Update prices & metadata
          sqliteDB.saveProduct({
            ...existing,
            sellingPrice: pData.sellingPrice || existing.sellingPrice,
            purchasePrice: pData.purchasePrice || existing.purchasePrice,
            wholesalePrice: pData.wholesalePrice ?? existing.wholesalePrice,
            shelfLocation: pData.shelfLocation || existing.shelfLocation,
          });
          updatedCount++;
        }
      } else {
        // Brand new product insert
        const newProduct = sqliteDB.saveProduct({
          name: pData.name!,
          barcode: pData.barcode!,
          category: pData.category || 'General',
          unit: pData.unit || 'pcs',
          purchasePrice: pData.purchasePrice || 0,
          sellingPrice: pData.sellingPrice || 0,
          wholesalePrice: pData.wholesalePrice,
          distributorPrice: pData.distributorPrice,
          vipPrice: pData.vipPrice,
          quantity: pData.quantity || 0,
          minStockLevel: pData.minStockLevel || 10,
          maxStockLevel: pData.maxStockLevel || 100,
          shelfLocation: pData.shelfLocation || '',
          supplierName: pData.supplierName || 'Bulk Import',
        });

        // Add initial inward batch for FIFO tracking if stock > 0
        if ((pData.quantity || 0) > 0) {
          sqliteDB.addBatchToProduct(newProduct.id, {
            batchNumber: `INIT-${newProduct.id.slice(-4)}`,
            expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
            quantity: pData.quantity || 0,
            purchasePrice: pData.purchasePrice || 0,
            sellingPrice: pData.sellingPrice || 0,
          });
        }
        importedCount++;
      }

      setProgressPercent(Math.round(((i + 1) / validRows.length) * 100));
    }

    setIsProcessing(false);
    onImportComplete(importedCount + updatedCount);
    onClose();
  };

  const filteredRows = validationResult?.rows.filter(r => {
    if (filterMode === 'valid') return r.isValid && r.warnings.length === 0;
    if (filterMode === 'warning') return r.isValid && r.warnings.length > 0;
    if (filterMode === 'error') return !r.isValid;
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                Bulk Product Import (Excel / CSV)
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-semibold">
                  Zero Data Loss
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instantly populate your store inventory from an existing Excel or CSV spreadsheet.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Step 1: Download Template Banner & Upload Dropzone */}
          {!validationResult ? (
            <div className="space-y-4">
              
              {/* Template Download Card */}
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Download Formatted Sample Template
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Open directly in Microsoft Excel, Google Sheets, or LibreOffice with pre-styled columns.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={handleDownloadExcel}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                    title="Download styled Microsoft Excel spreadsheet (.xlsx)"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download Excel Template (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleDownloadCsv}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Download universal CSV format (.csv)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                  <UploadCloud className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Click to browse or drag & drop your Excel / CSV file
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports .csv, .tsv, .txt files exported from Excel, Tally, Marg, or custom POS
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .tsv, .txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Required Columns Info Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Supported Column Headers (Auto-Mapped):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Product Name *',
                    'Barcode',
                    'Category',
                    'Unit',
                    'Purchase Price',
                    'Selling Price',
                    'MRP',
                    'Current Stock',
                    'Min Stock Level',
                    'Shelf Location',
                    'Tax Percent',
                    'HSN Code',
                  ].map((col) => (
                    <span
                      key={col}
                      className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-[10px] text-slate-600 dark:text-slate-400"
                    >
                      {col}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  * Only <strong>Product Name</strong> is mandatory. If Barcode is left blank, a unique 12-digit code will be generated automatically.
                </p>
              </div>

            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Validation Summary Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Rows</span>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{validationResult.totalRows}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Ready to Import</span>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{validationResult.validRows}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Duplicates Detected</span>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{validationResult.duplicateCount}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Invalid Rows</span>
                  <p className="text-xl font-bold text-rose-700 dark:text-rose-300">{validationResult.invalidRows}</p>
                </div>
              </div>

              {/* Duplicate Strategy Radio Selector */}
              {validationResult.duplicateCount > 0 && (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    How would you like to handle duplicate barcodes found in your file?
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 transition ${
                      duplicateStrategy === 'add_stock'
                        ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 text-amber-900 dark:text-amber-100 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'add_stock'}
                        onChange={() => setDuplicateStrategy('add_stock')}
                        className="accent-emerald-600"
                      />
                      <span>Add Stock to Existing (Recommended)</span>
                    </label>

                    <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 transition ${
                      duplicateStrategy === 'overwrite'
                        ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 text-amber-900 dark:text-amber-100 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'overwrite'}
                        onChange={() => setDuplicateStrategy('overwrite')}
                        className="accent-emerald-600"
                      />
                      <span>Overwrite Existing Data</span>
                    </label>

                    <label className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 transition ${
                      duplicateStrategy === 'skip'
                        ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-400 text-amber-900 dark:text-amber-100 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="accent-emerald-600"
                      />
                      <span>Skip Duplicates (Keep Existing)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Filter Tabs for Preview Table */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition ${
                      filterMode === 'all'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400'
                    }`}
                  >
                    All Rows ({validationResult.totalRows})
                  </button>
                  <button
                    onClick={() => setFilterMode('valid')}
                    className={`px-3 py-1 rounded-lg font-semibold transition ${
                      filterMode === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
                    }`}
                  >
                    Valid Only ({validationResult.validRows - validationResult.duplicateCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('warning')}
                    className={`px-3 py-1 rounded-lg font-semibold transition ${
                      filterMode === 'warning'
                        ? 'bg-amber-600 text-white'
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    Warnings & Duplicates ({validationResult.duplicateCount})
                  </button>
                  {validationResult.invalidRows > 0 && (
                    <button
                      onClick={() => setFilterMode('error')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        filterMode === 'error'
                          ? 'bg-rose-600 text-white'
                          : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50'
                      }`}
                    >
                      Errors ({validationResult.invalidRows})
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setFile(null);
                    setValidationResult(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline font-medium"
                >
                  Choose Different File
                </button>
              </div>

              {/* Live Preview Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">Barcode</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5">Buy Price</th>
                      <th className="p-2.5">Sell Price</th>
                      <th className="p-2.5">Stock</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono text-[11px]">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-slate-400">
                          No items match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                          <td className="p-2.5 text-slate-400 font-sans">{row.rowNumber}</td>
                          <td className="p-2.5 font-bold font-sans text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
                            {row.product.name || <span className="text-rose-500">Missing</span>}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{row.product.barcode}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300 font-sans">{row.product.category}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300 font-sans">{row.product.unit}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{currency}{row.product.purchasePrice}</td>
                          <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">{currency}{row.product.sellingPrice}</td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{row.product.quantity}</td>
                          <td className="p-2.5 font-sans">
                            {row.errors.length > 0 ? (
                              <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded font-semibold text-[10px]" title={row.errors.join(', ')}>
                                ✕ {row.errors[0]}
                              </span>
                            ) : row.warnings.length > 0 ? (
                              <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded font-semibold text-[10px]" title={row.warnings.join(', ')}>
                                ⚠️ {row.isExistingInDb ? 'Duplicate Barcode' : row.warnings[0]}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-semibold text-[10px]">
                                ✓ Valid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Progress Bar when committing */}
              {isProcessing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Importing & Creating Batches...</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Cancel
          </button>

          {validationResult && (
            <button
              onClick={handleCommitImport}
              disabled={isProcessing || validationResult.validRows === 0}
              className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition ${
                (isProcessing || validationResult.validRows === 0) ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing {validationResult.validRows} Items...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Commit Import ({validationResult.validRows} Products)</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
