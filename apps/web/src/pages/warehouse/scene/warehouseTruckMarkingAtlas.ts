import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
} from 'three';

import type {
  WorldPaletteKeyValue,
  WorldPaletteValue,
} from '@/shared/3d';
import type { RgbaColorValue } from '@/shared/lib/color';

import {
  buildMonogramParts,
  resolveOrganizationLogoUrl,
} from '@/entities/organization';
import { getAppBaseUrl } from '@/shared/routing';

import type {
  WarehouseYardVehicleAccentValue,
  WarehouseYardVehicleMarkingVisualValue,
} from '../model/warehouseYardVehicleMarkingVisual';

export interface WarehouseTruckMarkingAtlasValue extends WarehouseTruckMarkingLayoutValue {
  context: CanvasRenderingContext2D;
  texture: CanvasTexture;
}

interface WarehouseTruckMarkingLayoutValue {
  cells: ReadonlyMap<string, number>;
  columns: number;
  rows: number;
}

const CELL_WIDTH = 256;
const STRIP_HEIGHT = 64;
const CELL_HEIGHT = STRIP_HEIGHT * 2;
const MAX_COLUMNS = 8;
const MAX_CELLS = 128;
const NUMBER_FONT = '800 74px monospace';
const BRAND_FONT = '800 42px Manrope, Arial, sans-serif';

const ACCENT_COLORS = {
  blue: 'water',
  green: 'treeCrownDark',
  ochre: 'buildingRoofAlt',
  slate: 'warehouseRoof',
  terracotta: 'buildingBrick',
} as const satisfies Readonly<Record<WarehouseYardVehicleAccentValue, WorldPaletteKeyValue>>;

const isBranded = ({ accent, brandName, logoPath }: WarehouseYardVehicleMarkingVisualValue): boolean =>
  brandName !== undefined || logoPath !== undefined || accent !== undefined;

export const createWarehouseTruckMarkingLayout = (
  markings: ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined,
  priority: readonly string[] = [],
): WarehouseTruckMarkingLayoutValue => {
  const cells = new Map<string, number>();
  const include = (taskId: string, marking: undefined | WarehouseYardVehicleMarkingVisualValue): void => {
    if (marking !== undefined && !cells.has(taskId) && (isBranded(marking) || marking.registrationNumber !== undefined)) {
      cells.set(taskId, cells.size + 1);
    }
  };
  for (const taskId of priority) {
    include(taskId, markings?.get(taskId));
    if (cells.size + 1 === MAX_CELLS) {
      break;
    }
  }
  for (const [taskId, marking] of markings ?? []) {
    if (cells.size + 1 === MAX_CELLS) {
      break;
    }
    include(taskId, marking);
  }
  const count = cells.size + 1;
  const columns = Math.min(MAX_COLUMNS, Math.ceil(Math.sqrt(count / 2)));
  return { cells, columns, rows: Math.ceil(count / columns) };
};

export const createWarehouseTruckMarkingAtlas = (
  markings: ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined,
  priority: readonly string[],
): undefined | WarehouseTruckMarkingAtlasValue => {
  const layout = createWarehouseTruckMarkingLayout(markings, priority);
  const canvas = document.createElement('canvas');
  canvas.width = layout.columns * CELL_WIDTH;
  canvas.height = layout.rows * CELL_HEIGHT;
  const context = canvas.getContext('2d');
  if (context === null) {
    return undefined;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  return { ...layout, context, texture };
};

const readCssColor = ({ blue, green, red }: RgbaColorValue): string => `rgb(${String(red)}, ${String(green)}, ${String(blue)})`;

const paintNumberPlate = (context: CanvasRenderingContext2D, number: string | undefined, plate: string, text: string): void => {
  context.fillStyle = plate;
  context.fillRect(0, STRIP_HEIGHT, CELL_WIDTH, STRIP_HEIGHT);
  context.strokeStyle = text;
  context.lineWidth = 3;
  context.strokeRect(4, STRIP_HEIGHT + 3, CELL_WIDTH - 8, STRIP_HEIGHT - 6);
  if (number !== undefined) {
    context.fillStyle = text;
    context.font = NUMBER_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    const { actualBoundingBoxAscent, actualBoundingBoxDescent } = context.measureText(number);
    const centerY = STRIP_HEIGHT + STRIP_HEIGHT / 2;
    context.fillText(number, CELL_WIDTH / 2, centerY + (actualBoundingBoxAscent - actualBoundingBoxDescent) / 2, CELL_WIDTH - 20);
  }
};

const paintBrandPlate = (
  context: CanvasRenderingContext2D,
  { accent, brandName }: WarehouseYardVehicleMarkingVisualValue,
  palette: WorldPaletteValue,
  image: HTMLImageElement | undefined,
): void => {
  const accentColor = readCssColor(palette[accent === undefined ? 'warehouseRoof' : ACCENT_COLORS[accent]]);
  context.fillStyle = readCssColor(palette.bannerPlate);
  context.fillRect(0, 0, CELL_WIDTH, STRIP_HEIGHT);
  context.fillStyle = accentColor;
  context.fillRect(0, 0, 15, STRIP_HEIGHT);
  context.fillRect(CELL_WIDTH - 15, 0, 15, STRIP_HEIGHT);
  if (image !== undefined) {
    const scale = Math.min((CELL_WIDTH - 52) / image.naturalWidth, (STRIP_HEIGHT - 12) / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (CELL_WIDTH - width) / 2, (STRIP_HEIGHT - height) / 2, width, height);
  }
  else {
    const { index, letters } = buildMonogramParts(brandName ?? '');
    context.fillStyle = readCssColor(palette.bannerText);
    context.font = BRAND_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letters + index, CELL_WIDTH / 2, STRIP_HEIGHT / 2, CELL_WIDTH - 54);
  }
};

export const drawWarehouseTruckMarkingAtlas = (
  { cells, columns, context, texture }: WarehouseTruckMarkingAtlasValue,
  markings: ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined,
  palette: WorldPaletteValue,
  images: ReadonlyMap<string, HTMLImageElement>,
): void => {
  const plate = readCssColor(palette.bannerPlate);
  const text = readCssColor(palette.bannerText);
  context.resetTransform();
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  paintNumberPlate(context, undefined, plate, text);

  for (const [taskId, cell] of cells) {
    const marking = markings?.get(taskId);
    if (marking === undefined) {
      continue;
    }
    const { logoPath, registrationNumber } = marking;
    context.setTransform(1, 0, 0, 1, (cell % columns) * CELL_WIDTH, Math.floor(cell / columns) * CELL_HEIGHT);
    if (isBranded(marking)) {
      paintBrandPlate(context, marking, palette, logoPath === undefined ? undefined : images.get(logoPath));
    }
    paintNumberPlate(context, registrationNumber, plate, text);
  }
  texture.needsUpdate = true;
};

export const loadWarehouseTruckMarkingLogo = async (path: string): Promise<HTMLImageElement | undefined> => {
  const url = resolveOrganizationLogoUrl(path, getAppBaseUrl());
  if (url === undefined) {
    return undefined;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = url;
  await image.decode().catch(() => undefined);
  return image.naturalWidth > 0 && image.naturalHeight > 0 ? image : undefined;
};
