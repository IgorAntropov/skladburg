import {
  expect,
  it,
  vi,
} from 'vitest';

import type { PrintPageValue } from './printPageTypes';

import { buildPrintDocument } from './buildPrintDocument';

vi.mock(import('./generatePrintCodes'), async () => {
  const { encodePrintCodes } = await import('./encodePrintCodes');
  return { generatePrintCodes: codes => Promise.resolve(encodePrintCodes(codes)) };
});

const BASE = new URL('https://example.test/skladburg/');

const renderPages = async (pages: PrintPageValue[]): Promise<Document> => {
  const html = await buildPrintDocument(pages, BASE, 'ru', 'Печать', new AbortController().signal);
  return new DOMParser().parseFromString(html, 'text/html');
};

it('fits seeded cells on thermal labels and keeps one page per cell', async () => {
  const printed = await renderPages(['Z01-R01-S01-Y01-C01', 'Z01-R01-S01-Y01-C02'].map(code => ({
    code, details: [], heading: code, kind: 'cell',
  })));
  expect(printed.querySelector('style')?.textContent).toContain('size: 58mm 40mm');
  expect(printed.querySelectorAll('article')).toHaveLength(2);
  expect(Number.parseFloat(printed.querySelector('figure img')?.getAttribute('style')?.slice('width: '.length) ?? '')).toBeLessThan(50);
});

it('preserves readable symbol dimensions on a wider sheet for long cells', async () => {
  const code = 'A'.repeat(64);
  const printed = await renderPages([{ code, details: [], heading: code, kind: 'cell' }]);
  expect(printed.querySelector('style')?.textContent).toContain('size: 210mm 70mm');
  expect(printed.querySelector('h1')?.textContent).toBe(code);
});

it('renders label details as literal text with the SSCC under its code', async () => {
  const code = '000000000000000017';
  const printed = await renderPages([{
    code,
    details: [{ label: '<img src="https://example.test">', value: 'Партия 6 · 8 шт.' }],
    heading: 'Паллета',
    kind: 'unit',
  }]);
  expect(printed.querySelector('style')?.textContent).toContain('size: 100mm 150mm');
  expect(printed.querySelector('.details')?.textContent).toContain('<img src="https://example.test">Партия 6 · 8 шт.');
  expect(printed.querySelectorAll('img')).toHaveLength(1);
  expect(printed.querySelector('figcaption')?.textContent).toBe(`(00) ${code}`);
});
