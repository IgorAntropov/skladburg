import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { TripSchema } from '@skladburg/contracts/logistics/v1/logistics';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  readAssignmentDeparture,
  readOfferAmount,
  toTripAssignmentFormValues,
  validateOfferValues,
} from './transportFormValues';

describe('transport offer amount', () => {
  it('keeps kopecks exact beyond the safe integer range', () => {
    expect(readOfferAmount('90 071 992 547 409,93')).toBe(9_007_199_254_740_993n);
    expect(validateOfferValues({ amount: '90 071 992 547 409,93' })).toEqual([]);
  });

  it.each(['', '0', '-1', '3,141', '92233720368547758,08'])('reports invalid or out of range value %s on the amount field', (amount) => {
    expect(validateOfferValues({ amount })).toEqual([{ field: 'amount', ruleId: 'transport.amount' }]);
  });
});

describe('trip assignment departure', () => {
  const assignment = {
    departureDate: '2026-11-10',
    departureTime: '09:30',
    driverId: '',
    vehicleId: '',
  };

  it('preserves the seconds and nanoseconds of an unchanged departure', () => {
    const previous = timestampFromDate(new Date(Date.UTC(2026, 10, 10, 9, 30, 23, 456)));

    expect(readAssignmentDeparture(assignment, previous)).toBe(previous);
  });

  it('uses UTC for a new departure', () => {
    expect(readAssignmentDeparture(assignment, undefined)).toEqual(timestampFromDate(new Date(Date.UTC(2026, 10, 10, 9, 30))));
  });

  it('starts at the next full minute when the pickup opens after the start of a minute', () => {
    const startsAt = timestampFromDate(new Date(Date.UTC(2026, 10, 10, 23, 59, 50)));
    const trip = create(TripSchema, { transportOrder: { pickupWindow: { startsAt } } });

    expect(toTripAssignmentFormValues(trip)).toMatchObject({ departureDate: '2026-11-11', departureTime: '00:00' });
  });
});
