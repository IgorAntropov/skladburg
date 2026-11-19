import type {
  BrowserContext,
  Locator,
  Page,
  TestInfo,
} from '@playwright/test';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ClockService } from '@skladburg/contracts/clock/v1/clock';
import { DealService } from '@skladburg/contracts/deal/v1/deal';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';
import {
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardDispatchOutcome,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import type { GraphicsPreferenceValue } from './fixtures/graphicsPreference.ts';
import type { YardSceneDispatchFixtureValue } from './fixtures/sixDockWarehouse.ts';
import type { SceneRobotValue } from './robots/scene-robot.ts';

import {
  OWN_NETWORK_SITES,
  PERSONAS,
} from './fixtures/demoData.ts';
import { freezeEngineClock } from './fixtures/engineClock.ts';
import { createStoreGraphicsPreferenceScript } from './fixtures/graphicsPreference.ts';
import { withNativeTabVisibility } from './fixtures/nativeTabVisibility.ts';
import {
  toObjectHash,
  toWarehouseRoute,
} from './fixtures/routes.ts';
import { storeYardSceneDispatchQueue } from './fixtures/sixDockWarehouse.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { createStoreSystemThemeScript } from './fixtures/themePreference.ts';
import { callYardWorker } from './fixtures/yardPolicyQueue.ts';
import { DEAL_CUSTOMER } from './robots/deal-worker-robot.ts';
import { changeStoredEngineMetadata } from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';
import { readTruckCabPositions } from './robots/warehouse-cab-observer.ts';

const KAZAN_SCOPE = { warehouseId: OWN_NETWORK_SITES[2].id };
const MOSCOW_SCOPE = { warehouseId: OWN_NETWORK_SITES[0].id };
const DUSK_MS = Date.UTC(2026, 9, 12, 15);
const DAWN_MS = Date.UTC(2026, 9, 13, 3);
const NIGHT_MS = Date.UTC(2026, 9, 12, 17);
const YARD_VIEWPORT = { height: 900, width: 1920 };
const CAMERA_PAN_START = { x: 1_070, y: 850 };
const CAMERA_PAN_DISTANCE = 350;
const MINUTE_MS = 60_000;
const CLOCK_MARGIN_MS = 5_000;
const REST_MS = 700;
const CANVAS_ONLY_STYLE = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }';
const CANVAS_AND_DOCK_TARGET_STYLE
  = `${CANVAS_ONLY_STYLE} [data-testid="warehouse-yard-dock-target"] { visibility: visible !important; }`;
const LIGHTING_CHUNK = /\/assets\/WarehouseYardLightingLayer-[^/]+\.js$/u;
const DRAG_CHUNK = /\/assets\/WarehouseYardDragLayer-[^/]+\.js$/u;
const SCENE_CHUNK = /\/assets\/(?:SceneRoot|WarehouseWorldScene|WarehouseYard\w+Layer|qualityLevel|warehouse-scene)-[^/]+\.js$/u;
const YARD_DRAW_COUNTER_SCRIPT = DRAW_COUNTER_INIT_SCRIPT
  .replace('counter.triangles = 0;', `
    const beforeFrame = counter.count - 1;
    counter.triangles = 0;
    counter.headlightBeamDraws = 0;
    counter.lampHalos = 0;
    counter.lampPools = 0;
  `)
  .replace('counter.isInFrame = false;', 'counter.lastFrameDrawCalls = counter.count - beforeFrame; counter.isInFrame = false;')
  .replace('counter.triangles +=', `
    if (methodName === 'drawElementsInstanced' && args[countIndex] === 12 && instanceCount === 1) {
      counter.headlightBeamDraws += 1;
    }
    if (methodName === 'drawElementsInstanced' && (args[countIndex] === 48 || args[countIndex] === 144) && instanceCount >= 4) {
      counter.lampPools = instanceCount;
    }
    if (methodName === 'drawArraysInstanced' && args[countIndex] === 60 && instanceCount >= 4) {
      counter.lampHalos = instanceCount;
    }
    counter.triangles +=
  `);
const LEVELS = ['low', 'medium', 'high'] as const;

interface LightComparisonValue {
  meanDarkening: number;
  newWarmPixels: number;
}

