import { AssistantAddressForm } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedSphereId,
} from './seedIds';
import {
  createSeedOrganizations,
  createSeedOrganizationSettings,
} from './seedOrganizations';

const LOGO_KEY_PATTERN = /^(customer|supplier|carrier)-\d+$/;

describe('createSeedOrganizations', () => {
  const organizations = createSeedOrganizations();

  it('lists the eleven organizations by their names in the order of the identifiers', () => {
    expect(organizations.map(organization => organization.name)).toEqual([
      'Тёплый угол',
      'Яблоневый край',
      'Белое поле',
      'Северный холод',
      'Каменный двор',
      'Прокатный ряд',
      'Серый камень',
      'Широкий путь',
      'Южная грядка',
      'Утиный брод',
      'Ровный брус',
    ]);
    expect(organizations.map(organization => organization.id)).toEqual([
      SeedOrganizationId.CUSTOMER_1,
      SeedOrganizationId.SUPPLIER_1,
      SeedOrganizationId.SUPPLIER_2,
      SeedOrganizationId.CARRIER_1,
      SeedOrganizationId.CUSTOMER_2,
      SeedOrganizationId.SUPPLIER_3,
      SeedOrganizationId.SUPPLIER_4,
      SeedOrganizationId.CARRIER_2,
      SeedOrganizationId.SUPPLIER_5,
      SeedOrganizationId.SUPPLIER_6,
      SeedOrganizationId.SUPPLIER_7,
    ]);
  });

  it('gives the nine first organizations a light and a dark logo by the shared path template', () => {
    const withLogo = organizations.filter(organization => organization.logo !== undefined);

    expect(withLogo).toHaveLength(9);

    for (const { logo, name } of withLogo) {
      const lightMatch = /^logos\/(.+)-light\.svg$/.exec(logo?.lightUrl ?? '');
      const darkMatch = /^logos\/(.+)-dark\.svg$/.exec(logo?.darkUrl ?? '');

      expect(lightMatch?.[1], name).toMatch(LOGO_KEY_PATTERN);
      expect(darkMatch?.[1], name).toBe(lightMatch?.[1]);
    }
  });

  it('keeps the logo paths unique across organizations and variants', () => {
    const paths = organizations.flatMap(organization => [organization.logo?.lightUrl, organization.logo?.darkUrl])
      .filter(path => path !== undefined);

    expect(paths).toHaveLength(18);
    expect(new Set(paths).size).toBe(18);
  });

  it('keys the logo by the identifier of the organization, not by its name', () => {
    const keys = organizations.map(organization => [organization.id, organization.logo?.lightUrl]);

    expect(keys).toEqual([
      [SeedOrganizationId.CUSTOMER_1, 'logos/customer-1-light.svg'],
      [SeedOrganizationId.SUPPLIER_1, 'logos/supplier-1-light.svg'],
      [SeedOrganizationId.SUPPLIER_2, 'logos/supplier-2-light.svg'],
      [SeedOrganizationId.CARRIER_1, 'logos/carrier-1-light.svg'],
      [SeedOrganizationId.CUSTOMER_2, 'logos/customer-2-light.svg'],
      [SeedOrganizationId.SUPPLIER_3, 'logos/supplier-3-light.svg'],
      [SeedOrganizationId.SUPPLIER_4, 'logos/supplier-4-light.svg'],
      [SeedOrganizationId.CARRIER_2, 'logos/carrier-2-light.svg'],
      [SeedOrganizationId.SUPPLIER_5, 'logos/supplier-5-light.svg'],
      [SeedOrganizationId.SUPPLIER_6, undefined],
      [SeedOrganizationId.SUPPLIER_7, undefined],
    ]);
  });

  it('assigns the spheres of the source document to the organizations', () => {
    const spheres = new Map(organizations.map(organization => [organization.id, organization.sphereIds]));

    expect(spheres.get(SeedOrganizationId.CUSTOMER_1)).toEqual([SeedSphereId.FOOD]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_1)).toEqual([SeedSphereId.FRUIT_AND_VEGETABLES]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_2)).toEqual([SeedSphereId.DAIRY]);
    expect(spheres.get(SeedOrganizationId.CARRIER_1)).toEqual([SeedSphereId.FOOD]);
    expect(spheres.get(SeedOrganizationId.CUSTOMER_2)).toEqual([SeedSphereId.CONSTRUCTION]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_3)).toEqual([SeedSphereId.METAL_PRODUCTS]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_4)).toEqual([SeedSphereId.CEMENT_AND_CONCRETE]);
    expect(spheres.get(SeedOrganizationId.CARRIER_2)).toEqual([SeedSphereId.CONSTRUCTION]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_5)).toEqual([SeedSphereId.FRUIT_AND_VEGETABLES]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_6)).toEqual([SeedSphereId.MEAT_AND_POULTRY]);
    expect(spheres.get(SeedOrganizationId.SUPPLIER_7)).toEqual([SeedSphereId.TIMBER]);
  });
});

describe('createSeedOrganizationSettings', () => {
  const settings = createSeedOrganizationSettings();

  it('sets the assistant address form explicitly for every organization', () => {
    expect(settings).toHaveLength(11);

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
    expect(settings.filter(entry => entry.assistantAddressForm === AssistantAddressForm.FORMAL)).toHaveLength(10);
  });
});
