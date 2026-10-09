import {
  expect,
  test,
} from '@playwright/test';

import {
  DEFAULT_PERSONA,
  PERSONAS,
} from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import { VIEWPORT_SCENARIOS } from './fixtures/viewports.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

for (const viewport of VIEWPORT_SCENARIOS) {
  const isDesktop = viewport.layout === 'desktop';
  const isPhone = viewport.layout === 'phone';

  test.describe(`top bar on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test.describe('content', () => {
      test('shows the brand, sections, search, persona switcher and theme without a horizontal scroll', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openRoot();

        await topBar.expectBannerShown();
        await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
        await topBar.expectSections(DEFAULT_PERSONA.sections);
        await topBar.expectSearchAvailable();
        await topBar.expectPersonaSwitcher(DEFAULT_PERSONA);
        await topBar.expectThemeControl();
        await topBar.expectThemeChecked('light');
        await topBar.expectNoHorizontalScroll();
      });

      test('marks the current section and follows the address', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('deals');
        await topBar.expectCurrentSection('deals');

        await navigation.openSection('warehouse');
        await topBar.expectCurrentSection('warehouse');
      });
    });

    test.describe('search', () => {
      test('takes the focus on the slash key', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectBrand(DEFAULT_PERSONA.organizationName);

        await topBar.pressSlash();

        await topBar.expectFocusOnSearchField();
        await topBar.expectSearchEmpty();
      });

      test('takes the focus on the key of the slash position of the Russian layout', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectBrand(DEFAULT_PERSONA.organizationName);

        await topBar.pressSlashOfRussianLayout();

        await topBar.expectFocusOnSearchField();
        await topBar.expectSearchEmpty();
      });

      test('types the slash as a character inside the field', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
        await topBar.pressSlash();
        await topBar.expectFocusOnSearchField();

        await topBar.typeInSearch('/');

        await topBar.expectSearchValue('/');
        await topBar.expectFocusOnSearchField();
      });

      test('clears the field and returns the focus to the element that had it before the slash key on Escape', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
        await topBar.focusKnownElement('catalog');
        await topBar.pressSlash();
        await topBar.expectFocusOnSearchField();
        await topBar.typeInSearch('abc');
        await topBar.expectSearchValue('abc');

        await topBar.closeSearchWithEscape();

        await topBar.expectFocusOnKnownElement('catalog');
        await topBar.expectFocusNotOnBody();

        if (isPhone) {
          await topBar.expectSearchFolded();
        }
        else {
          await topBar.expectSearchEmpty();
        }
      });

      if (isPhone) {
        test('folds the field and returns the focus to the search button on Escape after opening it with the button', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
          await topBar.openSearchWithToggle();
          await topBar.typeInSearch('abc');
          await topBar.expectSearchValue('abc');

          await topBar.closeSearchWithEscape();

          await topBar.expectSearchFolded();
          await topBar.expectFocusOnSearchToggle();
          await topBar.expectFocusNotOnBody();
        });

        test('falls back to the search button on Escape when nothing had the focus before the slash key', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
          await topBar.blurActiveElement();
          await topBar.pressSlash();
          await topBar.expectFocusOnSearchField();
          await topBar.typeInSearch('abc');

          await topBar.closeSearchWithEscape();

          await topBar.expectSearchFolded();
          await topBar.expectFocusOnSearchToggle();
          await topBar.expectFocusNotOnBody();
        });
      }
      else {
        test('keeps the focus in the cleared field on Escape when nothing had it before the slash key', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
          await topBar.blurActiveElement();
          await topBar.pressSlash();
          await topBar.expectFocusOnSearchField();
          await topBar.typeInSearch('abc');
          await topBar.expectSearchValue('abc');

          await topBar.closeSearchWithEscape();

          await topBar.expectSearchEmpty();
          await topBar.expectFocusOnSearchField();
          await topBar.expectFocusNotOnBody();
        });
      }

      test('tells that the search comes with the catalog on Enter and takes the note away on typing', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
        await topBar.pressSlash();
        await topBar.typeInSearch('abc');
        await topBar.expectSearchNoteHidden();

        await topBar.pressEnterInSearch();

        await topBar.expectSearchUnavailableNote();
        await topBar.expectSearchValue('abc');

        await topBar.typeInSearch('d');

        await topBar.expectSearchNoteHidden();
      });
    });

    test.describe('theme', () => {
      test('switches to dark, paints the banner with the dark panel, keeps the section marker and survives a reload', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectDocumentTheme('light');
        const lightPanel = await topBar.expectPanelBackgroundFromTheme();
        await topBar.expectCurrentSection('network');

        await topBar.selectTheme('dark');

        await topBar.expectDocumentTheme('dark');
        await topBar.expectThemeChecked('dark');
        const darkPanel = await topBar.expectPanelBackgroundFromTheme();
        expect(darkPanel).not.toBe(lightPanel);
        await topBar.expectCurrentSection('network');

        await navigation.reload();

        await topBar.expectBannerShown();
        await topBar.expectDocumentTheme('dark');
        await topBar.expectThemeChecked('dark');
        await topBar.expectPanelBackgroundFromTheme();
        await topBar.expectCurrentSection('network');
        await topBar.expectNoHorizontalScroll();
      });

      test('switches back to light', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.selectTheme('dark');
        await topBar.expectDocumentTheme('dark');

        await topBar.selectTheme('light');

        await topBar.expectDocumentTheme('light');
        await topBar.expectThemeChecked('light');
        await topBar.expectPanelBackgroundFromTheme();
      });

      if (isDesktop) {
        test('changes the value with the arrow keys of the radio group', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectThemeChecked('light');
          await topBar.focusThemeOption('light');

          await topBar.pressArrowOnTheme('ArrowRight');

          await topBar.expectThemeChecked('dark');
          await topBar.expectDocumentTheme('dark');

          await topBar.pressArrowOnTheme('ArrowRight');

          await topBar.expectThemeChecked('system');

          await topBar.pressArrowOnTheme('ArrowLeft');

          await topBar.expectThemeChecked('dark');
          await topBar.expectDocumentTheme('dark');
        });
      }
    });

    test.describe('demo reset', () => {
      test('asks first, focuses the cancel button and returns the focus to the opener on cancel', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('warehouse');
        await topBar.expectBannerShown();

        await topBar.requestReset();

        await topBar.expectResetConfirmOpen();
        await topBar.expectResetConfirmFocusedOnCancel();

        await topBar.cancelResetConfirm();

        await topBar.expectResetConfirmClosed();
        await topBar.expectFocusOnResetOpener();
        await topBar.expectResetNotAnnounced();
      });

      test('closes the question on Escape and returns the focus to the opener', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('warehouse');
        await topBar.expectBannerShown();
        await topBar.requestReset();
        await topBar.expectResetConfirmFocusedOnCancel();

        await topBar.closeResetConfirmWithEscape();

        await topBar.expectResetConfirmClosed();
        await topBar.expectFocusOnResetOpener();
        await topBar.expectResetNotAnnounced();
      });

      test('resets after the confirmation, announces it and shows the seed warehouses', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);
        const warehouse = createWarehouseRobot(page);

        await navigation.openSection('warehouse');
        await warehouse.expectEngineData();

        await topBar.requestReset();
        await topBar.expectResetConfirmOpen();
        await topBar.resetFromConfirm();

        await topBar.expectResetConfirmClosed();
        await topBar.expectResetAnnounced();
        await topBar.expectFocusOnResetOpener();
        await warehouse.expectEngineData();
        await navigation.expectAddress(toSectionHash('warehouse'));
      });

      if (isDesktop) {
        test('keeps the button mounted and expanded while the question is open', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('warehouse');
          await topBar.expectResetButtonExpanded(false);

          await topBar.requestReset();

          await topBar.expectResetButtonExpanded(true);
          await topBar.expectResetConfirmOpen();

          await topBar.closeResetConfirmWithEscape();

          await topBar.expectResetButtonExpanded(false);
        });
      }
    });

    test.describe('persona switcher', () => {
      if (isDesktop) {
        test('keeps the focus on the trigger of the new switcher after a change with the keyboard only', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const persona = createPersonaRobot(page);

          await navigation.openSection('network');
          await persona.expectCurrentPersona(DEFAULT_PERSONA);

          await persona.focusTriggerWithTab();
          await page.keyboard.press('Enter');
          await persona.expectMenuOpen();
          await persona.highlightPersonaWithArrows(PERSONAS.freshCarrier);
          await persona.pressEnterOnHighlightedPersona();

          await persona.expectMenuClosed();
          await persona.expectCurrentPersona(PERSONAS.freshCarrier);
          await persona.expectTriggerFocused();
          await persona.expectSwitchAnnounced(PERSONAS.freshCarrier);
        });
      }
      else {
        test('keeps the focus on the menu button after a change from the menu', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const persona = createPersonaRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectBrand(DEFAULT_PERSONA.organizationName);

          await topBar.selectMenuPersona(PERSONAS.freshCarrier);

          await topBar.expectBrand(PERSONAS.freshCarrier.organizationName);
          await topBar.expectFocusOnMenuButton();
          await persona.expectSwitchAnnounced(PERSONAS.freshCarrier);
          await topBar.expectPersonaSwitcher(PERSONAS.freshCarrier);
          await topBar.expectSections(PERSONAS.freshCarrier.sections);
        });
      }
    });

    if (!isDesktop) {
      test.describe('menu', () => {
        test('does not request the menu chunk on load and requests it once on the first opening', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectBrand(DEFAULT_PERSONA.organizationName);
          await page.waitForLoadState('networkidle');

          await topBar.expectMenuChunkRequestCount(0);

          await topBar.openMenu();

          await topBar.expectMenuChunkRequestCount(1);

          await topBar.closeMenuWithEscape();
          await topBar.openMenu();
          await topBar.closeMenuWithEscape();

          await topBar.expectMenuChunkRequestCount(1);
        });

        test('closes on Escape and returns the focus to the menu button', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.openMenu();

          await topBar.closeMenuWithEscape();

          await topBar.expectFocusOnMenuButton();
          await navigation.expectAddress(toSectionHash('network'));
        });

        test('opens the reset question from the menu and returns the focus to the menu button', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectBannerShown();

          await topBar.requestReset();

          await topBar.expectResetConfirmOpen();
          await topBar.expectResetConfirmFocusedOnCancel();

          await topBar.cancelResetConfirm();

          await topBar.expectFocusOnMenuButton();
          await topBar.expectResetConfirmClosed();
        });

        test('keeps the page without a horizontal scroll with the menu and the search open', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectSearchAvailable();
          await topBar.openMenu();

          await topBar.expectNoHorizontalScroll();
        });
      });
    }

    if (isPhone) {
      test.describe('sections in the menu', () => {
        test('goes to the chosen section and closes the menu', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const persona = createPersonaRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectBrand(DEFAULT_PERSONA.organizationName);

          await topBar.selectMenuSection('catalog');

          await navigation.expectAddress(toSectionHash('catalog'));
          await persona.expectSectionHeading('catalog');
          await topBar.expectMenuClosed();
          await topBar.expectCurrentSection('catalog');
        });
      });
    }
  });
}
