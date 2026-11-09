import { expectNoAxeViolations } from './fixtures/axe.ts';
import { PERSONAS } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

test('isolates carrier fleets and denies a customer opening the garage on a phone', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const persona = createPersonaRobot(page);

  await persona.openAsPersona('#/garage', PERSONAS.freshCarrier.id);
  await persona.expectCurrentPersona(PERSONAS.freshCarrier);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('page-garage')).toBeVisible();
  await expect(page.getByTestId('garage-vehicle-row')).toHaveCount(3);
  await expect(page.getByTestId('garage-vehicle-row').first()).toContainText('А001АА 000');
  await expect(page.locator('canvas')).toHaveCount(0);

  await page.getByTestId('garage-vehicle-row-edit').first().click();
  const vehicle = page.getByTestId('garage-vehicle-form');
  await vehicle.getByTestId('garage-vehicle-payload').locator('input').fill('21000000');
  await persona.selectPersona(PERSONAS.constructionCarrier);
  await expect(vehicle).toHaveCount(0);
  await expect(page.getByTestId('garage-vehicle-row')).toHaveCount(3);
  await expect(page.getByTestId('garage-vehicle-row').first()).toContainText('А004АА 000');
  await expect(page.getByTestId('garage-vehicle-row').filter({ hasText: 'А001АА 000' })).toHaveCount(0);

  await persona.selectPersona(PERSONAS.freshCustomer);
  await persona.expectCurrentPersona(PERSONAS.freshCustomer);
  await expect(page.getByTestId('page-garage')).toHaveCount(0);
  await expect(page.getByTestId('garage-vehicle-row')).toHaveCount(0);
});

test('protects unsaved fleet changes and persists edits in all three lists', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const persona = createPersonaRobot(page);
  await persona.openAsPersona('#/garage', PERSONAS.freshCarrier.id);
  const garage = page.getByTestId('page-garage');
  const tabs = garage.getByRole('tab');
  const save = garage.getByTestId('garage-save');

  await garage.getByTestId('garage-vehicle-row-edit').first().click();
  const vehicle = garage.getByTestId('garage-vehicle-form');
  const payload = vehicle.getByTestId('garage-vehicle-payload').locator('input');
  await payload.fill('21000000');
  await page.setViewportSize({ height: 390, width: 844 });
  await expect(payload).toHaveValue('21000000');
  await page.setViewportSize({ height: 844, width: 390 });
  await garage.getByTestId('garage-cancel').click();
  await expect(garage.getByTestId('garage-leave-confirm')).toBeVisible();
  await garage.getByTestId('garage-leave-confirm-stay').click();
  await expect(payload).toHaveValue('21000000');
  await vehicle.getByTestId('garage-vehicle-remove-window').first().click();
  await save.click();
  await expect(vehicle).toHaveCount(0);
  await garage.getByTestId('garage-vehicle-row-edit').first().click();
  await expect(payload).toHaveValue('21000000');
  await expect(vehicle.getByTestId('garage-vehicle-window')).toHaveCount(0);
  await garage.getByTestId('garage-cancel').click();

  await tabs.nth(1).click();
  await garage.getByTestId('garage-drivers-add').click();
  const driver = garage.getByTestId('garage-driver-form');
  const name = driver.getByTestId('garage-driver-name').locator('input');
  await name.fill('Родион Соснин');
  await save.click();
  await expect(driver).toHaveCount(0);
  await expect(garage.getByTestId('garage-driver-row')).toHaveCount(4);
  await expect(garage.getByTestId('garage-driver-row').filter({ hasText: 'Родион Соснин' })).toBeVisible();

  await tabs.nth(2).click();
  await garage.getByTestId('garage-lane-row-edit').first().click();
  const lane = garage.getByTestId('garage-lane-form');
  await expect(lane.getByTestId('garage-lane-from').locator('select')).not.toHaveValue('');
  await expect(lane.getByTestId('garage-lane-to').locator('select')).not.toHaveValue('');
  await lane.getByTestId('garage-lane-tariff').locator('input').fill('41234,56');
  await lane.getByTestId('garage-lane-monday').click();
  await save.click();
  await expect(lane).toHaveCount(0);
  await garage.getByTestId('garage-lane-row-edit').first().click();
  await expect(lane.getByTestId('garage-lane-tariff').locator('input')).toHaveValue('41234,56');
  await expect(lane.getByTestId('garage-lane-monday').locator('input')).not.toBeChecked();
});

test('has no accessibility violations in the garage and its vehicle editor', async ({ page }) => {
  const persona = createPersonaRobot(page);
  await persona.openAsPersona('#/garage', PERSONAS.freshCarrier.id);
  const garage = page.getByTestId('page-garage');

  await expect(garage.getByTestId('garage-vehicle-row').first()).toBeVisible();
  await expectNoAxeViolations(page);
  await garage.getByTestId('garage-vehicle-row-edit').first().click();
  await expect(garage.getByTestId('garage-vehicle-form')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('keeps a stale driver form blocked after the other tab saves a newer version', async ({ page }) => {
  const otherPage = await page.context().newPage();
  const firstPersona = createPersonaRobot(page);
  const secondPersona = createPersonaRobot(otherPage);

  try {
    await firstPersona.openAsPersona('#/garage', PERSONAS.freshCarrier.id);
    await secondPersona.openAsPersona('#/garage', PERSONAS.freshCarrier.id);
    const firstGarage = page.getByTestId('page-garage');
    const secondGarage = otherPage.getByTestId('page-garage');

    await firstGarage.getByRole('tab').nth(1).click();
    await secondGarage.getByRole('tab').nth(1).click();
    await firstGarage.getByTestId('garage-driver-row-edit').first().click();
    await secondGarage.getByTestId('garage-driver-row-edit').first().click();

    await firstGarage.getByTestId('garage-driver-name').locator('input').fill('Семён Коренев');
    await firstGarage.getByTestId('garage-save').click();
    await expect(firstGarage.getByTestId('garage-driver-form')).toHaveCount(0);

    const secondName = secondGarage.getByTestId('garage-driver-name').locator('input');
    const secondSave = secondGarage.getByTestId('garage-save');
    await secondName.fill('Владимир Брусин');
    await secondSave.click();
    await expect(secondSave).toHaveAttribute('aria-disabled', 'true');
    await expect(secondSave).not.toHaveAttribute('aria-busy', 'true');
    await secondName.fill('Степан Брусин');
    await expect(secondSave).toHaveAttribute('aria-disabled', 'true');

    await secondGarage.getByTestId('garage-cancel').click();
    await secondGarage.getByTestId('garage-leave-confirm-leave').click();
    await expect(secondGarage.getByTestId('garage-driver-row').first()).toContainText('Семён Коренев');
  }
  finally {
    await otherPage.close();
  }
});
