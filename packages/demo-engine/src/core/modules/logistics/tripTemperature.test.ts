import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { TripRecordSchema } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { readTripBodyTemperature } from './tripTemperature';

const START_MS = 60_000;
const ARRIVAL_MS = 180_000;
const assignment = { arrivalAt: timestampFromMs(ARRIVAL_MS), vehicleId: 'e1000002-0000-4000-8000-000000000000' };
const departedAt = timestampFromMs(START_MS);

describe('readTripBodyTemperature', () => {
  it('preserves zero and negative readings within the agreed bounds', () => {
    for (const celsius of [0, -18]) {
      const trip = create(TripRecordSchema, {
        assignment, departedAt, transportOrder: { cargo: { temperature: { maxCelsius: celsius, minCelsius: celsius } } },
      });

      expect(readTripBodyTemperature(trip, START_MS)).toMatchObject({ deciCelsius: celsius * 10, measuredAt: departedAt });
    }
  });

  it('returns no sample for cargo without a temperature range', () => {
    const trip = create(TripRecordSchema, { assignment, departedAt, transportOrder: { cargo: {} } });

    expect(readTripBodyTemperature(trip, START_MS)).toBeUndefined();
  });

  it('stops sampling at the planned arrival even if the clock has advanced before the arrival tick', () => {
    const trip = create(TripRecordSchema, {
      assignment, departedAt, transportOrder: { cargo: { temperature: { maxCelsius: 4, minCelsius: 2 } } },
    });

    const last = readTripBodyTemperature(trip, ARRIVAL_MS);
    expect(last?.measuredAt).toEqual(assignment.arrivalAt);
    expect(readTripBodyTemperature(trip, ARRIVAL_MS + START_MS)).toEqual(last);
    expect(readTripBodyTemperature({ ...trip, arrivedAt: assignment.arrivalAt }, ARRIVAL_MS + START_MS)).toEqual(last);
  });
});
