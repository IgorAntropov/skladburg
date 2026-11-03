import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SalesTermsFormOutputValue } from './salesTermsFormValues';

import {
  buildSaveSalesTermsCommand,
  collectSalesTermsIssues,
} from './buildSaveSalesTermsCommand';

const RUB = 'RUB';

const createValues = (overrides: Partial<SalesTermsFormOutputValue> = {}): SalesTermsFormOutputValue => ({
  hasOwnDelivery: false,
  isAutoConfirmEnabled: false,
  ownDelivery: {
    minimumCharge: { amountMinor: undefined, currencyCode: RUB },
    pricePerKm: { amountMinor: undefined, currencyCode: RUB },
  },
  preparationWorkingDays: 2,
  ...overrides,
});

const createDelivery = (pricePerKm: bigint | undefined, minimumCharge: bigint | undefined): SalesTermsFormOutputValue['ownDelivery'] => ({
  minimumCharge: { amountMinor: minimumCharge, currencyCode: RUB },
  pricePerKm: { amountMinor: pricePerKm, currencyCode: RUB },
});

describe('buildSaveSalesTermsCommand', () => {
  it('leaves the own delivery out when the switch is off even if the hidden fields keep amounts', () => {
    const command = buildSaveSalesTermsCommand(createValues({ ownDelivery: createDelivery(4500n, 150000n) }));

    expect(command.ownDelivery).toBeUndefined();
    expect(command).toMatchObject({ isAutoConfirmEnabled: false, preparationWorkingDays: 2 });
  });

  it('sends the own delivery with both amounts when the switch is on', () => {
    const command = buildSaveSalesTermsCommand(createValues({
      hasOwnDelivery: true,
      isAutoConfirmEnabled: true,
      ownDelivery: createDelivery(4500n, 150000n),
    }));

    expect(command.ownDelivery).toEqual({
      minimumCharge: { amountMinor: 150000n, currencyCode: RUB },
      pricePerKm: { amountMinor: 4500n, currencyCode: RUB },
    });
    expect(command.isAutoConfirmEnabled).toBe(true);
  });

  it('keeps zero amounts of an enabled delivery', () => {
    const command = buildSaveSalesTermsCommand(createValues({
      hasOwnDelivery: true,
      ownDelivery: createDelivery(0n, 0n),
    }));

    expect(command.ownDelivery).toEqual({
      minimumCharge: { amountMinor: 0n, currencyCode: RUB },
      pricePerKm: { amountMinor: 0n, currencyCode: RUB },
    });
  });

  it('sends zero days of the preparation as a number', () => {
    expect(buildSaveSalesTermsCommand(createValues({ preparationWorkingDays: 0 })).preparationWorkingDays).toBe(0);
  });
});

describe('collectSalesTermsIssues', () => {
  it('asks for nothing from the delivery fields while the switch is off', () => {
    expect(collectSalesTermsIssues(createValues())).toEqual([]);
  });

  it('requires both amounts when the switch is on', () => {
    expect(collectSalesTermsIssues(createValues({ hasOwnDelivery: true }))).toEqual([
      { field: 'ownDelivery.pricePerKm.amountMinor', ruleId: 'required' },
      { field: 'ownDelivery.minimumCharge.amountMinor', ruleId: 'required' },
    ]);
  });

  it('points only at the amount that is still empty', () => {
    expect(collectSalesTermsIssues(createValues({ hasOwnDelivery: true, ownDelivery: createDelivery(4500n, undefined) }))).toEqual([
      { field: 'ownDelivery.minimumCharge.amountMinor', ruleId: 'required' },
    ]);
  });

  it('requires the preparation days', () => {
    expect(collectSalesTermsIssues(createValues({ preparationWorkingDays: undefined }))).toEqual([
      { field: 'preparationWorkingDays', ruleId: 'required' },
    ]);
  });
});
