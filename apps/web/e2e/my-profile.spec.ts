import {
  DEFAULT_PERSONA,
  DIRECTORY_ORGANIZATIONS,
} from './fixtures/demoData.ts';
import { toSectionHash } from './fixtures/routes.ts';
import { test } from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { createMyProfileRobot } from './robots/my-profile-robot.ts';
import { createNavigationRobot } from './robots/navigation-robot.ts';
import { createOrganizationDirectoryRobot } from './robots/organization-directory-robot.ts';
import { createTopBarRobot } from './robots/top-bar-robot.ts';

const { customer1 } = DIRECTORY_ORGANIZATIONS;

const NETWORK_HASH = toSectionHash('network');

test.describe('my profile on a desktop', () => {
  test.use({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('sets the photo, keeps it after a reload and removes it', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);

    await myProfile.open(NETWORK_HASH);
    await myProfile.expectInitialsEverywhere(DEFAULT_PERSONA);

    await myProfile.openPlate();
    await myProfile.expectNoPhotoActions();
    await myProfile.uploadPattern();
    await myProfile.expectPhotoInPlate();
    await myProfile.closePlateWithEscape();
    await myProfile.expectPhotoEverywhere(DEFAULT_PERSONA);

    await myProfile.reload();
    await myProfile.expectPhotoEverywhere(DEFAULT_PERSONA);

    await myProfile.openPlate();
    await myProfile.expectPhotoInPlate();
    await myProfile.expectPhotoActions();
    await myProfile.removePhoto();
    await myProfile.expectInitialsEverywhere(DEFAULT_PERSONA);
  });

  test('keeps the keyboard focus inside the plate after the photo is removed', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);

    await myProfile.open(NETWORK_HASH);
    await myProfile.openPlate();
    await myProfile.uploadPattern();
    await myProfile.removePhoto();

    await myProfile.expectFocusInsidePlate();
    await myProfile.closePlateWithEscape();
    await myProfile.expectProfileButtonFocused();
  });

  test('shows the photo in another tab without a reload', async ({ context, page }) => {
    const myProfile = createMyProfileRobot(page);

    await myProfile.open(NETWORK_HASH);

    const otherPage = await context.newPage();
    const otherMyProfile = createMyProfileRobot(otherPage);

    await otherMyProfile.open(NETWORK_HASH);
    await otherMyProfile.expectInitialsEverywhere(DEFAULT_PERSONA);

    await myProfile.openPlate();
    await myProfile.uploadPattern();

    await otherMyProfile.expectPhotoEverywhere(DEFAULT_PERSONA);
  });

  test('drops the photo when the demo is reset', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);
    const topBar = createTopBarRobot(page);

    await myProfile.open(NETWORK_HASH);
    await myProfile.openPlate();
    await myProfile.uploadPattern();
    await myProfile.closePlateWithEscape();
    await myProfile.expectPhotoEverywhere(DEFAULT_PERSONA);

    await topBar.requestReset();
    await topBar.expectResetConfirmOpen();
    await topBar.resetFromConfirm();
    await topBar.expectResetConfirmClosed();

    await myProfile.expectInitialsEverywhere(DEFAULT_PERSONA);
  });

  test('shows an error under the button for a broken file and sets no photo', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);

    await myProfile.open(NETWORK_HASH);
    await myProfile.openPlate();
    await myProfile.uploadBrokenFile();

    await myProfile.expectDecodeError();
    await myProfile.expectNoPhotoActions();
    await myProfile.closePlateWithEscape();
    await myProfile.expectInitialsEverywhere(DEFAULT_PERSONA);
  });

  test('focuses the first button on open, returns focus on Escape and leads to the own company card', async ({ page }) => {
    const directory = createOrganizationDirectoryRobot(page);
    const myProfile = createMyProfileRobot(page);
    const navigation = createNavigationRobot(page);

    await myProfile.open(NETWORK_HASH);
    await myProfile.openPlate();
    await myProfile.expectFirstButtonFocused();

    await myProfile.closePlateWithEscape();
    await myProfile.expectProfileButtonFocused();

    await myProfile.openPlate();
    await myProfile.followCompanyLink();
    await navigation.expectAddress(`#/organizations/${customer1.id}`);
    await directory.expectOwnCard(customer1);
    await myProfile.expectPlateClosed();
  });

  test('has no violations of WCAG 2.1 A and AA in the plate with a photo', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);
    const topBar = createTopBarRobot(page);

    await myProfile.open(NETWORK_HASH);
    await topBar.expectDocumentTheme('light');
    await myProfile.openPlate();
    await myProfile.uploadPattern();
    await myProfile.expectPhotoInPlate();

    await myProfile.expectNoViolationsOfAccessibility();
  });
});

test.describe('my profile in the dark theme', () => {
  test.use({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: DESKTOP_VIEWPORT,
  });

  test('has no violations of WCAG 2.1 A and AA in the plate with a photo', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);
    const topBar = createTopBarRobot(page);

    await myProfile.followSystemTheme();
    await myProfile.open(NETWORK_HASH);
    await topBar.expectDocumentTheme('dark');
    await myProfile.openPlate();
    await myProfile.uploadPattern();
    await myProfile.expectPhotoInPlate();

    await myProfile.expectNoViolationsOfAccessibility();
  });
});

test.describe('my profile on a phone', () => {
  test.use({
    colorScheme: 'light',
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    viewport: PHONE_VIEWPORT,
  });

  test('fits the plate with a photo into 360 px without a horizontal scroll', async ({ page }) => {
    const myProfile = createMyProfileRobot(page);

    await myProfile.open(NETWORK_HASH);
    await myProfile.openPlate();
    await myProfile.uploadPattern();
    await myProfile.expectPhotoInPlate();

    await myProfile.expectPlateInsideViewport();
    await myProfile.expectNoHorizontalScroll();
  });
});