interface YardDrawValue {
  calls: number;
  halos: number;
  pools: number;
  triangles: number;
}

type YardQualityLevelValue = typeof LEVELS[number];

interface YardSceneValue {
  canvas: Locator;
  scene: SceneRobotValue;
  waitForLightingLayer: () => Promise<void>;
}

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
};

const prepareSixDockQueue = async (page: Page, visitCount: 25 | 30): Promise<YardSceneDispatchFixtureValue> => {
  const seed = await createEngineWorkerRobot(page, DEAL_CUSTOMER);
  const { deliveries, topology, warehouse } = await (async () => {
    const [{ tasks }, { topology }, { warehouses }] = await Promise.all([
      callYardWorker(seed, WarehouseReceivingService.method.listReceivingTasks, KAZAN_SCOPE),
      callYardWorker(seed, WarehouseTopologyService.method.getWarehouseTopology, KAZAN_SCOPE),
      callYardWorker(seed, OrganizationService.method.listWarehouses, {}),
    ]);
    const warehouse = required(warehouses.find(entry => entry.id === KAZAN_SCOPE.warehouseId), 'the Kazan warehouse');
    expect(warehouse.timeZone).toBe('Europe/Moscow');
    const deliveries = await Promise.all(tasks.map(async (task) => {
      const { deal } = await callYardWorker(seed, DealService.method.getDeal, { dealId: task.dealId });
      return { deal: required(deal, `the source deal ${task.dealId}`), task };
    }));
    return { deliveries, topology: required(topology, 'the Kazan topology'), warehouse };
  })().finally(seed.stop);
  return storeYardSceneDispatchQueue(page, topology, warehouse, deliveries, visitCount);
};

const openWarehouse = async (page: Page, warehouseId: string, baseUrl: string | undefined): Promise<void> => {
  const hash = toObjectHash(toWarehouseRoute(warehouseId));
  const persona = PERSONAS.freshCustomer.id;
  if (baseUrl === undefined) {
    await createPersonaRobot(page).openAsPersona(hash, persona);
  }
  else {
    await page.goto(new URL(`./${hash}?as=${persona}`, baseUrl).href);
  }
  await expect(page.getByTestId('warehouse-workspace')).toBeVisible();
};

const prepareScene = async (
  page: Page,
  preference: GraphicsPreferenceValue,
  reducedMotion: 'no-preference' | 'reduce' = 'no-preference',
): Promise<YardSceneValue> => {
  await page.addInitScript({ content: createStoreGraphicsPreferenceScript(preference) });
  await page.addInitScript({ content: createStoreSystemThemeScript() });
  await page.addInitScript({ content: YARD_DRAW_COUNTER_SCRIPT });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion });
  let hasFinishedLightingRequest = false;
  page.on('requestfinished', (request): void => {
    hasFinishedLightingRequest ||= LIGHTING_CHUNK.test(new URL(request.url()).pathname);
  });
  const scene = createSceneRobot(page);
  scene.watchPageErrors();
  return {
    canvas: page.getByTestId('scene-viewport').locator('canvas'),
    scene,
    waitForLightingLayer: async (): Promise<void> => {
      await expect.poll(() => hasFinishedLightingRequest, { message: 'the yard lighting chunk has loaded' }).toBe(true);
    },
  };
};

const readStableFrame = async (yard: YardSceneValue, testInfo: TestInfo, label: string): Promise<Buffer> => {
  const { canvas, scene, waitForLightingLayer } = yard;
  await waitForLightingLayer();
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_MS);
  return canvas.screenshot({ path: testInfo.outputPath(`${label}.png`), scale: 'css', style: CANVAS_ONLY_STYLE });
};

