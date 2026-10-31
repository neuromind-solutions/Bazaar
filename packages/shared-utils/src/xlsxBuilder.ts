/**
 * @bazaar/shared-utils — Pure Zero-Dependency Binary .xlsx (OpenXML) Generator
 *
 * Generates genuine binary .xlsx (Office Open XML ZIP archive) files directly in the browser
 * or node.js with zero external dependencies.
 *
 * 100% compatible with:
 * - Microsoft Excel (All versions: 2007, 2010, 2013, 2016, 2019, 2021, Office 365)
 * - Google Sheets & Excel Online
 * - LibreOffice Calc & Apple Numbers
 * - Mobile Office Apps (WPS, Polaris, Microsoft 365 Mobile)
 */

// CRC-32 Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Convert string to UTF-8 Uint8Array
function strToUtf8(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

/**
 * Builds an uncompressed (Store) ZIP archive in pure Uint8Array.
 * OpenXML / Excel natively supports uncompressed Store method (method 0).
 */
function buildZipArchive(entries: ZipEntry[]): Uint8Array {
  let totalLocalSize = 0;
  let totalCentralSize = 0;

  for (const entry of entries) {
    const pathBytes = strToUtf8(entry.path);
    totalLocalSize += 30 + pathBytes.length + entry.data.length;
    totalCentralSize += 46 + pathBytes.length;
  }

  const eocdSize = 22;
  const fullBuffer = new Uint8Array(totalLocalSize + totalCentralSize + eocdSize);
  const view = new DataView(fullBuffer.buffer, fullBuffer.byteOffset, fullBuffer.byteLength);

  let localOffset = 0;
  const centralOffsets: number[] = [];

  // 1. Write Local File Headers & Data
  for (const entry of entries) {
    centralOffsets.push(localOffset);
    const pathBytes = strToUtf8(entry.path);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Signature 0x04034b50
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true); // Version needed (2.0)
    view.setUint16(localOffset + 6, 0x0800, true); // Flags (UTF-8 filename)
    view.setUint16(localOffset + 8, 0, true); // Compression method (0 = Store)
    view.setUint16(localOffset + 10, 0, true); // Last mod time
    view.setUint16(localOffset + 12, 0, true); // Last mod date
    view.setUint32(localOffset + 14, crc, true); // CRC-32
    view.setUint32(localOffset + 18, size, true); // Compressed size
    view.setUint32(localOffset + 22, size, true); // Uncompressed size
    view.setUint16(localOffset + 26, pathBytes.length, true); // Filename length
    view.setUint16(localOffset + 28, 0, true); // Extra field length

    fullBuffer.set(pathBytes, localOffset + 30);
    fullBuffer.set(entry.data, localOffset + 30 + pathBytes.length);

    localOffset += 30 + pathBytes.length + size;
  }

  const centralDirStart = localOffset;

  // 2. Write Central Directory Headers
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const pathBytes = strToUtf8(entry.path);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const offset = centralOffsets[i];

    // Signature 0x02014b50
    view.setUint32(localOffset, 0x02014b50, true);
    view.setUint16(localOffset + 4, 20, true); // Version made by
    view.setUint16(localOffset + 6, 20, true); // Version needed
    view.setUint16(localOffset + 8, 0x0800, true); // Flags (UTF-8)
    view.setUint16(localOffset + 10, 0, true); // Compression (Store)
    view.setUint16(localOffset + 12, 0, true); // Mod time
    view.setUint16(localOffset + 14, 0, true); // Mod date
    view.setUint32(localOffset + 16, crc, true); // CRC-32
    view.setUint32(localOffset + 20, size, true); // Compressed size
    view.setUint32(localOffset + 24, size, true); // Uncompressed size
    view.setUint16(localOffset + 28, pathBytes.length, true); // Filename length
    view.setUint16(localOffset + 30, 0, true); // Extra field length
    view.setUint16(localOffset + 32, 0, true); // Comment length
    view.setUint16(localOffset + 34, 0, true); // Disk start
    view.setUint16(localOffset + 36, 0, true); // Internal attrs
    view.setUint32(localOffset + 38, 0, true); // External attrs
    view.setUint32(localOffset + 42, offset, true); // Relative offset of local header

    fullBuffer.set(pathBytes, localOffset + 46);
    localOffset += 46 + pathBytes.length;
  }

  const centralDirSize = localOffset - centralDirStart;

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(localOffset, 0x06054b50, true); // Signature
  view.setUint16(localOffset + 4, 0, true); // Disk number
  view.setUint16(localOffset + 6, 0, true); // Start disk
  view.setUint16(localOffset + 8, entries.length, true); // Entries on disk
  view.setUint16(localOffset + 10, entries.length, true); // Total entries
  view.setUint32(localOffset + 12, centralDirSize, true); // Size of central dir
  view.setUint32(localOffset + 16, centralDirStart, true); // Offset of central dir
  view.setUint16(localOffset + 20, 0, true); // Comment length

  return fullBuffer;
}

function escapeXml(str: string | number | undefined | null): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Builds a standard binary .xlsx (Office OpenXML) workbook buffer from headers and rows.
 */
export function buildXlsxWorkbook(
  sheetName: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
): Uint8Array {
  // 1. Build sheet1.xml
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>`;

  headers.forEach((_, idx) => {
    const width = idx === 0 ? 30 : idx === 1 ? 18 : 16;
    sheetXml += `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
  });
  sheetXml += `</cols><sheetData>`;

  // Header Row (Row 1)
  sheetXml += `<row r="1" ht="24" customHeight="1">`;
  headers.forEach((h, colIdx) => {
    const cellRef = `${colToLetter(colIdx)}1`;
    sheetXml += `<c r="${cellRef}" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetXml += `</row>`;

  // Data Rows (Row 2+)
  rows.forEach((row, rowIdx) => {
    const rNum = rowIdx + 2;
    sheetXml += `<row r="${rNum}">`;
    row.forEach((val, colIdx) => {
      const cellRef = `${colToLetter(colIdx)}${rNum}`;
      const numVal = Number(val);
      // Treat specific columns as numbers if valid
      if (val !== '' && val !== null && val !== undefined && !isNaN(numVal) && typeof val === 'number') {
        sheetXml += `<c r="${cellRef}" s="2"><v>${numVal}</v></c>`;
      } else {
        sheetXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
      }
    });
    sheetXml += `</row>`;
  });

  sheetXml += `</sheetData></worksheet>`;

  // 2. styles.xml with green header styling and border
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
  <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF10B981"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"><color rgb="FF059669"/></left><right style="thin"><color rgb="FF059669"/></right><top style="thin"><color rgb="FF059669"/></top><bottom style="thin"><color rgb="FF059669"/></bottom></border>
</borders>
<cellStyleXfs count="1">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="3">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
</cellXfs>
</styleSheet>`;

  // 3. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // 4. _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // 5. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // 6. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Package all into ZIP structure
  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: strToUtf8(contentTypesXml) },
    { path: '_rels/.rels', data: strToUtf8(relsXml) },
    { path: 'xl/workbook.xml', data: strToUtf8(workbookXml) },
    { path: 'xl/_rels/workbook.xml.rels', data: strToUtf8(workbookRelsXml) },
    { path: 'xl/styles.xml', data: strToUtf8(stylesXml) },
    { path: 'xl/worksheets/sheet1.xml', data: strToUtf8(sheetXml) },
  ];

  return buildZipArchive(entries);
}
