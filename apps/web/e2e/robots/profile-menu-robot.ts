import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';

import { PERSONA_COUNT } from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import {
  createReadContainsFocusScript,
  createReadOverflowScript,
  createReadScrollTopScript,
  INSTALL_ANIMATION_START_RECORDER,
  READ_RUNNING_ANIMATION_COUNT,
  READ_STARTED_ANIMATION_NAMES,
  SETTLE_FINITE_ANIMATIONS,
} from '../fixtures/pageScripts.ts';
import { getProfileButtonLabel } from '../fixtures/personaLabels.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';

const SCROLL_TOLERANCE_PX = 1;

const MENU_SELECTOR = '[role="menu"]';

const SCROLL_BLOCK_SELECTOR = '[data-testid="profile-menu-scroll"]';

const WAIT_TWO_FRAMES = 'new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(true); }); }); })';

export interface ProfileMenuRobotValue {
  clickAcceptReset: () => Promise<void>;
  clickProfileButtonWhileResetting: () => Promise<void>;
  clickRetryPersonas: () => Promise<void>;
  expectAcceptResetPending: () => Promise<void>;
  expectAcceptWidthKept: (before: number) => Promise<void>;
  expectFocusInsideMenu: () => Promise<void>;
  expectFooterShown: () => Promise<void>;
  expectLastPersonaScrolledIntoView: () => Promise<void>;
  expectMenuAnimationStarted: () => Promise<void>;
  expectMenuNotScrollable: () => Promise<void>;
  expectNoAnimationsRunning: () => Promise<void>;
  expectNoAnimationStarted: () => Promise<void>;
  expectOnlyPersonaBlockScrollable: () => Promise<void>;
  expectPersonaLoadError: () => Promise<void>;
  expectPersonaSkeletonFilled: (hasPulse: boolean) => Promise<void>;
  expectPersonasListed: () => Promise<void>;
  expectPressTransition: (duration: RegExp | string) => Promise<void>;
  expectProfileButtonReady: (persona: PersonaValue) => Promise<void>;
  expectProfileButtonResetting: () => Promise<void>;
  expectResetItemShownWholeWithoutScroll: () => Promise<void>;
  expectRetryItemAbsent: () => Promise<void>;
  focusResetWithEnd: () => Promise<void>;
  installAnimationStartRecorder: () => Promise<void>;
  readAcceptWidth: () => Promise<number>;
  settleAnimations: () => Promise<void>;
}

interface BoxValue {
  height: number;
  width: number;
  x: number;
  y: number;
}

