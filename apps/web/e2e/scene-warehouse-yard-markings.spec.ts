import type {
  Locator,
  Page,
  TestInfo,
} from '@playwright/test';

import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardDispatchOutcome,
} from '@skladburg/contracts/wms/v1/receiving';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import type { SceneRobotValue } from './robots/scene-robot.ts';
import type {
  YardPlateCornersValue,
  YardPlateFaceValue,
  YardScreenPointValue,
} from './robots/yard-marking-scene-probe.ts';

import { PERSONAS } from './fixtures/demoData.ts';
import { createStoreGraphicsPreferenceScript } from './fixtures/graphicsPreference.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import {
  openYardVehicleMarkings,
  prepareYardVehicleMarkings,
  YARD_MARKINGS_SCOPE,
} from './fixtures/yardVehicleMarkings.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import {
  installYardMarkingSceneProbe,
  projectYardPlateCorners,
  readYardMarkingSceneProbe,
  readYardZoomCssPx,
} from './robots/yard-marking-scene-probe.ts';
import { readYardPlateRaster } from './robots/yard-plate-raster.ts';

const VIEWPORT = { height: 900, width: 1920 };
const MAX_ZOOM = 96;
const WORK_ZOOM = 64;
const ZOOM_TOLERANCE = 0.2;
const REST_MS = 700;
const CANVAS_ONLY_STYLE = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }';
const LEVELS = ['low', 'medium', 'high'] as const;
const NIGHT_DRAW_BUDGET = { high: 35, low: 29, medium: 29 } as const;
const CONDITIONS = [{ dpr: 1, time: 'day' }, { dpr: 1, time: 'night' }, { dpr: 2, time: 'day' }, { dpr: 2, time: 'night' }] as const;
const LOGO_WITH_MISSING_IMAGE = '/logos/carrier-2-light.svg';
const LOGO_WITH_IMAGE = '/logos/carrier-1-light.svg';

interface ReadableMarkingValue {
  contrast: number;
  face: YardPlateFaceValue;
  glyphSlots: boolean[];
  inkHeightCssPx: number;
  paperRatio: number;
  zoomCssPxPerMeter: number;
}

interface YardMarkingSceneValue {
  canvas: Locator;
  page: Page;
  scene: SceneRobotValue;
}

const prepareScene = async (page: Page, hasPoseHistory = false): Promise<YardMarkingSceneValue> => {
  await page.addInitScript({ content: createStoreGraphicsPreferenceScript('low') });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  await page.addInitScript(installYardMarkingSceneProbe, hasPoseHistory);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: hasPoseHistory ? 'no-preference' : 'reduce' });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  scene.watchLogoRequests();
  return { canvas: page.getByTestId('scene-viewport').locator('canvas'), page, scene };
};

const watchYardBrandPainting = async (page: Page): Promise<void> => {
  await page.route(`**${LOGO_WITH_MISSING_IMAGE}`, route => route.fulfill({ status: 404 }));
  await page.addInitScript((logoPath) => {
    const brands = { imageCells: new Set<string>(), monogramCells: new Set<string>() };
    Object.defineProperty(window, '__yardBrandPainting', { value: brands });
    const getCell = (context: CanvasRenderingContext2D): string => {
      const { e, f } = context.getTransform();
      return `${String(e)},${String(f)}`;
    };
    const prototype = CanvasRenderingContext2D.prototype;
    const original = Object.create(null, Object.getOwnPropertyDescriptors(prototype)) as CanvasRenderingContext2D;
    prototype.drawImage = function (this: CanvasRenderingContext2D, image, ...args: number[]): void {
      if (image instanceof HTMLImageElement && image.src.endsWith(logoPath)) {
        brands.imageCells.add(getCell(this));
      }
      original.drawImage.apply(this, [image, ...args] as Parameters<CanvasRenderingContext2D['drawImage']>);
    };
    prototype.fillText = function (this: CanvasRenderingContext2D, text, x, y, maxWidth): void {
      if (this.font.startsWith('800 42px') && text === 'ШП') {
        brands.monogramCells.add(getCell(this));
      }
      original.fillText.call(this, text, x, y, maxWidth);
    };
  }, LOGO_WITH_IMAGE);
};

const getCanvasBox = async ({ canvas }: YardMarkingSceneValue): Promise<{ height: number; width: number; x: number; y: number }> => {
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error('The warehouse yard canvas must be visible');
  }
  return box;
};

const readCameraZoom = async (yard: YardMarkingSceneValue): Promise<number> => {
  const { width } = await getCanvasBox(yard);
  return readYardZoomCssPx(await readYardMarkingSceneProbe(yard.page), width);
};

