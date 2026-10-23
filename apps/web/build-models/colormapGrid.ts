import type { PngImageValue } from './decodePng.ts';

export interface RgbValue {
  blue: number;
  green: number;
  red: number;
}

export const COLORMAP_COLUMNS = 16;

export const COLORMAP_ROWS = 4;

export const CELL_SAMPLE_ROWS = 8;

const CHANNEL_COUNT = 4;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const toCellId = (u: number, v: number): number => {
  const column = clamp(Math.floor(u * COLORMAP_COLUMNS), 0, COLORMAP_COLUMNS - 1);
  const row = clamp(Math.floor(v * COLORMAP_ROWS), 0, COLORMAP_ROWS - 1);

  return row * COLORMAP_COLUMNS + column;
};

export const toCellFraction = (v: number): number => {
  const scaled = v * COLORMAP_ROWS;

  return clamp(scaled - Math.floor(scaled), 0, 1);
};

export const sampleCell = (colormap: PngImageValue, cellId: number, fraction: number): RgbValue => {
  const column = cellId % COLORMAP_COLUMNS;
  const row = Math.floor(cellId / COLORMAP_COLUMNS);
  const x = clamp(Math.floor(((column + 0.5) / COLORMAP_COLUMNS) * colormap.width), 0, colormap.width - 1);
  const y = clamp(Math.floor(((row + fraction) / COLORMAP_ROWS) * colormap.height), 0, colormap.height - 1);
  const offset = (y * colormap.width + x) * CHANNEL_COUNT;

  return {
    blue: colormap.data[offset + 2] ?? 0,
    green: colormap.data[offset + 1] ?? 0,
    red: colormap.data[offset] ?? 0,
  };
};

export const sampleCellRows = (colormap: PngImageValue, cellId: number): RgbValue[] => (
  Array.from({ length: CELL_SAMPLE_ROWS }, (_, row) => sampleCell(colormap, cellId, (row + 0.5) / CELL_SAMPLE_ROWS))
);

export const getMeanColor = (colors: readonly RgbValue[]): RgbValue => {
  const total = colors.reduce(
    (sum, color) => ({ blue: sum.blue + color.blue, green: sum.green + color.green, red: sum.red + color.red }),
    { blue: 0, green: 0, red: 0 },
  );
  const count = Math.max(1, colors.length);

  return { blue: total.blue / count, green: total.green / count, red: total.red / count };
};

export const getLuminance = (color: RgbValue): number => 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue;
