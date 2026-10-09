import {
  expect,
  test,
} from '@playwright/test';

import {
  DEFAULT_PERSONA,
  PERSONAS,
} from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import {
  LAPTOP_VIEWPORT,
  NARROW_PHONE_VIEWPORT,
  PHONE_VIEWPORT_SCENARIOS,
  VIEWPORT_SCENARIOS,
} from './fixtures/viewports.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';
import { createWarehouseRobot } from './robots/warehouse-robot.ts';

for (const viewport of VIEWPORT_SCENARIOS) {
  const isPhone = viewport.layout === 'phone';

  test.describe(`top bar on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test.describe('content', () => {
      test('shows the product mark, sections, search and the profile button with initials, no scroll', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openRoot();

        await topBar.expectBannerShown();
        await topBar.expectProductMark();
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.expectProfileButtonLast();
        await topBar.expectNoSignInLabel();
        await topBar.expectSections(DEFAULT_PERSONA.sections);
        await topBar.expectSearchAvailable();
        await topBar.expectNoHorizontalScroll();
      });

      test('gives the profile button a touch target of at least 44 px', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openRoot();
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.expectButtonTouchTarget();
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

    test.describe('profile menu content', () => {
      test('shows the header, two groups of four personas with one checked, the theme row and the reset item', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.openMenu();

        await topBar.expectMenuContent(DEFAULT_PERSONA);
        await topBar.closeMenuWithEscape();
        await topBar.expectFocusOnProfileButton();
      });

      test('shows the carrier name, role and side after switching to it', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const persona = createPersonaRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await persona.selectPersona(PERSONAS.freshCarrier);

        await topBar.openMenu();

        await topBar.expectMenuContent(PERSONAS.freshCarrier);
      });

      test('gives every menu item a touch target of at least 44 px', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.openMenu();

        await topBar.expectMenuItemsTouchTargets();
      });

      test('keeps the page without a horizontal scroll with the menu open', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectSearchAvailable();
        await topBar.openMenu();

        await topBar.expectNoHorizontalScroll();
      });

      test('closes on Escape and returns the focus to the profile button', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.openMenu();

        await topBar.closeMenuWithEscape();

        await topBar.expectFocusOnProfileButton();
        await navigation.expectAddress(toSectionHash('network'));
      });

      test('keeps the banner and the main area available to assistive technology while open', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.openMenu();

        await topBar.expectBannerAndMainExposed();
      });

      test('closes on a click outside the menu without moving the focus back to the profile button', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.openMenu();

        await topBar.clickOutsideMenu();

        await topBar.expectMenuClosed();
        await topBar.expectFocusNotOnProfileButton();
        await navigation.expectAddress(toSectionHash('network'));
      });

      test('closes on a click of the search and leaves the focus in it', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.openMenu();

        await topBar.clickSearchWhileMenuOpen();

        await topBar.expectMenuClosed();
        await topBar.expectFocusOnSearchField();
      });

      test('closes on Tab with the focus on the profile button and lets the next Tab move on', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.openMenu();

        await topBar.pressTabInMenu();

        await topBar.expectMenuClosed();
        await topBar.expectFocusOnProfileButton();

        await topBar.pressTab();

        await topBar.expectFocusNotOnProfileButton();
        await topBar.expectMenuClosed();
      });

      test('closes on Shift+Tab with the focus on the profile button', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.openMenu();

        await topBar.pressShiftTabInMenu();

        await topBar.expectMenuClosed();
        await topBar.expectFocusOnProfileButton();
      });

      if (!isPhone) {
        test('closes on a click of a section link and goes to the section', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const persona = createPersonaRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await topBar.openMenu();

          await topBar.clickSectionLinkWhileMenuOpen('catalog');

          await topBar.expectMenuClosed();
          await navigation.expectAddress(toSectionHash('catalog'));
          await persona.expectSectionHeading('catalog');
          await topBar.expectCurrentSection('catalog');
        });
      }

      if (isPhone) {
        test('moves the sections into the menu and goes to the chosen one', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const persona = createPersonaRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await topBar.expectSections(DEFAULT_PERSONA.sections);

          await topBar.selectMenuSection('catalog');

          await navigation.expectAddress(toSectionHash('catalog'));
          await persona.expectSectionHeading('catalog');
          await topBar.expectMenuClosed();
          await topBar.expectCurrentSection('catalog');
        });
      }
      else {
        test('keeps the sections out of the menu', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('network');
          await topBar.expectProfileButton(DEFAULT_PERSONA);

          await topBar.openMenu();

          await topBar.expectNoSectionsInMenu();
        });
      }
    });

    test.describe('search', () => {
      test('takes the focus on the slash key', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.pressSlash();

        await topBar.expectFocusOnSearchField();
        await topBar.expectSearchEmpty();
      });

      test('takes the focus on the key of the slash position of the Russian layout', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.pressSlashOfRussianLayout();

        await topBar.expectFocusOnSearchField();
        await topBar.expectSearchEmpty();
      });

      test('types the slash as a character inside the field', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('catalog');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.pressSlash();
        await topBar.expectFocusOnSearchField();

        await topBar.typeInSearch('/');

        await topBar.expectSearchValue('/');
        await topBar.expectFocusOnSearchField();
      });

      if (isPhone) {
        test('returns the focus to the search button on Escape when the open search hides the element that had it', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await topBar.focusKnownElement('catalog');
          await topBar.pressSlash();
          await topBar.expectFocusOnSearchField();
          await topBar.typeInSearch('abc');
          await topBar.expectSearchValue('abc');

          await topBar.closeSearchWithEscape();

          await topBar.expectSearchFolded();
          await topBar.expectFocusOnSearchToggle();
          await topBar.expectFocusNotOnBody();
          await topBar.expectPhoneSearchClosed();
        });
      }
      else {
        test('clears the field and returns the focus to the element that had it before the slash key on Escape', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await topBar.focusKnownElement('catalog');
          await topBar.pressSlash();
          await topBar.expectFocusOnSearchField();
          await topBar.typeInSearch('abc');
          await topBar.expectSearchValue('abc');

          await topBar.closeSearchWithEscape();

          await topBar.expectFocusOnKnownElement('catalog');
          await topBar.expectFocusNotOnBody();
          await topBar.expectSearchEmpty();
        });
      }

      if (isPhone) {
        test('folds the field and returns the focus to the search button on Escape after opening it with the button', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
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
          await topBar.expectProfileButton(DEFAULT_PERSONA);
          await topBar.blurActiveElement();
          await topBar.pressSlash();
          await topBar.expectFocusOnSearchField();
          await topBar.typeInSearch('abc');

          await topBar.closeSearchWithEscape();

          await topBar.expectSearchFolded();
          await topBar.expectFocusOnSearchToggle();
          await topBar.expectFocusNotOnBody();
        });

        test('keeps the open field and the close button inside the panel with no horizontal scroll', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectProfileButton(DEFAULT_PERSONA);

          await topBar.openSearchWithToggle();

          await topBar.expectSearchRowInsidePanel();
          await topBar.expectNoHorizontalScroll();
        });
      }
      else {
        test('keeps the focus in the cleared field on Escape when nothing had it before the slash key', async ({ page }) => {
          const navigation = createNavigationRobot(page);
          const topBar = createTopBarRobot(page, viewport.layout);

          await navigation.openSection('catalog');
          await topBar.expectProfileButton(DEFAULT_PERSONA);
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
        await topBar.expectProfileButton(DEFAULT_PERSONA);
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
      test('offers the three themes as one row of icon items with the light one checked', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.expectThemeRow();
        await topBar.expectThemeChecked('light');
      });

      test('switches to dark from the menu, paints the banner dark, keeps the section marker and survives a reload', async ({ page }) => {
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
        await topBar.expectProfileButton(DEFAULT_PERSONA);
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

      test('moves the focus over the theme items with the arrow keys without changing the theme', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.expectThemeFocusMovesWithoutChange('light');
      });
    });

    test.describe('demo reset', () => {
      test('asks first, focuses the cancel button and returns the focus to the profile button on cancel', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('warehouse');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.requestReset();

        await topBar.expectResetConfirmOpen();
        await topBar.expectResetConfirmFocusedOnCancel();
        await topBar.expectNoHorizontalScroll();

        await topBar.cancelResetConfirm();

        await topBar.expectResetConfirmClosed();
        await topBar.expectFocusOnProfileButton();
        await topBar.expectResetNotAnnounced();
      });

      test('closes the question on Escape and returns the focus to the profile button', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('warehouse');
        await topBar.expectProfileButton(DEFAULT_PERSONA);
        await topBar.requestReset();
        await topBar.expectResetConfirmFocusedOnCancel();

        await topBar.closeResetConfirmWithEscape();

        await topBar.expectResetConfirmClosed();
        await topBar.expectFocusOnProfileButton();
        await topBar.expectResetNotAnnounced();
      });

      test('resets after the confirmation, announces it, focuses the profile button and shows the seed warehouses', async ({ page }) => {
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
        await topBar.expectFocusOnProfileButton();
        await warehouse.expectEngineData();
        await navigation.expectAddress(toSectionHash('warehouse'));
      });
    });

    test.describe('persona change', () => {
      test('keeps the focus on the profile button of the new persona after a change from the menu', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const persona = createPersonaRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('network');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await persona.selectPersona(PERSONAS.freshCarrier);

        await topBar.expectProfileButton(PERSONAS.freshCarrier);
        await topBar.expectFocusOnProfileButton();
        await persona.expectSwitchAnnounced(PERSONAS.freshCarrier);
        await topBar.expectPersonaPicker(PERSONAS.freshCarrier);
        await topBar.expectSections(PERSONAS.freshCarrier.sections);
      });
    });
  });
}

test.describe('profile menu on a laptop 1280x800', () => {
  test.use({
    hasTouch: LAPTOP_VIEWPORT.hasTouch,
    isMobile: LAPTOP_VIEWPORT.isMobile,
    viewport: { height: LAPTOP_VIEWPORT.height, width: LAPTOP_VIEWPORT.width },
  });

  test('keeps the reset item reachable with the keyboard and inside the window', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const persona = createPersonaRobot(page);
    const topBar = createTopBarRobot(page, 'desktop');

    await navigation.openSection('network');
    await topBar.expectProfileButton(DEFAULT_PERSONA);

    await persona.openMenuWithEnter();

    await topBar.expectResetItemReachableWithKeyboard();
  });
});

test.describe('top bar on phone 360x740', () => {
  test.use({
    hasTouch: NARROW_PHONE_VIEWPORT.hasTouch,
    isMobile: NARROW_PHONE_VIEWPORT.isMobile,
    viewport: { height: NARROW_PHONE_VIEWPORT.height, width: NARROW_PHONE_VIEWPORT.width },
  });

  test('keeps the closed row and the open search row inside the panel with no scroll', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const topBar = createTopBarRobot(page, 'phone');

    await navigation.openSection('network');
    await topBar.expectProfileButton(DEFAULT_PERSONA);
    await topBar.expectProductMark();
    await topBar.expectSearchRowInsidePanel();
    await topBar.expectNoHorizontalScroll();

    await topBar.openSearchWithToggle();

    await topBar.expectSearchRowInsidePanel();
    await topBar.expectNoHorizontalScroll();
  });

  test('keeps the page without a horizontal scroll with the profile menu open', async ({ page }) => {
    const navigation = createNavigationRobot(page);
    const topBar = createTopBarRobot(page, 'phone');

    await navigation.openSection('network');
    await topBar.expectProfileButton(DEFAULT_PERSONA);

    await topBar.openMenu();
    await topBar.expectMenuContent(DEFAULT_PERSONA);

    await topBar.expectNoHorizontalScroll();
  });
});

for (const viewport of PHONE_VIEWPORT_SCENARIOS) {
  test.describe(`search that replaces the panel row on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test('opens with the button, takes the focus, hides the mark, clock and profile button and keeps the geometry', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await navigation.openSection('catalog');
      await topBar.expectProfileButton(DEFAULT_PERSONA);
      await topBar.expectPhoneSearchClosed();
      const geometryBefore = await topBar.readPanelGeometry();

      await topBar.openSearchWithToggle();

      await topBar.expectPhoneSearchOpen();
      await topBar.expectPanelGeometryKept(geometryBefore);
      await topBar.expectNoHorizontalScroll();
    });

    test('returns the row, the focus on the search button and the same geometry on the close button', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await navigation.openSection('catalog');
      await topBar.expectProfileButton(DEFAULT_PERSONA);
      const geometryBefore = await topBar.readPanelGeometry();
      await topBar.openSearchWithToggle();
      await topBar.typeInSearch('abc');

      await topBar.closeSearchWithButton();

      await topBar.expectPhoneSearchClosed();
      await topBar.expectFocusOnSearchToggle();
      await topBar.expectSearchFolded();
      await topBar.expectPanelGeometryKept(geometryBefore);
    });

    test('returns the row, the focus on the search button and the same geometry on Escape', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await navigation.openSection('catalog');
      await topBar.expectProfileButton(DEFAULT_PERSONA);
      const geometryBefore = await topBar.readPanelGeometry();
      await topBar.openSearchWithToggle();
      await topBar.typeInSearch('abc');

      await topBar.closeSearchWithEscape();

      await topBar.expectPhoneSearchClosed();
      await topBar.expectFocusOnSearchToggle();
      await topBar.expectSearchFolded();
      await topBar.expectPanelGeometryKept(geometryBefore);
    });

    test('opens on the slash key and shows the cleared field again after a close and a new opening', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await navigation.openSection('catalog');
      await topBar.expectProfileButton(DEFAULT_PERSONA);
      await topBar.pressSlash();
      await topBar.expectPhoneSearchOpen();
      await topBar.typeInSearch('abc');
      await topBar.closeSearchWithButton();

      await topBar.openSearchWithToggle();

      await topBar.expectSearchEmpty();
      await topBar.expectPhoneSearchOpen();
    });

    test('keeps the profile menu usable after the search was opened and closed', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await navigation.openSection('catalog');
      await topBar.expectProfileButton(DEFAULT_PERSONA);
      await topBar.openSearchWithToggle();
      await topBar.closeSearchWithButton();

      await topBar.openMenu();

      await topBar.expectMenuContent(DEFAULT_PERSONA);
    });
  });
}

for (const viewport of VIEWPORT_SCENARIOS) {
  const isPhone = viewport.layout === 'phone';

  test.describe(`sections and themes of the profile menu on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      isMobile: viewport.isMobile,
      viewport: { height: viewport.height, width: viewport.width },
    });

    if (isPhone) {
      test('marks the current section in the menu with a checked item and an indicator line, without a checkmark', async ({ page }) => {
        const navigation = createNavigationRobot(page);
        const topBar = createTopBarRobot(page, viewport.layout);

        await navigation.openSection('deals');
        await topBar.expectProfileButton(DEFAULT_PERSONA);

        await topBar.expectCurrentSectionMarkedWithoutCheckmark('deals');
      });
    }

    test('names every theme item by its visible text', async ({ page }) => {
      const navigation = createNavigationRobot(page);
      const topBar = createTopBarRobot(page, viewport.layout);

      await navigation.openSection('network');
      await topBar.expectProfileButton(DEFAULT_PERSONA);

      await topBar.expectThemeItemsNamedByVisibleText();
    });
  });
}