const compareNightToDay = async (page: Page, night: Buffer, day: Buffer): Promise<LightComparisonValue> =>
  page.evaluate(async ([nightUri, dayUri]): Promise<LightComparisonValue> => {
    const readPixels = async (src: string): Promise<Uint8ClampedArray> => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx === null) {
        throw new Error('The comparison needs a raster canvas');
      }
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height).data;
    };
    const [current, reference] = await Promise.all([readPixels(nightUri), readPixels(dayUri)]);
    if (current.length !== reference.length) {
      throw new Error('The captured warehouse images have different dimensions');
    }
    let darkening = 0;
    let newWarmPixels = 0;
    for (let offset = 0; offset < current.length; offset += 4) {
      const [r, g, b] = [current[offset] ?? 0, current[offset + 1] ?? 0, current[offset + 2] ?? 0];
      const [prevR, prevG, prevB] = [reference[offset] ?? 0, reference[offset + 1] ?? 0, reference[offset + 2] ?? 0];
      darkening += (prevR - r) * 0.2126 + (prevG - g) * 0.7152 + (prevB - b) * 0.0722;
      if (r >= 175 && g >= 125 && r - b >= 28 && r - g <= 85 && r >= prevR + 18) {
        newWarmPixels += 1;
      }
    }
    return { meanDarkening: darkening / (current.length / 4), newWarmPixels };
  }, [`data:image/png;base64,${night.toString('base64')}`, `data:image/png;base64,${day.toString('base64')}`] as const);

const expectNightLighting = async (page: Page, night: Buffer, day: Buffer): Promise<void> => {
  const comparison = await compareNightToDay(page, night, day);
  expect(comparison.meanDarkening, 'dimmer night lighting at a fixed camera').toBeGreaterThan(3);
  expect(comparison.newWarmPixels, 'new warm light pixels at a fixed camera').toBeGreaterThan(12);
};

const openClock = async (context: BrowserContext, worldTimeMs: number, baseUrl: string | undefined): Promise<{
  control: Page;
  worker: Awaited<ReturnType<typeof createEngineWorkerRobot>>;
}> => {
  const control = await context.newPage();
  const seed = await createEngineWorkerRobot(control, DEAL_CUSTOMER, baseUrl);
  await expect.poll(seed.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
  await seed.stop();
  await changeStoredEngineMetadata(control, { isClockPaused: false, seedVersionOffset: 0, worldTimeMs });
  const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER, baseUrl);
  return { control, worker };
};

const readTimeMs = async (worker: Awaited<ReturnType<typeof createEngineWorkerRobot>>): Promise<number> => {
  const { worldTime } = await callYardWorker(worker, ClockService.method.getWorldClock, {});
  return timestampMs(required(worldTime, 'the world time'));
};

const readHeadlightBeamDraws = (page: Page): Promise<number> =>
  page.evaluate<number>('window.__drawCounter?.headlightBeamDraws ?? 0');

const readYardDraw = (page: Page): Promise<YardDrawValue> => page.evaluate<YardDrawValue>(`({
  calls: window.__drawCounter?.lastFrameDrawCalls ?? 0,
  halos: window.__drawCounter?.lampHalos ?? 0,
  pools: window.__drawCounter?.lampPools ?? 0,
  triangles: window.__drawCounter?.triangles ?? 0,
})`);

const isRenderedQuality = ({ halos, pools }: YardDrawValue, level: YardQualityLevelValue): boolean => {
  if (level === 'low') {
    return pools === 4 && halos === 0;
  }
  return pools > 4 && halos === (level === 'high' ? pools : 0);
};

const canPointAtCanvas = (canvas: Locator, point: { x: number; y: number }): Promise<boolean> =>
  canvas.evaluate((element, { x, y }) => document.elementFromPoint(x, y) === element, point);

const checkNightDockTarget = async (
  page: Page, canvas: Locator, fixture: YardSceneDispatchFixtureValue, parked: Buffer, testInfo: TestInfo,
): Promise<void> => {
  const cabs = await readTruckCabPositions(page, parked, 30);
  expect(cabs).toHaveLength(fixture.visitCount);
  const rowProjections = cabs.map(cab => cab.x + cab.y * Math.sqrt(3));
  const rowCenter = (Math.min(...rowProjections) + Math.max(...rowProjections)) / 2;
  const front = required(cabs.filter(cab => cab.x + cab.y * Math.sqrt(3) > rowCenter)
    .toSorted((current, prev) => (prev.y - current.y) * Math.sqrt(3) - (prev.x - current.x))[0], 'the first parked cab');
  const canvasBox = await canvas.boundingBox();
  if (canvasBox === null) {
    throw new Error('The warehouse canvas is not visible');
  }
  const source = { x: canvasBox.x + front.x, y: canvasBox.y + front.y };
  expect(await canPointAtCanvas(canvas, source)).toBe(true);
  const targets = page.getByTestId('warehouse-yard-dock-target');
  const target = targets.and(page.locator(`[data-dock-id="${fixture.dockId}"]`));
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await expect(target).toBeVisible();
  await expect(target).toHaveText('D06');
  const targetBox = await target.boundingBox();
  if (targetBox === null) {
    throw new Error('The night target for dock D06 is not visible');
  }
  const dockCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  expect(await canPointAtCanvas(canvas, dockCenter)).toBe(true);
  await page.mouse.move(dockCenter.x, dockCenter.y, { steps: 8 });
  await expect(target).toHaveAttribute('data-hovered', 'true');
  await canvas.screenshot({
    path: testInfo.outputPath('night-dock-target.png'), scale: 'css', style: CANVAS_AND_DOCK_TARGET_STYLE,
  });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(targets).toHaveCount(0);
  await expect(page.getByTestId('yard-dispatch-form')).toHaveCount(0);
};

