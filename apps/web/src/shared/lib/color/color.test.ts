import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RgbaColorValue } from './index';

import {
  compositeOver,
  contrastRatio,
  parseCssColor,
  relativeLuminance,
} from './index';

const parseOrFail = (value: string): RgbaColorValue => {
  const color = parseCssColor(value);

  if (color === undefined) {
    throw new Error(`Cannot parse ${value}`);
  }

  return color;
};

describe('parseCssColor', () => {
  it('parses six-digit hex', () => {
    expect(parseCssColor('#3B5BDB')).toEqual({
      alpha: 1,
      blue: 0xdb,
      green: 0x5b,
      red: 0x3b,
    });
  });

  it('parses hex in any letter case', () => {
    expect(parseCssColor('#3b5bdb')).toEqual(parseCssColor('#3B5BDB'));
  });

  it('parses three-digit hex by doubling digits', () => {
    expect(parseCssColor('#f80')).toEqual({
      alpha: 1,
      blue: 0,
      green: 0x88,
      red: 0xff,
    });
  });

  it('parses eight-digit hex with alpha', () => {
    const color = parseOrFail('#FFFFFF80');

    expect(color.red).toBe(255);
    expect(color.alpha).toBeCloseTo(128 / 255, 6);
  });

  it('parses rgb with spaces', () => {
    expect(parseCssColor('rgb(59 91 219)')).toEqual({
      alpha: 1,
      blue: 219,
      green: 91,
      red: 59,
    });
  });

  it('parses rgb with numeric alpha', () => {
    expect(parseCssColor('rgb(255 255 255 / 0.5)')).toEqual({
      alpha: 0.5,
      blue: 255,
      green: 255,
      red: 255,
    });
  });

  it('parses rgb with percent alpha', () => {
    expect(parseCssColor('rgb(0 0 0 / 25%)')?.alpha).toBe(0.25);
  });

  it('allows spaces around the value and inside the function', () => {
    expect(parseCssColor('  rgb( 1 2 3 / 50% )  ')).toEqual({
      alpha: 0.5,
      blue: 3,
      green: 2,
      red: 1,
    });
    expect(parseCssColor('  #fff  ')?.red).toBe(255);
  });

  it.each([
    '',
    'var(--color-primary)',
    'red',
    'transparent',
    'garbage',
    '#',
    '#ff',
    '#fffff',
    '#fffffff',
    '#ggg',
    'fff',
    'rgb(256 0 0)',
    'rgb(0 0 0 / 1.5)',
    'rgb(0 0 0 / 150%)',
    'rgb(-1 0 0)',
    'rgb(0, 0, 0)',
    'rgb(0 0)',
    'rgb(0 0 0 / )',
    'rgba(0 0 0 / 0.5)',
  ])('returns undefined for %s', (value) => {
    expect(parseCssColor(value)).toBeUndefined();
  });
});

describe('compositeOver', () => {
  it('returns top unchanged when it is opaque', () => {
    const top = parseOrFail('#3B5BDB');

    expect(compositeOver(top, parseOrFail('#000000'))).toEqual(top);
  });

  it('returns bottom when top is fully transparent', () => {
    const bottom = parseOrFail('#336699');
    const result = compositeOver(parseOrFail('rgb(255 0 0 / 0)'), bottom);

    expect(result.red).toBeCloseTo(bottom.red, 6);
    expect(result.green).toBeCloseTo(bottom.green, 6);
    expect(result.blue).toBeCloseTo(bottom.blue, 6);
    expect(result.alpha).toBe(1);
  });

  it('mixes half-transparent white over black into mid gray', () => {
    const result = compositeOver(
      parseOrFail('rgb(255 255 255 / 0.5)'),
      parseOrFail('#000000'),
    );

    expect(result.red).toBeCloseTo(127.5, 6);
    expect(result.green).toBeCloseTo(127.5, 6);
    expect(result.blue).toBeCloseTo(127.5, 6);
    expect(result.alpha).toBe(1);
  });

  it('mixes #FFFFFF80 over black into about #808080', () => {
    const result = compositeOver(parseOrFail('#FFFFFF80'), parseOrFail('#000'));

    expect(Math.round(result.red)).toBe(128);
    expect(Math.round(result.green)).toBe(128);
    expect(Math.round(result.blue)).toBe(128);
  });

  it('stays opaque when bottom is opaque', () => {
    expect(
      compositeOver(parseOrFail('rgb(10 20 30 / 0.3)'), parseOrFail('#abcdef')).alpha,
    ).toBe(1);
  });

  it('applies source-over for translucent bottom', () => {
    const result = compositeOver(
      { alpha: 0.5, blue: 0, green: 0, red: 255 },
      { alpha: 0.5, blue: 255, green: 0, red: 0 },
    );

    expect(result.alpha).toBeCloseTo(0.75, 6);
    expect(result.red).toBeCloseTo(170, 6);
    expect(result.blue).toBeCloseTo(85, 6);
  });

  it('returns transparent black when both layers are transparent', () => {
    expect(
      compositeOver(
        { alpha: 0, blue: 1, green: 2, red: 3 },
        { alpha: 0, blue: 4, green: 5, red: 6 },
      ),
    ).toEqual({ alpha: 0, blue: 0, green: 0, red: 0 });
  });
});

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance(parseOrFail('#FFFFFF'))).toBeCloseTo(1, 6);
    expect(relativeLuminance(parseOrFail('#000000'))).toBe(0);
  });

  it('uses the linear segment below the threshold', () => {
    expect(relativeLuminance(parseOrFail('#0A0A0A'))).toBeCloseTo(10 / 255 / 12.92, 6);
  });

  it('ignores alpha', () => {
    expect(relativeLuminance(parseOrFail('#FFFFFF80'))).toBeCloseTo(1, 6);
  });
});

describe('contrastRatio', () => {
  const white = parseOrFail('#FFFFFF');
  const black = parseOrFail('#000000');

  it('gives 21 for black on white', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 2);
  });

  it('gives 5.67 for #3B5BDB on white', () => {
    expect(contrastRatio(parseOrFail('#3B5BDB'), white)).toBeCloseTo(5.67, 2);
  });

  it('gives 1 for identical colors', () => {
    const color = parseOrFail('#3B5BDB');

    expect(contrastRatio(color, color)).toBeCloseTo(1, 6);
  });

  it('is symmetric for opaque colors', () => {
    const blue = parseOrFail('#3B5BDB');

    expect(contrastRatio(blue, white)).toBeCloseTo(contrastRatio(white, blue), 10);
  });

  it('composites a translucent foreground over the background first', () => {
    const translucentWhite = parseOrFail('rgb(255 255 255 / 0.5)');
    const grayEquivalent = parseOrFail('#808080');

    expect(contrastRatio(translucentWhite, black)).toBeCloseTo(
      contrastRatio(grayEquivalent, black),
      1,
    );
    expect(contrastRatio(translucentWhite, black)).toBeLessThan(
      contrastRatio(white, black),
    );
  });

  it('gives 1 for a fully transparent foreground', () => {
    expect(contrastRatio(parseOrFail('rgb(255 0 0 / 0)'), white)).toBeCloseTo(1, 6);
  });

  it('throws for a translucent background', () => {
    expect(() => contrastRatio(black, parseOrFail('#FFFFFF80'))).toThrow(
      'contrastRatio requires an opaque background',
    );
  });
});
