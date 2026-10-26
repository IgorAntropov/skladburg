import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
} from '../layout/layoutTestSupport';
import { listSiteBannerEntries } from './listSiteBannerEntries';
import { createTestMapSite } from './siteBannerTestSupport';

const SITES = [
  createTestMapSite('s1', 'org-b', { isOwn: true, organizationName: 'ООО «Заказчик 2»', side: 'customer' }),
  createTestMapSite('s2', 'org-b', { organizationName: 'ООО «Заказчик 2»', side: 'customer' }),
  createTestMapSite('s3', 'org-a', { organizationName: 'Поставщик 1', side: 'supplier' }),
];

const buildLayout = (): ReturnType<typeof buildNetworkSceneLayout> => buildNetworkSceneLayout(
  createTestModel([createTestCity('a', 4, 2)], [], SITES),
);

describe('listSiteBannerEntries', () => {
  it('lists each organization of the visible company buildings once', () => {
    const entries = listSiteBannerEntries(buildLayout().buildings, SITES);

    expect(entries.map(entry => entry.organizationId)).toEqual(['org-a', 'org-b']);
  });

  it('puts the organizations in the order of their ids', () => {
    const reversed = [...SITES].reverse();
    const entries = listSiteBannerEntries(buildLayout().buildings.toReversed(), reversed);

    expect(entries.map(entry => entry.organizationId)).toEqual(['org-a', 'org-b']);
  });

  it('takes the side from the site and the monogram from the name of the organization', () => {
    const entries = listSiteBannerEntries(buildLayout().buildings, SITES);

    expect(entries).toEqual([
      { monogram: { index: '1', letters: 'Пос' }, organizationId: 'org-a', side: 'supplier' },
      { monogram: { index: '2', letters: 'Зак' }, organizationId: 'org-b', side: 'customer' },
    ]);
  });

  it('skips the organizations of the sites that the city hides', () => {
    const sites = Array.from({ length: 30 }, (_, index) => createTestMapSite(
      `site-${String(index).padStart(2, '0')}`,
      `org-${String(index).padStart(2, '0')}`,
      { organizationName: `Склад ${String(index)}`, side: 'supplier' },
    ));
    const layout = buildNetworkSceneLayout(createTestModel([createTestCity('a', 4, 2)], [], sites));
    const [city] = layout.cities;
    const entries = listSiteBannerEntries(layout.buildings, sites);

    expect(city?.hiddenSiteIds.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(sites.length - (city?.hiddenSiteIds.length ?? 0));

    for (const hiddenId of city?.hiddenSiteIds ?? []) {
      const hiddenOrganizationId = sites.find(site => site.id === hiddenId)?.organizationId;

      expect(entries.map(entry => entry.organizationId)).not.toContain(hiddenOrganizationId);
    }
  });

  it('skips a building whose site is unknown', () => {
    expect(listSiteBannerEntries(buildLayout().buildings, [])).toEqual([]);
  });

  it('skips the buildings that are not companies', () => {
    const decor = buildLayout().buildings.map(building => ({ ...building, isCompany: false }));

    expect(listSiteBannerEntries(decor, SITES)).toEqual([]);
  });

  it('gives an empty monogram to an organization with no usable name', () => {
    const sites = [createTestMapSite('s1', 'org', { organizationName: 'ООО', side: 'carrier' })];
    const layout = buildNetworkSceneLayout(createTestModel([createTestCity('a', 4, 2)], [], sites));

    expect(listSiteBannerEntries(layout.buildings, sites)).toEqual([
      { monogram: { index: '', letters: '' }, organizationId: 'org', side: 'carrier' },
    ]);
  });
});
