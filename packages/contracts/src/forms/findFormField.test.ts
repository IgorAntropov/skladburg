import {
  describe,
  expect,
  it,
} from 'vitest';

import type { FormRulesValue } from './formRuleTypes';

import { findFormField } from './findFormField';

const rules: FormRulesValue = {
  fields: {
    'bank': { isServerOnly: true, kind: 'opaque', protoName: 'bank' },
    'bank.bik': { kind: 'string', protoName: 'bank.bik' },
    'bank.settlementAccount': { kind: 'string', protoName: 'bank.settlement_account' },
    'capabilities': { kind: 'repeated', protoName: 'capabilities' },
    'cityId': { isUuid: true, kind: 'string', protoName: 'city_id' },
    'name': { kind: 'string', protoName: 'name' },
    'shipTo': { isServerOnly: true, kind: 'opaque', protoName: 'ship_to' },
  },
};

describe('findFormField', () => {
  it('translates the proto name into the form field name', () => {
    expect(findFormField(rules, 'city_id')).toBe('cityId');
    expect(findFormField(rules, 'name')).toBe('name');
  });

  it('maps an element of a list to the list field', () => {
    expect(findFormField(rules, 'capabilities[0]')).toBe('capabilities');
    expect(findFormField(rules, 'capabilities[12]')).toBe('capabilities');
    expect(findFormField(rules, 'capabilities')).toBe('capabilities');
  });

  it('maps server-only fields too', () => {
    expect(findFormField(rules, 'ship_to')).toBe('shipTo');
  });

  it('maps a path through nested messages to the dotted form field', () => {
    expect(findFormField(rules, 'bank.bik')).toBe('bank.bik');
    expect(findFormField(rules, 'bank.settlement_account')).toBe('bank.settlementAccount');
    expect(findFormField(rules, 'bank')).toBe('bank');
  });

  it('does not map a nested path without a field in the table', () => {
    expect(findFormField(rules, 'bank.unknown')).toBeUndefined();
    expect(findFormField(rules, 'bank.bik.digit')).toBeUndefined();
    expect(findFormField(rules, 'bank.bik[0]')).toBeUndefined();
    expect(findFormField(rules, 'bank.settlementAccount')).toBeUndefined();
  });

  it('does not map nested paths', () => {
    expect(findFormField(rules, 'ship_to.street')).toBeUndefined();
    expect(findFormField(rules, 'capabilities[0].kind')).toBeUndefined();
    expect(findFormField(rules, 'capabilities[0][1]')).toBeUndefined();
    expect(findFormField(rules, 'name.first')).toBeUndefined();
  });

  it('does not map an index on a field that is not a list', () => {
    expect(findFormField(rules, 'name[0]')).toBeUndefined();
  });

  it('does not map map keys and extension paths', () => {
    expect(findFormField(rules, 'name["key"]')).toBeUndefined();
    expect(findFormField(rules, '[buf.validate.field]')).toBeUndefined();
  });

  it('does not map form field names, unknown fields and empty paths', () => {
    expect(findFormField(rules, 'cityId')).toBeUndefined();
    expect(findFormField(rules, 'idempotency_key')).toBeUndefined();
    expect(findFormField(rules, '')).toBeUndefined();
    expect(findFormField(rules, 'constructor')).toBeUndefined();
  });
});
