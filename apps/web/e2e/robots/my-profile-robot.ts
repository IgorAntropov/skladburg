import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import { createStoreSystemThemeScript } from '../fixtures/themePreference.ts';
import {
  createPatternPngBase64Script,
  HAS_HORIZONTAL_SCROLL_SCRIPT,
} from './my-profile-scripts.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';

const UPLOAD_LABEL = 'Загрузить фото';
const REPLACE_LABEL = 'Заменить фото';
const DECODE_ERROR_TEXT = 'Не получилось открыть картинку';
const STORED_AVATAR_SIZE_PX = 256;
const VIEWPORT_EDGE_TOLERANCE_PX = 1;

export interface MyProfileRobotValue {
  closePlateWithEscape: () => Promise<void>;
  expectDecodeError: () => Promise<void>;
  expectFirstButtonFocused: () => Promise<void>;
  expectFocusInsidePlate: () => Promise<void>;
  expectInitialsEverywhere: (persona: PersonaValue) => Promise<void>;
  expectNoHorizontalScroll: () => Promise<void>;
  expectNoPhotoActions: () => Promise<void>;
  expectNoViolationsOfAccessibility: () => Promise<void>;
  expectPhotoActions: () => Promise<void>;
  expectPhotoEverywhere: (persona: PersonaValue) => Promise<void>;
  expectPhotoInPlate: () => Promise<void>;
  expectPlateClosed: () => Promise<void>;
  expectPlateInsideViewport: () => Promise<void>;
  expectProfileButtonFocused: () => Promise<void>;
  followCompanyLink: () => Promise<void>;
  followSystemTheme: () => Promise<void>;
  open: (hash: string) => Promise<void>;
  openPlate: () => Promise<void>;
  reload: () => Promise<void>;
  removePhoto: () => Promise<void>;
  uploadBrokenFile: () => Promise<void>;
  uploadPattern: () => Promise<void>;
}