test.use({ initialGraphicsPreference: null, viewport: YARD_VIEWPORT });

test('crosses dusk by the world clock in a one-dock warehouse and returns to zero frames', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  const { control, worker } = await openClock(context, DUSK_MS - MINUTE_MS, undefined);
  try {
    const yard = await prepareScene(page, 'medium');
    await page.clock.install();
    await openWarehouse(page, MOSCOW_SCOPE.warehouseId, undefined);
    await page.bringToFront();
    await yard.scene.expectOneCanvas();
    await yard.scene.waitForCameraControls();
    await yard.scene.expectThemeAttribute('light');
    const advance = await freezeEngineClock(page, control);
    const day = await readStableFrame(yard, testInfo, 'one-dock-day');
    const before = await yard.scene.readDrawFrames();
    const toDuskMs = DUSK_MS - await readTimeMs(worker);
    expect(toDuskMs).toBeGreaterThan(0);
    await advance(toDuskMs + CLOCK_MARGIN_MS);
    await page.clock.fastForward(toDuskMs + CLOCK_MARGIN_MS);
    await yard.scene.waitForDrawFramesToExceed(before + 3, 'dusk renders the warehouse transition');
    const dusk = await yard.canvas.screenshot({ path: testInfo.outputPath('one-dock-dusk.png'), scale: 'css', style: CANVAS_ONLY_STYLE });
    const night = await readStableFrame(yard, testInfo, 'one-dock-night');
    await expectNightLighting(page, night, day);
    expect(dusk.equals(day), 'dusk changes the day frame').toBe(false);
    expect(dusk.equals(night), 'dusk precedes the settled night frame').toBe(false);
    await yard.scene.expectThemeAttribute('light');
    expect(yard.scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
  }
});

test('opens at night and applies dawn after returning with reduced motion', async ({ baseURL }, testInfo) => {
  test.setTimeout(90_000);
  const baseUrl = required(baseURL, 'the preview URL');
  await withNativeTabVisibility(async (context) => {
    const { control, worker } = await openClock(context, DAWN_MS - MINUTE_MS, baseUrl);
    try {
      const page = await context.newPage();
      await page.setViewportSize(YARD_VIEWPORT);
      const yard = await prepareScene(page, 'medium', 'reduce');
      await openWarehouse(page, MOSCOW_SCOPE.warehouseId, baseUrl);
      await page.bringToFront();
      await yard.scene.expectOneCanvas();
      await yard.scene.waitForCameraControls();
      const advance = await freezeEngineClock(page, control);
      const night = await readStableFrame(yard, testInfo, 'initial-night');
      const before = await yard.scene.readDrawFrames();
      await control.bringToFront();
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
      const toDawnMs = DAWN_MS - await readTimeMs(worker);
      expect(toDawnMs).toBeGreaterThan(0);
      await advance(toDawnMs + CLOCK_MARGIN_MS);
      await yard.scene.expectNoDrawFramesFor(REST_MS);
      await page.bringToFront();
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
      await yard.scene.waitForDrawFramesToExceed(before, 'dawn renders on returning to the warehouse');
      const day = await readStableFrame(yard, testInfo, 'after-background-dawn');
      await expectNightLighting(page, night, day);
      await yard.scene.expectThemeAttribute('light');
      expect(yard.scene.readPageErrors()).toEqual([]);
    }
    finally {
      await worker.stop();
    }
  });
});