const expectCameraZoom = async (yard: YardMarkingSceneValue, desiredZoom: number): Promise<void> => {
  await expect.poll(async () => Math.abs(await readCameraZoom(yard) - desiredZoom), {
    message: `WebGL orthographic camera at ${String(desiredZoom)} CSS px per meter`,
  }).toBeLessThanOrEqual(ZOOM_TOLERANCE);
};

const readyForMarks = async ({ page, scene }: YardMarkingSceneValue, expectedCount: number): Promise<void> => {
  await scene.expectOneCanvas();
  await scene.expectSceneState('ready');
  await scene.waitForCameraControls();
  await expect.poll(async () => (await readYardMarkingSceneProbe(page)).markedTruckInstances, {
    message: 'marking data has reached all rendered trucks',
  }).toBe(expectedCount);
  await scene.waitForIdle();
};

const openWarehouseTasks = async (page: Page): Promise<void> => {
  await page.getByRole('tab').and(page.locator('[id$="-trigger-tasks"]')).press('Enter');
  await expect(page.getByTestId('warehouse-yard-dispatch')).toHaveCount(0);
};

const zoomToWorkingView = async (yard: YardMarkingSceneValue): Promise<void> => {
  for (let step = 0; step < 12; step += 1) {
    const current = await readCameraZoom(yard);
    if (Math.abs(MAX_ZOOM - current) <= ZOOM_TOLERANCE) {
      break;
    }
    await focusPlate(yard);
    const before = await yard.scene.readDrawFrames();
    await yard.scene.pressCameraButton('zoom-in');
    await yard.scene.waitForDrawFramesToExceed(before, 'the zoom button updates the WebGL scene');
    await yard.scene.waitForIdle();
  }
  await expectCameraZoom(yard, MAX_ZOOM);
  await yard.scene.pressCameraButton('zoom-out');
  await expectCameraZoom(yard, WORK_ZOOM);
  await yard.scene.waitForIdle();
};

const getVisiblePlate = async (yard: YardMarkingSceneValue): Promise<{ corners: YardPlateCornersValue; face: YardPlateFaceValue }> => {
  const box = await getCanvasBox(yard);
  const probe = await readYardMarkingSceneProbe(yard.page);
  expect(probe.instance).toHaveLength(16);
  expect(probe.modelView).toHaveLength(16);
  expect(probe.markedTruckInstances).toBe(1);
  const front = projectYardPlateCorners(probe, 'front', box.width, box.height);
  return front.topLeft.x < front.topRight.x
    ? { corners: front, face: 'front' }
    : { corners: projectYardPlateCorners(probe, 'rear', box.width, box.height), face: 'rear' };
};

const focusPlate = async (yard: YardMarkingSceneValue): Promise<void> => {
  const area = await yard.page.getByTestId('hud-free-area').boundingBox();
  if (area === null) {
    throw new Error('The camera needs a free area between HUD panels');
  }
  const center = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
  const getOffset = async (): Promise<YardScreenPointValue> => {
    const { corners: { bottomLeft, topRight } } = await getVisiblePlate(yard);
    const canvas = await getCanvasBox(yard);
    return { x: center.x - canvas.x - (topRight.x + bottomLeft.x) / 2, y: center.y - canvas.y - (topRight.y + bottomLeft.y) / 2 };
  };
  for (let step = 0; step < 8; step += 1) {
    const offset = await getOffset();
    if (Math.abs(offset.x) < 60 && Math.abs(offset.y) < 60) {
      break;
    }
    const dx = Math.max(-area.width / 2, Math.min(area.width / 2, offset.x));
    const dy = Math.max(-area.height / 2, Math.min(area.height / 2, offset.y));
    await yard.page.mouse.move(center.x - dx / 2, center.y - dy / 2);
    await yard.page.mouse.down();
    await yard.page.mouse.move(center.x + dx / 2, center.y + dy / 2, { steps: 12 });
    await yard.page.mouse.up();
    await yard.scene.waitForIdle();
  }
  const { corners: { bottomLeft, topLeft, topRight } } = await getVisiblePlate(yard);
  const canvas = await getCanvasBox(yard);
  const bottomRight = { x: topRight.x + bottomLeft.x - topLeft.x, y: topRight.y + bottomLeft.y - topLeft.y };
  const points = [bottomLeft, bottomRight, topLeft, topRight].map(({ x, y }) => ({ x: x + canvas.x, y: y + canvas.y }));
  const areCornersVisible = await yard.canvas.evaluate((element, points) =>
    points.every(({ x, y }) => document.elementFromPoint(x, y) === element), points);
  expect(areCornersVisible, 'all four plate corners are on the unoccluded yard canvas').toBe(true);
};

