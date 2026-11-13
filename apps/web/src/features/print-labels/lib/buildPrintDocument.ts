import { toAppUrl } from '@/shared/routing';

import type {
  EncodedPrintCodeValue,
  PrintCodeValue,
} from './printCodeTypes';
import type { PrintPageValue } from './printPageTypes';

import { generatePrintCodes } from './generatePrintCodes';

interface PrintSheetValue {
  height: number;
  width: number;
}

const CELL_SHEET = { height: 40, width: 58 };
const UNIT_SHEET = { height: 150, width: 100 };
const DOCUMENT_SHEET = { height: 297, width: 210 };
const LONG_CELL_SHEET = { height: 70, width: 210 };
const LABEL_HORIZONTAL_PADDING = 8;
const CELL_CODE_SCALE = 0.0945;
const ITEM_CODE_SCALE = 0.125;
const UNIT_CODE_SCALE = 0.25;

const toPrintCodes = (page: PrintPageValue, base: URL): PrintCodeValue[] => {
  const qr: PrintCodeValue[] = page.address === undefined ? [] : [{ kind: 'qr', text: toAppUrl(page.address, base) }];
  return page.kind === 'document' ? qr : [...qr, { kind: page.kind === 'unit' ? 'sscc' : 'address', text: page.code }];
};

const chooseSheet = (kind: PrintPageValue['kind'], width: number): PrintSheetValue => {
  if (kind === 'document') {
    return DOCUMENT_SHEET;
  }
  if (kind === 'unit') {
    return UNIT_SHEET;
  }
  if (kind === 'item') {
    return width * ITEM_CODE_SCALE > CELL_SHEET.width - LABEL_HORIZONTAL_PADDING ? LONG_CELL_SHEET : { height: 60, width: 58 };
  }
  return width * CELL_CODE_SCALE > CELL_SHEET.width - LABEL_HORIZONTAL_PADDING ? LONG_CELL_SHEET : CELL_SHEET;
};

const createStyles = ({ height, width }: PrintSheetValue): string => `
  @page { size: ${String(width)}mm ${String(height)}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font: 11pt system-ui, sans-serif; color: black; background: #e5e7eb; }
  article {
    background: white; width: ${String(width)}mm; min-height: ${String(height)}mm; margin: 3mm auto;
    padding: 4mm; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 2mm; overflow-wrap: anywhere;
  }
  .top { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2mm; align-items: start; }
  .top:has(h1:only-child) { grid-template-columns: minmax(0, 1fr); }
  h1, p { margin: 0; }
  h1 { font-size: 15pt; line-height: 1.05; }
  .cell h1, .item h1 { font-size: 12pt; }
  .cell .top { align-items: center; }
  figure { break-inside: avoid; }
  .document { padding: 15mm; }
  .document .top { margin-bottom: 4mm; }
  .details { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1mm; line-height: 1.2; }
  .details p { white-space: pre-wrap; }
  .unit .details { font-size: 10pt; line-height: 1.15; }
  .unit .details .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  figure { margin: 0; text-align: center; }
  figcaption { font: 12pt ui-monospace, monospace; }
  .cell figcaption { display: none; }
  img { display: block; margin-inline: auto; }
  @media print {
    body { background: white; }
    article { margin: 0; break-after: page; }
    article:last-child { break-after: auto; }
    .cell, .unit, .item { break-inside: avoid; }
    .document .details { display: block; }
    .document .details p + p { margin-top: 1mm; }
  }
`;

const appendText = (parent: HTMLElement, tag: 'figcaption' | 'h1' | 'p', text: string): void => {
  const element = parent.ownerDocument.createElement(tag);
  element.textContent = text;
  parent.append(element);
};

const appendCode = (parent: HTMLElement, code: EncodedPrintCodeValue, width: number): void => {
  const image = parent.ownerDocument.createElement('img');
  image.alt = '';
  image.src = `data:image/svg+xml,${encodeURIComponent(code.svg)}`;
  image.style.width = `${String(width)}mm`;
  image.style.aspectRatio = `${String(code.width)} / ${String(code.height)}`;
  parent.append(image);
};

const appendPage = (
  printDocument: Document,
  page: PrintPageValue,
  qr: EncodedPrintCodeValue | undefined,
  linear: EncodedPrintCodeValue | undefined,
  sheet: PrintSheetValue,
): void => {
  const article = printDocument.createElement('article');
  article.className = page.kind;
  const top = printDocument.createElement('header');
  top.className = 'top';
  appendText(top, 'h1', page.heading);
  if (qr !== undefined) {
    appendCode(top, qr, page.kind === 'cell' ? 16 : 24);
  }
  article.append(top);

  if (page.details.length > 0) {
    const details = printDocument.createElement('div');
    details.className = 'details';
    for (const line of page.details) {
      if (typeof line === 'string') {
        appendText(details, 'p', line);
      }
      else {
        const entry = printDocument.createElement('div');
        const label = printDocument.createElement('p');
        label.className = 'label';
        label.textContent = line.label;
        entry.append(label);
        appendText(entry, 'p', line.value);
        details.append(entry);
      }
    }
    article.append(details);
  }

  if (page.kind !== 'document' && linear !== undefined) {
    const figure = printDocument.createElement('figure');
    const scale = page.kind === 'cell' && sheet === CELL_SHEET ? CELL_CODE_SCALE : ITEM_CODE_SCALE;
    appendCode(figure, linear, linear.width * (page.kind === 'unit' ? UNIT_CODE_SCALE : scale));
    appendText(figure, 'figcaption', page.kind === 'unit' ? `(00) ${page.code}` : page.code);
    article.append(figure);
  }
  printDocument.body.append(article);
};

export const buildPrintDocument = async (
  pages: readonly PrintPageValue[],
  base: URL,
  locale: string,
  title: string,
  signal: AbortSignal,
): Promise<string> => {
  const kind = pages[0]?.kind;
  if (kind === undefined || pages.some(page => page.kind !== kind)) {
    throw new Error('Expected a nonempty print job with one page format');
  }

  const requests = pages.flatMap(page => toPrintCodes(page, base));
  const codes = requests.length === 0 ? [] : await generatePrintCodes(requests, signal);
  const printDocument = document.implementation.createHTMLDocument(title);
  printDocument.documentElement.lang = locale;
  const style = printDocument.createElement('style');
  let offset = 0;
  const encodedPages = pages.map((page) => {
    const qr = page.address === undefined ? undefined : codes[offset++];
    const linear = page.kind === 'document' ? undefined : codes[offset++];
    return { linear, page, qr };
  });
  const width = encodedPages.reduce((widest, { linear }) => Math.max(widest, linear?.width ?? 0), 0);
  const sheet = chooseSheet(kind, width);
  for (const { linear, page, qr } of encodedPages) {
    appendPage(printDocument, page, qr, linear, sheet);
  }
  style.textContent = createStyles(sheet);
  printDocument.head.append(style);

  return `<!doctype html>${printDocument.documentElement.outerHTML}`;
};
