import type { QualityLevelValue } from '@/shared/3d';

import type { WarehouseRackLayoutValue } from './warehouseLayout';

import warehouseKit from './warehouseKit.json';

export type WarehouseRackDetailValue = 'detailed' | 'light' | 'posts';

const TRIANGLE_BUDGET: Readonly<Record<QualityLevelValue, number>> = { high: 55_000, low: 24_000, medium: 40_000 };

export const pickWarehouseRackDetail = (
  layout: Pick<WarehouseRackLayoutValue, 'decks' | 'frames'>,
  level: QualityLevelValue,
): WarehouseRackDetailValue => {
  const budget = TRIANGLE_BUDGET[level] * 3;
  const { rackDeck, rackDeckLow, rackFrame, rackFrameLow, rackRail, rackRailLow } = warehouseKit;
  const { decks, frames } = layout;
  const full = frames.length * rackFrame.indices.length + decks.length * (rackDeck.indices.length + rackRail.indices.length);
  if (full <= budget) {
    return 'detailed';
  }

  const light = frames.length * rackFrameLow.indices.length + decks.length * (rackDeckLow.indices.length + rackRailLow.indices.length);
  return light <= budget ? 'light' : 'posts';
};