const capturePlate = async (
  yard: YardMarkingSceneValue, testInfo: TestInfo, label: string, expectedNumber: string | undefined,
): Promise<ReadableMarkingValue> => {
  await focusPlate(yard);
  await yard.scene.waitForIdle();
  await yard.scene.expectNoDrawFramesFor(REST_MS);
  const { corners, face } = await getVisiblePlate(yard);
  const box = await getCanvasBox(yard);
  const framePath = testInfo.outputPath(`${label}-${face}.png`);
  const frame = await yard.canvas.screenshot({ path: framePath, scale: 'device', style: CANVAS_ONLY_STYLE });
  const raster = await readYardPlateRaster(yard.page, frame, corners, box, expectedNumber);
  const { contrast, glyphSlots, inkHeightCssPx, paperRatio, png } = raster;
  const cropPath = testInfo.outputPath(`${label}-${face}-plate.png`);
  await writeFile(cropPath, Buffer.from(png, 'base64'));
  await testInfo.attach(`${label}-${face}-plate`, { contentType: 'image/png', path: cropPath });
  expect(paperRatio, `${label} ${face} plate is visibly light on the canvas`).toBeGreaterThan(0.35);
  if (expectedNumber === undefined) {
    expect(glyphSlots, `${label} ${face} has a blank frame`).toEqual([false]);
  }
  else {
    const expectedSlots = Array.from(expectedNumber, character => character !== ' ');
    expect(glyphSlots, `${label} ${face} includes all glyphs of ${expectedNumber} and the gap`).toEqual(expectedSlots);
    expect(inkHeightCssPx, `${label} ${face} glyph height`).toBeGreaterThanOrEqual(10);
    expect(contrast, `${label} ${face} text contrast`).toBeGreaterThanOrEqual(4.5);
  }
  return { contrast, face, glyphSlots, inkHeightCssPx, paperRatio, zoomCssPxPerMeter: await readCameraZoom(yard) };
};

const rotateYardToOtherFace = async ({ scene }: YardMarkingSceneValue): Promise<void> => {
  for (let turn = 0; turn < 2; turn += 1) {
    const before = await scene.readDrawFrames();
    await scene.pressCameraButton('rotate-right');
    await scene.waitForDrawFramesToExceed(before, 'rotating the camera renders a new view');
    await scene.waitForIdle();
  }
};

test.use({ initialGraphicsPreference: null, viewport: VIEWPORT });

for (const { dpr, time } of CONDITIONS) {
  test.describe(`${time} at DPR ${String(dpr)}`, () => {
    test.use({ deviceScaleFactor: dpr });

    test('reads both plates at the working zoom on all graphics levels and settles', async ({ context, page }, testInfo) => {
      test.setTimeout(180_000);
      const fixture = await prepareYardVehicleMarkings(await context.newPage(), 1, time);
      const yard = await prepareScene(page);
      await openYardVehicleMarkings(page);
      await page.bringToFront();
      await expect(page.getByTestId('warehouse-yard-registration')).toHaveText(fixture.registrationNumber);
      await openWarehouseTasks(page);
      await readyForMarks(yard, 1);
      await zoomToWorkingView(yard);
      const metrics: ReadableMarkingValue[] = [];
      for (const level of LEVELS) {
        if (level !== 'low') {
          const before = await yard.scene.readDrawFrames();
          await yard.scene.chooseGraphicsPreference(level);
          await yard.scene.waitForDrawFramesToExceed(before, `${level} quality draws before checking the marking`);
          await readyForMarks(yard, 1);
        }
        await expectCameraZoom(yard, WORK_ZOOM);
        const first = await capturePlate(yard, testInfo, `${level}-working`, fixture.registrationNumber);
        await rotateYardToOtherFace(yard);
        const second = await capturePlate(yard, testInfo, `${level}-working`, fixture.registrationNumber);
        expect([first.face, second.face].sort()).toEqual(['front', 'rear']);
        metrics.push(first, second);
      }
      await yard.scene.pressCameraButton('zoom-in');
      await expectCameraZoom(yard, MAX_ZOOM);
      metrics.push(await capturePlate(yard, testInfo, 'control', fixture.registrationNumber));
      await rotateYardToOtherFace(yard);
      metrics.push(await capturePlate(yard, testInfo, 'control', fixture.registrationNumber));
      await expect.poll(() => yard.scene.readLogoResponses().some(({ pathname, status }) => pathname.endsWith('/logos/carrier-1-light.svg')
        && status === 200)).toBe(true);
      expect(yard.scene.readPageErrors()).toEqual([]);
      const path = testInfo.outputPath('plate-metrics.json');
      await writeFile(path, JSON.stringify(metrics, null, 2));
      await testInfo.attach('plate-metrics', { contentType: 'application/json', path });
    });
  });
}

