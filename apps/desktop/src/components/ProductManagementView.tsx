import React, { useState } from 'react';
import { Product, ShopSettings, ProductVariant, ProductBatch, ComboItem } from '../types';
import { BulkImportModal } from './BulkImportModal';
import {
  exportProductsToCsv,
  exportProductsToXlsxBinary,
  blockInvalidNumberKeys,
  validateBarcode,
  validatePrice,
  validateQuantity
} from '@bazaar/shared-utils';
import { downloadBlob } from '../utils/download';

/**
 * Generate a valid EAN-13 barcode with correct Luhn checksum.
 * Uses the 890 prefix (India GS1 prefix range) for auto-generated codes.
 */
function generateEAN13(): string {
  // 890xxxxx prefix for India, random 9 more digits = 12 digits total
  const prefix = '890';
  const randomPart = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const digits = prefix + randomPart;
  // Compute EAN-13 check digit (alternating weight 1 and 3)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
}
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Barcode, 
  AlertTriangle, 
  Filter, 
  X, 
  Check, 
  Calendar, 
  DollarSign, 
  Truck, 
  Tag,
  Sparkles,
  Layers,
  Clock,
  Boxes,
  MapPin,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  UploadCloud
} from 'lucide-react';

interface ProductManagementViewProps {
  products: Product[];
  settings: ShopSettings;
  onSaveProduct: (productData: Partial<Product> & { name: string; barcode: string; purchasePrice: number; sellingPrice: number; quantity: number }) => void;
  onDeleteProduct: (id: string) => void;
  onOpenBarcodeGenerator: (product: Product) => void;
}

