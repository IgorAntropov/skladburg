import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import { expectNoAxeViolations } from '../fixtures/axe.ts';
import { createSleepScript } from './scene-draw-counter.ts';

const SILENCE_OBSERVATION_MS = 1500;
const IS_OVERFLOWING_SCRIPT = `(() => {
  const element = document.querySelector('[data-testid="assistant-replica-scroll"]');

  return element !== null && element.scrollHeight > element.clientHeight;
})()`;

export interface AssistantRobotValue {
  closeReplica: () => Promise<void>;
  dismissReplica: (kind: ReplicaKindValue) => Promise<void>;
  expectNoReplica: () => Promise<void>;
  expectNoReplicaFor: (kind: ReplicaKindValue) => Promise<void>;
  expectNoViolationsOfAccessibility: (kind: ReplicaKindValue) => Promise<void>;
  expectQuietMode: (isOn: boolean) => Promise<void>;
  expectReplica: (kind: ReplicaKindValue, importance?: ReplicaImportanceValue) => Promise<void>;
  expectReplicaText: (kind: ReplicaKindValue, text: string) => Promise<void>;
  expectReplicaWithoutText: (kind: ReplicaKindValue, text: string) => Promise<void>;
  expectScrollAreaFocusable: (kind: ReplicaKindValue) => Promise<void>;
  holdReplica: (kind: ReplicaKindValue) => Promise<void>;
  openReplicaLink: (link: ReplicaLinkValue) => Promise<void>;
  toggleQuietMode: () => Promise<void>;
}

export type ReplicaImportanceValue = 'critical' | 'important' | 'normal';

export type ReplicaKindValue = 'digest' | 'error' | 'more' | 'notification';

export type ReplicaLinkValue = 'map' | 'open' | 'organization';

export const createAssistantRobot = (page: Page): AssistantRobotValue => {
  const replicas = page.getByTestId('assistant-replica');
  const closeButton = page.getByTestId('assistant-replica-close');
  const quietModeSwitch = page.getByTestId('assistant-quiet-mode-switch');

  const getReplica = (kind: ReplicaKindValue): Locator => replicas.and(page.locator(`[data-kind="${kind}"]`));

  const expectReplica = async (kind: ReplicaKindValue, importance?: ReplicaImportanceValue): Promise<void> => {
    const replica = getReplica(kind);

    await expect(replica).toBeVisible();
    await expect(replica).toHaveCount(1);

    if (importance !== undefined) {
      await expect(replica).toHaveAttribute('data-importance', importance);
    }
  };

  const expectNoReplica = async (): Promise<void> => {
    await expect(replicas).toHaveCount(0);
  };

  return {
    async closeReplica(): Promise<void> {
      await closeButton.click();
      await expectNoReplica();
    },
    async dismissReplica(kind: ReplicaKindValue): Promise<void> {
      await expectReplica(kind);
      await closeButton.click();
      await expectNoReplica();
    },
    expectNoReplica,
    async expectNoReplicaFor(kind: ReplicaKindValue): Promise<void> {
      await page.evaluate(createSleepScript(SILENCE_OBSERVATION_MS));
      await expect(getReplica(kind)).toHaveCount(0);
    },
    async expectNoViolationsOfAccessibility(kind: ReplicaKindValue): Promise<void> {
      await expectReplica(kind);
      await expectNoAxeViolations(page);
      await expectReplica(kind);
    },
    async expectQuietMode(isOn: boolean): Promise<void> {
      await expect(quietModeSwitch).toHaveAttribute('aria-checked', String(isOn));
    },
    expectReplica,
    async expectReplicaText(kind: ReplicaKindValue, text: string): Promise<void> {
      await expect(getReplica(kind)).toContainText(text);
    },
    async expectReplicaWithoutText(kind: ReplicaKindValue, text: string): Promise<void> {
      const replica = getReplica(kind);

      await expect(replica).toBeVisible();
      await expect(replica).not.toContainText(text);
    },
    async expectScrollAreaFocusable(kind: ReplicaKindValue): Promise<void> {
      const scrollArea = getReplica(kind).getByTestId('assistant-replica-scroll');

      await expect(scrollArea).toHaveAttribute('tabindex', '0');
      await expect(scrollArea).toHaveAttribute('role', 'group');
      await expect(scrollArea).toHaveAttribute('aria-labelledby', /.+/);
      const isOverflowing: unknown = await page.evaluate(IS_OVERFLOWING_SCRIPT);

      expect(isOverflowing).toBe(true);
    },
    async holdReplica(kind: ReplicaKindValue): Promise<void> {
      await getReplica(kind).hover();
    },
    async openReplicaLink(link: ReplicaLinkValue): Promise<void> {
      await page.getByTestId(`assistant-replica-link-${link}`).click();
      await expectNoReplica();
    },
    async toggleQuietMode(): Promise<void> {
      await expect(quietModeSwitch).toBeVisible();
      await quietModeSwitch.click();
    },
  };
};
