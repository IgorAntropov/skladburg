import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapSiteValue } from '@/entities/network';

import type { SiteMarkSetValue } from './buildSiteMarkSet';

import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { applySiteMarkAzimuth } from '../geometry/siteMarkOrientation';
import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
} from '../layout/layoutTestSupport';
import {
  buildSiteMarkSet,
  fillSiteMarkHoverMask,
  writeSiteMarkMarkerMatrices,
} from './buildSiteMarkSet';
import { createSiteBannerCellLookup } from './createSiteBannerCellLookup';
import { listSiteBannerEntries } from './listSiteBannerEntries';
import { computeSiteBannerAtlasLayout } from './siteBannerAtlasLayout';
import { createTestMapSite } from './siteBannerTestSupport';

const SITES: readonly NetworkMapSiteValue[] = [
  createTestMapSite('s1', 'org-1', { isOwn: true, organizationName: 'Заказчик 1', side: 'customer' }),
  createTestMapSite('s2', 'org-1', { organizationName: 'Заказчик 1', side: 'customer' }),
  createTestMapSite('s3', 'org-2', { organizationName: 'Поставщик 1', side: 'supplier' }),
];

const buildScene = (
  sites: readonly NetworkMapSiteValue[],
): { lookup: ReturnType<typeof createSiteBannerCellLookup>; set: SiteMarkSetValue; sites: readonly NetworkMapSiteValue[] } => {
  const layout = buildNetworkSceneLayout(createTestModel([createTestCity('a', 4, 2)], [], sites));
  const entries = listSiteBannerEntries(layout.buildings, sites);
  const lookup = createSiteBannerCellLookup(computeSiteBannerAtlasLayout(entries.length), entries);

  return { lookup, set: buildSiteMarkSet(layout.buildings, sites, lookup), sites };
};

const readMatrix = (matrices: Float32Array, slot: number): Float32Array => (
  matrices.slice(slot * INSTANCE_MATRIX_ITEM_SIZE, (slot + 1) * INSTANCE_MATRIX_ITEM_SIZE)
);

const readCell = (cells: Float32Array, slot: number): number[] => [...cells.slice(slot * 4, slot * 4 + 4)];

describe('buildSiteMarkSet', () => {
  it('makes one instance for each visible company building', () => {
    const { set } = buildScene(SITES);

    expect(set.count).toBe(3);
    expect([...set.slotBySiteId.keys()].toSorted()).toEqual(['s1', 's2', 's3']);
    expect(set.matrices).toHaveLength(3 * INSTANCE_MATRIX_ITEM_SIZE);
    expect(set.postMatrices).toHaveLength(3 * INSTANCE_MATRIX_ITEM_SIZE);
    expect(set.nearCells).toHaveLength(3 * 4);
    expect(set.farCells).toHaveLength(3 * 4);
    expect(set.hoverMask).toHaveLength(3);
  });

  it('makes no instance for a site that the city hides', () => {
    const sites = Array.from({ length: 30 }, (_, index) => createTestMapSite(
      `site-${String(index).padStart(2, '0')}`,
      `org-${String(index).padStart(2, '0')}`,
      { organizationName: `Склад ${String(index)}`, side: 'supplier' },
    ));
    const layout = buildNetworkSceneLayout(createTestModel([createTestCity('a', 4, 2)], [], sites));
    const hidden = layout.cities[0]?.hiddenSiteIds ?? [];
    const { set } = buildScene(sites);

    expect(hidden.length).toBeGreaterThan(0);
    expect(set.count).toBe(sites.length - hidden.length);

    for (const siteId of hidden) {
      expect(set.slotBySiteId.has(siteId)).toBe(false);
    }
  });

  it('is empty with no buildings', () => {
    const lookup = createSiteBannerCellLookup(computeSiteBannerAtlasLayout(0), []);
    const set = buildSiteMarkSet([], [], lookup);

    expect(set.count).toBe(0);
    expect(set.matrices).toHaveLength(0);
    expect(set.ownSlots).toEqual([]);
    expect(set.markerMatrices).toHaveLength(0);
  });

  it('gives the sites of one organization the same banner cell and a different one to another organization', () => {
    const { lookup, set } = buildScene(SITES);
    const first = set.slotBySiteId.get('s1') ?? -1;
    const second = set.slotBySiteId.get('s2') ?? -1;
    const third = set.slotBySiteId.get('s3') ?? -1;
    const near = (organizationId: string, side: 'customer' | 'supplier'): number[] => {
      const cell = lookup.getNearCell(organizationId, side);

      return [cell.u0, cell.u1, cell.v0, cell.v1].map(value => Math.fround(value));
    };

    expect(readCell(set.nearCells, first)).toEqual(readCell(set.nearCells, second));
    expect(readCell(set.nearCells, first)).toEqual(near('org-1', 'customer'));
    expect(readCell(set.nearCells, third)).toEqual(near('org-2', 'supplier'));
    expect(readCell(set.nearCells, third)).not.toEqual(readCell(set.nearCells, first));
  });

  it('gives the far cell by side, the same for every organization of the side', () => {
    const sites = [
      ...SITES,
      createTestMapSite('s4', 'org-3', { organizationName: 'Заказчик 2', side: 'customer' }),
    ];
    const { set } = buildScene(sites);
    const slot = (siteId: string): number => set.slotBySiteId.get(siteId) ?? -1;

    expect(readCell(set.farCells, slot('s1'))).toEqual(readCell(set.farCells, slot('s4')));
    expect(readCell(set.farCells, slot('s1'))).toEqual(readCell(set.farCells, slot('s2')));
    expect(readCell(set.farCells, slot('s3'))).not.toEqual(readCell(set.farCells, slot('s1')));
  });

  it('gives the shared cell of the side to a building whose site is unknown', () => {
    const layout = buildNetworkSceneLayout(createTestModel([createTestCity('a', 4, 2)], [], SITES));
    const lookup = createSiteBannerCellLookup(computeSiteBannerAtlasLayout(0), []);
    const set = buildSiteMarkSet(layout.buildings, [], lookup);
    const shared = lookup.getNearCell('', 'customer');

    expect(readCell(set.nearCells, 0)).toEqual([shared.u0, shared.u1, shared.v0, shared.v1].map(value => Math.fround(value)));
  });

  it('keeps the slots of the own sites and one marker matrix for each of them', () => {
    const { set } = buildScene(SITES);

    expect(set.ownSlots).toEqual([set.slotBySiteId.get('s1')]);
    expect(set.markerMatrices).toHaveLength(INSTANCE_MATRIX_ITEM_SIZE);
  });

  it('puts the center of the mark 3.7 m over the site and a thin post under it', () => {
    const { set } = buildScene(SITES);
    const slot = set.slotBySiteId.get('s3') ?? -1;
    const mark = readMatrix(set.matrices, slot);
    const post = readMatrix(set.postMatrices, slot);

    expect(mark[13]).toBeCloseTo(3.7, 6);
    expect(post[13]).toBeCloseTo(0.1, 6);
    expect(post[0]).toBeCloseTo(0.16, 6);
    expect(post[5]).toBeCloseTo(2.4, 6);
    expect(post[10]).toBeCloseTo(0.16, 6);
    expect(post[12]).toBeCloseTo(mark[12] ?? 0, 6);
    expect(post[14]).toBeCloseTo(mark[14] ?? 0, 6);
  });
});