export const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  products,
  settings,
  onSaveProduct,
  onDeleteProduct,
  onOpenBarcodeGenerator,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out' | 'expiring'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'pricing' | 'batches' | 'combo'>('basic');

  const handleExportExcel = () => {
    if (products.length === 0) {
      alert('No products available to export.');
      return;
    }
    const xlsxBuffer = exportProductsToXlsxBinary(products);
    const blob = new Blob([xlsxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, `Bazaar_POS_Inventory_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCsv = () => {
    if (products.length === 0) {
      alert('No products available to export.');
      return;
    }
    const csvContent = exportProductsToCsv(products);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `Bazaar_POS_Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const [formData, setFormData] = useState({
    name: '',
    category: 'Grains & Atta',
    barcode: '',
    purchasePrice: '',
    sellingPrice: '',
    quantity: '',
    supplierName: '',
    expiryDate: '',
    unit: 'pcs',
    wholesalePrice: '',
    distributorPrice: '',
    vipPrice: '',
    minStockLevel: '',
    maxStockLevel: '',
    shelfLocation: '',
    isCombo: false,
    comboItems: [] as ComboItem[],
    variants: [] as ProductVariant[],
    batches: [] as ProductBatch[],
  });

  // Batch Adder State inside Modal
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchQty, setNewBatchQty] = useState('');
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [newBatchPrice, setNewBatchPrice] = useState('');

  const currency = settings.currencySymbol || '₹';
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setActiveFormTab('basic');
    setFormData({
      name: '',
      category: 'Grains & Atta',
      barcode: generateEAN13(),
      purchasePrice: '',
      sellingPrice: '',
      quantity: '',
      supplierName: '',
      expiryDate: '',
      unit: 'pcs',
      wholesalePrice: '',
      distributorPrice: '',
      vipPrice: '',
      minStockLevel: '10',
      maxStockLevel: '100',
      shelfLocation: '',
      isCombo: false,
      comboItems: [],
      variants: [],
      batches: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setActiveFormTab('basic');
    setFormData({
      name: product.name,
      category: product.category,
      barcode: product.barcode,
      purchasePrice: product.purchasePrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      quantity: product.quantity.toString(),
      supplierName: product.supplierName || '',
      expiryDate: product.expiryDate || '',
      unit: product.unit || 'pcs',
      wholesalePrice: product.wholesalePrice ? product.wholesalePrice.toString() : '',
      distributorPrice: product.distributorPrice ? product.distributorPrice.toString() : '',
      vipPrice: product.vipPrice ? product.vipPrice.toString() : '',
      minStockLevel: product.minStockLevel ? product.minStockLevel.toString() : '10',
      maxStockLevel: product.maxStockLevel ? product.maxStockLevel.toString() : '100',
      shelfLocation: product.shelfLocation || '',
      isCombo: !!product.isCombo,
      comboItems: product.comboItems || [],
      variants: product.variants || [],
      batches: product.batches || [],
    });
    setIsModalOpen(true);
  };

  const handleGenerateBarcode = () => {
    const randomBarcode = generateEAN13();
    setFormData(prev => ({ ...prev, barcode: randomBarcode }));
  };

  const handleAddBatch = () => {
    if (!newBatchNumber || !newBatchQty || !newBatchExpiry) {
      alert('Please fill in Batch Number, Quantity, and Expiry Date.');
      return;
    }
    const batch: ProductBatch = {
      id: `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      batchNumber: newBatchNumber.trim(),
      quantity: parseFloat(newBatchQty) || 0,
      expiryDate: newBatchExpiry,
      purchasePrice: parseFloat(newBatchPrice) || parseFloat(formData.purchasePrice) || 0,
    };
    setFormData(prev => ({
      ...prev,
      batches: [...prev.batches, batch],
    }));
    setNewBatchNumber('');
    setNewBatchQty('');
    setNewBatchExpiry('');
    setNewBatchPrice('');
  };

  const handleRemoveBatch = (index: number) => {
    setFormData(prev => ({
      ...prev,
      batches: prev.batches.filter((_, i) => i !== index),
    }));
  };

  const handleAddComboComponent = (compProductId: string) => {
    const targetProduct = products.find(p => p.id === compProductId);
    if (!targetProduct) return;
    setFormData(prev => ({
      ...prev,
      comboItems: [
        ...prev.comboItems,
        {
          productId: targetProduct.id,
          productName: targetProduct.name,
          qty: 1,
          unit: targetProduct.unit || 'pcs',
        },
      ],
    }));
  };

  const handleRemoveComboComponent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      comboItems: prev.comboItems.filter((_, i) => i !== index),
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Product name is required.');
      return;
    }

    const barcodeVal = validateBarcode(formData.barcode);
    if (!barcodeVal.isValid) {
      alert(barcodeVal.error || 'Please enter a valid barcode (at least 6 characters).');
      return;
    }

    const cost = parseFloat(formData.purchasePrice);
    if (isNaN(cost) || cost < 0) {
      alert('Cost price must be a valid positive number.');
      return;
    }

    const retail = parseFloat(formData.sellingPrice);
    if (isNaN(retail) || retail <= 0) {
      alert('Retail selling price must be greater than 0.');
      return;
    }

    if (retail < cost) {
      const proceed = confirm(
        `Warning: Retail price (${currency}${retail}) is less than Cost price (${currency}${cost}).\n\nThis will result in a negative profit margin. Are you sure you want to save?`
      );
      if (!proceed) return;
    }

    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty < 0) {
      alert('Current stock quantity cannot be negative.');
      return;
    }

    const payload: Partial<Product> & { name: string; barcode: string; purchasePrice: number; sellingPrice: number; quantity: number } = {
      id: editingProduct ? editingProduct.id : undefined,
      name: formData.name.trim(),
      category: formData.category,
      barcode: formData.barcode.trim(),
      purchasePrice: cost,
      sellingPrice: retail,
      quantity: qty,
      supplierName: formData.supplierName || undefined,
      expiryDate: formData.expiryDate || undefined,
      unit: formData.unit,
      wholesalePrice: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : undefined,
      distributorPrice: formData.distributorPrice ? parseFloat(formData.distributorPrice) : undefined,
      vipPrice: formData.vipPrice ? parseFloat(formData.vipPrice) : undefined,
      minStockLevel: formData.minStockLevel ? Math.max(0, parseFloat(formData.minStockLevel)) : undefined,
      maxStockLevel: formData.maxStockLevel ? Math.max(0, parseFloat(formData.maxStockLevel)) : undefined,
      shelfLocation: formData.shelfLocation || undefined,
      isCombo: formData.isCombo,
      comboItems: formData.isCombo ? formData.comboItems : undefined,
      variants: formData.variants.length > 0 ? formData.variants : undefined,
      batches: formData.batches.length > 0 ? formData.batches : undefined,
    };

    onSaveProduct(payload);
    setIsModalOpen(false);
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());

    const isLow = p.quantity <= (p.minStockLevel || settings.lowStockThreshold || 10) && p.quantity > 0;
    const isOut = p.quantity <= 0;
    const isExpiring = p.expiryDate ? (new Date(p.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000) : false;

    if (filterType === 'low') return matchesCategory && matchesSearch && isLow;
    if (filterType === 'out') return matchesCategory && matchesSearch && isOut;
    if (filterType === 'expiring') return matchesCategory && matchesSearch && isExpiring;

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-3 md:p-5 space-y-3.5 max-w-7xl mx-auto">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            Inventory & Catalog
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            {products.length} registered products • FIFO batch tracking active
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg font-medium text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200/60 dark:border-zinc-700/60"
            title="Export catalog to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg font-medium text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200/60 dark:border-zinc-700/60"
            title="Export catalog to CSV (.csv)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg font-medium text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200/60 dark:border-zinc-700/60"
            title="Import products in bulk from Excel or CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
            <span>Bulk Import</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name, barcode, or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-xs outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-400 dark:focus:border-zinc-500 text-slate-800 dark:text-zinc-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
          {/* Quick Filter Buttons */}
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterType === 'all'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            All ({products.length})
          </button>
          <button
            onClick={() => setFilterType('low')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterType === 'low'
                ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterType('out')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterType === 'out'
                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Out of Stock
          </button>
          <button
            onClick={() => setFilterType('expiring')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filterType === 'expiring'
                ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            Expiring &lt;30d
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 dark:bg-zinc-950/40 border-b border-slate-200/70 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] font-medium uppercase tracking-wider">
                <th className="p-3">Product Name</th>
                <th className="p-3">Barcode</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-center">Stock</th>
                <th className="p-3">Batches / Kits</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-xs">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-zinc-500 text-xs">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLow = p.quantity <= (p.minStockLevel || settings.lowStockThreshold || 10) && p.quantity > 0;
                  const isOut = p.quantity <= 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                      <td className="p-3">
                        <div className="font-medium text-slate-800 dark:text-zinc-100">
                          {p.name}
                        </div>
                        {p.shelfLocation && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" /> Shelf: {p.shelfLocation}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                        {p.barcode}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded text-[10px] font-medium">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500 dark:text-zinc-400 text-xs">
                        {currency}{p.purchasePrice}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-900 dark:text-zinc-100 text-xs">
                        {currency}{p.sellingPrice}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[11px] font-medium ${
                          isOut
                            ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                            : 'text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                          {p.quantity} {p.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.isCombo && (
                            <span className="px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 rounded text-[10px] font-medium">
                              Combo ({p.comboItems?.length || 0})
                            </span>
                          )}
                          {p.batches && p.batches.length > 0 && (
                            <span className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 rounded text-[10px] font-medium">
                              {p.batches.length} Batch(es)
                            </span>
                          )}
                          {p.wholesalePrice && (
                            <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded text-[10px] font-mono">
                              WS: {currency}{p.wholesalePrice}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenBarcodeGenerator(p)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
                            title="Generate Barcode Labels"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal with Multi-Tab Panels */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {editingProduct ? `Edit: ${editingProduct.name}` : 'Add New Inventory Product'}
                </h3>
                <p className="text-[11px] text-slate-500">Configure catalog data, wholesale tiers, and FIFO tracking</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-900/40 px-4 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveFormTab('basic')}
                className={`py-2.5 px-3 border-b-2 transition ${
                  activeFormTab === 'basic'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                1. Basic Info
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('pricing')}
                className={`py-2.5 px-3 border-b-2 transition ${
                  activeFormTab === 'pricing'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                2. Tiered Pricing & Stock Levels
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('batches')}
                className={`py-2.5 px-3 border-b-2 transition ${
                  activeFormTab === 'batches'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                3. FIFO Batches ({formData.batches.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('combo')}
                className={`py-2.5 px-3 border-b-2 transition ${
                  activeFormTab === 'combo'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                4. Combo / Loose Kit
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Tab 1: Basic Info */}
              {activeFormTab === 'basic' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fortune Sunlite Sunflower Oil 1L"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Category *
                      </label>
                      <input
                        type="text"
                        required
                        list="cat-suggestions"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                      />
                      <datalist id="cat-suggestions">
                        <option value="Grains & Atta" />
                        <option value="Rice & Pulses" />
                        <option value="Oils & Ghee" />
                        <option value="Spices & Salt" />
                        <option value="Beverages" />
                        <option value="Snacks & Biscuits" />
                        <option value="Dairy & Bakery" />
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Unit of Measure
                      </label>
                      <select
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                      >
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="packet">Packet</option>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="g">Gram (g)</option>
                        <option value="l">Litre (L)</option>
                        <option value="ml">Millilitre (ml)</option>
                        <option value="bag">Bag / Sack</option>
                        <option value="box">Box / Carton</option>
                      </select>
                    </div>
                  </div>

                  {/* Barcode Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Barcode (EAN-13 / Code128) *</span>
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        className="text-emerald-600 hover:underline font-semibold text-[11px] flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Auto Generate
                      </button>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Scan with USB reader or enter code"
                      value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cost Price ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        onKeyDown={blockInvalidNumberKeys}
                        required
                        placeholder="100"
                        value={formData.purchasePrice}
                        onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Retail Price ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        onKeyDown={blockInvalidNumberKeys}
                        required
                        placeholder="125"
                        value={formData.sellingPrice}
                        onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Current Stock *
                      </label>
                      <input
                        type="number"
                        min="0"
                        onKeyDown={blockInvalidNumberKeys}
                        required
                        placeholder="50"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Supplier Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Fortune Distributors"
                        value={formData.supplierName}
                        onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={formData.expiryDate}
                        onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Tiered Pricing & Stock Levels */}
              {activeFormTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      Customer Tiered Pricing Rates
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Applied automatically at POS billing when a customer with matching tag is selected.
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Wholesale Price ({currency})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="e.g. 110"
                          value={formData.wholesalePrice}
                          onChange={e => setFormData({ ...formData, wholesalePrice: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Distributor Price ({currency})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="e.g. 105"
                          value={formData.distributorPrice}
                          onChange={e => setFormData({ ...formData, distributorPrice: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          VIP Price ({currency})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="e.g. 118"
                          value={formData.vipPrice}
                          onChange={e => setFormData({ ...formData, vipPrice: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Warehouse & Threshold Levels
                    </h4>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Min Stock Level (Alert)
                        </label>
                        <input
                          type="number"
                          min="0"
                          onKeyDown={blockInvalidNumberKeys}
                          value={formData.minStockLevel}
                          onChange={e => setFormData({ ...formData, minStockLevel: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Max Stock Target
                        </label>
                        <input
                          type="number"
                          min="0"
                          onKeyDown={blockInvalidNumberKeys}
                          value={formData.maxStockLevel}
                          onChange={e => setFormData({ ...formData, maxStockLevel: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Shelf Location
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Aisle 3 - Shelf B"
                          value={formData.shelfLocation}
                          onChange={e => setFormData({ ...formData, shelfLocation: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: FIFO Batches */}
              {activeFormTab === 'batches' && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-2">
                    <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Add Inward Batch (FIFO Depletion)
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Sales automatically deduct stock from the earliest expiry batch first.
                    </p>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Batch No (e.g. B-01)"
                        value={newBatchNumber}
                        onChange={e => setNewBatchNumber(e.target.value)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Qty (e.g. 20)"
                        value={newBatchQty}
                        onChange={e => setNewBatchQty(e.target.value)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none font-mono"
                      />
                      <input
                        type="date"
                        value={newBatchExpiry}
                        onChange={e => setNewBatchExpiry(e.target.value)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddBatch}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        + Add Batch
                      </button>
                    </div>
                  </div>

                  {/* Batches Table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500">
                        <tr>
                          <th className="p-2.5">Batch #</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5 text-center">Quantity</th>
                          <th className="p-2.5 text-right">Cost</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {formData.batches.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-slate-400">
                              No batches recorded. Master product quantity applies.
                            </td>
                          </tr>
                        ) : (
                          formData.batches.map((b, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{b.batchNumber}</td>
                              <td className="p-2.5 font-mono">{b.expiryDate}</td>
                              <td className="p-2.5 text-center font-mono font-bold">{b.quantity}</td>
                              <td className="p-2.5 text-right font-mono">{currency}{b.purchasePrice}</td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatch(idx)}
                                  className="text-rose-600 hover:underline text-[11px] font-bold"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: Combo / Loose Kit */}
              {activeFormTab === 'combo' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-900/50">
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 dark:text-purple-200">
                        Is this a Composite Bundle / Loose Kit?
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        When sold, stock will be automatically deducted from individual component items.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.isCombo}
                      onChange={e => setFormData({ ...formData, isCombo: e.target.checked })}
                      className="w-5 h-5 rounded text-purple-600 cursor-pointer"
                    />
                  </div>

                  {formData.isCombo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <select
                          id="combo-product-select"
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>Select component product to bundle...</option>
                          {products
                            .filter(p => !editingProduct || p.id !== editingProduct.id)
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.quantity} {p.unit})
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const select = document.getElementById('combo-product-select') as HTMLSelectElement;
                            if (select && select.value) {
                              handleAddComboComponent(select.value);
                              select.value = '';
                            }
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          + Add Component
                        </button>
                      </div>

                      {/* Combo Items Table */}
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500">
                            <tr>
                              <th className="p-2.5">Component Product</th>
                              <th className="p-2.5 text-center">Deduct Qty Per Sale</th>
                              <th className="p-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {formData.comboItems.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="text-center py-6 text-slate-400">
                                  No component items added to this bundle.
                                </td>
                              </tr>
                            ) : (
                              formData.comboItems.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                    {item.productName || item.productId}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={item.qty}
                                      onChange={e => {
                                        const newQty = parseFloat(e.target.value) || 0;
                                        setFormData(prev => ({
                                          ...prev,
                                          comboItems: prev.comboItems.map((ci, i) =>
                                            i === idx ? { ...ci, qty: newQty } : ci
                                          ),
                                        }));
                                      }}
                                      className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-center font-mono text-xs"
                                    />
                                    <span className="ml-1 text-[11px] text-slate-500">{item.unit || 'pcs'}</span>
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveComboComponent(idx)}
                                      className="text-rose-600 hover:underline text-[11px] font-bold"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  Save Product Details
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Bulk Excel / CSV Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        settings={settings}
        onImportComplete={(count) => {
          alert(`Successfully imported / updated ${count} products in inventory!`);
        }}
      />

    </div>
  );
};
