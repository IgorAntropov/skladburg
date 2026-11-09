import { create } from '@bufbuild/protobuf';
import { TimestampSchema } from '@bufbuild/protobuf/wkt';
import { VehicleAvailabilitySchema } from '@skladburg/contracts/fleet/v1/fleet';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  mapVehicleViolationPath,
  readAvailabilityWindows,
  toAvailabilityRow,
} from './vehicleAvailability';

const CITY_ID = 'f2a81d12-e5a9-46a3-90ae-e9f64074814d';
const ORIGINAL = create(VehicleAvailabilitySchema, {
  cityId: CITY_ID,
  endsAt: create(TimestampSchema, { nanos: 987654321, seconds: 1_777_636_817n }),
  startsAt: create(TimestampSchema, { nanos: 123456789, seconds: 1_777_633_213n }),
});

describe('vehicle availability', () => {
  it('keeps both original timestamps when the row moves and its UTC values are unchanged', () => {
    const row = toAvailabilityRow(ORIGINAL, 0);
    const result = readAvailabilityWindows([toAvailabilityRow(undefined, -1), row], [1], [ORIGINAL]);

    expect(result.issues).toEqual([]);
    expect(result.availability).toEqual([{ cityId: CITY_ID, endsAt: ORIGINAL.endsAt, startsAt: ORIGINAL.startsAt }]);
  });

  it('replaces only the edited boundary using explicit UTC at minute precision', () => {
    const row = { ...toAvailabilityRow(ORIGINAL, 0), endDate: '2024-02-29', endTime: '12:30' };
    const result = readAvailabilityWindows([row], [0], [ORIGINAL]);

    expect(result.issues).toEqual([]);
    expect(result.availability?.[0]).toEqual({
      cityId: CITY_ID,
      endsAt: create(TimestampSchema, { nanos: 0, seconds: 1_709_209_800n }),
      startsAt: ORIGINAL.startsAt,
    });
  });

  it.each([
    ['2026-02-29', '15:15', 'endDate'],
    ['0000-01-01', '15:15', 'endDate'],
    ['2024-02-29', '24:00', 'endTime'],
    ['2024-02-29', '12:00Z', 'endTime'],
  ])('rejects invalid UTC date or time %s %s', (endDate, endTime, field) => {
    const row = { ...toAvailabilityRow(ORIGINAL, 0), endDate, endTime };
    const result = readAvailabilityWindows([row], [0], [ORIGINAL]);

    expect(result.availability).toBeUndefined();
    expect(result.issues).toEqual([{ field: `details.availability.0.${field}`, ruleId: 'fleet.timestamp_invalid' }]);
  });

  it('focuses the visible row corresponding to an indexed server violation after removal', () => {
    const windowOrder = [0, 3, 1];

    expect(mapVehicleViolationPath('details.availability[1].starts_at', windowOrder)).toBe('details.availability.3.startTime');
    expect(mapVehicleViolationPath('details.availability[2].city_id', windowOrder)).toBe('details.availability.1.cityId');
  });
});