test('clears the rendered plate when switching to a warehouse viewer without trip permission', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await prepareYardVehicleMarkings(await context.newPage(), 1, 'day');
  const yard = await prepareScene(page);
  await openYardVehicleMarkings(page);
  await page.bringToFront();
  await expect(page.getByTestId('warehouse-yard-registration')).toHaveText(fixture.registrationNumber);
  await openWarehouseTasks(page);
  await readyForMarks(yard, 1);
  await zoomToWorkingView(yard);
  await capturePlate(yard, testInfo, 'authorized-registration', fixture.registrationNumber);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const before = await yard.scene.readDrawFrames();
  await createPersonaRobot(page).selectPersona(PERSONAS.freshStorekeeper);
  await expect(page.getByText(fixture.registrationNumber, { exact: true })).toHaveCount(0);
  await openYardVehicleMarkings(page, PERSONAS.freshStorekeeper.id);
  await page.bringToFront();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await expect(page.getByTestId('yard-dispatch-visit')).toHaveCount(1);
  await expect(page.getByText(fixture.registrationNumber, { exact: true })).toHaveCount(0);
  await openWarehouseTasks(page);
  await yard.scene.waitForDrawFramesToExceed(before, 'the current persona draws a new yard frame');
  await readyForMarks(yard, 1);
  await zoomToWorkingView(yard);
  await capturePlate(yard, testInfo, 'allowed-warehouse-denied-registration', undefined);
  expect(yard.scene.readPageErrors()).toEqual([]);
});

test('keeps the plate frame blank on a branded direct delivery without a vehicle assignment', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  await prepareYardVehicleMarkings(await context.newPage(), 1, 'day', true);
  const yard = await prepareScene(page);
  await openYardVehicleMarkings(page);
  await page.bringToFront();
  await expect(page.getByTestId('yard-dispatch-visit')).toHaveCount(1);
  await expect(page.getByTestId('warehouse-yard-vehicle-owner')).toBeVisible();
  await expect(page.getByTestId('warehouse-yard-registration')).toHaveCount(0);
  await openWarehouseTasks(page);
  await readyForMarks(yard, 1);
  await zoomToWorkingView(yard);
  await capturePlate(yard, testInfo, 'brand-without-registration', undefined);
  expect(yard.scene.readPageErrors()).toEqual([]);
});

