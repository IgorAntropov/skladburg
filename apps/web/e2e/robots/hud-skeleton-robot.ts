import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { SectionValue } from '../fixtures/routes.ts';
import type { TopBarLayoutValue } from '../fixtures/viewports.ts';

import { getText } from '../fixtures/messages.ts';
import {
  createDelayEngineRequestScript,
  INSTALL_SKELETON_RECORDER,
  READ_SKELETON_RECORD,
  RESET_SKELETON_RECORD,
} from '../fixtures/pageScripts.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';

export type SkeletonFrameNameValue = 'inspector' | 'kpi' | 'lists' | 'panel' | 'tracker';

export type SkeletonKindValue = 'section' | 'session';

export interface SkeletonRobotValue {
  delayRequest: (urlPart: string, delayMs: number) => Promise<void>;
  delaySectionChunk: (section: SectionValue, delayMs: number) => Promise<void>;
  expectFramesMatchZones: (section: SectionValue, tolerancePx: number) => Promise<void>;
  expectFramesOfSection: (section: SectionValue) => Promise<void>;
  expectHiddenAtFirstSight: (kind: SkeletonKindValue) => Promise<void>;
  expectLabelAnnounced: (kind: SkeletonKindValue) => Promise<void>;
  expectNeverVisible: (kind: SkeletonKindValue) => Promise<void>;
  expectNoFrames: () => Promise<void>;
  expectNoSkeletonInPage: () => Promise<void>;
  expectNothingVisibleSinceReset: () => Promise<void>;
  expectPageShownAfterSkeleton: (kind: SkeletonKindValue, minVisibleMs: number) => Promise<void>;
  expectSameTopBarGeometry: (pending: TopBarGeometryValue, loaded: TopBarGeometryValue, tolerancePx: number) => void;
  expectVisible: (kind: SkeletonKindValue) => Promise<void>;
  expectVisibleAfterDelay: (kind: SkeletonKindValue, minDelayMs: number) => Promise<void>;
  installRecorder: () => Promise<void>;
  readTopBarGeometry: () => Promise<TopBarGeometryValue>;
  resetRecorder: () => Promise<void>;
}

export interface TopBarGeometryValue {
  bannerHeight: number;
  profileButtonY: number;
}

