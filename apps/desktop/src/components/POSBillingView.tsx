import React, { useState, useEffect, useRef } from 'react';
import { Product, CartItem, ShopSettings, Sale, HeldBill, SplitPayment, Customer, ProductVariant } from '../types';
import { UPIPaymentModal } from './UPIPaymentModal';
import { UPIPaymentService } from '../services/paymentService';
import { sqliteDB } from '../db/sqliteStorage';
import { useBusinessMode } from '../context/BusinessModeContext';
import { useDbVersion } from '../hooks/useDbVersion';
import { playPosSuccessBeep, playPosErrorBeep } from '../utils/sound';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Camera,
  Coins,
  QrCode,
  CreditCard,
  UserCheck,
  CheckCircle,
  RotateCcw,
  ShoppingBag,
  AlertCircle,
  Keyboard,
  PauseCircle,
  PlayCircle,
  Clock,
  Layers,
  X,
  HelpCircle,
  LayoutGrid,
  ListOrdered,
  CornerDownLeft,
  Sparkles,
  Check,
  Zap,
} from 'lucide-react';
import {
  blockInvalidNumberKeys,
  blockNonDigitKeys,
  sanitizeNumericInput,
  validatePhone
} from '@bazaar/shared-utils';

interface POSBillingViewProps {
  products: Product[];
  settings: ShopSettings;
  selectedCustomerProp?: Customer | null;
  onClearSelectedCustomerProp?: () => void;
  onRecordSale: (
    cartItems: CartItem[],
    customerName: string,
    customerPhone: string,
    paymentMode: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Split',
    receivedAmount: number,
    discountAmount: number,
    taxPercent: number,
    notes?: string,
    customerId?: string,
    splitPayments?: SplitPayment[]
  ) => Sale;
  onOpenCameraScanner: () => void;
  scannedBarcode: string | null;
  onClearScannedBarcode: () => void;
}

