import React, { useState, useEffect, useRef } from 'react';
import { Product, ShopSettings } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { 
  Barcode as BarcodeIcon, 
  Printer, 
  Settings2, 
  Check, 
  X, 
  Sliders 
} from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface LabelDesignerModalProps {
  settings: ShopSettings;
  onClose: () => void;
}

export const LabelDesignerModal: React.FC<LabelDesignerModalProps> = ({ settings, onClose }) => {
  const products = sqliteDB.getProducts();
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  
  // Customization options
  const [stickerWidth, setStickerWidth] = useState<number>(50); // mm
  const [stickerHeight, setStickerHeight] = useState<number>(30); // mm
  const [showShopName, setShowShopName] = useState(true);
  const [showSellingPrice, setShowSellingPrice] = useState(true);
  const [showMRP, setShowMRP] = useState(true);
  const [showShelfLocation, setShowShelfLocation] = useState(true);
  const [showExpiry, setShowExpiry] = useState(false);
  const [copies, setCopies] = useState<number>(12);

  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const printableAreaRef = useRef<HTMLDivElement | null>(null);

  const product = products.find(p => p.id === selectedProductId) || products[0];
  const barcodeValue = product?.barcode || '8901234567890';
  const currency = settings.currencySymbol || '₹';

  useEffect(() => {
    if (previewSvgRef.current && barcodeValue) {
      try {
        const isEan13 = /^\d{12,13}$/.test(barcodeValue);
        JsBarcode(previewSvgRef.current, barcodeValue, {
          format: isEan13 ? 'EAN13' : 'CODE128',
          width: 1.5,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 2,
        });
      } catch {
        // Fallback to Code128 if EAN checksum fails
        try {
          if (previewSvgRef.current) {
            JsBarcode(previewSvgRef.current, barcodeValue, {
              format: 'CODE128',
              width: 1.5,
              height: 35,
              displayValue: true,
              fontSize: 10,
              margin: 2,
            });
          }
        } catch (err) {
          console.warn('[LabelDesigner] Barcode render error:', err);
        }
      }
    }
  }, [barcodeValue, selectedProductId, stickerWidth, stickerHeight]);

  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 shrink-0">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
            <BarcodeIcon className="w-5 h-5 text-emerald-600" />
            Barcode Sticker & Shelf Label Studio (Offline)
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>

        <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-6 text-xs overflow-y-auto flex-1 pr-1">
          {/* Options Panel */}
          <div className="space-y-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Select Product</label>
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none font-bold"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({currency}{p.sellingPrice})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Sticker Width (mm)</label>
                <input
                  type="number"
                  value={stickerWidth}
                  onChange={e => setStickerWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Sticker Height (mm)</label>
                <input
                  type="number"
                  value={stickerHeight}
                  onChange={e => setStickerHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-700 dark:text-slate-300">Fields to Include on Sticker:</p>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showShopName} onChange={e => setShowShopName(e.target.checked)} className="rounded text-emerald-600" />
                <span>Show Store Header ({settings.shopName})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showSellingPrice} onChange={e => setShowSellingPrice(e.target.checked)} className="rounded text-emerald-600" />
                <span>Show Selling Price ({currency}{product?.sellingPrice})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showMRP} onChange={e => setShowMRP(e.target.checked)} className="rounded text-emerald-600" />
                <span>Show MRP Badge (MRP: {currency}{Math.round((product?.sellingPrice || 100) * 1.15)})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showShelfLocation} onChange={e => setShowShelfLocation(e.target.checked)} className="rounded text-emerald-600" />
                <span>Show Shelf Location ({product?.shelfLocation || 'Shelf A-1'})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showExpiry} onChange={e => setShowExpiry(e.target.checked)} className="rounded text-emerald-600" />
                <span>Show Expiry Date ({product?.expiryDate || 'N/A'})</span>
              </label>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Number of Labels to Print</label>
              <input
                type="number"
                min={1}
                max={100}
                value={copies}
                onChange={e => setCopies(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          {/* Live Single Sticker Preview Box */}
          <div className="bg-slate-100 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center space-y-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Scannable Barcode Preview</p>

            {/* Sticker Mock with Real SVG Barcode */}
            <div 
              style={{ width: `${Math.max(160, stickerWidth * 3.5)}px` }} 
              className="bg-white border-2 border-slate-900 text-slate-900 p-3 rounded-lg flex flex-col items-center justify-between text-center shadow-lg select-none space-y-1"
            >
              {showShopName && <div className="text-[10px] font-bold uppercase border-b w-full pb-0.5 tracking-tight">{settings.shopName}</div>}
              <div className="font-bold text-[11px] leading-tight line-clamp-2">{product?.name}</div>
              
              {/* Real Scannable Barcode SVG */}
              <div className="my-1 flex justify-center">
                <svg ref={previewSvgRef} className="max-w-full h-auto" />
              </div>

              <div className="flex items-center justify-between w-full pt-1 border-t text-[10px] font-bold">
                {showSellingPrice && <span>Price: {currency}{product?.sellingPrice}</span>}
                {showMRP && <span className="text-[9px] text-slate-500 line-through">MRP: {currency}{Math.round((product?.sellingPrice || 100) * 1.15)}</span>}
                {showShelfLocation && <span className="text-[9px] text-slate-600">Loc: {product?.shelfLocation || 'Shelf'}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="no-print pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrintLabels}
            className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-md text-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print {copies} Stickers</span>
          </button>
        </div>
      </div>
    </div>
  );
};
