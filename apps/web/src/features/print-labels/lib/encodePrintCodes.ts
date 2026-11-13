import {
  code128,
  drawingSVG,
  gs1_128,
  qrcode,
} from '@bwip-js/generic';

import type {
  EncodedPrintCodeValue,
  PrintCodeValue,
} from './printCodeTypes';

const encodePrintCode = ({ kind, text }: PrintCodeValue): EncodedPrintCodeValue => {
  const drawing = drawingSVG();
  const scale = 2;
  let svg: string;
  switch (kind) {
    case 'address':
      svg = code128({ bcid: 'code128', height: 14, paddingwidth: 10, scale, text }, drawing);
      break;
    case 'qr':
      svg = qrcode({ bcid: 'qrcode', padding: 4, scale, text }, drawing);
      break;
    case 'sscc':
      if (!/^\d{18}$/u.test(text)) {
        throw new Error('Expected an 18-digit SSCC');
      }
      svg = gs1_128({ bcid: 'gs1-128', height: 33, paddingwidth: 10, scale, text: `(00)${text}` }, drawing);
      break;
  }

  const dimensions = /^<svg viewBox="0 0 (\d+) (\d+)"/u.exec(svg);
  if (dimensions === null) {
    throw new Error('Missing print code dimensions');
  }
  return { height: Number(dimensions[2]), svg, width: Number(dimensions[1]) };
};

export const encodePrintCodes = (codes: readonly PrintCodeValue[]): EncodedPrintCodeValue[] => codes.map(encodePrintCode);
