import React, { useState, useRef, useEffect } from 'react';
import { Sale, ShopSettings } from '../types';
import { Printer, Download, X, CheckCircle, FileText, ShoppingBag, AlertCircle, QrCode } from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { buildUpiPayload } from '@bazaar/shared-utils';

interface InvoiceModalProps {
  sale: Sale | null;
  settings: ShopSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  sale,
  settings,
  isOpen,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>(
    settings.receiptType === 'a4' || settings.receiptType === 'A4' ? 'a4' : 'thermal'
  );
  const [printError, setPrintError] = useState<string | null>(null);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string | null>(null);
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const currency = settings.currencySymbol || '₹';

  // Generate dynamic offline UPI QR code for the invoice
  useEffect(() => {
    if (!sale) return;
    const isUpiInvolved =
      sale.paymentMode === 'UPI' ||
      (sale.paymentMode === 'Split' && sale.splitPayments?.some(sp => sp.mode === 'UPI')) ||
      (settings.enableUpiPayments && !!settings.upiId);

    if (isUpiInvolved && settings.upiId) {
      const payload = buildUpiPayload({
        upiId: settings.upiId,
        merchantName: settings.merchantName || settings.shopName,
        amount: sale.totalAmount,
        invoiceNumber: sale.invoiceNumber,
        note: settings.defaultPaymentNote || `Bill ${sale.invoiceNumber}`,
      });

      QRCode.toDataURL(payload, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(url => setUpiQrDataUrl(url))
        .catch(err => console.warn('[InvoiceModal] Failed to render UPI QR:', err));
    } else {
      setUpiQrDataUrl(null);
    }
  }, [sale, settings]);

  if (!isOpen || !sale) return null;

  // Print handler: Electron IPC silent print with fallback to window.print()
  const handlePrint = async () => {
    setPrintError(null);

    // 1. Verify invoice data exists
    if (!sale) {
      setPrintError('Print Error: Invoice sale data is missing.');
      return;
    }

    // 2. If running inside Electron desktop shell, try native silent print API
    const electronAPI = (window as unknown as { electronAPI?: { isElectron: boolean; printReceipt: (opt: { silent?: boolean }) => Promise<{ success: boolean; failureReason?: string }> } }).electronAPI;
    if (electronAPI?.isElectron) {
      try {
        console.log('[InvoicePrint] Invoking Electron native print API...');
        const res = await electronAPI.printReceipt({ silent: false });
        if (res?.success) {
          console.log('[InvoicePrint] Native Electron print completed.');
          return;
        }
      } catch (e) {
        console.warn('[InvoicePrint] Electron native print call failed, falling back to window.print():', e);
      }
    }

    // 3. Browser fallback window.print()
    const elem = printableAreaRef.current || document.querySelector('.printable-area');
    if (!elem || !elem.innerHTML.trim()) {
      setPrintError('Print Error: Invoice DOM content is missing.');
      return;
    }

    try {
      window.focus();
      window.print();
    } catch (primaryErr: unknown) {
      console.warn('[InvoicePrint] Standard window.print() failed, attempting iframe fallback:', primaryErr);
      try {
        let printFrame = document.getElementById('invoice-print-frame') as HTMLIFrameElement;
        if (!printFrame) {
          printFrame = document.createElement('iframe');
          printFrame.id = 'invoice-print-frame';
          printFrame.style.position = 'fixed';
          printFrame.style.right = '0';
          printFrame.style.bottom = '0';
          printFrame.style.width = '0';
          printFrame.style.height = '0';
          printFrame.style.border = '0';
          document.body.appendChild(printFrame);
        }

        const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
        if (frameDoc) {
          frameDoc.open();
          frameDoc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Invoice - ${sale.invoiceNumber}</title>
                <style>
                  body { font-family: monospace, sans-serif; margin: 10px; color: #000; background: #fff; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { padding: 4px; text-align: left; font-size: 12px; }
                  .text-right { text-align: right; }
                  .text-center { text-align: center; }
                  .font-bold { font-weight: bold; }
                  .no-print { display: none !important; }
                  @page { size: ${printFormat === 'thermal' ? '80mm auto' : 'A4 auto'}; margin: 0; }
                </style>
              </head>
              <body>
                ${elem.innerHTML}
              </body>
            </html>
          `);
          frameDoc.close();

          setTimeout(() => {
            try {
              printFrame.contentWindow?.focus();
              printFrame.contentWindow?.print();
            } catch (fallbackErr: unknown) {
              const err = fallbackErr as Error;
              setPrintError(`Print failed: ${err.message || 'Browser blocked print execution.'}`);
            }
          }, 300);
        }
      } catch (err: unknown) {
        const error = err as Error;
        setPrintError(`Printing failed: ${error.message || 'Browser prevented print execution.'}`);
      }
    }
  };

  // PDF Export using jsPDF with embedded UPI QR and Split breakdown
  const handleDownloadPDF = () => {
    setPrintError(null);
    if (!sale) return;

    try {
      const isThermal = printFormat === 'thermal';
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: isThermal ? [80, 240] : 'a4',
      });

      const font = 'helvetica';
      let y = 10;

      if (isThermal) {
        // --- 80mm Thermal PDF ---
        doc.setFont(font, 'bold');
        doc.setFontSize(12);
        doc.text(settings.shopName, 40, y, { align: 'center' });
        y += 5;

        doc.setFontSize(8);
        doc.setFont(font, 'normal');
        if (settings.address) {
          doc.text(settings.address.substring(0, 45), 40, y, { align: 'center' });
          y += 4;
        }
        if (settings.phone) {
          doc.text(`Phone: ${settings.phone}`, 40, y, { align: 'center' });
          y += 4;
        }
        if (settings.gstNumber) {
          doc.text(`GSTIN: ${settings.gstNumber}`, 40, y, { align: 'center' });
          y += 4;
        }

        y += 2;
        doc.setLineDashPattern([1, 1], 0);
        doc.line(5, y, 75, y);
        y += 5;

        doc.setFontSize(8);
        doc.text(`Invoice: ${sale.invoiceNumber}`, 5, y);
        y += 4;
        doc.text(`Date: ${new Date(sale.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`, 5, y);
        y += 4;
        if (sale.customerName && sale.customerName !== 'Walk-in Customer') {
          doc.text(`Cust: ${sale.customerName} (${sale.customerPhone || ''})`, 5, y);
          y += 4;
        }

        y += 1;
        doc.line(5, y, 75, y);
        y += 4;

        // Items Header
        doc.setFont(font, 'bold');
        doc.text('Item', 5, y);
        doc.text('Qty', 45, y, { align: 'center' });
        doc.text('Total', 75, y, { align: 'right' });
        y += 4;

        // Items List
        doc.setFont(font, 'normal');
        sale.items.forEach(item => {
          doc.text(item.productName.substring(0, 20), 5, y);
          doc.text(`${item.quantity}`, 45, y, { align: 'center' });
          doc.text(`${currency}${item.totalPrice}`, 75, y, { align: 'right' });
          y += 4;
        });

        doc.line(5, y, 75, y);
        y += 4;

        // Totals
        doc.text(`Subtotal:`, 40, y);
        doc.text(`${currency}${sale.subtotal}`, 75, y, { align: 'right' });
        y += 4;

        if (sale.discountAmount > 0) {
          doc.text(`Discount:`, 40, y);
          doc.text(`-${currency}${sale.discountAmount}`, 75, y, { align: 'right' });
          y += 4;
        }

        if (sale.taxAmount > 0) {
          doc.text(`GST (${sale.taxPercent}%):`, 40, y);
          doc.text(`${currency}${sale.taxAmount.toFixed(2)}`, 75, y, { align: 'right' });
          y += 4;
        }

        doc.setFont(font, 'bold');
        doc.setFontSize(10);
        doc.text(`GRAND TOTAL:`, 35, y);
        doc.text(`${currency}${sale.totalAmount}`, 75, y, { align: 'right' });
        y += 5;

        // Payment Info & Splits
        doc.setFont(font, 'normal');
        doc.setFontSize(8);
        doc.text(`Payment Mode: ${sale.paymentMode}`, 5, y);
        y += 4;

        if (sale.paymentMode === 'Split' && sale.splitPayments) {
          sale.splitPayments.forEach(sp => {
            doc.text(`  • ${sp.mode}: ${currency}${sp.amount}`, 5, y);
            y += 3.5;
          });
        }

        if (sale.paymentMode === 'Cash' && sale.receivedAmount > 0) {
          doc.text(`Paid: ${currency}${sale.receivedAmount} | Change: ${currency}${sale.changeAmount}`, 5, y);
          y += 4;
        }

        // Embedded QR Code
        if (upiQrDataUrl) {
          y += 2;
          doc.addImage(upiQrDataUrl, 'PNG', 26, y, 28, 28);
          y += 30;
          doc.setFontSize(7);
          doc.text('Scan with any UPI App to Pay / Verify', 40, y, { align: 'center' });
          y += 4;
        }

        y += 2;
        doc.setFontSize(7);
        doc.text(settings.upiReceiptFooter || 'Thank you for your visit!', 40, y, { align: 'center' });
      } else {
        // --- A4 Standard PDF ---
        doc.setFont(font, 'bold');
        doc.setFontSize(18);
        doc.text(settings.shopName, 15, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont(font, 'normal');
        if (settings.address) { doc.text(settings.address, 15, y); y += 4; }
        if (settings.phone) { doc.text(`Phone: ${settings.phone}`, 15, y); y += 4; }
        if (settings.gstNumber) { doc.text(`GSTIN: ${settings.gstNumber}`, 15, y); y += 4; }

        doc.setFont(font, 'bold');
        doc.setFontSize(16);
        doc.text('TAX INVOICE', 195, 15, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont(font, 'normal');
        doc.text(`Invoice No: ${sale.invoiceNumber}`, 195, 22, { align: 'right' });
        doc.text(`Date: ${new Date(sale.dateTime).toLocaleString()}`, 195, 27, { align: 'right' });

        y += 4;
        doc.line(15, y, 195, y);
        y += 6;

        if (sale.customerName) {
          doc.setFont(font, 'bold');
          doc.text('Customer Details:', 15, y);
          y += 4;
          doc.setFont(font, 'normal');
          doc.text(`Name: ${sale.customerName}`, 15, y);
          if (sale.customerPhone) doc.text(`Phone: ${sale.customerPhone}`, 100, y);
          y += 7;
        }

        // Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y, 180, 7, 'F');
        doc.setFont(font, 'bold');
        doc.text('#', 18, y + 5);
        doc.text('Product Name', 30, y + 5);
        doc.text('Barcode', 100, y + 5);
        doc.text('Unit Price', 130, y + 5);
        doc.text('Qty', 160, y + 5);
        doc.text('Total', 190, y + 5, { align: 'right' });
        y += 9;

        doc.setFont(font, 'normal');
        sale.items.forEach((item, idx) => {
          doc.text(`${idx + 1}`, 18, y);
          doc.text(item.productName.substring(0, 35), 30, y);
          doc.text(item.barcode || '', 100, y);
          doc.text(`${currency}${item.unitSellingPrice}`, 130, y);
          doc.text(`${item.quantity}`, 160, y);
          doc.text(`${currency}${item.totalPrice}`, 190, y, { align: 'right' });
          y += 6;
        });

        y += 3;
        doc.line(15, y, 195, y);
        y += 6;

        doc.text(`Subtotal:`, 140, y);
        doc.text(`${currency}${sale.subtotal}`, 190, y, { align: 'right' });
        y += 5;

        if (sale.discountAmount > 0) {
          doc.text(`Discount:`, 140, y);
          doc.text(`-${currency}${sale.discountAmount}`, 190, y, { align: 'right' });
          y += 5;
        }

        if (sale.taxAmount > 0) {
          doc.text(`Tax (${sale.taxPercent}%):`, 140, y);
          doc.text(`${currency}${sale.taxAmount.toFixed(2)}`, 190, y, { align: 'right' });
          y += 5;
        }

        doc.setFont(font, 'bold');
        doc.setFontSize(12);
        doc.text(`Grand Total:`, 140, y);
        doc.text(`${currency}${sale.totalAmount}`, 190, y, { align: 'right' });
        y += 8;

        doc.setFontSize(9);
        doc.setFont(font, 'normal');
        doc.text(`Payment Method: ${sale.paymentMode}`, 15, y);
        y += 4;

        if (sale.paymentMode === 'Split' && sale.splitPayments) {
          const splitSummary = sale.splitPayments.map(sp => `${sp.mode}: ${currency}${sp.amount}`).join(' | ');
          doc.text(`Breakdown: ${splitSummary}`, 15, y);
          y += 4;
        }

        if (upiQrDataUrl) {
          doc.addImage(upiQrDataUrl, 'PNG', 15, y, 25, 25);
          doc.setFontSize(8);
          doc.text('Scan with any UPI App', 15, y + 29);
        }

        doc.text('Authorized Signatory / Stamp', 195, y + 25, { align: 'right' });
      }

      doc.save(`${sale.invoiceNumber}.pdf`);
    } catch (pdfErr: unknown) {
      const error = pdfErr as Error;
      setPrintError(`PDF Generation Failed: ${error.message || 'An error occurred while building the PDF file.'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150 my-auto">
        
        {/* Modal Top Toolbar */}
        <div className="no-print flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                Invoice {sale.invoiceNumber}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transaction Completed • {new Date(sale.dateTime).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Receipt format toggle */}
            <div className="bg-slate-200 dark:bg-slate-700 p-0.5 rounded-xl flex text-xs font-medium">
              <button
                onClick={() => setPrintFormat('thermal')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  printFormat === 'thermal'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Thermal (80mm)
              </button>
              <button
                onClick={() => setPrintFormat('a4')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  printFormat === 'a4'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                A4 Standard
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] bg-slate-50 dark:bg-slate-900/50">
          <div
            ref={printableAreaRef}
            className={`printable-area mx-auto bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 p-6 ${
              printFormat === 'thermal' ? 'max-w-[340px] text-xs font-mono' : 'max-w-xl text-sm font-sans'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-600">
              <div className="flex justify-center items-center gap-2 mb-1">
                <ShoppingBag className="w-5 h-5 text-emerald-600 no-print" />
                <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                  {settings.shopName}
                </h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs">{settings.address}</p>
              {settings.phone && <p className="text-slate-500 dark:text-slate-400 text-xs">Phone: {settings.phone}</p>}
              {settings.gstNumber && <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5">GSTIN: {settings.gstNumber}</p>}
            </div>

            {/* Bill Meta */}
            <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-600 flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
              <div>
                <p><span className="font-semibold text-slate-800 dark:text-slate-200">Invoice:</span> {sale.invoiceNumber}</p>
                {sale.customerName && (
                  <p><span className="font-semibold text-slate-800 dark:text-slate-200">Customer:</span> {sale.customerName} ({sale.customerPhone || 'N/A'})</p>
                )}
              </div>
              <div className="text-right">
                <p>{new Date(sale.dateTime).toLocaleDateString()}</p>
                <p>{new Date(sale.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-600">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                    <th className="pb-1 font-semibold">Item</th>
                    <th className="pb-1 text-center font-semibold">Qty</th>
                    <th className="pb-1 text-right font-semibold">Price</th>
                    <th className="pb-1 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {sale.items.map((item, i) => (
                    <tr key={i} className="text-xs">
                      <td className="py-1.5 pr-1 font-medium text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                        {item.productName}
                      </td>
                      <td className="py-1.5 text-center">{item.quantity}</td>
                      <td className="py-1.5 text-right">{currency}{item.unitSellingPrice}</td>
                      <td className="py-1.5 text-right font-semibold">{currency}{item.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculation Totals */}
            <div className="py-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{currency}{sale.subtotal}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span>-{currency}{sale.discountAmount}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>GST / Tax ({sale.taxPercent}%)</span>
                  <span>{currency}{sale.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Total Amount</span>
                <span>{currency}{sale.totalAmount}</span>
              </div>
            </div>

            {/* Payment info */}
            <div className="mt-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div className="flex justify-between items-center">
                <span>Mode: <strong>{sale.paymentMode}</strong></span>
                {sale.paymentMode === 'Cash' && sale.receivedAmount > 0 && (
                  <span>Recv: {currency}{sale.receivedAmount} | Change: <strong>{currency}{sale.changeAmount}</strong></span>
                )}
                {sale.paymentMode === 'UPI' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    ✓ PAID via Dynamic UPI
                  </span>
                )}
              </div>

              {/* Split payment breakdown list */}
              {sale.paymentMode === 'Split' && sale.splitPayments && sale.splitPayments.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-600/60 text-[11px] space-y-0.5">
                  <div className="font-semibold text-slate-600 dark:text-slate-400">Split Breakdown:</div>
                  <div className="grid grid-cols-2 gap-1 font-mono">
                    {sale.splitPayments.map((sp, idx) => (
                      <div key={idx} className="flex justify-between px-1.5 py-0.5 bg-white/60 dark:bg-slate-800/60 rounded">
                        <span>{sp.mode}:</span>
                        <strong>{currency}{sp.amount}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic UPI QR Code on Printed Receipt */}
            {upiQrDataUrl && (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                <div className="flex justify-center">
                  <img src={upiQrDataUrl} alt="UPI Payment QR Code" className="w-28 h-28 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-1" />
                </div>
                <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  Scan to Pay / Verify with Any UPI App
                </p>
                {settings.upiId && (
                  <p className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                    VPA: {settings.upiId}
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-4 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <p>*** {settings.upiReceiptFooter || 'Thank You For Shopping With Us!'} ***</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Bazaar POS Commercial System</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="no-print p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Invoice synced and stored in local database.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-medium text-sm flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" />
              Save PDF
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        </div>

      </div>

      {/* Printing / PDF Failure Error Dialog */}
      {printError && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-rose-300 dark:border-rose-800 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-7 h-7 shrink-0" />
              <h4 className="text-base font-bold">Print Operation Notice</h4>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {printError}
            </p>
            <div className="p-3 bg-slate-100 dark:bg-slate-900/80 rounded-xl text-[11px] text-slate-500 font-mono leading-normal">
              Tip: You can use the &quot;Save PDF&quot; button to save or print the receipt file directly.
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setPrintError(null)}
                className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
