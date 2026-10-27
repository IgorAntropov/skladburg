import { AssistantAddressForm } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { SeedOrganizationId } from './seedIds';
import {
  createSeedOrganizations,
  createSeedOrganizationSettings,
} from './seedOrganizations';

const LOGO_KEY_PATTERN = /^(customer|supplier|carrier)-\d+$/;

describe('createSeedOrganizations', () => {
  const organizations = createSeedOrganizations();

  it('gives every organization a light and a dark logo by the shared path template', () => {
    expect(organizations).toHaveLength(9);

    for (const { logo, name } of organizations) {
      const lightMatch = /^logos\/(.+)-light\.svg$/.exec(logo?.lightUrl ?? '');
      const darkMatch = /^logos\/(.+)-dark\.svg$/.exec(logo?.darkUrl ?? '');

      expect(lightMatch?.[1], name).toMatch(LOGO_KEY_PATTERN);
      expect(darkMatch?.[1], name).toBe(lightMatch?.[1]);
    }
  });

  it('keeps the logo paths unique across organizations and variants', () => {
    const paths = organizations.flatMap(organization => [organization.logo?.lightUrl, organization.logo?.darkUrl]);

    expect(new Set(paths).size).toBe(organizations.length * 2);
  });

  it('names the logo key after the placeholder name of the organization', () => {
    const keys = organizations.map(organization => [organization.name, organization.logo?.lightUrl]);

    expect(keys).toEqual([
      ['Заказчик 1', 'logos/customer-1-light.svg'],
      ['Поставщик 1', 'logos/supplier-1-light.svg'],
      ['Поставщик 2', 'logos/supplier-2-light.svg'],
      ['Перевозчик 1', 'logos/carrier-1-light.svg'],
      ['Заказчик 2', 'logos/customer-2-light.svg'],
      ['Поставщик 3', 'logos/supplier-3-light.svg'],
      ['Поставщик 4', 'logos/supplier-4-light.svg'],
      ['Перевозчик 2', 'logos/carrier-2-light.svg'],
      ['Поставщик 5', 'logos/supplier-5-light.svg'],
    ]);
  });
});

describe('createSeedOrganizationSettings', () => {
  const settings = createSeedOrganizationSettings();

  it('sets the assistant address form explicitly for every organization', () => {
    expect(settings).toHaveLength(9);

    for (const entry of settings) {
      expect(
        [AssistantAddressForm.FORMAL, AssistantAddressForm.INFORMAL],
        entry.organizationId,
      ).toContain(entry.assistantAddressForm);
    }
  });

  it('addresses informally only the second carrier and formally everyone else', () => {
    const informal = settings.filter(entry => entry.assistantAddressForm === AssistantAddressForm.INFORMAL);

    expect(informal.map(entry => entry.organizationId)).toEqual([SeedOrganizationId.CARRIER_2]);
    expect(settings.filter(entry => entry.assistantAddressForm === AssistantAddressForm.FORMAL)).toHaveLength(8);
  });
});