export const POSBillingView: React.FC<POSBillingViewProps> = ({
  products,
  settings,
  selectedCustomerProp,
  onClearSelectedCustomerProp,
  onRecordSale,
  onOpenCameraScanner,
  scannedBarcode,
  onClearScannedBarcode,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Customer state & autocomplete
  const [customers, setCustomers] = useState<Customer[]>(() => sqliteDB.getCustomers());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(selectedCustomerProp || null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerName, setCustomerName] = useState(selectedCustomerProp?.name || '');
  const [customerPhone, setCustomerPhone] = useState(selectedCustomerProp?.phone || '');

  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Credit' | 'Split'>('Cash');
  const [saleNotes, setSaleNotes] = useState('');

  // Split payment state
  const [splitPayments, setSplitPayments] = useState<Array<{ mode: SplitPayment['mode']; amount: number }>>([
    { mode: 'Cash', amount: 0 },
    { mode: 'UPI', amount: 0 },
  ]);

  // Parked (Held) Bills State
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => sqliteDB.getHeldBills());
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdNoteInput, setHoldNoteInput] = useState('');

  const [discountInput, setDiscountInput] = useState<number>(0);
  const [taxPercentInput, setTaxPercentInput] = useState<number>(settings.defaultTaxPercent || 0);
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('');
  const [isUpiModalOpen, setIsUpiModalOpen] = useState<boolean>(false);
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState<string>('');

  // Biller Experience State
  const [billerMode, setBillerMode] = useState<'table' | 'tiles'>(() => {
    try {
      return (localStorage.getItem('bazaar_pos_biller_mode') as 'table' | 'tiles') || 'table';
    } catch {
      return 'table';
    }
  });
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(-1);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Input & Focus Refs for Enter-to-Advance cashier flow
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const receivedAmountInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const currency = settings.currencySymbol || '₹';
  const { isSoloMode, authorizeAction } = useBusinessMode();
  const dbVersion = useDbVersion();
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');

  // Tier pricing calculation helper
  const getProductPriceForCustomer = (
    product: Product,
    customer: Customer | null,
    variant?: ProductVariant
  ): number => {
    if (variant && variant.sellingPrice && variant.sellingPrice > 0) {
      return variant.sellingPrice;
    }
    if (!customer) return product.sellingPrice;
    if (customer.tag === 'VIP' && product.vipPrice && product.vipPrice > 0) {
      return product.vipPrice;
    }
    if (customer.tag === 'Wholesale' && product.wholesalePrice && product.wholesalePrice > 0) {
      return product.wholesalePrice;
    }
    if (customer.tag === 'Distributor' && product.distributorPrice && product.distributorPrice > 0) {
      return product.distributorPrice;
    }
    return product.sellingPrice;
  };

  // Sync selectedCustomerProp if passed from customer ledger view
  useEffect(() => {
    if (selectedCustomerProp) {
      handleSelectCustomer(selectedCustomerProp);
    }
  }, [selectedCustomerProp]);

  // Keep customer list refreshed
  useEffect(() => {
    setCustomers(sqliteDB.getCustomers());
  }, [dbVersion]);

  // Keep held bills reactive (refreshes on any DB change, including cross-terminal syncs)
  useEffect(() => {
    setHeldBills(sqliteDB.getHeldBills());
  }, [dbVersion]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const focusBarcodeInput = () => {
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 50);
  };

  useEffect(() => {
    focusBarcodeInput();
  }, [billerMode]);

  const handleSelectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setIsCustomerDropdownOpen(false);
    setCustomerSearchQuery('');
    if (customer) {
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone);
      // Recalculate cart item prices based on customer tier
      setCart(prevCart => prevCart.map(item => {
        const newPrice = getProductPriceForCustomer(item.product, customer, item.selectedVariant);
        return {
          ...item,
          unitSellingPrice: newPrice,
          totalPrice: newPrice * item.quantity,
        };
      }));
      showToast('success', `Selected: ${customer.name} (${customer.tag || 'Regular'})`);
    } else {
      setCustomerName('');
      setCustomerPhone('');
      if (onClearSelectedCustomerProp) {
        onClearSelectedCustomerProp();
      }
      setCart(prevCart => prevCart.map(item => {
        const newPrice = item.selectedVariant?.sellingPrice || item.product.sellingPrice;
        return {
          ...item,
          unitSellingPrice: newPrice,
          totalPrice: newPrice * item.quantity,
        };
      }));
    }
    focusBarcodeInput();
  };

  // Keyboard shortcut ref to prevent stale closure
  const handleCheckoutRef = useRef<() => void>(() => {});

  // High-Speed Biller Keyboard Shortcuts Listener (F1-F10, Esc, Alt+V, Ctrl+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Shortcuts Cheat Sheet Help Modal
      if (e.key === 'F1') {
        e.preventDefault();
        setIsShortcutHelpOpen(prev => !prev);
        return;
      }

      // F2: Complete & Print Bill (or Pay)
      if (e.key === 'F2') {
        e.preventDefault();
        handleCheckoutRef.current();
        return;
      }

      // F3: Focus Barcode Scanner
      if (e.key === 'F3') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }

      // F4: Camera Scanner
      if (e.key === 'F4') {
        e.preventDefault();
        onOpenCameraScanner();
        return;
      }

      // F6: Park / Hold Current Cart
      if (e.key === 'F6') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsHoldModalOpen(true);
        } else {
          showToast('error', 'Cart is empty. Nothing to hold.');
        }
        return;
      }

      // F7: Open Parked Bills Queue
      if (e.key === 'F7') {
        e.preventDefault();
        setHeldBills(sqliteDB.getHeldBills());
        setIsParkedModalOpen(true);
        return;
      }

      // F8: Focus Customer Search / Walk-in selector
      if (e.key === 'F8') {
        e.preventDefault();
        setIsCustomerDropdownOpen(true);
        setTimeout(() => customerSearchInputRef.current?.focus(), 50);
        return;
      }

      // F9: Focus Discount Input
      if (e.key === 'F9') {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
        return;
      }

      // F10: Cycle Payment Tender (Cash -> UPI -> Card -> Credit -> Split)
      if (e.key === 'F10') {
        e.preventDefault();
        const modes: Array<'Cash' | 'UPI' | 'Card' | 'Credit' | 'Split'> = ['Cash', 'UPI', 'Card', 'Credit', 'Split'];
        setPaymentMode(prevMode => {
          const nextIndex = (modes.indexOf(prevMode) + 1) % modes.length;
          showToast('success', `Payment Tender: ${modes[nextIndex]}`);
          return modes[nextIndex];
        });
        return;
      }

      // Alt+V: Switch Biller View (Table Mode vs Tiles Mode)
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setBillerMode(prev => {
          const next = prev === 'table' ? 'tiles' : 'table';
          try {
            localStorage.setItem('bazaar_pos_biller_mode', next);
          } catch {}
          showToast('success', next === 'table' ? 'Biller Table Mode (Fast)' : 'Catalog Tiles Mode');
          return next;
        });
        return;
      }

      // Escape: Close open modals, clear search, refocus scanner
      if (e.key === 'Escape') {
        setIsShortcutHelpOpen(false);
        setIsParkedModalOpen(false);
        setIsHoldModalOpen(false);
        setIsCustomerDropdownOpen(false);
        setSearchQuery('');
        setHighlightedProductIndex(-1);
        focusBarcodeInput();
        return;
      }

      // Ctrl + L or Alt + C: Clear current cart
      if ((e.ctrlKey && e.key.toLowerCase() === 'l') || (e.altKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        if (cart.length > 0 && confirm('Clear all items from current cart?')) {
          setCart([]);
          showToast('success', 'Cart cleared');
          focusBarcodeInput();
        }
        return;
      }

      // Typing outside inputs: Auto-focus the barcode scanner
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        barcodeInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length]);

  // Handle external camera scanned barcode
  useEffect(() => {
    if (scannedBarcode) {
      handleBarcodeScanned(scannedBarcode);
      onClearScannedBarcode();
    }
  }, [scannedBarcode]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Barcode scanning with variant matching & Qty Multiplier support (e.g. "5*890123")
  const handleBarcodeScanned = (inputStr: string) => {
    let cleaned = inputStr.trim();
    if (!cleaned) return;

    let qtyMultiplier = 1;
    if (cleaned.includes('*')) {
      const parts = cleaned.split('*');
      if (parts.length === 2 && !isNaN(Number(parts[0])) && Number(parts[0]) > 0) {
        qtyMultiplier = Math.max(1, parseInt(parts[0], 10) || 1);
        cleaned = parts[1].trim();
      }
    }

    const now = Date.now();
    if (
      lastScannedTimeRef.current.code === cleaned &&
      now - lastScannedTimeRef.current.time < 500 &&
      qtyMultiplier === 1
    ) {
      setSearchQuery('');
      focusBarcodeInput();
      return;
    }

    lastScannedTimeRef.current = { code: cleaned, time: now };

    let matchedProduct: Product | undefined;
    let matchedVariant: ProductVariant | undefined;

    for (const p of products) {
      if (p.barcode === cleaned || p.id.toLowerCase() === cleaned.toLowerCase()) {
        matchedProduct = p;
        break;
      }
      if (p.variants && p.variants.length > 0) {
        const v = p.variants.find(varItem => varItem.barcode === cleaned || varItem.id.toLowerCase() === cleaned.toLowerCase());
        if (v) {
          matchedProduct = p;
          matchedVariant = v;
          break;
        }
      }
    }

    if (matchedProduct) {
      addToCart(matchedProduct, matchedVariant, qtyMultiplier);
      setSearchQuery('');
      setHighlightedProductIndex(-1);
      playPosSuccessBeep();
      const displayName = matchedVariant ? `${matchedProduct.name} (${matchedVariant.name})` : matchedProduct.name;
      const appliedPrice = getProductPriceForCustomer(matchedProduct, selectedCustomer, matchedVariant);
      showToast('success', `Added ${qtyMultiplier > 1 ? `${qtyMultiplier}x ` : ''}${displayName} (${currency}${appliedPrice * qtyMultiplier})`);
    } else {
      // If not exact barcode, check if query matches single product in catalog
      const matches = products.filter(p =>
        p.name.toLowerCase().includes(cleaned.toLowerCase()) ||
        p.barcode.includes(cleaned) ||
        p.category.toLowerCase().includes(cleaned.toLowerCase())
      );
      if (matches.length === 1) {
        addToCart(matches[0], undefined, qtyMultiplier);
        setSearchQuery('');
        setHighlightedProductIndex(-1);
        playPosSuccessBeep();
        showToast('success', `Added ${qtyMultiplier > 1 ? `${qtyMultiplier}x ` : ''}${matches[0].name}`);
      } else {
        playPosErrorBeep();
        showToast('error', `Product not found for: "${cleaned}"`);
      }
    }

    focusBarcodeInput();
  };

  // Add item to cart with quantity multiplier
  const addToCart = (product: Product, variant?: ProductVariant, quantityToAdd = 1) => {
    if (product.quantity <= 0) {
      playPosErrorBeep();
      showToast('error', `"${product.name}" is OUT OF STOCK!`);
      return;
    }

    const unitPrice = getProductPriceForCustomer(product, selectedCustomer, variant);

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(
        item => item.product.id === product.id && item.selectedVariant?.id === variant?.id
      );
      if (existingIndex !== -1) {
        const existingItem = prevCart[existingIndex];
        const maxAvailable = variant ? variant.quantity : product.quantity;
        if (existingItem.quantity + quantityToAdd > maxAvailable) {
          playPosErrorBeep();
          showToast('error', `Stock limit reached for ${product.name}! Max: ${maxAvailable}`);
          return prevCart;
        }

        const updated = [...prevCart];
        const newQty = existingItem.quantity + quantityToAdd;
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          totalPrice: newQty * existingItem.unitSellingPrice,
        };
        return updated;
      } else {
        const maxAvailable = variant ? variant.quantity : product.quantity;
        const initialQty = Math.min(quantityToAdd, maxAvailable);
        return [
          ...prevCart,
          {
            product,
            quantity: initialQty,
            selectedVariant: variant,
            unitSellingPrice: unitPrice,
            totalPrice: initialQty * unitPrice,
          }
        ];
      }
    });

    focusBarcodeInput();
  };

  const updateCartQuantity = (productId: string, delta: number, variantId?: string) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId && (!variantId || item.selectedVariant?.id === variantId)) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;

          const maxAvailable = item.selectedVariant ? item.selectedVariant.quantity : item.product.quantity;
          if (newQty > maxAvailable) {
            alert(`Stock limit reached! Max available: ${maxAvailable}`);
            return item;
          }

          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitSellingPrice,
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (productId: string, variantId?: string) => {
    setCart(prevCart => prevCart.filter(item => !(item.product.id === productId && (!variantId || item.selectedVariant?.id === variantId))));
  };

  const clearCart = () => {
    if (cart.length > 0 && confirm('Clear all items from current cart?')) {
      setCart([]);
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
  const taxAmount = (subtotal - discountInput) * (taxPercentInput / 100);
  const grandTotal = Math.max(0, Math.round(subtotal - discountInput + taxAmount));

  const receivedNum = parseFloat(receivedAmountInput) || 0;
  const changeDue = Math.max(0, receivedNum - grandTotal);

  // Split payment calculations
  const splitTotal = splitPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
  const splitRemaining = Math.max(0, grandTotal - splitTotal);

  const updateSplitAmount = (mode: SplitPayment['mode'], amount: number) => {
    setSplitPayments(prev => {
      const existing = prev.find(p => p.mode === mode);
      if (existing) {
        return prev.map(p => (p.mode === mode ? { ...p, amount } : p));
      }
      return [...prev, { mode, amount }];
    });
  };

  const autoFillSplit = (mode: SplitPayment['mode']) => {
    const currentWithoutThis = splitPayments
      .filter(p => p.mode !== mode)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const fillAmount = Math.max(0, grandTotal - currentWithoutThis);
    updateSplitAmount(mode, fillAmount);
  };

  // Hold / Recall Parked Sales Handlers
  const handleHoldBill = () => {
    if (cart.length === 0) {
      alert('Cart is empty. Nothing to hold.');
      return;
    }
    const held = sqliteDB.saveHeldBill(
      customerName || 'Walk-in Customer',
      customerPhone,
      cart,
      holdNoteInput
    );
    setHeldBills(sqliteDB.getHeldBills());
    setCart([]);
    handleSelectCustomer(null);
    setHoldNoteInput('');
    setIsHoldModalOpen(false);
    playPosSuccessBeep();
    showToast('success', `Bill parked #${held.id.slice(-6)}`);
  };

  const handleRecallBill = (bill: HeldBill) => {
    if (cart.length > 0 && !confirm('Active cart has items. Replace current cart with held bill?')) {
      return;
    }
    setCart(bill.cartItems);
    const matchedCust = customers.find(c => c.name === bill.customerName || (bill.customerPhone && c.phone === bill.customerPhone));
    if (matchedCust) {
      handleSelectCustomer(matchedCust);
    } else {
      setSelectedCustomer(null);
      setCustomerName(bill.customerName === 'Walk-in Customer' ? '' : bill.customerName);
      setCustomerPhone(bill.customerPhone || '');
    }
    sqliteDB.deleteHeldBill(bill.id);
    setHeldBills(sqliteDB.getHeldBills());
    setIsParkedModalOpen(false);
    playPosSuccessBeep();
    showToast('success', `Restored parked bill for ${bill.customerName}`);
  };

  const handleDeleteHeldBill = (billId: string) => {
    if (confirm('Delete this parked bill?')) {
      sqliteDB.deleteHeldBill(billId);
      setHeldBills(sqliteDB.getHeldBills());
      showToast('success', 'Parked bill removed');
    }
  };

  // Complete Sale
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Cart is empty! Scan or select products to start billing.');
      return;
    }

    const executeSaleRecording = () => {
      const activeCustomerId = selectedCustomer?.id || undefined;

      if (customerPhone.trim()) {
        const phoneVal = validatePhone(customerPhone.trim(), false);
        if (!phoneVal.isValid) {
          alert(phoneVal.error || 'Customer mobile number must be a valid 10-digit number starting with 6-9');
          return;
        }
      }

      if (discountInput < 0 || discountInput > subtotal) {
        alert(`Discount amount cannot exceed subtotal (${currency}${subtotal})`);
        return;
      }

      if (paymentMode === 'Cash' && receivedNum > 0 && receivedNum < grandTotal) {
        alert(`Received cash (${currency}${receivedNum}) is less than total amount (${currency}${grandTotal}).`);
        return;
      }

      if (paymentMode === 'Credit' && !selectedCustomer && !customerName.trim()) {
        alert('Please enter or select a customer for Credit (Khata) sales.');
        return;
      }

      if (paymentMode === 'Split') {
        if (splitTotal < grandTotal) {
          alert(`Split payment total (${currency}${splitTotal}) is less than grand total (${currency}${grandTotal}). Remaining balance: ${currency}${splitRemaining}`);
          return;
        }
        // Warn on overpayment > ₹1 (small rounding differences are acceptable)
        const overpayment = splitTotal - grandTotal;
        if (overpayment > 1) {
          const confirmed = confirm(
            `Split payments total (${currency}${splitTotal.toFixed(2)}) exceeds the bill by ${currency}${overpayment.toFixed(2)}.\n\nThe excess will be returned as change. Continue?`
          );
          if (!confirmed) return;
        }
        const activeSplits = splitPayments.filter(sp => (Number(sp.amount) || 0) > 0);
        const creditSplit = activeSplits.find(sp => sp.mode === 'Store Credit');
        if (creditSplit && !selectedCustomer && !customerName.trim()) {
          alert('Please enter or select a customer for Split payments containing Store Credit (Khata).');
          return;
        }
        const upiSplit = activeSplits.find(sp => sp.mode === 'UPI');
        if (upiSplit) {
          const upiService = new UPIPaymentService(settings);
          if (!upiService.isAvailable()) {
            alert('UPI Payments are disabled or missing Merchant UPI ID in settings.');
            return;
          }
        }
        onRecordSale(
          cart,
          customerName || 'Walk-in Customer',
          customerPhone,
          'Split',
          splitTotal,
          discountInput,
          taxPercentInput,
          saleNotes,
          activeCustomerId,
          activeSplits
        );
        resetSaleForm();
        return;
      }

      if (paymentMode === 'UPI') {
        const upiService = new UPIPaymentService(settings);
        if (!upiService.isAvailable()) {
          alert('UPI Payments are disabled or missing Merchant UPI ID. Please configure UPI Payment Settings under Settings tab.');
          return;
        }
        setDraftInvoiceNumber(sqliteDB.getNextInvoiceNumber());
        setIsUpiModalOpen(true);
        return;
      }

      onRecordSale(
        cart,
        customerName || 'Walk-in Customer',
        customerPhone,
        paymentMode,
        receivedNum > 0 ? receivedNum : grandTotal,
        discountInput,
        taxPercentInput,
        saleNotes,
        activeCustomerId
      );

      resetSaleForm();
    };

    // Check if high discount requires Manager PIN in Multi-Staff mode
    const discountPercent = subtotal > 0 ? (discountInput / subtotal) * 100 : 0;
    const threshold = settings.discountThresholdPercent ?? 15;
    const requirePin = settings.requireManagerPinForDiscount ?? true;

    if (!isSoloMode && requirePin && discountPercent > threshold) {
      authorizeAction({
        actionName: `High Discount (${Math.round(discountPercent)}% / ${currency}${discountInput})`,
        requiredRole: 'Manager',
        onSuccess: () => executeSaleRecording(),
      });
      return;
    }

    executeSaleRecording();
  };

  handleCheckoutRef.current = handleCheckout;

  const resetSaleForm = () => {
    setCart([]);
    handleSelectCustomer(null);
    setReceivedAmountInput('');
    setDiscountInput(0);
    setSearchQuery('');
    setSaleNotes('');
    setSplitPayments([
      { mode: 'Cash', amount: 0 },
      { mode: 'UPI', amount: 0 },
    ]);
  };

  const finalizeUpiSale = () => {
    onRecordSale(
      cart,
      customerName || 'Walk-in Customer',
      customerPhone,
      'UPI',
      grandTotal,
      discountInput,
      taxPercentInput,
      saleNotes,
      selectedCustomer?.id || undefined
    );

    setIsUpiModalOpen(false);
    resetSaleForm();
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const matchingCustomers = customerSearchQuery.trim() === '' ? [] : customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.phone.includes(customerSearchQuery)
  ).slice(0, 6);

  // Compute smart cash tenders
  const cashPresets = grandTotal > 0 ? [
    grandTotal,
    Math.ceil(grandTotal / 50) * 50 > grandTotal ? Math.ceil(grandTotal / 50) * 50 : null,
    Math.ceil(grandTotal / 100) * 100 > grandTotal ? Math.ceil(grandTotal / 100) * 100 : null,
    Math.ceil(grandTotal / 500) * 500 > grandTotal ? Math.ceil(grandTotal / 500) * 500 : null,
    2000 > grandTotal ? 2000 : null,
  ].filter((v, idx, arr): v is number => v !== null && v > 0 && arr.indexOf(v) === idx).slice(0, 5) : [100, 200, 500, 1000, 2000];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-50/70 dark:bg-zinc-950/70 p-2 sm:p-3 select-none">

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden bg-slate-200/60 dark:bg-zinc-800/60 p-1 rounded-xl gap-1 shrink-0 mb-2">
        <button
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            mobileTab === 'products'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400'
          }`}
        >
          <span>Catalog ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            mobileTab === 'cart'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400'
          }`}
        >
          <span>Current Bill ({cart.length})</span>
          {cart.length > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-mono font-medium">
              {currency}{grandTotal}
            </span>
          )}
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`absolute top-5 right-5 z-50 px-3.5 py-2 rounded-xl shadow-lg font-mono text-xs font-medium flex items-center gap-2 border transition-all duration-200 ${
          toastMessage.type === 'success'
            ? 'bg-zinc-900 text-zinc-100 border-zinc-700 shadow-zinc-950/20'
            : 'bg-rose-950 text-rose-100 border-rose-800 shadow-rose-950/20'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Terminal Grid: Workstation & Checkout Panel */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2.5 sm:gap-3 overflow-hidden">

        {/* Left Column: Biller Workstation (Table or Tiles) */}
        <div className={`flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden ${
          mobileTab === 'cart' ? 'hidden md:flex' : 'flex'
        }`}>

          {/* Top Cashier Command Bar */}
          <div className="p-2.5 border-b border-slate-200/70 dark:border-zinc-800 space-y-2 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-medium text-[10px] border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Biller Active
                </span>
                <span className="hidden sm:inline text-slate-400 dark:text-zinc-500 text-[10px]">
                  Multiplier supported: <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.2 rounded font-mono text-[9px]">5*barcode</code>
                </span>
              </div>

              {/* View Switcher & Quick Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBillerMode(billerMode === 'table' ? 'tiles' : 'table')}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 rounded-lg text-[10px] font-medium transition flex items-center gap-1 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer"
                  title="Toggle Table vs Tiles Mode (Alt+V)"
                >
                  {billerMode === 'table' ? (
                    <>
                      <LayoutGrid className="w-3 h-3 text-slate-500" />
                      <span>Tiles View</span>
                    </>
                  ) : (
                    <>
                      <ListOrdered className="w-3 h-3 text-slate-500" />
                      <span>Table Grid</span>
                    </>
                  )}
                  <kbd className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 ml-0.5">Alt+V</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setIsShortcutHelpOpen(true)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 rounded-lg text-[10px] font-medium transition flex items-center gap-1 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer"
                  title="Shortcuts Cheat Sheet (F1)"
                >
                  <Keyboard className="w-3 h-3 text-slate-500" />
                  <span>Keys</span>
                  <kbd className="text-[9px] font-mono text-slate-400 dark:text-zinc-500">F1</kbd>
                </button>
              </div>
            </div>

            {/* High-Speed Barcode / Item Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan barcode or type item name... (F3)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchQuery.trim()) {
                        handleBarcodeScanned(searchQuery);
                      } else if (cart.length > 0) {
                        // Empty enter -> jump straight to payment tender!
                        if (paymentMode === 'Cash') {
                          receivedAmountInputRef.current?.focus();
                        } else {
                          handleCheckout();
                        }
                      }
                    }
                  }}
                  className="w-full pl-9 pr-24 py-2 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 rounded-lg text-xs font-medium text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-400 dark:focus:border-zinc-500 focus:ring-0 outline-none transition font-mono"
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-400 pointer-events-none">
                  <span className="hidden sm:inline font-mono">↵ Enter to Add</span>
                </div>
              </div>

              {settings.enableCameraScanner && (
                <button
                  type="button"
                  onClick={onOpenCameraScanner}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg transition flex items-center gap-1 text-xs font-medium shrink-0 border border-slate-200/60 dark:border-zinc-700/60 cursor-pointer"
                  title="Open Camera Scanner (F4)"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span className="hidden sm:inline">Camera (F4)</span>
                </button>
              )}
            </div>

            {/* Quick Catalog Filter Pills (Visible when in Tiles mode or searching) */}
            {billerMode === 'tiles' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-xs">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Body: High-Density Cashier Table OR Visual Tiles */}
          {billerMode === 'table' ? (
            <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">

              {/* Cashier Table Header */}
              <div className="bg-slate-100/70 dark:bg-zinc-800/70 px-3 py-1.5 border-b border-slate-200 dark:border-zinc-700/80 grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider shrink-0">
                <span className="col-span-1 text-center">#</span>
                <span className="col-span-5">Item Description & Barcode</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Amount ({currency})</span>
              </div>

              {/* Cashier Table Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-3">
                      <Barcode className="w-6 h-6 stroke-1" />
                    </div>
                    <h4 className="font-semibold text-xs text-slate-800 dark:text-zinc-200">
                      Biller Workstation Ready
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 max-w-sm">
                      Scan product barcode with handheld scanner or type barcode/name and press <kbd className="px-1 py-0.2 bg-slate-100 dark:bg-zinc-800 rounded font-mono text-[10px] text-slate-700 dark:text-zinc-300">Enter</kbd>.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-700 dark:text-zinc-300 font-mono font-semibold">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
                        <code>3*barcode</code> = Multiplier
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
                        <code>F2</code> = Bill & Pay
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
                        <code>F6</code> = Hold Cart
                      </span>
                    </div>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={`${item.product.id}-${item.selectedVariant?.id || 'base'}`}
                      className="px-3 py-2 grid grid-cols-12 gap-2 items-center text-xs hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition group"
                    >
                      <span className="col-span-1 text-center font-mono text-[10px] text-slate-400">
                        {idx + 1}
                      </span>
                      <div className="col-span-5 min-w-0 pr-1">
                        <div className="font-medium text-slate-800 dark:text-zinc-100 truncate text-xs">
                          {item.product.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                          <span>{item.product.barcode}</span>
                          <span>•</span>
                          <span className="truncate">{item.product.category}</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-xs text-slate-700 dark:text-zinc-300">
                        {currency}{item.unitSellingPrice}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, -1, item.selectedVariant?.id)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-mono font-semibold text-xs w-6 text-center text-slate-800 dark:text-zinc-100">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, 1, item.selectedVariant?.id)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {currency}{item.totalPrice}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.product.id, item.selectedVariant?.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 transition cursor-pointer ml-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Floating Quick Search Matches (if user typed search text in table mode) */}
              {searchQuery.trim().length > 0 && filteredProducts.length > 0 && (
                <div className="shrink-0 max-h-36 overflow-y-auto border-t border-slate-200 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-950/90 p-2 divide-y divide-slate-100 dark:divide-zinc-800">
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase px-1 pb-1">
                    Matching Products ({filteredProducts.length}) - Click to Add
                  </div>
                  {filteredProducts.slice(0, 5).map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        addToCart(prod);
                        setSearchQuery('');
                        barcodeInputRef.current?.focus();
                      }}
                      className="w-full text-left px-2 py-1.5 hover:bg-white dark:hover:bg-zinc-900 rounded-md flex items-center justify-between text-xs transition cursor-pointer"
                    >
                      <div className="truncate">
                        <span className="font-medium text-slate-800 dark:text-zinc-200">{prod.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">[{prod.barcode}]</span>
                      </div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-zinc-100 shrink-0 ml-2">
                        {currency}{getProductPriceForCustomer(prod, selectedCustomer)}
                      </div>
                    </button>
                  ))}
                </div>
              )}

            </div>
          ) : (
            /* Visual Product Tiles Grid (for touchscreens & loose items) */
            <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 content-start bg-slate-50/30 dark:bg-zinc-950/20">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 dark:text-zinc-500 space-y-1.5">
                  <Search className="w-8 h-8 mx-auto stroke-1 opacity-40 text-slate-400" />
                  <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">No products match &quot;{searchQuery}&quot;</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">Scan barcode or pick a different category.</p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const isOut = product.quantity <= 0;
                  const isLow = product.quantity > 0 && product.quantity <= (product.minStockLevel || settings.lowStockThreshold || 10);
                  const displayPrice = getProductPriceForCustomer(product, selectedCustomer);
                  const hasTierDiscount = selectedCustomer && selectedCustomer.tag !== 'Regular' && displayPrice < product.sellingPrice;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOut}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition relative group ${
                        isOut
                          ? 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200/50 dark:border-zinc-800/50 opacity-50 cursor-not-allowed'
                          : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-xs cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] uppercase tracking-wider font-medium text-slate-400 dark:text-zinc-500 truncate">
                            {product.category}
                          </span>
                          {hasTierDiscount && (
                            <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                              {selectedCustomer?.tag}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-xs text-slate-800 dark:text-zinc-100 mt-0.5 line-clamp-2 leading-snug">
                          {product.name}
                        </h4>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="font-mono font-semibold text-xs text-slate-900 dark:text-zinc-100">
                            {currency}{displayPrice}
                          </span>
                          {hasTierDiscount && (
                            <span className="text-[9px] text-slate-400 line-through">
                              {currency}{product.sellingPrice}
                            </span>
                          )}
                        </div>

                        <span className={`text-[9px] font-mono font-medium ${
                          isOut
                            ? 'text-rose-600 dark:text-rose-400'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-zinc-500'
                        }`}>
                          {isOut ? 'Out' : `${product.quantity} ${product.unit || 'pcs'}`}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

        </div>

        {/* Right Column: Active Terminal, Cashier Keypad & Checkout */}
        <div className={`w-full md:w-[380px] lg:w-[410px] shrink-0 flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden ${
          mobileTab === 'products' ? 'hidden md:flex' : 'flex'
        }`}>

          {/* Cart Header with Parked/Hold Controls */}
          <div className="px-3 py-2 border-b border-slate-200/70 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
              <h3 className="font-semibold text-slate-800 dark:text-zinc-100 text-xs">
                Active Bill
              </h3>
              <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono text-slate-600 dark:text-zinc-400 font-medium">
                {cart.length} items
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Parked Bills Button with Badge */}
              <button
                type="button"
                onClick={() => {
                  setHeldBills(sqliteDB.getHeldBills());
                  setIsParkedModalOpen(true);
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition border ${
                  heldBills.length > 0
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                    : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 border-slate-200/70 dark:border-zinc-700/60 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
                title="View Parked Bills (F7)"
              >
                <Clock className="w-3 h-3" />
                <span>Parked</span>
                {heldBills.length > 0 && (
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white font-mono text-[9px] flex items-center justify-center font-bold">
                    {heldBills.length}
                  </span>
                )}
              </button>

              {/* Hold Current Cart Button */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsHoldModalOpen(true)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 border border-slate-200/70 dark:border-zinc-700/60 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition"
                  title="Hold / Park Current Cart (F6)"
                >
                  <PauseCircle className="w-3 h-3" />
                  <span>Hold</span>
                </button>
              )}

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Clear Cart (Ctrl+L)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Customer Fast Selector / Autocomplete (F8) */}
          <div className="px-3 py-2 bg-slate-50/50 dark:bg-zinc-950/30 border-b border-slate-200/70 dark:border-zinc-800 text-xs">
            {selectedCustomer ? (
              <div className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center font-semibold text-[11px] shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs text-slate-800 dark:text-zinc-100 truncate">{selectedCustomer.name}</span>
                      <span className="px-1 py-0.2 rounded text-[8px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                        {selectedCustomer.tag}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                      <span>{selectedCustomer.phone}</span>
                      <span>•</span>
                      <span>{selectedCustomer.loyaltyPoints || 0} pts</span>
                      {selectedCustomer.outstandingDues > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            Due: {currency}{selectedCustomer.outstandingDues}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectCustomer(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition shrink-0"
                  title="Clear customer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 relative">
                <div className="relative">
                  <input
                    ref={customerSearchInputRef}
                    type="text"
                    placeholder="Customer (F8): Search or enter name/phone..."
                    value={customerSearchQuery}
                    onChange={e => {
                      setCustomerSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    className="w-full px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-md text-xs outline-none focus:border-slate-400 dark:focus:border-zinc-500 placeholder:text-slate-400 text-slate-800 dark:text-zinc-100 font-mono"
                  />

                  {/* Customer Autocomplete Dropdown */}
                  {isCustomerDropdownOpen && matchingCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                      {matchingCustomers.map(cust => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 flex items-center justify-between text-xs transition cursor-pointer"
                        >
                          <div>
                            <div className="font-medium text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <span>{cust.name}</span>
                              <span className="text-[8px] px-1 py-0.2 bg-slate-100 dark:bg-zinc-800 rounded text-slate-500">
                                {cust.tag}
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">{cust.phone}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] text-slate-500 font-mono">{cust.loyaltyPoints} pts</div>
                            {cust.outstandingDues > 0 && (
                              <div className="text-[9px] font-medium text-rose-600 font-mono">{currency}{cust.outstandingDues}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="Walk-in Name"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-2 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded text-[11px] text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 outline-none"
                  />
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Phone (10 Digits)"
                    value={customerPhone}
                    onKeyDown={blockNonDigitKeys}
                    onChange={e => setCustomerPhone(sanitizeNumericInput(e.target.value, 10))}
                    className="w-full px-2 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded text-[11px] font-mono text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pricing Calculations & Giant Totals Panel */}
          <div className="p-3 bg-slate-50/60 dark:bg-zinc-950/40 border-b border-slate-200/70 dark:border-zinc-800 space-y-2">

            {/* Subtotal, Discount & Tax */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items):</span>
                <span className="font-mono font-medium text-slate-700 dark:text-zinc-300">{currency}{subtotal}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-zinc-400">Discount (F9):</span>
                <input
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  max={subtotal}
                  onKeyDown={e => {
                    blockInvalidNumberKeys(e);
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (paymentMode === 'Cash') {
                        receivedAmountInputRef.current?.focus();
                      } else {
                        handleCheckout();
                      }
                    }
                  }}
                  value={discountInput || ''}
                  placeholder="0"
                  onChange={e => {
                    const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), subtotal);
                    setDiscountInput(val);
                  }}
                  className="w-16 px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-right font-mono text-xs outline-none text-slate-800 dark:text-zinc-200"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-zinc-400">Tax (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  onKeyDown={blockInvalidNumberKeys}
                  value={taxPercentInput || ''}
                  placeholder="0"
                  onChange={e => {
                    const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), 100);
                    setTaxPercentInput(val);
                  }}
                  className="w-16 px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-right font-mono text-xs outline-none text-slate-800 dark:text-zinc-200"
                />
              </div>
            </div>

            {/* Giant Total Due Display */}
            <div className="p-2.5 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 dark:text-zinc-400">
                  Total Payable
                </span>
                <div className="text-[11px] text-slate-400">
                  Net after discount & tax
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-2xl sm:text-3xl tracking-tight text-emerald-400">
                  {currency}{grandTotal}
                </span>
              </div>
            </div>

          </div>

          {/* Tender Selector & Fast Cash Handling */}
          <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">

            <div>
              {/* Payment Method Selector (F10) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-zinc-400 font-mono font-semibold">
                  <span>Payment Tender</span>
                  <span>F10 to Cycle</span>
                </div>
                <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg">
                  {[
                    { mode: 'Cash', icon: Coins },
                    { mode: 'UPI', icon: QrCode },
                    { mode: 'Card', icon: CreditCard },
                    { mode: 'Credit', icon: UserCheck },
                    { mode: 'Split', icon: Layers },
                  ].map(({ mode, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode as any)}
                      className={`py-1 px-0.5 rounded-md text-[10px] font-medium flex flex-col items-center gap-0.5 transition cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                          : 'text-slate-700 dark:text-zinc-300 font-semibold hover:text-slate-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Workflow: Quick Presets & Change Due Calculation */}
              {paymentMode === 'Cash' && (
                <div className="mt-2.5 space-y-2">

                  {/* Cash Note Presets Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                    <span className="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold shrink-0 font-mono mr-1">Tender:</span>
                    {cashPresets.map((presetVal) => (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => {
                          setReceivedAmountInput(String(presetVal));
                          receivedAmountInputRef.current?.focus();
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border transition cursor-pointer shrink-0 ${
                          receivedNum === presetVal
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
                        }`}
                      >
                        {presetVal === grandTotal ? 'Exact' : `${currency}${presetVal}`}
                      </button>
                    ))}
                  </div>

                  {/* Amount Received Input */}
                  <div className="p-2 rounded-lg bg-slate-100/60 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/60 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-zinc-300 font-medium">Cash Received:</span>
                      <div className="relative">
                        <input
                          ref={receivedAmountInputRef}
                          type="number"
                          min="0"
                          onKeyDown={e => {
                            blockInvalidNumberKeys(e);
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCheckout();
                            }
                          }}
                          placeholder={`${grandTotal}`}
                          value={receivedAmountInput}
                          onChange={e => setReceivedAmountInput(e.target.value)}
                          className="w-28 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-right font-mono font-bold text-xs outline-none text-slate-800 dark:text-zinc-100 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Change Due Indicator */}
                    {receivedNum > 0 && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-zinc-700/60 text-xs">
                        <span className="text-slate-600 dark:text-zinc-300 font-medium">Change to Return:</span>
                        <span className={`font-mono font-bold text-sm ${changeDue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {currency}{changeDue}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Split Payment Allocator */}
              {paymentMode === 'Split' && grandTotal > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-slate-100/60 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/60 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-800 dark:text-zinc-200 font-medium text-[11px]">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-500" />
                      Split Breakdown
                    </span>
                    <span className={`font-mono text-[10px] font-medium ${splitRemaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {splitRemaining > 0 ? `Remaining: ${currency}${splitRemaining}` : '✓ Fully Covered'}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {(['Cash', 'UPI', 'Card', 'Store Credit', 'Wallet', 'Gift Voucher'] as const).map(mode => {
                      const currItem = splitPayments.find(p => p.mode === mode);
                      const amount = currItem?.amount || 0;
                      return (
                        <div key={mode} className="flex items-center justify-between gap-1.5 bg-white dark:bg-zinc-900 p-1 rounded border border-slate-200/60 dark:border-zinc-700/60">
                          <span className="text-slate-600 dark:text-zinc-300 text-[10px] w-20 truncate font-medium">
                            {mode}
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={amount || ''}
                              placeholder="0"
                              onChange={e => updateSplitAmount(mode, Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-16 px-1.5 py-0.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-right font-mono text-[11px] outline-none text-slate-800 dark:text-zinc-100"
                            />
                            {splitRemaining > 0 && amount === 0 && (
                              <button
                                type="button"
                                onClick={() => autoFillSplit(mode)}
                                className="px-1 py-0.2 text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-medium hover:bg-slate-200"
                              >
                                Fill
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Complete & Print Bill CTA */}
            <div className="space-y-2 pt-2">
              <input
                type="text"
                placeholder="Bill remarks / reference (optional)..."
                value={saleNotes}
                onChange={e => setSaleNotes(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-md text-[11px] outline-none text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />

              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0 || (paymentMode === 'Split' && splitRemaining > 0)}
                className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                  cart.length === 0 || (paymentMode === 'Split' && splitRemaining > 0)
                    ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-[0.99]'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Complete & Print Bill (F2)</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Docked Cashier Ergonomics Bottom Bar */}
      <div className="shrink-0 mt-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 font-mono">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F1</kbd>
            <span>Shortcuts</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F2</kbd>
            <span>Checkout</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F3</kbd>
            <span>Scan/Search</span>
          </div>
          <div className="flex items-center gap-1 font-mono hidden sm:flex">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F6</kbd>
            <span>Hold Bill</span>
          </div>
          <div className="flex items-center gap-1 font-mono hidden sm:flex">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F7</kbd>
            <span>Parked ({heldBills.length})</span>
          </div>
          <div className="flex items-center gap-1 font-mono hidden md:flex">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F8</kbd>
            <span>Customer</span>
          </div>
          <div className="flex items-center gap-1 font-mono hidden md:flex">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] text-slate-700 dark:text-zinc-300">F10</kbd>
            <span>Payment Mode</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[10px] text-slate-600 dark:text-zinc-400 font-mono font-semibold hidden sm:inline">
            Status: Ready
          </span>
        </div>
      </div>

      {/* Dynamic UPI Payment Modal */}
      <UPIPaymentModal
        isOpen={isUpiModalOpen}
        onClose={() => setIsUpiModalOpen(false)}
        onPaymentSuccess={finalizeUpiSale}
        settings={settings}
        invoiceNumber={draftInvoiceNumber || 'INV-2026-0001'}
        customerName={customerName}
        amount={grandTotal}
      />

      {/* Park / Hold Bill Modal */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                <h3 className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">Park / Hold Bill</h3>
              </div>
              <button onClick={() => setIsHoldModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-bold text-xs">✕</button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Hold {cart.length} item(s) ({currency}{grandTotal}) to serve the next customer. Resume anytime from the Parked queue.
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400 mb-0.5">Customer Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. Table 4 / Token 12 / Customer Name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs outline-none text-slate-800 dark:text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400 mb-0.5">Hold Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Customer fetching cash"
                  value={holdNoteInput}
                  onChange={e => setHoldNoteInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs outline-none text-slate-800 dark:text-zinc-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/70 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsHoldModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHoldBill}
                className="px-3 py-1.5 bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-xs"
              >
                Confirm Hold (F6)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parked Bills Modal */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-4 shadow-xl border border-slate-200/80 dark:border-zinc-800 space-y-3 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                <h3 className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">Parked Bills Queue ({heldBills.length})</h3>
              </div>
              <button onClick={() => setIsParkedModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-bold text-xs">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {heldBills.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-zinc-500 space-y-1">
                  <Clock className="w-8 h-8 mx-auto stroke-1 opacity-40" />
                  <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">No parked bills</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">Use &quot;Hold&quot; (F6) on any order to park it temporarily.</p>
                </div>
              ) : (
                heldBills.map(bill => {
                  const billTotal = bill.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
                  const itemCount = bill.cartItems.reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <div
                      key={bill.id}
                      className="p-2.5 rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-medium text-slate-800 dark:text-zinc-100 truncate">
                            {bill.customerName}
                          </h4>
                          {bill.customerPhone && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({bill.customerPhone})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 font-mono">
                          <span>{itemCount} item(s)</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">
                            {currency}{billTotal}
                          </span>
                          <span>•</span>
                          <span>{new Date(bill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {bill.note && (
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 italic">
                            &quot;{bill.note}&quot;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRecallBill(bill)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                        >
                          <PlayCircle className="w-3 h-3" />
                          <span>Resume</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHeldBill(bill.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete parked bill"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800 text-right">
              <button
                type="button"
                onClick={() => setIsParkedModalOpen(false)}
                className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-medium hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biller Keyboard Shortcuts Cheat Sheet Modal (F1) */}
      {isShortcutHelpOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200/80 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">
                  Cashier & Biller Ergonomics (Shortcuts)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutHelpOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-bold text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/60 space-y-2">
                <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider">
                  Billing Workflow
                </h4>
                <div className="space-y-1.5 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span>F3</span>
                    <span className="text-slate-400">Focus Barcode</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>↵ Enter</span>
                    <span className="text-slate-400">Add / Advance</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>5*barcode</span>
                    <span className="text-slate-400">Qty Multiplier</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>F2</span>
                    <span className="text-slate-400">Checkout & Print</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Ctrl + L</span>
                    <span className="text-slate-400">Clear Cart</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/60 space-y-2">
                <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider">
                  Customer & Controls
                </h4>
                <div className="space-y-1.5 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                  <div className="flex justify-between items-center">
                    <span>F6</span>
                    <span className="text-slate-400">Hold / Park Bill</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>F7</span>
                    <span className="text-slate-400">Recall Parked</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>F8</span>
                    <span className="text-slate-400">Select Customer</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>F9</span>
                    <span className="text-slate-400">Bill Discount</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>F10</span>
                    <span className="text-slate-400">Cycle Payment</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Alt + V</span>
                    <span className="text-slate-400">Toggle View</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong>Biller Pro-Tip:</strong> Press <kbd className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.2 rounded border">Enter</kbd> in the empty barcode scanner to instantly jump focus to Tender Cash! Press <kbd className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.2 rounded border">Enter</kbd> again on cash to finalize and print the invoice.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-zinc-800 text-right">
              <button
                type="button"
                onClick={() => setIsShortcutHelpOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Got It (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
