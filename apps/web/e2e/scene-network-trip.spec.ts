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
  TRIP_ARRIVAL_ADVANCE_MS,
  TRIP_DEPARTURE_ADVANCE_MS,
} from './robots/exchange-trip-journey.ts';
import { createNetworkTripsRobot } from './robots/network-trips-robot.ts';
import { createPersonaRobot } from './robots/persona-robot.ts';
import { DRAW_COUNTER_INIT_SCRIPT } from './robots/scene-draw-counter.ts';
import { createSceneRobot } from './robots/scene-robot.ts';

const REST_PERIOD_MS = 1_000;
const MIN_TRAVEL_FRAMES = 3;

test.use({
  colorScheme: 'light',
  initialGraphicsPreference: 'low',
  reducedMotion: 'no-preference',
  viewport: DESKTOP_VIEWPORT,
});
test.describe.configure({ timeout: 90_000 });

test('draws a trip on the network map between departure and arrival and returns to rest', async ({ context, page }) => {
  await page.addInitScript({ content: DRAW_COUNTER_INIT_SCRIPT });
  const scene = createSceneRobot(page);
  const networkTrips = createNetworkTripsRobot(page);
  const shaderErrors: string[] = [];

  scene.watchPageErrors();
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

  const framesBeforeLoad = await scene.readDrawFrames();
  await shipTrip();
  await networkTrips.expectStatus(tripAddress, TripStatus.LOADED);
  await scene.waitForDrawFramesToExceed(framesBeforeLoad, 'the loaded truck did not draw on the map');
  await scene.waitForIdle();
  await scene.expectNoDrawFramesFor(REST_PERIOD_MS);

  await advanceClock(TRIP_DEPARTURE_ADVANCE_MS);
  await networkTrips.expectStatus(tripAddress, TripStatus.IN_TRANSIT);
  const framesDuringTravel = await scene.readDrawFrames();
  await scene.waitForDrawFramesToExceed(framesDuringTravel + MIN_TRAVEL_FRAMES - 1, 'the truck did not sustain frames during travel');

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

  expect(scene.readPageErrors()).toEqual([]);
  expect(shaderErrors).toEqual([]);
});
