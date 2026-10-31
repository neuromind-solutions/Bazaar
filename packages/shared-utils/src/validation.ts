/**
 * @bazaar/shared-utils — Universal Input Validation & Restriction Library
 *
 * Provides standardized validators, formatters, and keyboard-event blockers
 * for form inputs across Desktop POS, Mobile companion, and backend services.
 */

export interface KeyboardLikeEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault: () => void;
}

// ----------------------------------------------------------------
// Regular Expressions
// ----------------------------------------------------------------

/** Indian 10-digit mobile number starting with 6, 7, 8, or 9 */
export const PHONE_REGEX = /^[6-9]\d{9}$/;

/** RFC-compliant email address validation */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** 15-character statutory Indian GSTIN format */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** 4-digit numeric security PIN */
export const PIN_REGEX = /^\d{4}$/;

/** Barcode: 8 to 18 alphanumeric characters */
export const BARCODE_REGEX = /^[a-zA-Z0-9\-_]{6,20}$/;

// ----------------------------------------------------------------
// Validators
// ----------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a 10-digit Indian mobile number.
 * Allows empty if not required.
 */
export function validatePhone(phone: string, required = true): ValidationResult {
  const cleaned = phone.trim();
  if (!cleaned) {
    return required
      ? { isValid: false, error: 'Mobile number is required' }
      : { isValid: true };
  }

  // Must be strictly 10 digits
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'Mobile number must contain digits only' };
  }

  if (cleaned.length !== 10) {
    return { isValid: false, error: `Mobile number must be exactly 10 digits (currently ${cleaned.length})` };
  }

  if (!PHONE_REGEX.test(cleaned)) {
    return { isValid: false, error: 'Mobile number must start with 6, 7, 8, or 9' };
  }

  return { isValid: true };
}

/**
 * Validates an email address.
 * Optional by default; only checks format if input is non-empty.
 */
export function validateEmail(email: string, required = false): ValidationResult {
  const cleaned = email.trim();
  if (!cleaned) {
    return required
      ? { isValid: false, error: 'Email address is required' }
      : { isValid: true };
  }

  if (!EMAIL_REGEX.test(cleaned)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@domain.com)' };
  }

  return { isValid: true };
}

/**
 * Validates an Indian GSTIN (Goods and Services Tax Identification Number).
 * Optional by default.
 */
export function validateGstin(gstin: string, required = false): ValidationResult {
  const cleaned = gstin.trim().toUpperCase();
  if (!cleaned) {
    return required
      ? { isValid: false, error: 'GSTIN number is required' }
      : { isValid: true };
  }

  if (cleaned.length !== 15) {
    return { isValid: false, error: `GSTIN must be exactly 15 characters (currently ${cleaned.length})` };
  }

  if (!GSTIN_REGEX.test(cleaned)) {
    return { isValid: false, error: 'Invalid GSTIN format (expected: 22AAAAA0000A1Z5)' };
  }

  return { isValid: true };
}

/**
 * Validates employee security PIN (strictly 4 digits).
 */
export function validatePin(pin: string): ValidationResult {
  const cleaned = pin.trim();
  if (!cleaned) {
    return { isValid: false, error: 'Security PIN is required' };
  }

  if (!PIN_REGEX.test(cleaned)) {
    return { isValid: false, error: 'PIN must be exactly 4 numeric digits' };
  }

  return { isValid: true };
}

/**
 * Validates barcode format and length.
 */
export function validateBarcode(barcode: string): ValidationResult {
  const cleaned = barcode.trim();
  if (!cleaned) {
    return { isValid: false, error: 'Barcode is required' };
  }

  if (cleaned.length < 6 || cleaned.length > 20) {
    return { isValid: false, error: 'Barcode must be between 6 and 20 characters' };
  }

  if (!BARCODE_REGEX.test(cleaned)) {
    return { isValid: false, error: 'Barcode contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validates a monetary price.
 */
export function validatePrice(price: number | string, min = 0, fieldName = 'Price'): ValidationResult {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }
  if (num < min) {
    return { isValid: false, error: `${fieldName} cannot be less than ${min}` };
  }
  return { isValid: true };
}

/**
 * Validates inventory stock quantity.
 */
export function validateQuantity(qty: number | string, allowZero = true, fieldName = 'Quantity'): ValidationResult {
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }
  if (allowZero ? num < 0 : num <= 0) {
    return { isValid: false, error: `${fieldName} must be ${allowZero ? 'greater than or equal to 0' : 'greater than 0'}` };
  }
  return { isValid: true };
}

/**
 * Validates discount amount or percentage against a subtotal.
 */
export function validateDiscount(discount: number, subtotal: number, isPercent = false): ValidationResult {
  if (isNaN(discount) || discount < 0) {
    return { isValid: false, error: 'Discount cannot be negative' };
  }
  if (isPercent && discount > 100) {
    return { isValid: false, error: 'Discount percentage cannot exceed 100%' };
  }
  if (!isPercent && discount > subtotal) {
    return { isValid: false, error: `Discount cannot exceed bill subtotal (${subtotal})` };
  }
  return { isValid: true };
}

// ----------------------------------------------------------------
// Input Sanitizers & Event Blockers
// ----------------------------------------------------------------

/**
 * Sanitizes input to digits only with an optional maximum length.
 * Useful for `onChange` handlers on phone numbers, OTPs, PINs.
 */
export function sanitizeNumericInput(val: string, maxLen?: number): string {
  const digits = val.replace(/\D/g, '');
  return maxLen !== undefined ? digits.slice(0, maxLen) : digits;
}

/**
 * Sanitizes decimal numbers (e.g. prices, weights).
 * Prevents multiple decimal points and negative numbers.
 */
export function sanitizeDecimalInput(val: string, maxDecimals = 3): string {
  // Remove all characters except digits and a single decimal point
  let cleaned = val.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  if (maxDecimals !== undefined && parts.length === 2 && parts[1].length > maxDecimals) {
    cleaned = parts[0] + '.' + parts[1].slice(0, maxDecimals);
  }
  return cleaned;
}

/**
 * Blocks typing negative signs, scientific notation 'e', and '+' in numeric inputs.
 * Use on `<input type="number" onKeyDown={blockInvalidNumberKeys} />`
 */
export function blockInvalidNumberKeys(e: KeyboardLikeEvent): void {
  if (['e', 'E', '-', '+'].includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Blocks non-digit keys on text inputs meant for numbers (e.g. phone, PIN).
 * Permits backspace, delete, tab, arrows, and copy/paste shortcuts.
 */
export function blockNonDigitKeys(e: KeyboardLikeEvent): void {
  // Allow navigation/control keys
  if (
    ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
    // Allow Ctrl/Cmd + A, C, V, X
    ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
  ) {
    return;
  }

  // If not a digit 0-9, prevent default
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Generate a valid EAN-13 barcode with correct GS1 Luhn check digit.
 * Uses the 890 prefix (India GS1 prefix range) by default.
 */
export function generateEAN13(prefix = '890'): string {
  const randomLen = 12 - prefix.length;
  const randomPart = Array.from({ length: randomLen }, () => Math.floor(Math.random() * 10)).join('');
  const digits = prefix + randomPart;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
}

export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(barcode[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(barcode[12], 10);
}


