import { VehicleCargoKind } from '@skladburg/contracts/fleet/v1/fleet';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PublishTransportOutputValue } from './publishTransportFormValues';

import {
  collectPublishTransportIssues,
  toTransportWindow,
} from './publishTransportFormValues';

const window = { endDate: '2026-11-10', endTime: '10:00', startDate: '2026-11-10', startTime: '09:00' };

const values: PublishTransportOutputValue = {
  bodyTypes: { curtainSide: true, flatbed: false, insulated: false, longHaul: false, lowLoader: false, refrigerated: false },
  cargo: {
    cargoKind: VehicleCargoKind.GENERAL,
    heightMillimeters: 800,
    lengthMillimeters: 1200,
    palletPlaces: undefined,
    temperature: { maxCelsius: undefined, minCelsius: undefined },
    volumeCubicCentimeters: 800_000n,
    weightGrams: 400_000n,
    widthMillimeters: 800,
  },
  deliveryWindow: { ...window, endTime: '13:00', startTime: '12:00' },
  pickupWindow: window,
};

describe('transport publication input', () => {
  it('maps reversed and malformed windows to their own inputs', () => {
    expect(collectPublishTransportIssues({
      ...values,
      deliveryWindow: { ...window, startDate: '2026-02-30' },
      pickupWindow: { ...window, endTime: '08:00' },
    })).toEqual([
      { field: 'pickupWindow.endTime', ruleId: 'logistics.window_invalid' },
      { field: 'deliveryWindow.startDate', ruleId: 'transport.date' },
    ]);
  });

  it('preserves UTC for timestamps on each side of midnight', () => {
    const result = toTransportWindow({ ...window, endDate: '2026-11-11', endTime: '00:15', startTime: '23:30' });

    expect(result?.startsAt.seconds).toBe(1_794_353_400n);
    expect(result?.endsAt.seconds).toBe(1_794_356_100n);
  });

  it('requires an explicit temperature range for cold cargo and keeps zero as a valid bound', () => {
    const cargo = { ...values.cargo, cargoKind: VehicleCargoKind.TEMPERATURE_CONTROLLED };

    expect(collectPublishTransportIssues({ ...values, cargo })).toEqual([
      { field: 'cargo.temperature.minCelsius', ruleId: 'required' },
      { field: 'cargo.temperature.maxCelsius', ruleId: 'required' },
    ]);
    expect(collectPublishTransportIssues({ ...values, cargo: { ...cargo, temperature: { maxCelsius: 0, minCelsius: -8 } } })).toEqual([]);
  });

  it('requires at least one eligible body type', () => {
    expect(collectPublishTransportIssues({ ...values, bodyTypes: { ...values.bodyTypes, curtainSide: false } })).toEqual([
      { field: 'bodyTypes.curtainSide', ruleId: 'repeated.min_items' },
    ]);
  });
});
