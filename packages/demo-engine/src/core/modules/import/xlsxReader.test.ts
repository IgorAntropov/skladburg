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
import { preflightXlsx } from './xlsxPreflight';
import { readXlsx } from './xlsxReader';

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
