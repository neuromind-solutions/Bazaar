/**
 * @bazaar/shared-utils — Excel & CSV Inventory Import/Export Engine
 *
 * Provides:
 * 1. Sample template generation (both Native Excel .xls XML and standard .csv with UTF-8 BOM)
 * 2. Robust CSV / TSV / Excel XML file parsing with intelligent header mapping
 * 3. Row-by-row validation & duplicate barcode conflict detection
 * 4. Export store catalog to Native Excel spreadsheet or CSV
 */

import { buildXlsxWorkbook } from './xlsxBuilder';

export interface ImportableProduct {
  id?: string;
  name: string;
  category: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  unit?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  shelfLocation?: string;
  supplierName?: string;
  expiryDate?: string;
  wholesalePrice?: number;
  distributorPrice?: number;
  vipPrice?: number;
}

export interface ParsedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  product: Partial<ImportableProduct>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicateInFile: boolean;
  isExistingInDb: boolean;
  existingProduct?: ImportableProduct;
}

export interface ImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  rows: ParsedImportRow[];
}

export const SAMPLE_TEMPLATE_HEADERS = [
  'Product Name',
  'Barcode',
  'Category',
  'Unit',
  'Purchase Price',
  'Selling Price',
  'Current Stock',
  'Min Stock Level',
  'Max Stock Level',
  'Shelf Location',
  'Wholesale Price',
  'Supplier Name',
];

export const SAMPLE_TEMPLATE_ROWS = [
  [
    'Basmati Rice Classic 5kg',
    '890103000001',
    'Grocery',
    'kg',
    '450',
    '520',
    '40',
    '10',
    '100',
    'Aisle 1-A',
    '490',
    'IndiaGate Mills',
  ],
  [
    'Tata Salt Vacuum Evaporated 1kg',
    '890103000002',
    'Grocery',
    'kg',
    '22',
    '28',
    '100',
    '20',
    '200',
    'Aisle 1-B',
    '25',
    'Tata Consumer',
  ],
  [
    'Fortune Sunlite Sunflower Oil 1L',
    '890103000003',
    'Oil & Ghee',
    'litre',
    '125',
    '145',
    '60',
    '15',
    '120',
    'Aisle 2-A',
    '135',
    'Adani Wilmar',
  ],
  [
    'Aashirvaad Superior MP Atta 5kg',
    '890103000004',
    'Atta & Flour',
    'kg',
    '210',
    '245',
    '35',
    '10',
    '80',
    'Aisle 1-C',
    '230',
    'ITC Ltd',
  ],
  [
    'Britannia Good Day Butter Cookies 200g',
    '890103000005',
    'Snacks & Biscuits',
    'pcs',
    '32',
    '40',
    '80',
    '25',
    '150',
    'Aisle 3-B',
    '36',
    'Britannia Industries',
  ],
];

/**
 * Generates native Microsoft Excel XML Workbook (.xls / .xml).
 * Opens immediately in Microsoft Excel without encoding issues, with styled green headers and column widths.
 */
