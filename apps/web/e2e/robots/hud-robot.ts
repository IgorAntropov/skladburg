import type {
  Locator,
  Page,
} from '@playwright/test';

import { AxeBuilder } from '@axe-core/playwright';
import { expect } from '@playwright/test';

import type { ObjectRouteValue } from '../fixtures/routes.ts';
import type { TopBarLayoutValue } from '../fixtures/viewports.ts';

import { getText } from '../fixtures/messages.ts';
import {
  createReadHorizontalOverflowScript,
  createSetHashScript,
  createStoreThemeScript,
  READ_HORIZONTAL_OVERFLOW,
  READ_VERTICAL_OVERFLOW,
  SETTLE_FINITE_ANIMATIONS,
} from '../fixtures/pageScripts.ts';
import { toObjectHash } from '../fixtures/routes.ts';

export type BottomTabValue = 'deals' | 'tracker' | 'trips' | 'warehouses';

export type HudThemeValue = 'dark' | 'light';

export type HudZoneNameValue = 'inspector' | 'kpi' | 'lists' | 'panel' | 'scene' | 'tracker';

interface RectValue {
  height: number;
  width: number;
  x: number;
  y: number;
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const NETWORK_ZONES: readonly HudZoneNameValue[] = ['scene', 'kpi', 'inspector', 'tracker', 'lists'];

const NON_SCENE_ZONES: readonly HudZoneNameValue[] = ['kpi', 'inspector', 'tracker', 'lists'];

export const BOTTOM_TABS: readonly BottomTabValue[] = ['tracker', 'deals', 'trips', 'warehouses'];

const BOTTOM_TAB_LABEL_KEYS = {
  deals: 'hud.lists.deals',
  tracker: 'hud.tracker.label',
  trips: 'hud.lists.trips',
  warehouses: 'hud.lists.warehouses',
} as const satisfies Record<
  BottomTabValue,
  'hud.lists.deals' | 'hud.lists.trips' | 'hud.lists.warehouses' | 'hud.tracker.label'
>;

const SAME_SIZE_TOLERANCE_PX = 1;

const BOTTOM_TAB_LIST_SELECTOR = '[data-testid="hud-bottom-tabs"] [role="tablist"]';

const isInsideWindow = ({ height, width, x, y }: RectValue, windowSize: { height: number; width: number }): boolean => (
  x >= 0 && y >= 0 && x + width <= windowSize.width && y + height <= windowSize.height
);

const areIntersecting = (first: RectValue, second: RectValue): boolean => (
  first.x < second.x + second.width
  && second.x < first.x + first.width
  && first.y < second.y + second.height
  && second.y < first.y + first.height
);

export interface HudRobotValue {
  closeInspectorWithButton: () => Promise<void>;
  closeInspectorWithEscape: () => Promise<void>;
  expectBottomTabs: () => Promise<void>;
  expectBottomTabSelected: (tab: BottomTabValue) => Promise<void>;
  expectBottomTabsInOneRow: () => Promise<void>;
  expectBottomZoneStableAcrossTabs: () => Promise<void>;
  expectInspectorAbsent: () => Promise<void>;
  expectInspectorEmpty: () => Promise<void>;
  expectInspectorOpen: (route: ObjectRouteValue) => Promise<void>;
  expectInspectorSlidIn: () => Promise<void>;
  expectKpiAndTrackerOfSameHeight: () => Promise<void>;
  expectNetworkZonesOnDesktop: () => Promise<void>;
  expectNoHorizontalScroll: () => Promise<void>;
  expectNoVerticalScroll: () => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectPhoneZones: (visibleZone: 'lists' | 'panel') => Promise<void>;
  expectSheetCollapsed: () => Promise<void>;
  expectSheetExpanded: () => Promise<void>;
  expectSheetToggleFocused: () => Promise<void>;
  expectZoneAbsent: (zone: HudZoneNameValue) => Promise<void>;
  expectZonesApartInsideWindow: () => Promise<void>;
  expectZoneShown: (zone: HudZoneNameValue) => Promise<void>;
  focusBottomTab: (tab: BottomTabValue) => Promise<void>;
  focusInspectorCloseButton: () => Promise<void>;
  openObjectInPlace: (route: ObjectRouteValue) => Promise<void>;
  preferTheme: (theme: HudThemeValue) => Promise<void>;
  pressArrowOnBottomTab: (key: 'ArrowLeft' | 'ArrowRight') => Promise<void>;
  readInspectorHeight: () => Promise<number>;
  selectBottomTab: (tab: BottomTabValue) => Promise<void>;
  toggleSheet: () => Promise<void>;
}

export const createHudRobot = (page: Page, layout: TopBarLayoutValue): HudRobotValue => {
  const isPhone = layout === 'phone';

  const main = page.getByRole('main');
  const getZone = (zone: HudZoneNameValue): Locator => page.getByTestId(`hud-zone-${zone}`);
  const sheet = page.getByTestId('hud-inspector-sheet');
  const inspectorRoot = isPhone ? sheet : getZone('inspector');
  const closeButton = inspectorRoot.getByRole('button', { exact: true, name: getText('hud.inspector.close') });
  const sheetToggle = sheet.getByRole('button', {
    name: new RegExp(`^(${getText('hud.inspector.collapse')}|${getText('hud.inspector.expand')})$`),
  });
  const bottomTabList = page.getByRole('tablist', { exact: true, name: getText('hud.bottom.label') });

  const getBottomTab = (tab: BottomTabValue): Locator => bottomTabList.getByRole('tab', {
    exact: true,
    name: getText(BOTTOM_TAB_LABEL_KEYS[tab]),
  });

  const readRect = async (zone: HudZoneNameValue): Promise<RectValue> => {
    const box = await getZone(zone).boundingBox();

    if (box === null) {
      throw new Error(`The zone ${zone} has no box`);
    }

    return box;
  };

  const expectZoneShown = async (zone: HudZoneNameValue): Promise<void> => {
    await expect(getZone(zone)).toBeVisible();
  };

  const expectZoneAbsent = async (zone: HudZoneNameValue): Promise<void> => {
    await expect(getZone(zone)).toHaveCount(0);
  };

  const expectNoHorizontalScroll = async (): Promise<void> => {
    await expect.poll(() => page.evaluate<number>(READ_HORIZONTAL_OVERFLOW)).toBeLessThanOrEqual(0);
  };

  return {
    async closeInspectorWithButton(): Promise<void> {
      await closeButton.click();
    },
    async closeInspectorWithEscape(): Promise<void> {
      await closeButton.focus();
      await expect(closeButton).toBeFocused();
      await page.keyboard.press('Escape');
    },
    async expectBottomTabs(): Promise<void> {
      await expect(bottomTabList).toBeVisible();
      await expect(bottomTabList.getByRole('tab')).toHaveText(BOTTOM_TABS.map(tab => getText(BOTTOM_TAB_LABEL_KEYS[tab])));
      await expect(getZone('lists').getByRole('tablist')).toHaveCount(1);
    },
    async expectBottomTabSelected(tab: BottomTabValue): Promise<void> {
      for (const candidate of BOTTOM_TABS) {
        await expect(getBottomTab(candidate)).toHaveAttribute('aria-selected', candidate === tab ? 'true' : 'false');
      }

      await expectZoneShown('lists');

      if (tab === 'tracker') {
        await expectZoneShown('tracker');
      }
      else {
        await expectZoneAbsent('tracker');
      }
    },
    async expectBottomTabsInOneRow(): Promise<void> {
      await expect(bottomTabList).toBeVisible();

      const listBox = await bottomTabList.boundingBox();

      if (listBox === null) {
        throw new Error('The bottom tab list has no box');
      }

      const overflow = await page.evaluate<null | number>(createReadHorizontalOverflowScript(BOTTOM_TAB_LIST_SELECTOR));

      expect(overflow, 'the tab row does not scroll or clip').toBe(0);

      let firstTop: number | undefined;

      for (const tab of BOTTOM_TABS) {
        const box = await getBottomTab(tab).boundingBox();

        if (box === null) {
          throw new Error(`The tab ${tab} has no box`);
        }

        firstTop ??= box.y;

        expect(Math.abs(box.y - firstTop), `${tab} is in the same row`).toBeLessThanOrEqual(SAME_SIZE_TOLERANCE_PX);
        expect(box.x, `${tab} starts inside the row`).toBeGreaterThanOrEqual(listBox.x - SAME_SIZE_TOLERANCE_PX);
        expect(box.x + box.width, `${tab} ends inside the row`).toBeLessThanOrEqual(listBox.x + listBox.width + SAME_SIZE_TOLERANCE_PX);
      }
    },
    async expectBottomZoneStableAcrossTabs(): Promise<void> {
      const rects: { rect: RectValue; tab: BottomTabValue }[] = [];

      for (const tab of BOTTOM_TABS) {
        await getBottomTab(tab).click();
        await expect(getBottomTab(tab)).toHaveAttribute('aria-selected', 'true');
        await page.evaluate(SETTLE_FINITE_ANIMATIONS);
        rects.push({ rect: await readRect('lists'), tab });
      }

      const [first] = rects;

      if (first === undefined) {
        throw new Error('No bottom tabs were measured');
      }

      for (const { rect, tab } of rects) {
        expect(Math.abs(rect.height - first.rect.height), `${tab} zone height`).toBeLessThanOrEqual(SAME_SIZE_TOLERANCE_PX);
        expect(Math.abs(rect.y - first.rect.y), `${tab} zone top`).toBeLessThanOrEqual(SAME_SIZE_TOLERANCE_PX);
        expect(Math.abs(rect.width - first.rect.width), `${tab} zone width`).toBeLessThanOrEqual(SAME_SIZE_TOLERANCE_PX);
      }
    },
    async expectInspectorAbsent(): Promise<void> {
      await expect(inspectorRoot).toHaveCount(0);
    },
    async expectInspectorEmpty(): Promise<void> {
      await expect(inspectorRoot).toBeVisible();
      await expect(inspectorRoot.getByText(getText('hud.inspector.empty'))).toBeVisible();
      await expect(closeButton).toHaveCount(0);
    },
    async expectInspectorOpen(route: ObjectRouteValue): Promise<void> {
      await expect(inspectorRoot).toBeVisible();
      await expect(inspectorRoot.getByRole('heading', { level: 2, name: getText('hud.inspector.title') })).toBeVisible();
      await expect(inspectorRoot.getByText(route.id, { exact: true })).toBeVisible();
      await expect(inspectorRoot.getByText(getText('hud.inspector.empty'))).toHaveCount(0);
      await expect(closeButton).toBeVisible();
    },
    async expectInspectorSlidIn(): Promise<void> {
      const windowSize = page.viewportSize();

      if (windowSize === null) {
        throw new Error('The viewport is not set');
      }

      const inspector = getZone('inspector');

      await expect.poll(async () => {
        const box = await inspector.boundingBox();

        return box === null ? Number.POSITIVE_INFINITY : box.x + box.width;
      }).toBeLessThanOrEqual(windowSize.width);

      const rect = await readRect('inspector');

      expect(rect.x).toBeGreaterThan(windowSize.width / 2);
      expect(rect.x + rect.width).toBeLessThanOrEqual(windowSize.width);
      expect(rect.width).toBeLessThanOrEqual(windowSize.width * 0.9);
      expect(rect.height).toBeGreaterThan(0);
      expect(isInsideWindow(rect, { height: windowSize.height, width: windowSize.width })).toBe(true);
    },
    async expectKpiAndTrackerOfSameHeight(): Promise<void> {
      const kpi = await readRect('kpi');
      const tracker = await readRect('tracker');

      expect(Math.abs(kpi.height - tracker.height)).toBeLessThanOrEqual(SAME_SIZE_TOLERANCE_PX);
    },
    async expectNetworkZonesOnDesktop(): Promise<void> {
      for (const zone of NETWORK_ZONES) {
        await expectZoneShown(zone);
      }

      await expectZoneAbsent('panel');
    },
    expectNoHorizontalScroll,
    async expectNoVerticalScroll(): Promise<void> {
      await expect.poll(() => page.evaluate<number>(READ_VERTICAL_OVERFLOW)).toBeLessThanOrEqual(0);
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expect(main).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

      expect(violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map(node => node.target.map(String).join(' ')),
      }))).toEqual([]);
    },
    async expectPhoneZones(visibleZone: 'lists' | 'panel'): Promise<void> {
      const hiddenZones: readonly HudZoneNameValue[] = ['kpi', 'tracker', 'inspector', visibleZone === 'lists' ? 'panel' : 'lists'];

      await expectZoneShown(visibleZone);

      for (const zone of hiddenZones) {
        await expectZoneAbsent(zone);
      }

      await expectNoHorizontalScroll();
    },
    async expectSheetCollapsed(): Promise<void> {
      await expect(sheetToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(sheetToggle).toHaveAccessibleName(getText('hud.inspector.expand'));
      await expect(closeButton).toBeHidden();
    },
    async expectSheetExpanded(): Promise<void> {
      await expect(sheet).toBeVisible();
      await expect(sheetToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(sheetToggle).toHaveAccessibleName(getText('hud.inspector.collapse'));
      await expect(closeButton).toBeVisible();
    },
    async expectSheetToggleFocused(): Promise<void> {
      await expect(sheetToggle).toBeFocused();
    },
    expectZoneAbsent,
    async expectZonesApartInsideWindow(): Promise<void> {
      const windowSize = page.viewportSize();

      if (windowSize === null) {
        throw new Error('The viewport is not set');
      }

      const rects = new Map<HudZoneNameValue, RectValue>();

      for (const zone of NON_SCENE_ZONES) {
        const rect = await readRect(zone);

        expect(isInsideWindow(rect, { height: windowSize.height, width: windowSize.width }), `${zone} is inside the window`).toBe(true);
        rects.set(zone, rect);
      }

      for (const [index, first] of NON_SCENE_ZONES.entries()) {
        for (const second of NON_SCENE_ZONES.slice(index + 1)) {
          const firstRect = rects.get(first);
          const secondRect = rects.get(second);

          expect(firstRect).toBeDefined();
          expect(secondRect).toBeDefined();

          if (firstRect !== undefined && secondRect !== undefined) {
            expect(areIntersecting(firstRect, secondRect), `${first} and ${second} do not intersect`).toBe(false);
          }
        }
      }
    },
    expectZoneShown,
    async focusBottomTab(tab: BottomTabValue): Promise<void> {
      await getBottomTab(tab).focus();
      await expect(getBottomTab(tab)).toBeFocused();
    },
    async focusInspectorCloseButton(): Promise<void> {
      await closeButton.focus();
      await expect(closeButton).toBeFocused();
    },
    async openObjectInPlace(route: ObjectRouteValue): Promise<void> {
      await page.evaluate(createSetHashScript(toObjectHash(route)));
    },
    async preferTheme(theme: HudThemeValue): Promise<void> {
      await page.addInitScript({ content: createStoreThemeScript(theme) });
    },
    async pressArrowOnBottomTab(key: 'ArrowLeft' | 'ArrowRight'): Promise<void> {
      await page.keyboard.press(key);
    },
    async readInspectorHeight(): Promise<number> {
      return (await readRect('inspector')).height;
    },
    async selectBottomTab(tab: BottomTabValue): Promise<void> {
      await getBottomTab(tab).click();
      await expect(getBottomTab(tab)).toHaveAttribute('aria-selected', 'true');
    },
    async toggleSheet(): Promise<void> {
      await sheetToggle.click();
    },
  };
};
