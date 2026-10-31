import { describe, it, expect } from 'vitest';
import {
  parseDelimitedText,
  validateImportRows,
  generateSampleCsvContent,
} from '@bazaar/shared-utils';

describe('Excel & CSV Data Import Parser (@bazaar/shared-utils)', () => {
  it('parses standard comma-separated text into rows and headers', () => {
    const csvData = `Name,Barcode,Purchase Price,Selling Price,Quantity,Category
Atta 5kg,8901234001028,240,285,30,Grains
Salt 1kg,8901234001035,22,28,100,Spices`;

    const rows = parseDelimitedText(csvData);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Name']).toBe('Atta 5kg');
    expect(rows[1]['Barcode']).toBe('8901234001035');
  });

  it('validates product import rows and flags missing required fields', () => {
    const rows = [
      { 'Product Name': 'Good Product', 'Barcode': '8901234001011', 'Selling Price': '100', 'Purchase Price': '80', 'Current Stock': '20' },
      { 'Product Name': '', 'Barcode': '8901234001012', 'Selling Price': '50', 'Purchase Price': '40', 'Current Stock': '10' }, // Missing Name
      { 'Product Name': 'Bad Price', 'Barcode': '8901234001013', 'Selling Price': '-10', 'Purchase Price': '40', 'Current Stock': '10' }, // Negative price
    ];

    // Test with optional second argument omitted
    const validation = validateImportRows(rows);
    expect(validation.validRows).toBe(1);
    expect(validation.invalidRows).toBeGreaterThanOrEqual(2);
    expect(validation.rows[0].product.name).toBe('Good Product');
  });

  it('generates non-empty downloadable CSV template', () => {
    const template = generateSampleCsvContent();
    expect(template).toContain('Name');
    expect(template).toContain('Barcode');
    expect(template.split('\n').length).toBeGreaterThan(1);
  });
});