test('keeps paused yards with 25 and 30 trucks idle across graphics levels and off', async ({ browser, context, page }, testInfo) => {
  test.setTimeout(120_000);
  const otherContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    serviceWorkers: 'block',
    viewport: YARD_VIEWPORT,
  });
  try {
    const otherPage = await otherContext.newPage();
    const metrics: (YardDrawValue & { level: YardQualityLevelValue; visits: number })[] = [];
    for (const { current, currentContext, visitCount } of [
      { current: page, currentContext: context, visitCount: 25 },
      { current: otherPage, currentContext: otherContext, visitCount: 30 },
    ] as const) {
      const control = await currentContext.newPage();
      const fixture = await prepareSixDockQueue(control, visitCount);
      await changeStoredEngineMetadata(control, { isClockPaused: true, seedVersionOffset: 0, worldTimeMs: NIGHT_MS });
      const requests: string[] = [];
      current.on('request', request => requests.push(new URL(request.url()).pathname));
      const yard = await prepareScene(current, 'off');
      await openWarehouse(current, KAZAN_SCOPE.warehouseId, undefined);
      await current.bringToFront();
      await current.getByTestId('warehouse-workspace').locator('button[id$="-trigger-yard"]').click();
      await expect(current.getByTestId('yard-dispatch-visit')).toHaveCount(fixture.visitCount);
      await yard.scene.expectNoCanvas();
      await yard.scene.expectNoDrawFramesFor(REST_MS);
      expect(requests.filter(path => SCENE_CHUNK.test(path))).toEqual([]);

      for (const level of LEVELS) {
        const before = await yard.scene.readDrawFrames();
        const dragLayer = level === 'low' ? current.waitForResponse(DRAG_CHUNK) : undefined;
        await Promise.all([dragLayer, yard.scene.chooseGraphicsPreference(level)]);
        await yard.scene.expectOneCanvas();
        await yard.scene.expectSceneState('ready');
        await yard.scene.waitForCameraControls();
        await yard.scene.waitForDrawFramesToExceed(before, `${level} quality is rendered before measuring rest`);
        await expect.poll(async () => isRenderedQuality(await readYardDraw(current), level), {
          message: `the yard lamps for ${level} quality have drawn`,
        }).toBe(true);
        await readStableFrame(yard, testInfo, `kazan-${String(visitCount)}-${level}`);
        const draws = await readYardDraw(current);
        expect(draws.calls).toBeGreaterThan(0);
        expect(draws.triangles).toBeGreaterThan(0);
        metrics.push({ ...draws, level, visits: visitCount });
      }
      const before = await yard.scene.readDrawFrames();
      await current.clock.install();
      await current.clock.fastForward(12 * 60 * MINUTE_MS);
      await yard.scene.expectNoDrawFramesFor(REST_MS);
      expect(await yard.scene.readDrawFrames()).toBe(before);
      expect(yard.scene.readPageErrors()).toEqual([]);
    }
    const metricsPath = testInfo.outputPath('yard-lighting-metrics.json');
    await writeFile(metricsPath, JSON.stringify(metrics, null, 2));
    await testInfo.attach('yard-lighting-metrics', { contentType: 'application/json', path: metricsPath });
    for (const level of LEVELS) {
      const first = required(metrics.find(metric => metric.visits === 25 && metric.level === level), 'the 25-truck measurement');
      const second = required(metrics.find(metric => metric.visits === 30 && metric.level === level), 'the 30-truck measurement');
      expect(second.calls, `${level} draw calls at 30 trucks`).toBe(first.calls);
      expect(second.triangles, `${level} rendered instances at 30 trucks`).toBeGreaterThan(first.triangles);
    }
  }
  finally {
    await otherContext.close();
  }
});

