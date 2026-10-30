import {
  describe,
  expect,
  it,
} from 'vitest';

import { UpdateOrganizationRequisitesRequestFormRules } from '../gen/forms/organization/v1/requisites_rules';
import { isFormFieldRequired } from './isFormFieldRequired';

describe('isFormFieldRequired on generated tables', () => {
  it('marks the requisites form fields whose rules reject an empty string as required', () => {
    const fields = [
      'legalAddress',
      'bank.bankName',
      'bank.bik',
      'bank.settlementAccount',
      'bank.correspondentAccount',
    ];

    for (const field of fields) {
      expect(isFormFieldRequired(UpdateOrganizationRequisitesRequestFormRules, field), field).toBe(true);
    }
  });
});
