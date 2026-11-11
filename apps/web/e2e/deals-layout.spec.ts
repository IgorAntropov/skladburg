import { DealStatus } from '@skladburg/contracts/deal/v1/deal';
import { DocumentType } from '@skladburg/contracts/document/v1/document';

import {
  GOLDEN_APPLES,
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import {
  toObjectHash,
  toSectionHash,
} from './fixtures/routes.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import {
  DESKTOP_VIEWPORT,
  PHONE_VIEWPORT,
} from './fixtures/viewports.ts';
import { toListingRoute } from './robots/catalog-robot.ts';
import { createDealRobot } from './robots/deal-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';

const DEALS_ADDRESS = toSectionHash('deals');
const CLOSED_DEAL_ADDRESS = '#/deals/d4000000-0000-4000-8000-000000000001';

test.use({ reducedMotion: 'reduce' });

for (const viewport of [DESKTOP_VIEWPORT, { height: 768, width: 1024 }, PHONE_VIEWPORT]) {
  test(`keeps the deals board and restores row focus at ${String(viewport.width)}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await createPersonaRobot(page).openAsPersona(DEALS_ADDRESS, PERSONAS.freshCustomer.id);

    const board = page.getByTestId('deals-board');
    const closedTab = board.locator('[role="tab"][id$="-trigger-closed"]');
    const row = board.getByTestId('deal-row').last();
    const inspector = page.getByTestId('deal-inspector');
    const deal = createDealRobot(page);

    await closedTab.click();
    await expect(row).toBeVisible();
    const address = await row.getAttribute('href');
    const originalRow = await row.elementHandle();
    await row.focus();
    await page.keyboard.press('Enter');

    await deal.expectStatus(DealStatus.CLOSED);
    await expect(row).toHaveAttribute('aria-current', 'page');
    expect(await originalRow.evaluate(element => element.isConnected)).toBe(true);
    await expect(inspector.getByTestId('deal-tracker')).toBeVisible();

    await page.locator('h2 + button').click();
    await expect(inspector).toHaveCount(0);
    await expect(closedTab).toHaveAttribute('aria-selected', 'true');
    await expect(row).toBeFocused();

    await page.goBack();
    await expect(row).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => new URL(page.url()).hash).toBe(address);

    await page.reload();
    await deal.expectStatus(DealStatus.CLOSED);
    await expect(closedTab).toHaveAttribute('aria-selected', 'true');
    await expect(row).toHaveAttribute('aria-current', 'page');
  });
}

test('preserves the scroll position when opening and closing a deal', async ({ page }) => {
  await page.setViewportSize({ height: 340, width: DESKTOP_VIEWPORT.width });
  await createPersonaRobot(page).openAsPersona(DEALS_ADDRESS, PERSONAS.freshCustomer.id);

  const board = page.getByTestId('deals-board');
  await board.locator('[role="tab"][id$="-trigger-closed"]').click();
  const row = board.getByTestId('deal-row').last();
  const panel = board.getByRole('tabpanel');
  await row.evaluate((element) => {
    element.focus({ preventScroll: true });
  });
  const scrollTop = await panel.evaluate((element) => {
    element.scrollTop = 37;
    return element.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);

  await page.keyboard.press('Enter');
  await createDealRobot(page).expectStatus(DealStatus.CLOSED);
  expect(await panel.evaluate(element => element.scrollTop)).toBe(scrollTop);
  await page.locator('h2 + button').click();
  await expect(row).toBeFocused();
  expect(await panel.evaluate(element => element.scrollTop)).toBe(scrollTop);
});

test('opens a search result and returns to the previous deal in its group', async ({ page }) => {
  await createPersonaRobot(page).openAsPersona(toObjectHash(toListingRoute(GOLDEN_APPLES.id)), PERSONAS.freshCustomer.id);

  const board = page.getByTestId('deals-board');
  const closedTab = board.locator('[role="tab"][id$="-trigger-closed"]');
  const mineTab = board.locator('[role="tab"][id$="-trigger-mine"]');
  const selectedRow = board.getByTestId('deal-row').and(page.locator('[aria-current="page"]'));
  const deal = createDealRobot(page);

  const draftAddress = await deal.createDraft(OWN_NETWORK_SITES[0].id, '480');
  await expect(mineTab).toHaveAttribute('aria-selected', 'true');
  await deal.openFromSearch(CLOSED_DEAL_ADDRESS, '1001');
  await expect(closedTab).toHaveAttribute('aria-selected', 'true');
  await expect(selectedRow).toHaveAttribute('href', CLOSED_DEAL_ADDRESS);

  await page.goBack();
  await deal.expectStatus(DealStatus.DRAFT);
  await expect(mineTab).toHaveAttribute('aria-selected', 'true');
  await expect(selectedRow).toHaveAttribute('href', draftAddress);
});

test('opens the group of a directly linked document after resolving the deal', async ({ page }) => {
  const persona = createPersonaRobot(page);
  await persona.openAsPersona(CLOSED_DEAL_ADDRESS, PERSONAS.freshCustomer.id);
  const invoice = page.getByTestId(`deal-document-${String(DocumentType.INVOICE)}`);
  const documentId = await invoice.getAttribute('data-document-id');
  if (documentId === null) {
    throw new Error('Expected the seeded invoice to have an ID');
  }

  await page.goto('about:blank');
  let releaseIndex: (() => void) | undefined;
  const index = new Promise<void>((resolve) => {
    releaseIndex = resolve;
  });
  await page.route('**/assets/documentIndex-*.js', async (route) => {
    await index;
    await route.continue();
  });

  const board = page.getByTestId('deals-board');
  const closedTab = board.locator('[role="tab"][id$="-trigger-closed"]');
  try {
    await persona.openAsPersona(`#/documents/${documentId}`, PERSONAS.freshCustomer.id);
    await expect(closedTab).toHaveAttribute('aria-selected', 'false');
  }
  finally {
    releaseIndex?.();
  }

  const documentView = page.getByTestId('deal-document-view');
  await expect(documentView).toBeVisible();
  await expect(documentView.getByRole('heading', { level: 3 })).toBeFocused();
  await expect(closedTab).toHaveAttribute('aria-selected', 'true');
  await expect(board.getByTestId('deal-row').and(page.locator('[aria-current="page"]'))).toHaveAttribute('href', CLOSED_DEAL_ADDRESS);
});