export const createMyProfileRobot = (page: Page): MyProfileRobotValue => {
  const {
    button: profileButton,
    getPersonaAvatarImage,
    getPersonaItem,
    header,
    headerAvatarImage,
    menu,
    myProfileItem,
  } = createProfileMenuLocators(page);
  const plate = page.getByTestId('profile-my-profile');
  const uploadButton = plate.getByTestId('change-avatar-upload');
  const uploadInput = plate.getByTestId('change-avatar-upload-input');
  const removeButton = plate.getByTestId('change-avatar-remove');
  const companyLink = plate.getByTestId('profile-my-profile-company-link');
  const profileButtonImage = profileButton.locator('img');
  const plateImage = plate.locator('img');

  const expectImageDecoded = async (image: Locator): Promise<void> => {
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty('naturalWidth', STORED_AVATAR_SIZE_PX);
    await expect(image).toHaveJSProperty('naturalHeight', STORED_AVATAR_SIZE_PX);
  };

  const waitForReadyProfileButton = async (): Promise<void> => {
    await expect(profileButton).toBeEnabled();
    await expect(profileButton).not.toHaveAttribute('aria-busy', 'true');
  };

  const openMenu = async (): Promise<void> => {
    await waitForReadyProfileButton();
    await profileButton.click();
    await expect(menu).toBeVisible();
    await expect(header).toBeVisible();
  };

  const closeMenu = async (): Promise<void> => {
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  };

  const readPatternPng = async (): Promise<Buffer> => {
    const base64 = await page.evaluate<string>(createPatternPngBase64Script());

    return Buffer.from(base64, 'base64');
  };

  return {
    async closePlateWithEscape(): Promise<void> {
      await page.keyboard.press('Escape');
      await expect(plate).toHaveCount(0);
    },
    async expectDecodeError(): Promise<void> {
      await expect(plate.getByRole('alert')).toContainText(DECODE_ERROR_TEXT);
      await expect(plateImage).toHaveCount(0);
      await expect(uploadButton).toHaveAccessibleName(UPLOAD_LABEL);
    },
    async expectFirstButtonFocused(): Promise<void> {
      await expect(plate).toBeVisible();
      await expect(uploadButton).toBeFocused();
    },
    async expectFocusInsidePlate(): Promise<void> {
      await expect(plate.locator(':focus')).toHaveCount(1);
    },
    async expectInitialsEverywhere(persona: PersonaValue): Promise<void> {
      await waitForReadyProfileButton();
      await expect(profileButtonImage).toHaveCount(0);

      await openMenu();
      await expect(headerAvatarImage).toHaveCount(0);
      await expect(getPersonaItem(persona)).toBeVisible();
      await expect(getPersonaAvatarImage(persona)).toHaveCount(0);
      await closeMenu();
    },
    async expectNoHorizontalScroll(): Promise<void> {
      expect(await page.evaluate<boolean>(HAS_HORIZONTAL_SCROLL_SCRIPT)).toBe(false);
    },
    async expectNoPhotoActions(): Promise<void> {
      await expect(uploadButton).toHaveAccessibleName(UPLOAD_LABEL);
      await expect(removeButton).toHaveCount(0);
    },
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expect(plate).toBeVisible();
      await expectNoAxeViolations(page);
    },
    async expectPhotoActions(): Promise<void> {
      await expect(uploadButton).toHaveAccessibleName(REPLACE_LABEL);
      await expect(removeButton).toBeVisible();
    },
    async expectPhotoEverywhere(persona: PersonaValue): Promise<void> {
      await waitForReadyProfileButton();
      await expectImageDecoded(profileButtonImage);

      await openMenu();
      await expectImageDecoded(headerAvatarImage);
      await expect(getPersonaItem(persona)).toBeVisible();
      await expectImageDecoded(getPersonaAvatarImage(persona));
      await closeMenu();
    },
    async expectPhotoInPlate(): Promise<void> {
      await expectImageDecoded(plateImage);
    },
    async expectPlateClosed(): Promise<void> {
      await expect(plate).toHaveCount(0);
    },
    async expectPlateInsideViewport(): Promise<void> {
      await expect(plate).toBeVisible();
      await expect(uploadButton).toBeVisible();
      await expect(removeButton).toBeVisible();

      const viewportWidth = page.viewportSize()?.width ?? 0;
      const box = await plate.boundingBox();

      expect(box).not.toBeNull();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
      expect((box?.x ?? 0) + (box?.width ?? viewportWidth + 1)).toBeLessThanOrEqual(viewportWidth + VIEWPORT_EDGE_TOLERANCE_PX);
    },
    async expectProfileButtonFocused(): Promise<void> {
      await expect(profileButton).toBeFocused();
    },
    async followCompanyLink(): Promise<void> {
      await companyLink.click();
      await expect(plate).toHaveCount(0);
    },
    async followSystemTheme(): Promise<void> {
      await page.addInitScript({ content: createStoreSystemThemeScript() });
    },
    async open(hash: string): Promise<void> {
      await page.goto(`./${hash}`);
      await waitForReadyProfileButton();
    },
    async openPlate(): Promise<void> {
      await openMenu();
      await myProfileItem.click();
      await expect(menu).toHaveCount(0);
      await expect(plate).toBeVisible();
      await expect(uploadButton).toBeVisible();
    },
    async reload(): Promise<void> {
      await page.reload();
      await waitForReadyProfileButton();
    },
    async removePhoto(): Promise<void> {
      await removeButton.click();
      await expect(removeButton).toHaveCount(0);
      await expect(uploadButton).toHaveAccessibleName(UPLOAD_LABEL);
      await expect(plateImage).toHaveCount(0);
    },
    async uploadBrokenFile(): Promise<void> {
      await uploadInput.setInputFiles({
        buffer: Buffer.from('это не картинка'),
        mimeType: 'image/png',
        name: 'broken.png',
      });
    },
    async uploadPattern(): Promise<void> {
      await uploadInput.setInputFiles({
        buffer: await readPatternPng(),
        mimeType: 'image/png',
        name: 'pattern.png',
      });
      await expect(removeButton).toBeVisible();
      await expect(uploadButton).toHaveAccessibleName(REPLACE_LABEL);
    },
  };
};
