import type {
  MapSideValue,
  NetworkMapSiteValue,
} from '@/entities/network';
import type { MonogramPartsValue } from '@/entities/organization';

import type { SiteBannerDrawContextValue } from './drawSiteBannerAtlas';
import type { SiteBannerColorsValue } from './siteBannerColors';
import type { SiteBannerEntryValue } from './siteBannerEntry';

export interface RecordedCallValue {
  args: readonly (number | string)[];
  fillStyle: string;
  font: string;
  lineWidth: number;
  op: string;
  strokeStyle: string;
}

export interface RecordingContextValue extends SiteBannerDrawContextValue {
  calls: RecordedCallValue[];
  countOf: (op: string) => number;
}

export const TEST_BANNER_COLORS: SiteBannerColorsValue = {
  carrier: 'rgb(1, 1, 1)',
  customer: 'rgb(2, 2, 2)',
  plate: 'rgb(3, 3, 3)',
  rim: 'rgb(4, 4, 4)',
  supplier: 'rgb(5, 5, 5)',
  text: 'rgb(6, 6, 6)',
};

const FONT_SIZE_PATTERN = /(\d+(?:\.\d+)?)px/u;

const TEXT_WIDTH_PER_SIZE = 0.6;

const readStyleText = (style: unknown): string => (typeof style === 'string' ? style : '');

const readFontSize = (font: string): number => Number(FONT_SIZE_PATTERN.exec(font)?.[1] ?? 0);

export const createRecordingContext = (): RecordingContextValue => {
  const calls: RecordedCallValue[] = [];

  const context: RecordingContextValue = {
    arc: (...args): void => { record('arc', args); },
    beginPath: (): void => { record('beginPath', []); },
    calls,
    clearRect: (...args): void => { record('clearRect', args); },
    closePath: (): void => { record('closePath', []); },
    countOf: (op): number => calls.filter(call => call.op === op).length,
    fill: (): void => { record('fill', []); },
    fillStyle: '',
    fillText: (...args): void => { record('fillText', args); },
    font: '',
    lineJoin: 'miter',
    lineTo: (...args): void => { record('lineTo', args); },
    lineWidth: 0,
    measureText: (text): { width: number } => ({
      width: text.length * readFontSize(context.font) * TEXT_WIDTH_PER_SIZE,
    }),
    moveTo: (...args): void => { record('moveTo', args); },
    roundRect: (...args): void => { record('roundRect', args); },
    stroke: (): void => { record('stroke', []); },
    strokeStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  function record(op: string, args: readonly (number | string)[]): void {
    calls.push({
      args,
      fillStyle: readStyleText(context.fillStyle),
      font: context.font,
      lineWidth: context.lineWidth,
      op,
      strokeStyle: readStyleText(context.strokeStyle),
    });
  }

  return context;
};

export const createTestEntry = (
  organizationId: string,
  side: MapSideValue,
  monogram: MonogramPartsValue,
): SiteBannerEntryValue => ({ monogram, organizationId, side });

export interface TestMapSiteOptionsValue {
  isOwn?: boolean;
  nodeId?: string;
  organizationName: string;
  side: MapSideValue;
}

export const createTestMapSite = (
  id: string,
  organizationId: string,
  options: TestMapSiteOptionsValue,
): NetworkMapSiteValue => {
  const nodeId = options.nodeId ?? 'a';

  return {
    cityId: `${nodeId}-city`,
    id,
    isOwn: options.isOwn ?? false,
    label: `Site ${id}`,
    nodeId,
    organizationId,
    organizationName: options.organizationName,
    side: options.side,
  };
};
