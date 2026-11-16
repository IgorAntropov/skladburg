import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';

import { expectNoAxeViolations } from './fixtures/axe.ts';
import { PERSONAS } from './fixtures/demoData.ts';
import {
  expect,
  test,
} from './fixtures/test.ts';
import { DESKTOP_VIEWPORT } from './fixtures/viewports.ts';
import {
  fundExchangeTrip,
  MINUTE_MS,
  TRIP_ARRIVAL_ADVANCE_MS,
  TRIP_DEPARTURE_ADVANCE_MS,
} from './robots/exchange-trip-journey.ts';
import { createNetworkTripsRobot } from './robots/network-trips-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const REST_PERIOD_MS = 1_000;
const MIN_TRAVEL_FRAMES = 3;
const TRUCK_MODELS_PATH = '**/models/industrial/route-truck*.bin';
const LOW_TRUCK_MODEL_PATH = '**/models/industrial/route-truck-light.bin';
const DETAILED_TRUCK_MODEL_PATH = '**/models/industrial/route-truck.bin';
const IN_TRANSIT_ADVANCE_MS = TRIP_DEPARTURE_ADVANCE_MS + 240 * MINUTE_MS;

test.use({
  colorScheme: 'light',
  initialGraphicsPreference: 'low',
  reducedMotion: 'no-preference',
  viewport: DESKTOP_VIEWPORT,
});
test.describe.configure({ timeout: 90_000 });

test('draws a trip on the network map between departure and arrival and returns to rest', async ({ context, page }, testInfo) => {
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  const scene = createSceneRobot(page);
  const networkTrips = createNetworkTripsRobot(page);
  const shaderErrors: string[] = [];
  const canvas = page.getByTestId('scene-viewport').locator('canvas');
  let truckModelRequests = 0;

  scene.watchPageErrors();
  await page.route(TRUCK_MODELS_PATH, async (route) => {
    truckModelRequests += 1;
    if (truckModelRequests === 1) {
      await route.fulfill({ status: 503 });
    }
    else {
      await route.continue();
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('THREE.WebGLProgram')) {
      shaderErrors.push(message.text());
    }
  });

  const { advanceClock, shipTrip, tripAddress } = await fundExchangeTrip({
    context,
    kind: VehicleCargoKind.GENERAL,
    page,
    shipperSide: 'supplier',
  });

  await networkTrips.openFromApp();
  await scene.expectSceneState('ready');
  await scene.expectOneCanvas();
  await scene.waitForIdle();
  expect(truckModelRequests).toBe(0);

  const framesBeforeLoad = await scene.readDrawFrames();
  const failedModel = page.waitForResponse(LOW_TRUCK_MODEL_PATH);
  await shipTrip();
  await networkTrips.expectStatus(tripAddress, TripStatus.LOADED);
  expect((await failedModel).status()).toBe(503);
  await scene.waitForDrawFramesToExceed(framesBeforeLoad, 'the fallback truck did not draw on the map');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  await scene.chooseGraphicsPreference('off');
  await scene.expectNoCanvas();
  const retriedModel = page.waitForResponse(LOW_TRUCK_MODEL_PATH);
  await scene.chooseGraphicsPreference('low');
  await scene.expectSceneState('ready');
  const truckResponse = await retriedModel;
  expect(truckResponse.ok()).toBe(true);
  await truckResponse.finished();
  await scene.waitForIdle();
  expect(truckModelRequests).toBe(2);

  const detailedModel = page.waitForResponse(DETAILED_TRUCK_MODEL_PATH);
  await scene.chooseGraphicsPreference('medium');
  const detailedResponse = await detailedModel;
  expect(detailedResponse.ok()).toBe(true);
  await detailedResponse.finished();
  await scene.waitForIdle();

  await advanceClock(IN_TRANSIT_ADVANCE_MS);
  await networkTrips.expectStatus(tripAddress, TripStatus.IN_TRANSIT);
  const framesDuringTravel = await scene.readDrawFrames();
  await scene.waitForDrawFramesToExceed(framesDuringTravel + MIN_TRAVEL_FRAMES - 1, 'the truck did not sustain frames during travel');
  await canvas.screenshot({ path: testInfo.outputPath('network-truck-in-transit.png') });

  await advanceClock(TRIP_ARRIVAL_ADVANCE_MS);
  await networkTrips.expectStatus(tripAddress, TripStatus.ARRIVED);
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);
  await expectNoAxeViolations(page);

  await createPersonaRobot(page).selectPersona(PERSONAS.constructionCarrier);
  await networkTrips.expectNoTrips();
  await scene.expectSceneState('ready');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  expect(truckModelRequests).toBe(3);
  expect(scene.readPageErrors()).toEqual([]);
  expect(shaderErrors).toEqual([]);
});
