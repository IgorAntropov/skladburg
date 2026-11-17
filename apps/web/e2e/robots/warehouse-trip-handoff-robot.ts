import type {
  Locator,
  Page,
} from '@playwright/test';

import {
  toObjectHash,
  toWarehouseRoute,
} from '../fixtures/routes.ts';
import { expect } from '../fixtures/test.ts';
import { scanCode } from './warehouse-delivery-robot.ts';

export const TRIP_ORIGIN_WAREHOUSE_ID = '80000011-0000-4000-8000-000000000000';

interface ScannedTripPalletValue {
  confirmPicking: () => Promise<void>;
  confirmShipment: () => Promise<void>;
  sscc: string;
}

export const openTripPicking = async (page: Page): Promise<Locator> => {
  await expect(page.getByTestId('deal-mark-shipped')).toHaveCount(0);
  await page.getByTestId('deal-open-warehouse').click();
  await expect.poll(() => new URL(page.url()).hash).toBe(toObjectHash(toWarehouseRoute(TRIP_ORIGIN_WAREHOUSE_ID)));

  const picking = page.getByTestId('warehouse-picking-task');
  await expect(picking).toBeVisible();

  return picking;
};

export const scanTripPallet = async (picking: Locator): Promise<ScannedTripPalletValue> => {
  await picking.getByTestId('warehouse-claim-picking').click();
  const pallet = picking.getByTestId('warehouse-pick-unit');
  await expect(pallet).toHaveCount(1);
  const sscc = await picking.getByText(/^09\d{16}$/u).innerText();
  await scanCode(picking, `]C100${sscc}`, true);
  await expect(pallet).toHaveAttribute('aria-pressed', 'true');
  const shipment = picking.getByTestId('warehouse-confirm-shipment');

  return {
    async confirmPicking(): Promise<void> {
      await picking.getByTestId('warehouse-confirm-picking').click();
      await expect(shipment).toBeEnabled();
    },
    async confirmShipment(): Promise<void> {
      await shipment.click();
      await expect(shipment).toHaveCount(0);
    },
    sscc,
  };
};

export const scanDeliveredPallet = async (receiving: Locator, sscc: string, isAlreadyClaimed = false): Promise<Locator> => {
  if (!isAlreadyClaimed) {
    await receiving.getByTestId('warehouse-claim-receiving').click();
  }
  await expect(receiving.getByText(sscc, { exact: true })).toBeVisible();
  await receiving.getByTestId('warehouse-enter-sscc').click();
  const form = receiving.getByTestId('warehouse-receive-form');
  await scanCode(form, `]C100${sscc}`, true);
  await expect(form.locator('input[name="sscc"]')).toHaveValue(sscc);

  return form.getByTestId('warehouse-receive-submit');
};

export const scanPutAwayCell = async (placement: Locator): Promise<string> => {
  const select = placement.locator('select');
  const option = select.locator('option').nth(1);
  const cellCode = await option.innerText();
  const cellId = await option.getAttribute('value');
  if (cellId === null) {
    throw new Error('Missing placement cell ID');
  }
  await scanCode(placement, cellCode, true);
  await expect(select).toHaveValue(cellId);

  return cellCode;
};