test('captures headlights during a confirmed approach and departure and idles after stopping', async ({ context, page }, testInfo) => {
  test.setTimeout(90_000);
  const control = await context.newPage();
  const fixture = await prepareSixDockQueue(control, 25);
  await changeStoredEngineMetadata(control, { isClockPaused: true, seedVersionOffset: 0, worldTimeMs: NIGHT_MS });
  const worker = await createEngineWorkerRobot(control, DEAL_CUSTOMER);
  const method = WarehouseReceivingService.method;
  const readTask = async (): Promise<ReceivingTask> => {
    const { tasks } = await callYardWorker(worker, method.listReceivingTasks, KAZAN_SCOPE);
    return required(tasks.find(task => task.id === fixture.taskId), 'the night delivery');
  };
  try {
    const yard = await prepareScene(page, 'medium');
    await openWarehouse(page, KAZAN_SCOPE.warehouseId, undefined);
    await page.bringToFront();
    await yard.scene.expectOneCanvas();
    await yard.scene.expectSceneState('ready');
    await yard.scene.waitForCameraControls();
    await Promise.all([
      page.waitForResponse(DRAG_CHUNK),
      page.getByTestId('warehouse-workspace').locator('button[id$="-trigger-yard"]').click(),
    ]);
    await expect(page.getByTestId('yard-dispatch-visit')).toHaveCount(fixture.visitCount);
    await yard.scene.pressCameraButton('home');
    await yard.scene.waitForIdle();
    for (let pan = 0; pan < 2; pan += 1) {
      const { x, y } = CAMERA_PAN_START;
      await expect.poll(() => canPointAtCanvas(yard.canvas, CAMERA_PAN_START)).toBe(true);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + CAMERA_PAN_DISTANCE, y, { steps: 10 });
      await page.mouse.up();
      await yard.scene.waitForIdle();
    }
    const parked = await readStableFrame(yard, testInfo, 'night-parked');
    expect(await readHeadlightBeamDraws(page), 'parked trucks have no headlight beam').toBe(0);
    await checkNightDockTarget(page, yard.canvas, fixture, parked, testInfo);
    await yard.scene.waitForIdle();
    const beforeApproach = await yard.scene.readDrawFrames();
    const { outcome } = await callYardWorker(worker, method.assignYardVisitToDock, {
      ...KAZAN_SCOPE,
      expectedVersion: (await readTask()).version,
      idempotencyKey: randomUUID(),
      reason: 'Ночная подача к доку',
      taskId: fixture.taskId,
      unloadingPointId: fixture.dockId,
    });
    expect(outcome).toBe(YardDispatchOutcome.DOCK_ASSIGNED);
    await yard.scene.waitForDrawFramesToExceed(beforeApproach + 8, 'truck headlights move during the approach');
    await expect.poll(() => readHeadlightBeamDraws(page), { message: 'one headlight beam during the approach' }).toBe(1);
    await yard.canvas.screenshot({ path: testInfo.outputPath('night-approach.png'), scale: 'css', style: CANVAS_ONLY_STYLE });
    await readStableFrame(yard, testInfo, 'night-docked');
    expect(await readHeadlightBeamDraws(page), 'docked trucks have no headlight beam').toBe(0);
    const { task } = await callYardWorker(worker, method.claimReceivingTask, {
      ...KAZAN_SCOPE, expectedVersion: (await readTask()).version, idempotencyKey: randomUUID(), taskId: fixture.taskId,
    });
    const receiving = required(task, 'the claimed night delivery');
    expect(receiving.status).toBe(ReceivingTaskStatus.IN_PROGRESS);
    const beforeDeparture = await yard.scene.readDrawFrames();
    const { task: finished } = await callYardWorker(worker, method.finishReceivingTask, {
      ...KAZAN_SCOPE, expectedVersion: receiving.version, idempotencyKey: randomUUID(), taskId: fixture.taskId,
    });
    expect(finished?.status).toBe(ReceivingTaskStatus.READY_FOR_RECONCILIATION);
    await yard.scene.waitForDrawFramesToExceed(beforeDeparture + 8, 'truck headlights move during the departure');
    await expect.poll(() => readHeadlightBeamDraws(page), { message: 'one headlight beam during the departure' }).toBe(1);
    await yard.canvas.screenshot({ path: testInfo.outputPath('night-departure.png'), scale: 'css', style: CANVAS_ONLY_STYLE });
    await readStableFrame(yard, testInfo, 'night-after-departure');
    expect(await readHeadlightBeamDraws(page), 'no headlight beam after the truck has left').toBe(0);
    expect(yard.scene.readPageErrors()).toEqual([]);
  }
  finally {
    await worker.stop();
  }
});
