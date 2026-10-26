import { NetworkService } from '@skladburg/contracts/network/v1/network';
import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import { defaultTenant } from 'virtual:build-profile';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkMapModelValue } from '@/entities/network';
import type { ApiRuntimeValue } from '@/shared/api';

import { buildNetworkMapModel } from '@/entities/network';
import {
  collectPages,
  createApiRuntime,
} from '@/shared/api';

import { buildNetworkSceneLayout } from '../layout';
import { buildSiteMarkSet } from './buildSiteMarkSet';
import { createSiteBannerCellLookup } from './createSiteBannerCellLookup';
import { listSiteBannerEntries } from './listSiteBannerEntries';
import {
  computeSiteBannerAtlasLayout,
  SITE_BANNER_ATLAS_CAPACITY,
} from './siteBannerAtlasLayout';
import { listSiteBannerLogoPaths } from './siteBannerLogos';

const LOGO_FILES = import.meta.glob('/public/logos/*.svg');

const LOGO_FILE_NAMES: ReadonlySet<string> = new Set(
  Object.keys(LOGO_FILES).map(path => `logos/${path.slice(path.lastIndexOf('/') + 1)}`),
);

describe('site banners built from the demo engine', () => {
  const inProcess = createInProcessEngineConnection();
  let runtime: ApiRuntimeValue | undefined;

  beforeAll(async () => {
    runtime = await createApiRuntime({
      connection: inProcess.connection,
      defaultOrganizationId: defaultTenant.tenantId,
    });
  });

  afterAll(async () => {
    runtime?.close();
    await inProcess.close();
  });

  const buildModelAs = async (organizationId: string, userId: string): Promise<NetworkMapModelValue> => {
    if (runtime === undefined) {
      throw new Error('Runtime is not started');
    }

    runtime.actingContext.set({ organizationId, userId });

    const network = runtime.client.service(NetworkService);

    const [cities, mapNodes, routeLegs, sites] = await Promise.all([
      collectPages(async (page) => {
        const response = await network.listCities({ page });

        return { items: response.cities, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
      collectPages(async (page) => {
        const response = await network.listMapNodes({ page });

        return { items: response.mapNodes, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
      collectPages(async (page) => {
        const response = await network.listRouteLegs({ page });

        return { items: response.routeLegs, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
      collectPages(async (page) => {
        const response = await network.listMapSites({ page });

        return { items: response.mapSites, nextPageToken: response.page?.nextPageToken ?? '' };
      }),
    ]);

    return buildNetworkMapModel({ directory: { cities, mapNodes, routeLegs }, locale: 'ru', organizationId, sites });
  };

  it('gives each organization on the map its own monogram and its own cell of the atlas', async () => {
    const model = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1);
    const layout = buildNetworkSceneLayout(model);
    const entries = listSiteBannerEntries(layout.buildings, model.sites);
    const atlasLayout = computeSiteBannerAtlasLayout(entries.length);
    const lookup = createSiteBannerCellLookup(atlasLayout, entries);
    const monograms = entries.map(entry => `${entry.monogram.letters}${entry.monogram.index}`);
    const cellKeys = entries.map((entry) => {
      const cell = lookup.getNearCell(entry.organizationId, entry.side);

      return `${String(cell.u0)}:${String(cell.v0)}`;
    });
    const sharedKeys = (['customer', 'supplier', 'carrier'] as const).map((side) => {
      const cell = lookup.getNearCell('', side);

      return `${String(cell.u0)}:${String(cell.v0)}`;
    });

    expect(entries).toHaveLength(new Set(model.sites.map(site => site.organizationId)).size);
    expect(entries).toHaveLength(6);
    expect(entries.length).toBeLessThanOrEqual(SITE_BANNER_ATLAS_CAPACITY);
    expect(monograms.toSorted()).toEqual(['Зак1', 'Зак2', 'Пос1', 'Пос2', 'Пос3', 'Пос4']);
    expect(new Set(monograms).size).toBe(entries.length);
    expect(new Set(cellKeys).size).toBe(entries.length);
    expect(cellKeys.filter(key => sharedKeys.includes(key))).toEqual([]);
    expect(atlasLayout).toMatchObject({ height: 512, width: 2048 });
  });

  it('makes an instance for each company building and gives its organization cell to each', async () => {
    const model = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1);
    const layout = buildNetworkSceneLayout(model);
    const entries = listSiteBannerEntries(layout.buildings, model.sites);
    const lookup = createSiteBannerCellLookup(computeSiteBannerAtlasLayout(entries.length), entries);
    const set = buildSiteMarkSet(layout.buildings, model.sites, lookup);
    const companies = layout.buildings.filter(building => building.isCompany);
    const siteById = new Map(model.sites.map(site => [site.id, site]));

    expect(set.count).toBe(companies.length);
    expect(set.ownSlots.length).toBe(companies.filter(building => building.isOwn).length);

    for (const building of companies) {
      const site = siteById.get(building.siteId ?? '');
      const slot = set.slotBySiteId.get(building.siteId ?? '') ?? -1;
      const cell = lookup.getNearCell(site?.organizationId ?? '', site?.side ?? 'customer');

      expect(slot).toBeGreaterThanOrEqual(0);
      expect(set.nearCells[slot * 4]).toBeCloseTo(cell.u0, 6);
      expect(set.nearCells[slot * 4 + 2]).toBeCloseTo(cell.v0, 6);
    }
  });

  it('gives each of the six organizations on the map the path of a light logo that is a file of the app', async () => {
    const model = await buildModelAs(SeedOrganizationId.CUSTOMER_1, SeedUserId.ADMIN_1);
    const layout = buildNetworkSceneLayout(model);
    const entries = listSiteBannerEntries(layout.buildings, model.sites);
    const paths = entries.map(entry => entry.logoPath);

    expect(entries).toHaveLength(6);
    expect(paths.filter(path => path !== '')).toHaveLength(6);
    expect(new Set(paths).size).toBe(6);

    for (const path of paths) {
      expect(path).toMatch(/^logos\/[a-z]+-\d-light\.svg$/u);
      expect(LOGO_FILE_NAMES.has(path), path).toBe(true);
    }

    expect(listSiteBannerLogoPaths(entries).toSorted()).toEqual(paths.toSorted());
  });
});
