import type { TripRecord } from '@skladburg/contracts/logistics/v1/trip_records';

import { create } from '@bufbuild/protobuf';
import {
  timestampFromMs,
  timestampMs,
} from '@bufbuild/protobuf/wkt';
import {
  type TripTemperatureReading,
  TripTemperatureReadingSchema,
} from '@skladburg/contracts/logistics/v1/logistics';

const SAMPLE_INTERVAL_MS = 60_000;
const DECICELSIUS_PER_CELSIUS = 10;
const SAMPLE_PERIOD = 5;

export const readTripBodyTemperature = (trip: TripRecord, worldTimeMs: number): TripTemperatureReading | undefined => {
  const range = trip.transportOrder?.cargo?.temperature;
  const { arrivedAt, assignment, departedAt } = trip;
  if (range === undefined || assignment === undefined || departedAt === undefined) {
    return undefined;
  }

  const start = timestampMs(departedAt);
  const arrival = arrivedAt ?? assignment.arrivalAt;
  const end = arrival === undefined ? worldTimeMs : Math.min(worldTimeMs, timestampMs(arrival));
  const sample = Math.floor(Math.max(0, end - start) / SAMPLE_INTERVAL_MS);
  const phase = Number.parseInt(assignment.vehicleId.slice(0, 8), 16) % SAMPLE_PERIOD;
  const min = range.minCelsius * DECICELSIUS_PER_CELSIUS;
  const max = range.maxCelsius * DECICELSIUS_PER_CELSIUS;
  const offset = ((sample + phase) % SAMPLE_PERIOD) - Math.floor(SAMPLE_PERIOD / 2);

  return create(TripTemperatureReadingSchema, {
    deciCelsius: Math.max(min, Math.min(max, (min + max) / 2 + offset)),
    measuredAt: arrivedAt ?? (sample === 0 ? departedAt : timestampFromMs(start + sample * SAMPLE_INTERVAL_MS)),
  });
};
