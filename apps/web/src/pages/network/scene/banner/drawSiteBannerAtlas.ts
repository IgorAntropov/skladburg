import type { MapSideValue } from '@/entities/network';

import { SIDE_SHAPES } from '@/entities/organization';

import type {
  SiteBannerAtlasLayoutValue,
  SiteBannerCellPixelsValue,
} from './siteBannerAtlasLayout';
import type { SiteBannerColorsValue } from './siteBannerColors';
import type { SiteBannerEntryValue } from './siteBannerEntry';

import { NETWORK_SIDES } from '../geometry/networkSides';
import {
  readFarCellPixels,
  readNearCellPixels,
  readSharedNearCellPixels,
} from './siteBannerAtlasLayout';
import {
  readBannerTextBlock,
  SITE_BANNER_FALLBACK_CIRCLE_RADIUS_PX,
  SITE_BANNER_FAR_GLYPH,
  SITE_BANNER_FONT_FAMILY,
  SITE_BANNER_FRAME_WIDTH_PX,
  SITE_BANNER_NEAR_GLYPH,
  SITE_BANNER_PLATE_INSET_PX,
  SITE_BANNER_PLATE_RADIUS_PX,
} from './siteBannerTemplate';

export interface SiteBannerDrawContextValue {
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void;
  beginPath: () => void;
  clearRect: (x: number, y: number, width: number, height: number) => void;
  closePath: () => void;
  fill: () => void;
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  fillText: (text: string, x: number, y: number) => void;
  font: string;
  lineJoin: CanvasLineJoin;
  lineTo: (x: number, y: number) => void;
  lineWidth: number;
  measureText: (text: string) => { width: number };
  moveTo: (x: number, y: number) => void;
  roundRect: (x: number, y: number, width: number, height: number, radius: number) => void;
  stroke: () => void;
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

interface GlyphPlacementValue {
  rimPx: number;
  sizePx: number;
  xPx: number;
  yPx: number;
}

const FULL_TURN_RADIANS = Math.PI * 2;

const drawSideGlyph = (
  context: SiteBannerDrawContextValue,
  side: MapSideValue,
  cell: SiteBannerCellPixelsValue,
  placement: GlyphPlacementValue,
  colors: SiteBannerColorsValue,
): void => {
  const originX = cell.x + placement.xPx;
  const originY = cell.y + placement.yPx;

  context.beginPath();

  for (const [index, [pointX, pointY]] of SIDE_SHAPES[side].outline.entries()) {
    const x = originX + pointX * placement.sizePx;
    const y = originY + pointY * placement.sizePx;

    if (index === 0) {
      context.moveTo(x, y);
    }
    else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.lineJoin = 'round';
  context.lineWidth = placement.rimPx * 2;
  context.strokeStyle = colors.rim;
  context.stroke();
  context.fillStyle = colors[side];
  context.fill();
};

const drawNearFrame = (
  context: SiteBannerDrawContextValue,
  side: MapSideValue,
  cell: SiteBannerCellPixelsValue,
  colors: SiteBannerColorsValue,
): void => {
  context.beginPath();
  context.roundRect(
    cell.x + SITE_BANNER_PLATE_INSET_PX,
    cell.y + SITE_BANNER_PLATE_INSET_PX,
    cell.width - SITE_BANNER_PLATE_INSET_PX * 2,
    cell.height - SITE_BANNER_PLATE_INSET_PX * 2,
    SITE_BANNER_PLATE_RADIUS_PX,
  );
  context.fillStyle = colors.plate;
  context.fill();
  context.lineJoin = 'round';
  context.lineWidth = SITE_BANNER_FRAME_WIDTH_PX;
  context.strokeStyle = colors[side];
  context.stroke();
};

const drawMonogram = (
  context: SiteBannerDrawContextValue,
  entry: SiteBannerEntryValue,
  cell: SiteBannerCellPixelsValue,
  colors: SiteBannerColorsValue,
): void => {
  const block = readBannerTextBlock(entry.monogram);

  if (block.runs.length === 0) {
    context.beginPath();
    context.arc(
      cell.x + block.centerX,
      cell.y + block.baseline - block.capHeightPx / 2,
      SITE_BANNER_FALLBACK_CIRCLE_RADIUS_PX,
      0,
      FULL_TURN_RADIANS,
    );
    context.fillStyle = colors[entry.side];
    context.fill();

    return;
  }

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = colors.text;

  const fonts = block.runs.map(run => `${String(run.fontWeight)} ${String(run.fontSize)}px ${SITE_BANNER_FONT_FAMILY}`);
  const widths = block.runs.map((run, index) => {
    context.font = fonts[index] ?? '';

    return context.measureText(run.text).width;
  });
  const totalWidth = block.runs.reduce((sum, run, index) => sum + run.gapBeforePx + (widths[index] ?? 0), 0);
  let cursorX = cell.x + block.centerX - totalWidth / 2;

  for (const [index, run] of block.runs.entries()) {
    cursorX += run.gapBeforePx;
    context.font = fonts[index] ?? '';
    context.fillText(run.text, cursorX, cell.y + block.baseline);
    cursorX += widths[index] ?? 0;
  }
};

export const drawSiteBannerAtlas = (
  context: SiteBannerDrawContextValue,
  layout: SiteBannerAtlasLayoutValue,
  entries: readonly SiteBannerEntryValue[],
  colors: SiteBannerColorsValue,
): void => {
  context.clearRect(0, 0, layout.width, layout.height);

  for (const side of NETWORK_SIDES) {
    drawSideGlyph(context, side, readFarCellPixels(side), SITE_BANNER_FAR_GLYPH, colors);

    const sharedCell = readSharedNearCellPixels(layout, side);

    drawNearFrame(context, side, sharedCell, colors);
    drawSideGlyph(context, side, sharedCell, SITE_BANNER_NEAR_GLYPH, colors);
  }

  for (const [index, entry] of entries.slice(0, layout.capacity).entries()) {
    const cell = readNearCellPixels(layout, index);

    drawNearFrame(context, entry.side, cell, colors);
    drawSideGlyph(context, entry.side, cell, SITE_BANNER_NEAR_GLYPH, colors);
    drawMonogram(context, entry, cell, colors);
  }
};
