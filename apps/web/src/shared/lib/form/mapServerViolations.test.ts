import type { FieldViolation } from '@skladburg/contracts/common/v1/error';

import { create } from '@bufbuild/protobuf';
import { FieldViolationSchema } from '@skladburg/contracts/common/v1/error';
import { CreateWarehouseRequestFormRules } from '@skladburg/contracts/forms/organization/v1/organization';
import { UpdateOrganizationRequisitesRequestFormRules } from '@skladburg/contracts/forms/organization/v1/requisites';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { mapServerViolations } from './mapServerViolations';

const FIELD_NAMES = [
  'address',
  'mapNodeId',
  'capabilities',
  'cityId',
  'contactPhone',
  'name',
  'timeZone',
];

const REQUISITES_FIELD_NAMES = [
  'bank.bankName',
  'bank.bik',
  'bank.correspondentAccount',
  'bank.settlementAccount',
  'legalAddress',
  'vatMode',
];

const violation = (fieldPath: string, ruleId: string): FieldViolation => create(FieldViolationSchema, { fieldPath, ruleId });

describe('mapServerViolations', () => {
  it('puts a violation under the form field that the rules table names', () => {
    const result = mapServerViolations(
      CreateWarehouseRequestFormRules,
      [violation('city_id', 'string.uuid')],
      FIELD_NAMES,
    );

    expect(result.fieldIssues).toEqual([{ field: 'cityId', ruleId: 'string.uuid' }]);
    expect(result.unmatched).toEqual([]);
  });

  it('puts a violation of a list element under the list field', () => {
    const result = mapServerViolations(
      CreateWarehouseRequestFormRules,
      [violation('capabilities[1]', 'enum.not_in')],
      FIELD_NAMES,
    );

    expect(result.fieldIssues).toEqual([{ field: 'capabilities', ruleId: 'enum.not_in' }]);
  });

  it('puts a violation under a form field that has no rules by turning snake_case into camelCase', () => {
    const result = mapServerViolations(
      CreateWarehouseRequestFormRules,
      [violation('contact_phone', 'string.pattern')],
      FIELD_NAMES,
    );

    expect(result.fieldIssues).toEqual([{ field: 'contactPhone', ruleId: 'string.pattern' }]);
    expect(result.unmatched).toEqual([]);
  });

  it('leaves a violation of a field that is not on the form in the remainder', () => {
    const unknown = violation('idempotency_key', 'string.uuid');
    const empty = violation('', 'headers.invalid');
    const nested = violation('address.city_id', 'string.uuid');

    const result = mapServerViolations(CreateWarehouseRequestFormRules, [unknown, empty, nested], FIELD_NAMES);

    expect(result.fieldIssues).toEqual([]);
    expect(result.unmatched).toEqual([unknown, empty, nested]);
  });

  it('orders the issues by the form fields and keeps the first violation of a field', () => {
    const result = mapServerViolations(
      CreateWarehouseRequestFormRules,
      [
        violation('time_zone', 'string.pattern'),
        violation('name', 'string.min_len'),
        violation('name', 'string.max_len'),
        violation('idempotency_key', 'string.uuid'),
      ],
      FIELD_NAMES,
    );

    expect(result.fieldIssues).toEqual([
      { field: 'name', ruleId: 'string.min_len' },
      { field: 'timeZone', ruleId: 'string.pattern' },
    ]);
    expect(result.unmatched.map(item => item.fieldPath)).toEqual(['idempotency_key']);
  });

  it('returns nothing for no violations', () => {
    expect(mapServerViolations(CreateWarehouseRequestFormRules, [], FIELD_NAMES)).toEqual({
      fieldIssues: [],
      unmatched: [],
    });
  });

  describe('nested fields', () => {
    it('puts a violation of a nested field under the nested path of the form', () => {
      const result = mapServerViolations(
        UpdateOrganizationRequisitesRequestFormRules,
        [violation('bank.settlement_account', 'field_check.settlement_account')],
        REQUISITES_FIELD_NAMES,
      );

      expect(result.fieldIssues).toEqual([{ field: 'bank.settlementAccount', ruleId: 'field_check.settlement_account' }]);
      expect(result.unmatched).toEqual([]);
    });

    it('turns snake_case into camelCase in every segment of a nested path that has no rules', () => {
      const rules = { fields: {} };

      const result = mapServerViolations(
        rules,
        [violation('bank.bank_name', 'string.max_len')],
        REQUISITES_FIELD_NAMES,
      );

      expect(result.fieldIssues).toEqual([{ field: 'bank.bankName', ruleId: 'string.max_len' }]);
    });

    it('leaves a violation of a nested field that is not on the form in the remainder', () => {
      const unknown = violation('bank.unknown_field', 'string.max_len');
      const listItem = violation('signatories[0].full_name', 'string.min_len');

      const result = mapServerViolations(
        UpdateOrganizationRequisitesRequestFormRules,
        [unknown, listItem],
        REQUISITES_FIELD_NAMES,
      );

      expect(result.fieldIssues).toEqual([]);
      expect(result.unmatched).toEqual([unknown, listItem]);
    });

    it('orders nested issues by the form fields', () => {
      const result = mapServerViolations(
        UpdateOrganizationRequisitesRequestFormRules,
        [
          violation('bank.settlement_account', 'field_check.settlement_account'),
          violation('legal_address', 'string.max_len'),
          violation('bank.bik', 'field_check.bik'),
        ],
        REQUISITES_FIELD_NAMES,
      );

      expect(result.fieldIssues.map(issue => issue.field)).toEqual([
        'bank.bik',
        'bank.settlementAccount',
        'legalAddress',
      ]);
    });
  });
});
