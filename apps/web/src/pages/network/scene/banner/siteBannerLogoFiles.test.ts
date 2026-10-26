import {
  describe,
  expect,
  it,
} from 'vitest';

import { fitSiteBannerLogo } from './fitSiteBannerLogo';
import { SITE_BANNER_LOGO_FIELD } from './siteBannerTemplate';

const LOGO_SOURCES = import.meta.glob<string>('/public/logos/*', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const LOGO_TEXTS: ReadonlyMap<string, string> = new Map(
  Object.entries(LOGO_SOURCES).map(([path, text]): [string, string] => [path.slice(path.lastIndexOf('/') + 1), text]),
);

const LOGO_KEYS = [
  'carrier-1',
  'carrier-2',
  'customer-1',
  'customer-2',
  'supplier-1',
  'supplier-2',
  'supplier-3',
  'supplier-4',
  'supplier-5',
] as const;

const VARIANTS = ['dark', 'light'] as const;

const EXPECTED_FILES = LOGO_KEYS.flatMap(key => VARIANTS.map(variant => `${key}-${variant}.svg`)).toSorted();

const MAX_FILE_BYTES = 3072;

const MAX_TOTAL_BYTES = 40 * 1024;

const PROPORTION_TOLERANCE = 0.01;

const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'circle',
  'clipPath',
  'defs',
  'ellipse',
  'g',
  'line',
  'linearGradient',
  'path',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'stop',
  'svg',
]);

const PLAIN_NUMBER_PATTERN = /^\d+(?:\.\d+)?$/u;

const TAG_PATTERN = /<\/?([A-Za-z][\w:.-]*)((?:\s[^<>]*)?)>/gu;

const ATTRIBUTE_PATTERN = /\s([A-Za-z_:][\w:.-]*)\s*=/gu;

const readSvg = (fileName: string): string => LOGO_TEXTS.get(fileName) ?? '';

const readByteLength = (text: string): number => new TextEncoder().encode(text).length;

const listFileNames = (): string[] => [...LOGO_TEXTS.keys()].toSorted();

const listElementNames = (svg: string): string[] => [...svg.matchAll(TAG_PATTERN)].map(match => match[1] ?? '');

const listAttributeNames = (svg: string): string[] => [...svg.matchAll(TAG_PATTERN)]
  .flatMap(match => [...(match[2] ?? '').matchAll(ATTRIBUTE_PATTERN)].map(attribute => attribute[1] ?? ''));

const readRootAttribute = (svg: string, name: string): string | undefined => {
  const root = /^<svg\s([^>]*)>/u.exec(svg)?.[1] ?? '';

  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'u').exec(root)?.[1];
};

const readViewBox = (svg: string): number[] => (readRootAttribute(svg, 'viewBox') ?? '')
  .trim()
  .split(/[\s,]+/u)
  .map(Number);

describe('files of the organization logos', () => {
  it('are exactly the eighteen files of the demo organizations and nothing else', () => {
    expect(listFileNames()).toEqual(EXPECTED_FILES);
  });

  it('have a dark variant for every light variant and a light one for every dark one', () => {
    const names = new Set(listFileNames());

    for (const name of names) {
      const counterpart = name.endsWith('-light.svg')
        ? name.replace('-light.svg', '-dark.svg')
        : name.replace('-dark.svg', '-light.svg');

      expect(names.has(counterpart), `${name} has no ${counterpart}`).toBe(true);
    }
  });

  it('weigh at most 3 KiB each and 40 KiB together', () => {
    const names = listFileNames();
    const sizes = names.map(name => readByteLength(readSvg(name)));

    for (const [index, size] of sizes.entries()) {
      expect(size, names[index]).toBeLessThanOrEqual(MAX_FILE_BYTES);
    }

    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  describe.each(EXPECTED_FILES)('%s', (fileName) => {
    const svg = readSvg(fileName);

    it('opens with the svg root that has the namespace, the size and the view box and nothing before it', () => {
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(readRootAttribute(svg, 'xmlns')).toBe('http://www.w3.org/2000/svg');
      expect(readRootAttribute(svg, 'width')).toMatch(PLAIN_NUMBER_PATTERN);
      expect(readRootAttribute(svg, 'height')).toMatch(PLAIN_NUMBER_PATTERN);
      expect(readViewBox(svg)).toHaveLength(4);
      expect(readViewBox(svg).every(Number.isFinite)).toBe(true);
    });

    it('keeps the proportion of the view box in the width and the height', () => {
      const width = Number(readRootAttribute(svg, 'width'));
      const height = Number(readRootAttribute(svg, 'height'));
      const [, , boxWidth = 0, boxHeight = 0] = readViewBox(svg);

      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(boxWidth).toBeGreaterThan(0);
      expect(boxHeight).toBeGreaterThan(0);
      expect(Math.abs(width / height / (boxWidth / boxHeight) - 1)).toBeLessThanOrEqual(PROPORTION_TOLERANCE);
    });

    it('is not smaller than the logo field in both sides, so the fit never makes it bigger', () => {
      const width = Number(readRootAttribute(svg, 'width'));
      const height = Number(readRootAttribute(svg, 'height'));
      const placement = fitSiteBannerLogo(width, height);

      expect(width >= SITE_BANNER_LOGO_FIELD.widthPx || height >= SITE_BANNER_LOGO_FIELD.heightPx).toBe(true);
      expect(placement?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(width);
      expect(placement?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(height);
    });

    it('has only the allowed shapes', () => {
      const disallowed = listElementNames(svg).filter(name => !ALLOWED_ELEMENTS.has(name));

      expect(disallowed).toEqual([]);
    });

    it('has no scripts, handlers, links, styles, comments or colors taken from the page', () => {
      const attributes = listAttributeNames(svg);

      expect(attributes.filter(name => name.toLowerCase().startsWith('on'))).toEqual([]);
      expect(attributes.filter(name => name === 'href' || name.endsWith(':href'))).toEqual([]);
      expect(attributes).not.toContain('style');
      expect(svg).not.toContain('<!--');
      expect(svg).not.toContain('<?');
      expect(svg).not.toContain('<!');
      expect(svg).not.toContain('@import');
      expect(svg.toLowerCase()).not.toContain('currentcolor');
      expect(svg.toLowerCase()).not.toContain('javascript:');
    });

    it('refers to nothing but its own parts by url()', () => {
      const references = [...svg.matchAll(/url\(\s*([^)]*)\)/giu)].map(match => (match[1] ?? '').trim());

      expect(svg.match(/url\(/giu)?.length ?? 0).toBe(references.length);

      for (const reference of references) {
        expect(reference.replace(/^['"]/u, '')).toMatch(/^#/u);
      }
    });

    it('closes every element it opens', () => {
      const names = [...svg.matchAll(TAG_PATTERN)];
      const openings = names.filter(match => !match[0].startsWith('</') && !match[0].endsWith('/>'));
      const closings = names.filter(match => match[0].startsWith('</'));

      expect(openings.map(match => match[1]).toSorted()).toEqual(closings.map(match => match[1]).toSorted());
    });
  });
});
