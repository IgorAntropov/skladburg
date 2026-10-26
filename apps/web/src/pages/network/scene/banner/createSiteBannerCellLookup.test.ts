import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SiteBannerEntryValue } from './siteBannerEntry';

import { createSiteBannerCellLookup } from './createSiteBannerCellLookup';
import { computeSiteBannerAtlasLayout } from './siteBannerAtlasLayout';
import { createTestEntry } from './siteBannerTestSupport';

const ENTRIES = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }),
  createTestEntry('c2', 'customer', { index: '2', letters: 'Зак' }),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }),
];

const createLookup = (entries: readonly SiteBannerEntryValue[]): ReturnType<typeof createSiteBannerCellLookup> => (
  createSiteBannerCellLookup(computeSiteBannerAtlasLayout(entries.length), entries)
);

const keyOf = (cell: { u0: number; v0: number }): string => `${String(cell.u0)}:${String(cell.v0)}`;

describe('createSiteBannerCellLookup', () => {
  it('keeps each organization in its own cell and gives each side one flag cell', () => {
    const lookup = createLookup(ENTRIES);
    const cells = ENTRIES.map(entry => lookup.getNearCell(entry.organizationId, entry.side));

    expect(new Set(cells.map(keyOf)).size).toBe(3);

    const flags = (['customer', 'supplier', 'carrier'] as const).map(side => lookup.getFarCell(side));

    expect(new Set(flags.map(keyOf)).size).toBe(3);
    expect(lookup.getNearCell('c1', 'customer')).toEqual(cells[0]);
  });

  it('gives an organization with no cell the shared cell of its side', () => {
    const lookup = createLookup(ENTRIES);
    const stranger = lookup.getNearCell('unknown', 'customer');

    expect(lookup.getNearCell('another', 'customer')).toEqual(stranger);
    expect(lookup.getNearCell('unknown', 'supplier')).not.toEqual(stranger);
    expect(ENTRIES.map(entry => lookup.getNearCell(entry.organizationId, entry.side))).not.toContainEqual(stranger);
  });

  it('gives the shared cell of the side to the organizations over the capacity', () => {
    const entries = Array.from({ length: 60 }, (_, index) => createTestEntry(
      `o${String(index).padStart(2, '0')}`,
      'supplier',
      { index: String(index), letters: 'Орг' },
    ));
    const lookup = createLookup(entries);
    const own = Array.from({ length: 53 }, (_, index) => lookup.getNearCell(`o${String(index).padStart(2, '0')}`, 'supplier'));
    const shared = lookup.getNearCell('o53', 'supplier');

    expect(new Set(own.map(keyOf)).size).toBe(53);
    expect(lookup.getNearCell('o59', 'supplier')).toEqual(shared);
    expect(own).not.toContainEqual(shared);
  });
});