test('keeps the same marking on the moving truck from parking to D06 and through departure', async ({ context, page }) => {
  test.setTimeout(90_000);
  const control = await context.newPage();
  const fixture = await prepareYardVehicleMarkings(control, 1, 'day');
  const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  const method = WarehouseReceivingService.method;
  const command = { ...YARD_MARKINGS_SCOPE, taskId: fixture.taskId };
  const readTaskVersion = async (): Promise<number> => {
    const { tasks } = await callYardWorker(worker, method.listReceivingTasks, YARD_MARKINGS_SCOPE);
    const task = tasks.find(({ id }) => id === fixture.taskId);
    if (task === undefined) {
      throw new Error('The marked truck needs a receiving task');
    }
    return task.version;
  };
  const readPoses = async (): Promise<Awaited<ReturnType<typeof readYardMarkingSceneProbe>>['markedPoses']> =>
    (await readYardMarkingSceneProbe(page)).markedPoses;
  const countPositionsAfter = async (index: number): Promise<number> =>
    new Set((await readPoses()).slice(index).map(({ position }) => position.join(','))).size;

  try {
    const yard = await prepareScene(page, true);
    await openYardVehicleMarkings(page);
    await page.bringToFront();
    await expect(page.getByTestId('warehouse-yard-registration')).toHaveText(fixture.registrationNumber);
    await readyForMarks(yard, 1);
    const parked = await readPoses();
    const parkedCell = parked.at(-1)?.cell;
    expect(parkedCell).toBeGreaterThan(0);

    const { outcome } = await callYardWorker(worker, method.assignYardVisitToDock, {
      ...command, expectedVersion: await readTaskVersion(), idempotencyKey: randomUUID(),
      reason: 'Подача маркированной фуры', unloadingPointId: fixture.dockId,
    });
    expect(outcome).toBe(YardDispatchOutcome.DOCK_ASSIGNED);
    await expect.poll(() => countPositionsAfter(parked.length), { message: 'the marked truck moves to D06' }).toBeGreaterThan(2);
    await yard.scene.waitForIdle();
    const docked = await readPoses();
    expect(docked.at(-1)?.position).not.toEqual(parked.at(-1)?.position);
    expect(docked.slice(parked.length).map(({ cell }) => cell).every(cell => cell === parkedCell)).toBe(true);

    const { task } = await callYardWorker(worker, method.claimReceivingTask, {
      ...command, expectedVersion: await readTaskVersion(), idempotencyKey: randomUUID(),
    });
    if (task === undefined) {
      throw new Error('The marked truck must be claimed before departure');
    }
    const { task: finished } = await callYardWorker(worker, method.finishReceivingTask, {
      ...command, expectedVersion: task.version, idempotencyKey: randomUUID(),
    });
    expect(finished?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
    await expect.poll(() => countPositionsAfter(docked.length), { message: 'the marked truck moves on departure' }).toBeGreaterThan(2);
    await expect.poll(async () => (await readYardMarkingSceneProbe(page)).markedTruckInstances).toBe(0);
    const departed = await readPoses();
    expect(departed.slice(docked.length).map(({ cell }) => cell).every(cell => cell === parkedCell)).toBe(true);
    await yard.scene.waitForIdle();
    await yard.scene.expectNoDrawFramesFor(REST_MS);
    expect(yard.scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
  }
});

for (const visitCount of [25, 30] as const) {
  test(`keeps markings for ${String(visitCount)} trucks in the existing WebGL draw budget`, async ({ context, page }, testInfo) => {
    test.setTimeout(90_000);
    const fixture = await prepareYardVehicleMarkings(await context.newPage(), visitCount, 'night');
    const yard = await prepareScene(page);
    if (visitCount === 25) {
      await watchYardBrandPainting(page);
    }
    await openYardVehicleMarkings(page);
    await page.bringToFront();
    await expect(page.getByTestId('yard-dispatch-visit')).toHaveCount(visitCount);
    await expect(page.getByText(fixture.registrationNumber, { exact: true })).toBeVisible();
    if (visitCount === 25) {
      const owners = page.getByTestId('warehouse-yard-vehicle-owner');
      await expect(owners.filter({ hasText: PERSONAS.freshCarrier.organizationName }).first()).toBeVisible();
      await expect(owners.filter({ hasText: PERSONAS.constructionCarrier.organizationName }).first()).toBeVisible();
      await expect.poll(() => yard.scene.readLogoResponses().some(({ pathname, status }) =>
        pathname.endsWith(LOGO_WITH_MISSING_IMAGE) && status === 404)).toBe(true);
      await expect.poll(() => page.evaluate<boolean>(`(() => {
        const { imageCells, monogramCells } = window.__yardBrandPainting;
        return Array.from(imageCells).some(image => Array.from(monogramCells).some(monogram => image !== monogram));
      })()`), { message: 'the working logo and fallback monogram are painted in separate atlas cells' }).toBe(true);
    }
    const metrics: { calls: number; level: string; markedDraws: number; markedTruckInstances: number }[] = [];
    for (const level of LEVELS) {
      if (level !== 'low') {
        const before = await yard.scene.readDrawFrames();
        await yard.scene.chooseGraphicsPreference(level);
        await yard.scene.waitForDrawFramesToExceed(before, `${level} quality is rendered before measuring rest`);
      }
      await readyForMarks(yard, visitCount);
      await yard.scene.expectNoDrawFramesFor(REST_MS);
      const { lastFrameDrawCalls, markedDraws, markedTruckInstances } = await readYardMarkingSceneProbe(page);
      expect(lastFrameDrawCalls).toBe(NIGHT_DRAW_BUDGET[level]);
      expect(markedDraws, 'parked trucks and their markings share one draw').toBe(1);
      metrics.push({ calls: lastFrameDrawCalls, level, markedDraws, markedTruckInstances });
      await yard.canvas.screenshot({ path: testInfo.outputPath(`${String(visitCount)}-${level}.png`), style: CANVAS_ONLY_STYLE });
    }
    const path = testInfo.outputPath('marking-draws.json');
    await writeFile(path, JSON.stringify(metrics, null, 2));
    await testInfo.attach('marking-draws', { contentType: 'application/json', path });
    expect(yard.scene.readPageErrors()).toEqual([]);
  });
}