describe('fillSiteMarkHoverMask', () => {
  it('marks the hovered site and the sites of a hovered city or row', () => {
    const { set } = buildScene(SITES);
    const slot = (siteId: string): number => set.slotBySiteId.get(siteId) ?? -1;

    fillSiteMarkHoverMask(set, 's2', []);
    expect([...set.hoverMask]).toEqual(Array.from({ length: 3 }, (_, index) => (index === slot('s2') ? 1 : 0)));

    fillSiteMarkHoverMask(set, undefined, ['s1', 's3']);
    expect(set.hoverMask[slot('s1')]).toBe(1);
    expect(set.hoverMask[slot('s3')]).toBe(1);
    expect(set.hoverMask[slot('s2')]).toBe(0);

    fillSiteMarkHoverMask(set, 's1', ['s3']);
    expect(set.hoverMask.reduce((sum, value) => sum + value, 0)).toBe(2);
  });

  it('marks nothing for an unknown id or a city id and clears the previous mask', () => {
    const { set } = buildScene(SITES);

    fillSiteMarkHoverMask(set, 's1', []);
    fillSiteMarkHoverMask(set, 'a', ['nobody']);

    expect(set.hoverMask.every(value => value === 0)).toBe(true);
  });
});

describe('writeSiteMarkMarkerMatrices', () => {
  const sqrt = Math.sqrt(1.5);

  it('puts the house over the left edge of the banner in the near view', () => {
    const { set } = buildScene(SITES);
    const base = readMatrix(set.matrices, set.ownSlots[0] ?? 0);

    writeSiteMarkMarkerMatrices(set, false);

    expect(set.markerMatrices[12]).toBeCloseTo((base[12] ?? 0) - 0.93, 6);
    expect(set.markerMatrices[13]).toBeCloseTo(3.7 + 1.58 * sqrt, 6);
    expect(set.markerMatrices[14]).toBeCloseTo(base[14] ?? 0, 6);
  });

  it('puts the house in the upper right corner of the flag in the far view', () => {
    const { set } = buildScene(SITES);
    const base = readMatrix(set.matrices, set.ownSlots[0] ?? 0);

    writeSiteMarkMarkerMatrices(set, false);
    writeSiteMarkMarkerMatrices(set, true);

    expect(set.markerMatrices[12]).toBeCloseTo((base[12] ?? 0) + 1.2, 6);
    expect(set.markerMatrices[13]).toBeCloseTo(3.7 + 1.05 * sqrt, 6);
  });

  it('follows the turn of the camera and keeps the matrix a pure transform of the mark', () => {
    const { set } = buildScene(SITES);
    const base = readMatrix(set.matrices, set.ownSlots[0] ?? 0);

    applySiteMarkAzimuth(set.matrices, set.count, Math.PI / 2, set.hoverMask);
    writeSiteMarkMarkerMatrices(set, false);

    expect(set.markerMatrices[12]).toBeCloseTo(base[12] ?? 0, 6);
    expect(set.markerMatrices[14]).toBeCloseTo((base[14] ?? 0) + 0.93, 6);
    expect(set.markerMatrices[15]).toBe(1);
    expect(set.markerMatrices[0]).toBeCloseTo(0, 6);
    expect(set.markerMatrices[2]).toBeCloseTo(-1, 6);
  });

  it('grows and lifts with the hovered banner', () => {
    const { set } = buildScene(SITES);

    fillSiteMarkHoverMask(set, 's1', []);
    applySiteMarkAzimuth(set.matrices, set.count, 0, set.hoverMask);
    writeSiteMarkMarkerMatrices(set, false);

    expect(set.markerMatrices[0]).toBeCloseTo(1.25, 6);
    expect(set.markerMatrices[13]).toBeCloseTo(4.1 + 1.58 * sqrt * 1.25, 6);
  });
});