export function generateSampleExcelXmlContent(): string {
  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const headerCells = SAMPLE_TEMPLATE_HEADERS.map(
    h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
  ).join('');

  const dataRows = SAMPLE_TEMPLATE_ROWS.map(row => {
    const cells = row.map((val, idx) => {
      // If purchase price, selling price, stock, min, max, ws price, treat as Number
      const isNum = [4, 5, 6, 7, 8, 10].includes(idx);
      if (isNum && !isNaN(Number(val))) {
        return `<Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${val}</Data></Cell>`;
      }
      return `<Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
    }).join('');
    return `<Row ss:Height="22">${cells}</Row>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Bazaar POS Products Template</Title>
  <Author>Bazaar POS</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#059669"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="TextCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Products Template">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="200"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="60"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="150"/>
   <Row ss:Height="26">
    ${headerCells}
   </Row>
   ${dataRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

/**
 * Generates sample CSV template content with UTF-8 BOM.
 */
export function generateSampleCsvContent(): string {
  const escapeCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const headerLine = SAMPLE_TEMPLATE_HEADERS.map(escapeCell).join(',');
  const rowLines = SAMPLE_TEMPLATE_ROWS.map(row => row.map(escapeCell).join(','));

  // UTF-8 BOM \uFEFF ensures Excel displays characters and Indian numbering correctly
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Parses raw CSV / TSV / Excel XML text into an array of string objects.
 */
export function parseDelimitedText(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, '').trim(); // strip BOM

  // 1. Detect if this is an Excel XML / HTML Spreadsheet document
  if (cleanText.includes('<Workbook') || cleanText.includes('<table')) {
    return parseExcelXmlOrHtml(cleanText);
  }

  // 2. Standard CSV / TSV parsing
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  // Detect delimiter (, or \t or ;)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const nc = line[j + 1];
      if (c === '"') {
        if (inQ && nc === '"') {
          cell += '"';
          j++;
        } else {
          inQ = !inQ;
        }
      } else if (c === delimiter && !inQ) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Parses Excel XML (<Row><Cell><Data>...</Data></Cell></Row>) or HTML <table> format.
 */
function parseExcelXmlOrHtml(xmlText: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  
  // Extract all <Row> ... </Row> or <tr> ... </tr>
  const rowMatches = xmlText.match(/<(?:Row|tr)[\s\S]*?<\/(?:Row|tr)>/gi) || [];
  if (rowMatches.length === 0) return [];

  const extractCells = (rowXml: string): string[] => {
    const cells: string[] = [];
    // Match <Data ...>value</Data> or <td>value</td> or <th>value</th>
    const cellMatches = rowXml.match(/<(?:Data|td|th)[^>]*>([\s\S]*?)<\/(?:Data|td|th)>/gi) || [];
    cellMatches.forEach(c => {
      const val = c.replace(/<[^>]+>/g, '').trim();
      // Decode basic xml entities
      const decoded = val
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      cells.push(decoded);
    });
    return cells;
  };

  if (!rowMatches[0]) return [];
  const headerCells = extractCells(rowMatches[0]);
  if (headerCells.length === 0) return [];

  for (let i = 1; i < rowMatches.length; i++) {
    const row = rowMatches[i];
    if (!row) continue;
    const values = extractCells(row);
    if (values.length === 0) continue;
    const rowObj: Record<string, string> = {};
    headerCells.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Maps arbitrary column headers to standard Product fields.
 */
function normalizeHeaderName(header: string): string {
  const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['name', 'productname', 'itemname', 'title', 'item', 'product'].includes(clean)) return 'name';
  if (['barcode', 'code', 'sku', 'upc', 'ean', 'barcodeno'].includes(clean)) return 'barcode';
  if (['category', 'group', 'dept', 'department', 'type'].includes(clean)) return 'category';
  if (['unit', 'uom', 'measure', 'measurement'].includes(clean)) return 'unit';
  if (['purchaseprice', 'costprice', 'cost', 'buyprice', 'purchase'].includes(clean)) return 'purchasePrice';
  if (['sellingprice', 'price', 'rate', 'saleprice', 'sellprice'].includes(clean)) return 'sellingPrice';
  if (['wholesaleprice', 'wsprice', 'wholesale'].includes(clean)) return 'wholesalePrice';
  if (['distributorprice', 'distprice', 'distributor'].includes(clean)) return 'distributorPrice';
  if (['vipprice', 'vip'].includes(clean)) return 'vipPrice';
  if (['currentstock', 'stock', 'quantity', 'qty', 'openingstock', 'inventory'].includes(clean)) return 'quantity';
  if (['minstocklevel', 'minstock', 'minlevel', 'reorderpoint', 'min'].includes(clean)) return 'minStockLevel';
  if (['maxstocklevel', 'maxstock', 'maxlevel', 'max'].includes(clean)) return 'maxStockLevel';
  if (['shelflocation', 'location', 'shelf', 'rack', 'aisle', 'bin'].includes(clean)) return 'shelfLocation';
  if (['suppliername', 'supplier', 'vendor'].includes(clean)) return 'supplierName';
  if (['expirydate', 'expiry', 'exp'].includes(clean)) return 'expiryDate';
  return clean;
}

/**
 * Validates parsed rows against existing inventory.
 */
export function validateImportRows(
  rawRows: Record<string, string>[],
  existingProducts: ImportableProduct[] = []
): ImportValidationResult {
  const existingBarcodeMap = new Map<string, ImportableProduct>();
  (existingProducts || []).forEach(p => {
    if (p.barcode) existingBarcodeMap.set(p.barcode.trim(), p);
  });

  const seenFileBarcodes = new Set<string>();
  const parsedRows: ParsedImportRow[] = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // header is line 1
    const normalized: Record<string, string> = {};

    Object.keys(row).forEach(key => {
      normalized[normalizeHeaderName(key)] = row[key];
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    const name = (normalized['name'] || '').trim();
    if (!name) {
      errors.push('Product Name is required.');
    }

    let barcode = (normalized['barcode'] || '').trim();
    if (!barcode) {
      // Auto-generate 12-digit barcode if blank
      barcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
      warnings.push(`Barcode was missing; auto-assigned ${barcode}`);
    }

    let isDuplicateInFile = false;
    if (seenFileBarcodes.has(barcode)) {
      isDuplicateInFile = true;
      warnings.push(`Duplicate barcode "${barcode}" found within file`);
    } else {
      seenFileBarcodes.add(barcode);
    }

    const existingProduct = existingBarcodeMap.get(barcode);
    const isExistingInDb = !!existingProduct;
    if (isExistingInDb) {
      warnings.push(`Barcode already exists in database ("${existingProduct?.name}")`);
    }

    const category = (normalized['category'] || 'General').trim();
    const unit = (normalized['unit'] || 'pcs').trim().toLowerCase();
    
    const purchasePrice = parseFloat(normalized['purchasePrice'] || '0') || 0;
    const sellingPrice = parseFloat(normalized['sellingPrice'] || '0') || 0;
    const wholesalePrice = normalized['wholesalePrice'] ? parseFloat(normalized['wholesalePrice']) : undefined;
    const distributorPrice = normalized['distributorPrice'] ? parseFloat(normalized['distributorPrice']) : undefined;
    const vipPrice = normalized['vipPrice'] ? parseFloat(normalized['vipPrice']) : undefined;
    const quantity = parseFloat(normalized['quantity'] || '0') || 0;
    const minStockLevel = parseFloat(normalized['minStockLevel'] || '10') || 10;
    const maxStockLevel = parseFloat(normalized['maxStockLevel'] || '100') || 100;
    const shelfLocation = (normalized['shelfLocation'] || '').trim();
    const supplierName = (normalized['supplierName'] || '').trim();
    const expiryDate = (normalized['expiryDate'] || '').trim();

    if (sellingPrice < 0) errors.push('Selling Price cannot be negative.');
    if (purchasePrice < 0) errors.push('Purchase Price cannot be negative.');
    if (quantity < 0) errors.push('Stock Quantity cannot be negative.');

    if (sellingPrice > 0 && purchasePrice > sellingPrice) {
      warnings.push(`Purchase price (₹${purchasePrice}) is higher than Selling price (₹${sellingPrice})`);
    }

    const product: Partial<ImportableProduct> = {
      name,
      barcode,
      category,
      unit,
      purchasePrice,
      sellingPrice,
      wholesalePrice,
      distributorPrice,
      vipPrice,
      quantity,
      minStockLevel,
      maxStockLevel,
      shelfLocation,
      supplierName: supplierName || undefined,
      expiryDate: expiryDate || undefined,
    };

    parsedRows.push({
      rowNumber,
      raw: row,
      product,
      isValid: errors.length === 0,
      errors,
      warnings,
      isDuplicateInFile,
      isExistingInDb,
      existingProduct,
    });
  });

  const validRows = parsedRows.filter(r => r.isValid).length;
  const invalidRows = parsedRows.filter(r => !r.isValid).length;
  const duplicateCount = parsedRows.filter(r => r.isExistingInDb || r.isDuplicateInFile).length;

  return {
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    duplicateCount,
    rows: parsedRows,
  };
}

/**
 * Exports store products list to standard CSV with UTF-8 BOM.
 */
export function exportProductsToCsv(products: ImportableProduct[]): string {
  const escapeCell = (cell: string | number | undefined | null) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Product Name',
    'Barcode',
    'Category',
    'Unit',
    'Purchase Price',
    'Selling Price',
    'Current Stock',
    'Min Stock Level',
    'Max Stock Level',
    'Shelf Location',
    'Wholesale Price',
    'Supplier Name',
  ];

  const rows = products.map(p => [
    p.name,
    p.barcode,
    p.category,
    p.unit,
    p.purchasePrice,
    p.sellingPrice,
    p.quantity,
    p.minStockLevel || 10,
    p.maxStockLevel || 100,
    p.shelfLocation || '',
    p.wholesalePrice || '',
    p.supplierName || '',
  ]);

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(r => r.map(escapeCell).join(','));

  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Exports store products list to Microsoft Excel XML (.xls).
 */
export function exportProductsToExcelXml(products: ImportableProduct[]): string {
  const escapeXml = (str: string | number | undefined | null) => {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const headers = [
    'Product Name',
    'Barcode',
    'Category',
    'Unit',
    'Purchase Price',
    'Selling Price',
    'Current Stock',
    'Min Stock Level',
    'Max Stock Level',
    'Shelf Location',
    'Wholesale Price',
    'Supplier Name',
  ];

  const headerCells = headers.map(
    h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
  ).join('');

  const dataRows = products.map(p => {
    return `<Row ss:Height="20">
      <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
      <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(p.barcode)}</Data></Cell>
      <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(p.category)}</Data></Cell>
      <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(p.unit || 'pcs')}</Data></Cell>
      <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.purchasePrice || 0}</Data></Cell>
      <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.sellingPrice || 0}</Data></Cell>
      <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.quantity || 0}</Data></Cell>
      <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.minStockLevel || 10}</Data></Cell>
      <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.maxStockLevel || 100}</Data></Cell>
      <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(p.shelfLocation || '')}</Data></Cell>
      <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${p.wholesalePrice || 0}</Data></Cell>
      <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXml(p.supplierName || '')}</Data></Cell>
    </Row>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#059669"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="TextCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Products Catalog">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="200"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="60"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="150"/>
   <Row ss:Height="26">
    ${headerCells}
   </Row>
   ${dataRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

/**
 * Generates an authentic binary Microsoft Excel .xlsx workbook (ZIP/OpenXML format).
 * Opens cleanly in ALL versions of Microsoft Excel with zero security or format warnings!
 */
export function generateSampleXlsxBinary(): Uint8Array {
  return buildXlsxWorkbook(
    'Products Template',
    SAMPLE_TEMPLATE_HEADERS,
    SAMPLE_TEMPLATE_ROWS
  );
}

/**
 * Exports products catalog to an authentic binary Microsoft Excel .xlsx workbook.
 */
export function exportProductsToXlsxBinary(products: ImportableProduct[]): Uint8Array {
  const headers = [
    'Product Name',
    'Barcode',
    'Category',
    'Unit',
    'Purchase Price',
    'Selling Price',
    'Current Stock',
    'Min Stock Level',
    'Max Stock Level',
    'Shelf Location',
    'Wholesale Price',
    'Supplier Name',
  ];

  const rows = products.map(p => [
    p.name,
    p.barcode,
    p.category,
    p.unit || 'pcs',
    p.purchasePrice || 0,
    p.sellingPrice || 0,
    p.quantity || 0,
    p.minStockLevel || 10,
    p.maxStockLevel || 100,
    p.shelfLocation || '',
    p.wholesalePrice || 0,
    p.supplierName || '',
  ]);

  return buildXlsxWorkbook('Products Catalog', headers, rows);
}

