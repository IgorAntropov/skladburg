import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync,
} from 'fflate';
import { readFileSync } from 'node:fs';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildImportXlsx } from './testing/buildImportXlsx';
import {
  CELLS_IMPORT_TEMPLATE,
  STOCK_IMPORT_TEMPLATE,
} from './warehouseImportTemplates';
import { preflightXlsx } from './xlsxPreflight';
import {
  readWarehouseXlsx,
  readXlsx,
} from './xlsxReader';

const archive = (xml: string): Uint8Array => zipSync({ 'xl/worksheets/sheet1.xml': strToU8(xml) });

describe('XLSX bounded preflight', () => {
  it.each([
    '<worksheet><row r="10002"/></worksheet>',
    '<worksheet><row r="1"><c r="AG1"/></row></worksheet>',
    '<worksheet><dimension ref="A1:XFD1048576"/></worksheet>',
    '<!DOCTYPE worksheet SYSTEM "https://invalid.example/x"><worksheet/>',
    '<worksheet><row r="1"><c r="A1"><v>' + 'x'.repeat(4097) + '</v></c></row></worksheet>',
    '<worksheet><row r="1"><c r="A1"><v>&external;</v></c></row></worksheet>',
  ])('rejects unsafe XML before materialization', (xml) => {
    expect(() => {
      preflightXlsx(archive(xml));
    }).toThrow();
  });
  it('accepts ordinary XML declarations in all workbook parts before reading cells', async () => {
    const bytes = buildImportXlsx(['name', 'sku'], [['Импорт', '0001']]);
    expect(() => {
      preflightXlsx(bytes);
    }).not.toThrow();
    expect(await readXlsx(bytes)).toEqual([['name', 'sku'], ['Импорт', '0001']]);
  });
  it.each([
    '<?xml-stylesheet href="https://invalid.example/style.xsl"?><worksheet/>',
    '<?xmlscript value="blocked"?><worksheet/>',
    '<?other instruction?><worksheet/>',
    '<?xml version="1.0"?><worksheet><?other instruction?></worksheet>',
  ])('rejects processing instructions other than the declaration', (xml) => {
    expect(() => {
      preflightXlsx(archive(xml));
    }).toThrow();
  });
  it.each([
    '<row x:r="10002"><c r="A1"/></row>',
    '<row r="1"><c x:r="AG1"/></row>',
    '<dimension x:ref="A1:AG1"/>',
    '<row r="1"><c r="A1" x:r="AG1"/></row>',
    '<row r="1"><c x:r="AG1" r="A1"/></row>',
    '<row r="1"><c x:r="A1" y:r="A1"/></row>',
    '<dimension ref="A1" x:ref="A1:AG1"/>',
    '<row r="1" x:r="1"><c r="A1"/></row>',
    '<row x:r="&#49;0002"><c r="A1"/></row>',
    '<row r="1"><c x:r="&#65;G1"/></row>',
    '<dimension x:ref="A1:&#65;G1"/>',
  ])('rejects normalized namespace references and colliding attributes before materialization', (content) => {
    const xml = '<worksheet xmlns:x="urn:test" xmlns:y="urn:other"><sheetData>' + content + '</sheetData></worksheet>';
    expect(() => {
      preflightXlsx(archive(xml));
    }).toThrow();
  });
  it.each([
    '<dimension ref="&#65;&#49;:&#65;&#49;"/><sheetData><row r="&#49;"><c r="&#65;&#49;"/></row></sheetData>',
    '<dimension x:ref="A1"/><sheetData><row x:r="1"><c x:r="A1"/></row></sheetData>',
    '<dimension x:ref="&#65;&#49;"/><sheetData><row x:r="&#49;"><c x:r="&#65;&#49;"/></row></sheetData>',
  ])('accepts valid normalized and decoded references with ordinary namespace metadata', (content) => {
    const xml = '<worksheet xmlns:x="urn:test" xmlns:r="urn:relationships" xmlns:mc="urn:compatibility" mc:Ignorable="x">'
      + content + '</worksheet>';
    expect(() => {
      preflightXlsx(archive(xml));
    }).not.toThrow();
  });
  it('reads normalized and decoded cell references while keeping namespace declarations separate', async () => {
    const parts = unzipSync(buildImportXlsx(['name'], [['Импорт']]));
    const sheetName = 'xl/worksheets/sheet1.xml';
    const sheet = parts[sheetName];
    if (sheet === undefined) {
      throw new Error('Expected a generated worksheet');
    }
    const xml = strFromU8(sheet)
      .replace('<worksheet ', '<worksheet xmlns:x="urn:test" xmlns:mc="urn:compatibility" mc:Ignorable="x" ')
      .replace('<row r="1"', '<row xmlns:r="urn:relationships" x:r="&#49;"')
      .replace('<c r="A1"', '<c x:r="&#65;&#49;"');
    parts[sheetName] = strToU8(xml);
    const bytes = zipSync(parts);
    expect(await readXlsx(bytes)).toEqual([['name'], ['Импорт']]);
  });
  it('rejects too many entries with small data', () => {
    const entries = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`e${String(index)}`, new Uint8Array()]));
    expect(() => {
      preflightXlsx(zipSync(entries));
    }).toThrow();
  });
  it('rejects forged output sizes before the public reader allocates', () => {
    const bytes = archive('<worksheet/>');
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < bytes.length - 24; index += 1) {
      if (view.getUint32(index, true) === 0x02014b50) {
        view.setUint32(index + 24, 0x7fffffff, true);
      }
    }
    expect(() => {
      preflightXlsx(bytes);
    }).toThrow();
  });
  it('counts actual deflate output when both local and central lengths are forged small', () => {
    const bytes = zipSync({ 'payload.bin': new Uint8Array(1024).fill(65) });
    const view = new DataView(bytes.buffer);
    view.setUint32(22, 1, true);
    for (let index = 0; index < bytes.length - 46; index += 1) {
      if (view.getUint32(index, true) === 0x02014b50) {
        view.setUint32(index + 24, 1, true);
      }
    }
    expect(() => {
      preflightXlsx(bytes);
    }).toThrow();
  });
  it('rejects a truncated archive', () => {
    const bytes = archive('<worksheet/>');
    expect(() => {
      preflightXlsx(bytes.subarray(0, bytes.length - 10));
    }).toThrow();
  });
  it('reads valid XLSX with raw numeric precision', async () => {
    const bytes = new Uint8Array(readFileSync(new URL('./testing/catalog.xlsx', import.meta.url)));
    const table = await readXlsx(bytes);
    expect(table).toHaveLength(1001);
    expect(table[1]?.includes('88259496234518.57')).toBe(true);
  });
});