export const createProfileMenuRobot = (page: Page): ProfileMenuRobotValue => {
  const { button, buttonIncludingHidden, menu, personaItems, resetItem } = createProfileMenuLocators(page);
  const scrollBlock = page.getByTestId('profile-menu-scroll');
  const footer = page.getByTestId('profile-menu-footer');
  const resetConfirm = page.getByRole('group', { name: getText('demo.reset.confirm.prompt') });
  const cancelResetButton = resetConfirm.getByRole('button', { exact: true, name: getText('demo.reset.confirm.cancel') });
  const acceptResetButton = resetConfirm.getByRole('button', { name: getText('demo.reset.confirm.accept') });
  const pendingAcceptResetButton = resetConfirm.getByRole('button', { name: getText('demo.reset.pending') });
  const retryItem = menu.getByRole('menuitem', { name: getText('persona.loadError.retry') });
  const personaSkeleton = menu.getByRole('status', { name: getText('persona.loading') });

  const readOverflowPx = (selector: string): Promise<null | number> => page.evaluate<null | number>(createReadOverflowScript(selector));

  const readScrollTop = (): Promise<null | number> => page.evaluate<null | number>(createReadScrollTopScript(SCROLL_BLOCK_SELECTOR));

  const readBox = async (target: Locator, description: string): Promise<BoxValue> => {
    const box = await target.boundingBox();

    if (box === null) {
      throw new Error(`The box of ${description} is not available`);
    }

    return box;
  };

  const readViewport = (): { height: number; width: number } => {
    const size = page.viewportSize();

    if (size === null) {
      throw new Error('The viewport is not set');
    }

    return size;
  };

  const expectInside = async (inner: Locator, outer: BoxValue, description: string): Promise<void> => {
    const box = await readBox(inner, description);

    expect(box.x, `${description} left`).toBeGreaterThanOrEqual(outer.x - SCROLL_TOLERANCE_PX);
    expect(box.y, `${description} top`).toBeGreaterThanOrEqual(outer.y - SCROLL_TOLERANCE_PX);
    expect(box.x + box.width, `${description} right`).toBeLessThanOrEqual(outer.x + outer.width + SCROLL_TOLERANCE_PX);
    expect(box.y + box.height, `${description} bottom`).toBeLessThanOrEqual(outer.y + outer.height + SCROLL_TOLERANCE_PX);
  };

  const expectMenuNotScrollable = async (): Promise<void> => {
    await expect(menu).toBeVisible();
    expect(await readOverflowPx(MENU_SELECTOR), 'the menu itself does not scroll').toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
  };

  const settleAnimations = async (): Promise<void> => {
    await page.evaluate<number>(SETTLE_FINITE_ANIMATIONS);
  };

  const waitTwoFrames = async (): Promise<void> => {
    await page.evaluate(WAIT_TWO_FRAMES);
  };

  return {
    async clickAcceptReset(): Promise<void> {
      await acceptResetButton.click();
    },
    async clickProfileButtonWhileResetting(): Promise<void> {
      await button.click({ force: true });
      await waitTwoFrames();
      await expect(menu).toHaveCount(0);
      await expect(button).toHaveAttribute('aria-expanded', 'false');

      await button.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await waitTwoFrames();
      await expect(menu).toHaveCount(0);
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    },
    async clickRetryPersonas(): Promise<void> {
      await retryItem.click();
    },
    async expectAcceptResetPending(): Promise<void> {
      await expect(pendingAcceptResetButton).toHaveAttribute('aria-busy', 'true');
      await expect(pendingAcceptResetButton).toHaveAttribute('aria-disabled', 'true');
      await expect(cancelResetButton).toBeDisabled();
    },
    async expectAcceptWidthKept(before: number): Promise<void> {
      await expect.poll(async () => Math.abs((await readBox(pendingAcceptResetButton, 'the pending accept button')).width - before))
        .toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
    },
    async expectFocusInsideMenu(): Promise<void> {
      await expect.poll(() => page.evaluate<boolean | null>(createReadContainsFocusScript(MENU_SELECTOR))).toBe(true);
    },
    async expectFooterShown(): Promise<void> {
      await expect(footer).toBeInViewport({ ratio: 1 });
    },
    async expectLastPersonaScrolledIntoView(): Promise<void> {
      const lastPersona = personaItems.last();

      expect(await readScrollTop()).toBe(0);

      await lastPersona.focus();
      await expect(lastPersona).toBeFocused();
      await expect.poll(readScrollTop).toBeGreaterThan(0);

      await expectInside(lastPersona, await readBox(scrollBlock, 'the persona block'), 'the last persona');
      await expect(lastPersona).toBeInViewport({ ratio: 1 });
    },
    async expectMenuAnimationStarted(): Promise<void> {
      await expect.poll(() => page.evaluate<string[]>(READ_STARTED_ANIMATION_NAMES)).toContain('menu-in');
    },
    expectMenuNotScrollable,
    async expectNoAnimationsRunning(): Promise<void> {
      await waitTwoFrames();
      await expect.poll(() => page.evaluate<number>(READ_RUNNING_ANIMATION_COUNT)).toBe(0);
    },
    async expectNoAnimationStarted(): Promise<void> {
      await waitTwoFrames();
      expect(await page.evaluate<string[]>(READ_STARTED_ANIMATION_NAMES)).toEqual([]);
    },
    async expectOnlyPersonaBlockScrollable(): Promise<void> {
      await expectMenuNotScrollable();
      await expect(scrollBlock).toBeVisible();
      expect(await readOverflowPx(SCROLL_BLOCK_SELECTOR), 'the persona block scrolls').toBeGreaterThan(SCROLL_TOLERANCE_PX);
      await expect(footer).toBeInViewport({ ratio: 1 });
      await expect(resetItem).toBeInViewport({ ratio: 1 });
      await expectInside(resetItem, await readBox(menu, 'the menu'), 'the reset item');
    },
    async expectPersonaLoadError(): Promise<void> {
      await expect(retryItem).toBeVisible();
    },
    async expectPersonaSkeletonFilled(hasPulse: boolean): Promise<void> {
      await expect(personaSkeleton).toBeVisible();

      const block = personaSkeleton.locator('div[aria-hidden="true"]').first();

      await expect(block).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

      if (hasPulse) {
        await expect(block).toHaveCSS('animation-name', 'skeleton-pulse');

        return;
      }

      await expect(block).toHaveCSS('animation-name', 'none');
    },
    async expectPersonasListed(): Promise<void> {
      await expect(personaItems).toHaveCount(PERSONA_COUNT);
    },
    async expectPressTransition(duration: RegExp | string): Promise<void> {
      await expect(button).toHaveCSS('transition-duration', duration);
      await expect(cancelResetButton).toHaveCSS('transition-duration', duration);
      await expect(acceptResetButton).toHaveCSS('transition-duration', duration);
    },
    async expectProfileButtonReady(persona: PersonaValue): Promise<void> {
      await expect(button).not.toHaveAttribute('aria-busy', 'true');
      await expect(button).toHaveAccessibleName(getProfileButtonLabel(persona));
    },
    async expectProfileButtonResetting(): Promise<void> {
      await expect(buttonIncludingHidden).toHaveAttribute('aria-busy', 'true');
      await expect(buttonIncludingHidden).toHaveAccessibleName(getText('profile.button.resetting'));
    },
    async expectResetItemShownWholeWithoutScroll(): Promise<void> {
      await expectMenuNotScrollable();
      expect(await readOverflowPx(SCROLL_BLOCK_SELECTOR), 'the persona block does not scroll').toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
      await expect(resetItem).toBeVisible();
      await expect(resetItem).toBeInViewport({ ratio: 1 });
      await expectInside(resetItem, await readBox(menu, 'the menu'), 'the reset item');

      const viewport = readViewport();
      const menuBox = await readBox(menu, 'the menu');

      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
    },
    async expectRetryItemAbsent(): Promise<void> {
      await expect(retryItem).toHaveCount(0);
    },
    async focusResetWithEnd(): Promise<void> {
      await page.keyboard.press('End');
      await expect(resetItem).toBeFocused();
      await expect(resetItem).toBeInViewport({ ratio: 1 });
    },
    async installAnimationStartRecorder(): Promise<void> {
      await page.evaluate(INSTALL_ANIMATION_START_RECORDER);
    },
    async readAcceptWidth(): Promise<number> {
      return (await readBox(acceptResetButton, 'the accept button')).width;
    },
    settleAnimations,
  };
};