interface RectValue {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface SkeletonRecordValue {
  labels: Record<string, SkeletonSpanValue | undefined>;
  pageShownAt: null | number;
}

interface SkeletonSpanValue {
  firstSeenAt: number;
  firstSeenVisibility: string;
  visibleEndedAt: null | number;
  visibleStartedAt: null | number;
}

const FRAME_NAMES_BY_SECTION = {
  catalog: { desktop: ['inspector', 'panel'], phone: ['panel'], tablet: ['panel'] },
  deals: { desktop: ['inspector', 'panel'], phone: ['panel'], tablet: ['panel'] },
  network: { desktop: ['kpi', 'tracker', 'inspector', 'lists'], phone: ['lists'], tablet: ['kpi', 'lists'] },
  warehouse: { desktop: ['inspector', 'lists'], phone: ['lists'], tablet: ['lists'] },
} as const satisfies Record<SectionValue, Record<TopBarLayoutValue, readonly SkeletonFrameNameValue[]>>;

const LABEL_KEYS = {
  section: 'routing.section.loading',
  session: 'session.loading',
} as const satisfies Record<SkeletonKindValue, 'routing.section.loading' | 'session.loading'>;

export const createHudSkeletonRobot = (page: Page, layout: TopBarLayoutValue): SkeletonRobotValue => {
  const getFrameNames = (section: SectionValue): readonly SkeletonFrameNameValue[] => FRAME_NAMES_BY_SECTION[section][layout];

  const getLabel = (kind: SkeletonKindValue): string => getText(LABEL_KEYS[kind]);
  const getGroup = (kind: SkeletonKindValue): Locator => page.getByRole('status', {
    exact: true,
    name: getLabel(kind),
  });

  const readRecord = (): Promise<SkeletonRecordValue> => page.evaluate<SkeletonRecordValue>(READ_SKELETON_RECORD);

  const readSpan = async (kind: SkeletonKindValue): Promise<SkeletonSpanValue | undefined> => {
    const record = await readRecord();

    return record.labels[getLabel(kind)];
  };

  const readRect = async (testId: string): Promise<RectValue> => {
    const box = await page.getByTestId(testId).boundingBox();

    if (box === null) {
      throw new Error(`The element ${testId} has no box`);
    }

    return box;
  };

  const profileLocators = createProfileMenuLocators(page);

  const expectVisible = async (kind: SkeletonKindValue): Promise<void> => {
    await expect(getGroup(kind).getByTestId('hud-layout-skeleton')).toBeVisible();
  };

  return {
    async delayRequest(urlPart: string, delayMs: number): Promise<void> {
      await page.addInitScript({ content: createDelayEngineRequestScript(urlPart, delayMs) });
    },
    async delaySectionChunk(section: SectionValue, delayMs: number): Promise<void> {
      await page.route(`**/assets/${section}-*.js`, async (route) => {
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });
        await route.continue();
      });
    },
    async expectFramesMatchZones(section: SectionValue, tolerancePx: number): Promise<void> {
      const frameNames = getFrameNames(section);
      const frameRects = new Map<SkeletonFrameNameValue, RectValue>();

      for (const name of frameNames) {
        frameRects.set(name, await readRect(`hud-skeleton-${name}`));
      }

      await expect(page.getByTestId('hud-layout-skeleton')).toHaveCount(0);

      for (const name of frameNames) {
        const zoneRect = await readRect(`hud-zone-${name}`);
        const frameRect = frameRects.get(name);

        expect(frameRect, `${name} frame was read`).toBeDefined();

        if (frameRect !== undefined) {
          for (const side of ['x', 'y', 'width', 'height'] as const) {
            expect(
              Math.abs(frameRect[side] - zoneRect[side]),
              `${name} ${side}: skeleton ${String(frameRect[side])}, zone ${String(zoneRect[side])}`,
            ).toBeLessThanOrEqual(tolerancePx);
          }
        }
      }
    },
    async expectFramesOfSection(section: SectionValue): Promise<void> {
      const frameNames = getFrameNames(section);
      const frames = page.locator('[data-testid^="hud-skeleton-"]');

      await expect(frames).toHaveCount(frameNames.length);

      for (const name of frameNames) {
        await expect(page.getByTestId(`hud-skeleton-${name}`)).toBeVisible();
      }
    },
    async expectHiddenAtFirstSight(kind: SkeletonKindValue): Promise<void> {
      await expect.poll(async () => (await readSpan(kind))?.firstSeenVisibility).toBe('hidden');
    },
    async expectLabelAnnounced(kind: SkeletonKindValue): Promise<void> {
      await expect(getGroup(kind)).toHaveAttribute('aria-busy', 'true');
      await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    },
    async expectNeverVisible(kind: SkeletonKindValue): Promise<void> {
      await expect(page.getByTestId('hud-zone-scene')).toBeVisible();

      const span = await readSpan(kind);

      expect(span?.visibleStartedAt ?? null).toBeNull();
    },
    async expectNoFrames(): Promise<void> {
      await expect(page.getByTestId('hud-layout-skeleton')).toHaveCount(1);
      await expect(page.locator('[data-testid^="hud-skeleton-"]')).toHaveCount(0);
    },
    async expectNoSkeletonInPage(): Promise<void> {
      await expect(page.getByTestId('hud-layout-skeleton')).toHaveCount(0);
    },
    async expectNothingVisibleSinceReset(): Promise<void> {
      const record = await readRecord();

      const visibleLabels = Object.entries(record.labels)
        .filter(([, span]) => span?.visibleStartedAt !== null && span?.visibleStartedAt !== undefined)
        .map(([label]) => label);

      expect(visibleLabels).toEqual([]);
    },
    async expectPageShownAfterSkeleton(kind: SkeletonKindValue, minVisibleMs: number): Promise<void> {
      await expect(page.getByTestId('hud-zone-scene')).toBeVisible();

      const record = await readRecord();
      const span = record.labels[getLabel(kind)];

      expect(span?.visibleStartedAt, 'the skeleton became visible').not.toBeNull();
      expect(span?.visibleEndedAt, 'the skeleton went away').not.toBeNull();
      expect(record.pageShownAt, 'the page was shown').not.toBeNull();

      const startedAt = span?.visibleStartedAt ?? 0;
      const endedAt = span?.visibleEndedAt ?? 0;
      const pageShownAt = record.pageShownAt ?? 0;

      expect(endedAt - startedAt, 'the skeleton stayed visible').toBeGreaterThanOrEqual(minVisibleMs);
      expect(pageShownAt - startedAt, 'the page came after the minimal visible time').toBeGreaterThanOrEqual(minVisibleMs);
    },
    expectSameTopBarGeometry(pending: TopBarGeometryValue, loaded: TopBarGeometryValue, tolerancePx: number): void {
      for (const side of ['bannerHeight', 'profileButtonY'] as const) {
        expect(
          Math.abs(pending[side] - loaded[side]),
          `${side}: pending ${String(pending[side])}, loaded ${String(loaded[side])}`,
        ).toBeLessThanOrEqual(tolerancePx);
      }
    },
    expectVisible,
    async expectVisibleAfterDelay(kind: SkeletonKindValue, minDelayMs: number): Promise<void> {
      await expectVisible(kind);

      const span = await readSpan(kind);

      expect(span?.visibleStartedAt, 'the skeleton became visible').not.toBeNull();
      expect((span?.visibleStartedAt ?? 0) - (span?.firstSeenAt ?? 0)).toBeGreaterThanOrEqual(minDelayMs);
    },
    async installRecorder(): Promise<void> {
      await page.addInitScript({ content: INSTALL_SKELETON_RECORDER });
    },
    async readTopBarGeometry(): Promise<TopBarGeometryValue> {
      const bannerBox = await profileLocators.banner.boundingBox();
      const buttonBox = await profileLocators.buttonIncludingHidden.boundingBox();

      if (bannerBox === null || buttonBox === null) {
        throw new Error('The top bar or the profile button has no box');
      }

      return { bannerHeight: bannerBox.height, profileButtonY: buttonBox.y };
    },
    async resetRecorder(): Promise<void> {
      await page.evaluate(RESET_SKELETON_RECORD);
    },
  };
};