describe('warehouse spreadsheets', () => {
  it.each([
    { filename: 'warehouse-cells-template.xlsx', template: CELLS_IMPORT_TEMPLATE },
    { filename: 'opening-stock-template.xlsx', template: STOCK_IMPORT_TEMPLATE },
  ])('reads the shipped template $filename without sample transactions', async ({ filename, template }) => {
    const url = new URL(`../../../../../../apps/web/public/templates/${filename}`, import.meta.url);
    const rows = await readWarehouseXlsx(new Uint8Array(readFileSync(url)));
    expect(rows[0]?.map(cell => cell.text)).toEqual(template.columns.map(column => column.key));
    expect(rows.slice(1).flat().every(cell => cell.text === '')).toBe(true);
  });

  it('keeps Excel cell types while normalizing calendar dates', async () => {
    const archive = unzipSync(buildImportXlsx(['sscc', 'quantity_base', 'expires_on', 'kind'], [
      ['000000000000000017', '1', '2028-02-29', 'false'],
    ]));
    const path = 'xl/worksheets/sheet1.xml';
    const source = archive[path];
    if (source === undefined) {
      throw new Error('Missing sheet fixture');
    }
    archive[path] = strToU8(strFromU8(source)
      .replace('<c r="B2" t="inlineStr"><is><t>1</t></is></c>', '<c r="B2" t="n"><v>9007199254740993</v></c>')
      .replace('<c r="C2" t="inlineStr"><is><t>2028-02-29</t></is></c>', '<c r="C2" t="d"><v>2028-02-29T00:00:00Z</v></c>')
      .replace('<c r="D2" t="inlineStr"><is><t>false</t></is></c>', '<c r="D2" t="b"><v>0</v></c>'));
    const rows = await readWarehouseXlsx(zipSync(archive));
    expect(rows[1]).toEqual([
      { kind: 'text', text: '000000000000000017' },
      { kind: 'number', text: '9007199254740993' },
      { kind: 'date', text: '2028-02-29' },
      { kind: 'boolean', text: 'false' },
    ]);
  });

  it('checks formula results on the first workbook sheet, even when its archive path is not sheet1', async () => {
    const archive = unzipSync(buildImportXlsx(['expires_on'], [['2028-02-29']]));
    const sheet = archive['xl/worksheets/sheet1.xml'];
    const relations = archive['xl/_rels/workbook.xml.rels'];
    const workbook = archive['xl/workbook.xml'];
    if (sheet === undefined || relations === undefined || workbook === undefined) {
      throw new Error('Missing workbook fixture');
    }
    archive['xl/workbook.xml'] = strToU8(strFromU8(workbook)
      .replace('</sheets>', '<sheet name="Второй" sheetId="2" r:id="rId2"/></sheets>'));
    archive['xl/_rels/workbook.xml.rels'] = strToU8(strFromU8(relations)
      .replace('Target="worksheets/sheet1.xml"', 'Target="/xl/worksheets/first.xml"')
      .replace('</Relationships>', '<Relationship Id="rId2" Target="worksheets/sheet1.xml" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>'));
    const brokenSheet = strToU8(strFromU8(sheet)
      .replace('<c r="A2" t="inlineStr"><is><t>2028-02-29</t></is></c>', '<c r="A2" t="e"><f>1/0</f><v>#DIV/0!</v></c>'));
    archive['xl/worksheets/first.xml'] = sheet;
    archive['xl/worksheets/sheet1.xml'] = brokenSheet;
    expect((await readWarehouseXlsx(zipSync(archive)))[1]).toEqual([{ kind: 'text', text: '2028-02-29' }]);
    archive['xl/worksheets/first.xml'] = brokenSheet;
    expect((await readWarehouseXlsx(zipSync(archive)))[1]).toEqual([{ kind: 'error', text: '' }]);
    expect(await readXlsx(zipSync(archive))).toEqual([['expires_on']]);
  });
});
