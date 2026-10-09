import type { Page } from '@playwright/test';

import { test } from '@playwright/test';

import type { SectionValue } from './fixtures/routes.ts';
import type { TopBarLayoutValue } from './fixtures/viewports.ts';

import {
  DEFAULT_PERSONA,
  WAREHOUSE_NAMES,
} from './fixtures/demoData.ts';
import {
  toObjectHash,
  toSectionHash,
  VEHICLE_ROUTE,
  WAREHOUSE_ROUTE,
} from './fixtures/routes.ts';
import { VIEWPORT_SCENARIOS } from './fixtures/viewports.ts';
import { createHudRobot } from './robots/hud-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaChunkRobot } from './robots/persona-chunk-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

const THEMES = ['light', 'dark'] as const;

const expectSectionShown = async (
  page: Page,
  layout: TopBarLayoutValue,
  section: SectionValue,
): Promise<void> => {
  const navigation = createNavigationRobot(page);

  if (layout === 'phone') {
    await navigation.expectSectionContent(section);

    return;
  }

  await navigation.expectSection(section);
};

for (const viewport of VIEWPORT_SCENARIOS) {
  const isDesktop = viewport.layout === 'desktop';
  const isTablet = viewport.layout === 'tablet';
  const isPhone = viewport.layout === 'phone';

  test.describe(`HUD layout on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    if (isDesktop) {
      test.describe('desktop zones', () => {
        test('shows all five zones of the network apart from each other inside the window without a page scroll', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('network');

          await expectSectionShown(page, viewport.layout, 'network');
          await hud.expectNetworkZonesOnDesktop();
          await hud.expectZonesApartInsideWindow();
          await hud.expectNoVerticalScroll();
          await hud.expectNoHorizontalScroll();
        });

        test('keeps the inspector in the empty state while no object is open', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('network');

          await hud.expectInspectorEmpty();
          await navigation.expectNoObjectNote();
        });

        test('shows the work panel and the inspector of the catalog without the other zones', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('catalog');

          await expectSectionShown(page, viewport.layout, 'catalog');
          await hud.expectZoneShown('scene');
          await hud.expectZoneShown('panel');
          await hud.expectZoneShown('inspector');
          await hud.expectZoneAbsent('kpi');
          await hud.expectZoneAbsent('tracker');
          await hud.expectZoneAbsent('lists');
          await hud.expectNoVerticalScroll();
          await hud.expectNoHorizontalScroll();
        });

        test('opens the object of the address in the inspector and returns to the section on close', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openObject(VEHICLE_ROUTE);

          await hud.expectInspectorOpen(VEHICLE_ROUTE);
          await navigation.expectObjectNote(VEHICLE_ROUTE);
          await hud.expectZonesApartInsideWindow();

          await hud.closeInspectorWithButton();

          await navigation.expectAddress(toSectionHash('network'));
          await hud.expectInspectorEmpty();
          await navigation.expectNoObjectNote();
        });

        test('follows the address inside the same page when the object changes', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('network');
          await hud.expectInspectorEmpty();

          await hud.openObjectInPlace(VEHICLE_ROUTE);

          await hud.expectInspectorOpen(VEHICLE_ROUTE);
          await navigation.expectObjectNote(VEHICLE_ROUTE);
        });
      });
    }

    if (isTablet) {
      test.describe('tablet zones', () => {
        test('has no inspector without an object and shows the indicators and the bottom tabs', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('network');

          await expectSectionShown(page, viewport.layout, 'network');
          await hud.expectInspectorAbsent();
          await hud.expectZoneShown('kpi');
          await hud.expectBottomTabs();
          await hud.expectNoHorizontalScroll();
        });

        test('slides the inspector in over the page for an object and closes it on Escape', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openObject(VEHICLE_ROUTE);

          await hud.expectInspectorOpen(VEHICLE_ROUTE);
          await hud.expectInspectorSlidIn();
          await navigation.expectObjectNote(VEHICLE_ROUTE);
          await hud.expectZoneShown('kpi');
          await hud.expectNoHorizontalScroll();

          await hud.closeInspectorWithEscape();

          await navigation.expectAddress(toSectionHash('network'));
          await hud.expectInspectorAbsent();
        });

        test('closes the inspector with the button and returns to the section', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openObject(VEHICLE_ROUTE);
          await hud.expectInspectorOpen(VEHICLE_ROUTE);

          await hud.closeInspectorWithButton();

          await navigation.expectAddress(toSectionHash('network'));
          await hud.expectInspectorAbsent();
        });

        test('switches the bottom tabs between the tracker and the lists with the arrow keys', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('network');
          await hud.expectBottomTabs();
          await hud.expectBottomTabSelected('tracker');

          await hud.focusBottomTab('tracker');
          await hud.pressArrowOnBottomTab('ArrowRight');

          await hud.expectBottomTabSelected('lists');

          await hud.pressArrowOnBottomTab('ArrowLeft');

          await hud.expectBottomTabSelected('tracker');
        });
      });
    }

    if (isPhone) {
      test.describe('phone zones', () => {
        test('shows the lists as the only main zone of the network without the indicators and the tracker', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('network');

          await expectSectionShown(page, viewport.layout, 'network');
          await hud.expectPhoneZones('lists');
          await hud.expectInspectorAbsent();
        });

        test('shows the work panel as the only main zone of the catalog', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openSection('catalog');

          await expectSectionShown(page, viewport.layout, 'catalog');
          await hud.expectPhoneZones('panel');
        });

        test('opens the sheet, folds it on Escape with the focus on its button and unfolds it with the button', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openObject(VEHICLE_ROUTE);

          await hud.expectInspectorOpen(VEHICLE_ROUTE);
          await hud.expectSheetExpanded();
          await navigation.expectObjectNote(VEHICLE_ROUTE);
          await hud.expectNoHorizontalScroll();

          await hud.closeInspectorWithEscape();

          await hud.expectSheetCollapsed();
          await hud.expectSheetToggleFocused();
          await navigation.expectAddress(toObjectHash(VEHICLE_ROUTE));
          await hud.expectNoHorizontalScroll();

          await hud.toggleSheet();

          await hud.expectSheetExpanded();
          await navigation.expectObjectNote(VEHICLE_ROUTE);
        });

        test('closes the sheet with the button and returns to the section', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const hud = createHudRobot(page, viewport.layout);

          await navigation.openObject(VEHICLE_ROUTE);
          await hud.expectSheetExpanded();

          await hud.closeInspectorWithButton();

          await navigation.expectAddress(toSectionHash('network'));
          await hud.expectInspectorAbsent();
        });
      });
    }

    test.describe('warehouse section', () => {
      test('shows the warehouses in the tab with the count', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const warehouse = createWarehouseRobot(page);
        const hud = createHudRobot(page, viewport.layout);

        await navigation.openSection('warehouse');

        await expectSectionShown(page, viewport.layout, 'warehouse');
        await warehouse.expectEngineData();
        await warehouse.expectWarehousesTab(WAREHOUSE_NAMES.length);
        await hud.expectNoHorizontalScroll();
      });
    });

    test.describe('profile menu chunk', () => {
      test('does not request the menu chunk on start and warms it up once on the focus of the profile button', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const personaChunk = createPersonaChunkRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openRoot();
        await topBar.expectBannerShown();
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await navigation.expectSectionContent('network');
        await personaChunk.waitForIdle();

        await personaChunk.expectRequestCount(0);
        await personaChunk.expectNoMenuCodeLoaded();

        await topBar.focusProfileButton();

        await personaChunk.expectRequestCount(1);
        await topBar.expectMenuClosed();
        await personaChunk.expectMenuCodeOnlyInMenuChunk();

        await topBar.openMenu();
        await topBar.expectMenuContent(DEFAULT_PERSONA);

        await personaChunk.expectRequestCount(1);
      });

      test('warms the chunk up on hovering the profile button without opening the menu', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const personaChunk = createPersonaChunkRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openRoot();
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await personaChunk.waitForIdle();
        await personaChunk.expectRequestCount(0);

        await topBar.hoverProfileButton();

        await personaChunk.expectRequestCount(1);
        await topBar.expectMenuClosed();
      });

      test('requests the chunk once on the first opening and not again on the next ones', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const personaChunk = createPersonaChunkRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openRoot();
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await personaChunk.waitForIdle();
        await personaChunk.expectRequestCount(0);

        await topBar.openMenu();
        await topBar.expectMenuContent(DEFAULT_PERSONA);
        await personaChunk.expectRequestCount(1);

        await topBar.closeMenuWithEscape();
        await topBar.openMenu();
        await topBar.closeMenuWithEscape();

        await personaChunk.expectRequestCount(1);
      });

      test('keeps the button busy and focused while a slow chunk loads, then opens the menu with the focus inside', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const personaChunk = createPersonaChunkRobot(page);
        const persona = createPersonaRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await personaChunk.delayChunk(1500);
        await navigation.openRoot();
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.pressProfileButtonWithEnter();

        await topBar.expectButtonBusy(true);
        await topBar.expectFocusOnProfileButton();
        await topBar.expectMenuClosed();

        await persona.expectMenuOpenedWithFocusInside();
        await topBar.expectButtonBusy(false);
      });

      test('tells that the chunk did not load and retries it on the next press', async ({ browserName, page }) => {
        const navigation = createNavigationRobot(page);
        const personaChunk = createPersonaChunkRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await personaChunk.blockChunk();
        await navigation.openRoot();
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.pressProfileButton();

        await personaChunk.expectLoadError();
        await topBar.expectMenuClosed();

        if (browserName === 'webkit') {
          return;
        }

        await personaChunk.unblockChunk();
        await topBar.pressProfileButton();

        await topBar.expectMenuContent(DEFAULT_PERSONA);
        await personaChunk.expectNoLoadError();
      });
    });

    test.describe('accessibility', () => {
      test.use({ reducedMotion: 'reduce' });

      for (const theme of THEMES) {
        test.describe(`${theme} theme`, () => {
          test.beforeEach(async ({ page }) => {
            await createHudRobot(page, viewport.layout).preferTheme(theme);
          });

          test('has no violations of WCAG 2.1 A and AA in the network without an object', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openSection('network');
            await expectSectionShown(page, viewport.layout, 'network');
            await topBar.expectDocumentTheme(theme);

            await hud.expectNoViolationsOfAccessibility();
          });

          test('has no violations of WCAG 2.1 A and AA with the profile menu open', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openSection('network');
            await expectSectionShown(page, viewport.layout, 'network');
            await topBar.expectDocumentTheme(theme);
            await topBar.openMenu();
            await topBar.expectMenuContent(DEFAULT_PERSONA);

            await hud.expectNoViolationsOfAccessibility();
          });

          test('has no violations of WCAG 2.1 A and AA with the reset question open', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openSection('network');
            await expectSectionShown(page, viewport.layout, 'network');
            await topBar.expectDocumentTheme(theme);
            await topBar.requestReset();
            await topBar.expectResetConfirmOpen();
            await topBar.expectResetConfirmFocusedOnCancel();

            await hud.expectNoViolationsOfAccessibility();
          });

          test('has no violations of WCAG 2.1 A and AA in the network with an open object', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openObject(VEHICLE_ROUTE);
            await hud.expectInspectorOpen(VEHICLE_ROUTE);
            await topBar.expectDocumentTheme(theme);

            await hud.expectNoViolationsOfAccessibility();
          });

          test('has no violations of WCAG 2.1 A and AA in the warehouse with the loaded list', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const warehouse = createWarehouseRobot(page);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openSection('warehouse');
            await warehouse.expectEngineData();
            await topBar.expectDocumentTheme(theme);

            await hud.expectNoViolationsOfAccessibility();
          });

          test('has no violations of WCAG 2.1 A and AA in the warehouse with an open object', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const warehouse = createWarehouseRobot(page);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openObject(WAREHOUSE_ROUTE);
            await hud.expectInspectorOpen(WAREHOUSE_ROUTE);
            await warehouse.expectEngineData();
            await topBar.expectDocumentTheme(theme);

            await hud.expectNoViolationsOfAccessibility();
          });

          test('has no violations of WCAG 2.1 A and AA in the catalog', async ({ page }) => {
            const navigation = createNavigationRobot(page);
            const topBar = createTopBarRobot(page, viewport.layout);
            const hud = createHudRobot(page, viewport.layout);

            await navigation.openSection('catalog');
            await expectSectionShown(page, viewport.layout, 'catalog');
            await topBar.expectDocumentTheme(theme);

            await hud.expectNoViolationsOfAccessibility();
          });

          if (isTablet) {
            test('has no violations of WCAG 2.1 A and AA with the lists tab of the bottom zone', async ({ page }) => {
              const navigation = createNavigationRobot(page);
              const topBar = createTopBarRobot(page, viewport.layout);
              const hud = createHudRobot(page, viewport.layout);

              await navigation.openSection('network');
              await hud.expectBottomTabSelected('tracker');
              await hud.focusBottomTab('tracker');
              await hud.pressArrowOnBottomTab('ArrowRight');
              await hud.expectBottomTabSelected('lists');
              await topBar.expectDocumentTheme(theme);

              await hud.expectNoViolationsOfAccessibility();
            });
          }

          if (isPhone) {
            test('has no violations of WCAG 2.1 A and AA with a folded sheet', async ({ page }) => {
              const navigation = createNavigationRobot(page);
              const topBar = createTopBarRobot(page, viewport.layout);
              const hud = createHudRobot(page, viewport.layout);

              await navigation.openObject(VEHICLE_ROUTE);
              await hud.expectSheetExpanded();
              await hud.closeInspectorWithEscape();
              await hud.expectSheetCollapsed();
              await topBar.expectDocumentTheme(theme);

              await hud.expectNoViolationsOfAccessibility();
            });
          }
        });
      }
    });
  });
}
