import {
  isCorrespondentAccountValid,
  isInnValid,
  isKppValid,
  isOgrnValid,
  isSettlementAccountValid,
} from '@skladburg/contracts/forms';
import {
  OrganizationRequisitesSchema,
  SignatoryBasis,
} from '@skladburg/contracts/organization/v1/requisites';
import { getContractRegistry } from '@skladburg/contracts/registry';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolvePermissionGrants } from '../access/index';
import { createDomainErrors } from '../errors/index';
import { isPlatformOperator } from '../platform/index';
import { createSeededRandom } from '../ports/index';
import {
  createEngineState,
  type IStateReader,
} from '../state/index';
import { createRequestValidator } from '../validation/index';
import { listVisibleMapSites } from '../visibility/index';
import {
  SeedOrganizationId,
  SeedPersonaId,
  SeedWarehouseId,
} from './seedIds';
import {
  createSeedRecords,
  createSeedSnapshot,
} from './seedSnapshot';

const TECHNICAL_ORGANIZATION_NAME_PATTERN = /^(Заказчик|Поставщик|Перевозчик) \d+$/;
const USER_NAME_PATTERN = /^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+$/;
const ROLE_NAME_PATTERN = /^(Директор|Администратор|Бухгалтер|Закупщик|Менеджер продаж|Кладовщик|Диспетчер)$/;
const WAREHOUSE_NAME_PATTERN = /^(Склад|Площадка) \d+$/;
const OPERATOR_NAME_PATTERN = /^Тридок$/;
const OPERATOR_LEGAL_NAME_PATTERN = /^ООО «Тридок»$/;
const OPERATOR_USER_NAME_PATTERN = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.$/;
const OPERATOR_ROLE_NAME_PATTERN = /^(Агент поддержки|Инженер поддержки|Администратор платформы|Супер-администратор)$/;
const LEGAL_ADDRESS_CITY_PATTERN = /^000000, г\. ([^,]+),/;

const BIK_REGION_START = 2;
const BIK_REGION_END = 4;
const ACCOUNT_LENGTH = 20;
const BUYER_LIMIT_MINOR = 10_000_000n;

const isCalendarDateExisting = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const isTimeZoneExisting = (timeZone: string): boolean => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone.length > 0;
  }
  catch {
    return false;
  }
};

const readFirstName = (displayName: string): string => displayName.split(' ')[0] ?? '';

const createSeedReader = (): IStateReader => createEngineState(createSeedSnapshot()).read;

describe('seed organization identifiers', () => {
  const organizations = createSeedRecords().organizations;

  it('uses an INN of ten digits with a correct check digit', () => {
    for (const { inn, name } of organizations) {
      expect(inn, name).toMatch(/^\d{10}$/);
      expect(isInnValid(inn), name).toBe(true);
    }
  });

  it('uses an OGRN of thirteen digits with a correct check digit', () => {
    for (const { name, ogrn } of organizations) {
      expect(ogrn, name).toMatch(/^[15]\d{12}$/);
      expect(isOgrnValid(ogrn), name).toBe(true);
    }
  });

  it('gives every KPP the format of the tax service', () => {
    for (const { kpp, name } of organizations) {
      expect(isKppValid(kpp), name).toBe(true);
    }
  });

  it('builds the KPP of nine digits from a non-existent tax office code, the permanent reason code 01 and a serial', () => {
    for (const { kpp, name } of organizations) {
      expect(kpp, name).toMatch(/^\d{9}$/);
      expect(kpp.slice(0, 4), name).toBe('0000');
      expect(kpp.slice(4, 6), name).toBe('01');
    }
  });

  it('puts the non-existent region code 00 into the INN and the OGRN', () => {
    for (const { inn, name, ogrn } of organizations) {
      expect(inn.slice(0, 2), name).toBe('00');
      expect(ogrn.slice(3, 5), name).toBe('00');
    }
  });

  it('keeps identifiers unique across organizations', () => {
    expect(new Set(organizations.map(organization => organization.inn)).size).toBe(organizations.length);
    expect(new Set(organizations.map(organization => organization.ogrn)).size).toBe(organizations.length);
    expect(new Set(organizations.map(organization => organization.kpp)).size).toBe(organizations.length);
  });
});

describe('seed bank details', () => {
  const requisites = createSeedRecords().organizationRequisites;

  it('contains the requisites to check', () => {
    expect(requisites.length).toBeGreaterThan(0);
  });

  it('uses a BIK of the non-existent region 00', () => {
    for (const { bank, organizationId } of requisites) {
      expect(bank?.bik, organizationId).toMatch(/^04\d{7}$/);
      expect(bank?.bik.slice(BIK_REGION_START, BIK_REGION_END), organizationId).toBe('00');
    }
  });

  it('gives every account of twenty digits a correct key by the bank algorithm', () => {
    for (const { bank, organizationId } of requisites) {
      expect(bank?.settlementAccount, organizationId).toHaveLength(ACCOUNT_LENGTH);
      expect(bank?.correspondentAccount, organizationId).toHaveLength(ACCOUNT_LENGTH);
      expect(isSettlementAccountValid(bank?.bik ?? '', bank?.settlementAccount ?? ''), organizationId).toBe(true);
      expect(isCorrespondentAccountValid(bank?.bik ?? '', bank?.correspondentAccount ?? ''), organizationId).toBe(true);
    }
  });

  it('keeps settlement accounts unique across organizations', () => {
    const accounts = requisites.map(entry => entry.bank?.settlementAccount);

    expect(new Set(accounts).size).toBe(requisites.length);
  });
});

describe('seed requisites', () => {
  const records = createSeedRecords();
  const requisites = records.organizationRequisites;
  const validator = createRequestValidator(createDomainErrors(createSeededRandom(1)), getContractRegistry());

  it('gives the bank accounts of every organization a correct key', () => {
    expect(requisites.length).toBeGreaterThan(0);

    for (const entry of requisites) {
      expect(isSettlementAccountValid(entry.bank?.bik ?? '', entry.bank?.settlementAccount ?? ''), entry.organizationId).toBe(true);
      expect(isCorrespondentAccountValid(entry.bank?.bik ?? '', entry.bank?.correspondentAccount ?? ''), entry.organizationId).toBe(true);
    }
  });

  it('gives every organization, the operator included, exactly one record', () => {
    expect(requisites).toHaveLength(records.organizations.length);

    for (const organization of records.organizations) {
      expect(requisites.filter(entry => entry.organizationId === organization.id), organization.name).toHaveLength(1);
    }
  });

  it('passes the contract validation rules of its message', () => {
    for (const entry of requisites) {
      expect(validator.collect(OrganizationRequisitesSchema, entry), entry.organizationId).toEqual([]);
    }
  });

  it('uses an existing IANA time zone equal to the one of the legal address city', () => {
    const cityZones = new Map(records.cities.map(city => [city.name, city.timeZone]));

    for (const entry of requisites) {
      const cityName = LEGAL_ADDRESS_CITY_PATTERN.exec(entry.legalAddress)?.[1] ?? '';

      expect(isTimeZoneExisting(entry.timeZone), entry.organizationId).toBe(true);
      expect(cityZones.has(cityName), entry.legalAddress).toBe(true);
      expect(entry.timeZone, entry.legalAddress).toBe(cityZones.get(cityName));
    }
  });

  it('puts the non-existent index 000000 into every legal address', () => {
    for (const entry of requisites) {
      expect(entry.legalAddress, entry.organizationId).toMatch(/^000000, г\. /);
    }
  });

  it('marks exactly one signatory of every organization as the default one', () => {
    for (const entry of requisites) {
      expect(entry.signatories.filter(signatory => signatory.isDefault), entry.organizationId).toHaveLength(1);
    }
  });

  it('keeps signatory identifiers unique across organizations', () => {
    const ids = requisites.flatMap(entry => entry.signatories.map(signatory => signatory.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives a signatory by power of attorney a number and an existing date and a signatory by charter neither', () => {
    const signatories = requisites.flatMap(entry => entry.signatories);

    expect(signatories.some(signatory => signatory.basis === SignatoryBasis.POWER_OF_ATTORNEY)).toBe(true);
    expect(signatories.some(signatory => signatory.basis === SignatoryBasis.CHARTER)).toBe(true);

    for (const signatory of signatories) {
      if (signatory.basis === SignatoryBasis.POWER_OF_ATTORNEY) {
        expect(signatory.powerOfAttorneyNumber, signatory.fullName).not.toBe('');
        expect(signatory.powerOfAttorneyDate, signatory.fullName).toBeDefined();
        expect(
          isCalendarDateExisting(
            signatory.powerOfAttorneyDate?.year ?? 0,
            signatory.powerOfAttorneyDate?.month ?? 0,
            signatory.powerOfAttorneyDate?.day ?? 0,
          ),
          signatory.fullName,
        ).toBe(true);
      }
      else {
        expect(signatory.basis, signatory.fullName).toBe(SignatoryBasis.CHARTER);
        expect(signatory.powerOfAttorneyNumber, signatory.fullName).toBe('');
        expect(signatory.powerOfAttorneyDate, signatory.fullName).toBeUndefined();
      }
    }
  });

  it('names every signatory by the surname, the first name and the patronymic', () => {
    for (const signatory of requisites.flatMap(entry => entry.signatories)) {
      expect(signatory.fullName).toMatch(/^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+$/);
    }
  });
});

describe('seed pairs in one city', () => {
  const read = createSeedReader();

  it('puts a supplier and a customer into Moscow and into Novosibirsk, all verified and visible to each other', () => {
    const pairs = [
      [SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1, SeedWarehouseId.SUPPLIER_6_WAREHOUSE_1],
      [SeedWarehouseId.CUSTOMER_2_SITE_2, SeedWarehouseId.SUPPLIER_7_WAREHOUSE_1],
    ] as const;

    for (const [customerWarehouseId, supplierWarehouseId] of pairs) {
      const customerWarehouse = read.get('warehouses', customerWarehouseId);
      const supplierWarehouse = read.get('warehouses', supplierWarehouseId);
      const customerId = customerWarehouse?.tenantId ?? '';
      const supplierId = supplierWarehouse?.tenantId ?? '';

      expect(customerWarehouse?.cityId).toBe(supplierWarehouse?.cityId);
      expect(listVisibleMapSites(read, customerId).map(site => site.id)).toContain(supplierWarehouseId);
      expect(listVisibleMapSites(read, supplierId).map(site => site.id)).toContain(customerWarehouseId);
    }
  });

  it('gives an organization two warehouses in one city', () => {
    const warehouses = read.listBy('warehouses', 'tenantId', SeedOrganizationId.SUPPLIER_1);

    expect(warehouses).toHaveLength(2);
    expect(new Set(warehouses.map(warehouse => warehouse.cityId)).size).toBe(1);
  });
});

describe('seed personas of the first customer', () => {
  const read = createSeedReader();

  const readGrants = (personaId: string, permission: string): ReturnType<typeof resolvePermissionGrants> => {
    const persona = read.get('personas', personaId);
    const membership = read
      .listBy('memberships', 'userId', persona?.userId ?? '')
      .find(candidate => candidate.organizationId === persona?.organizationId);

    return membership === undefined
      ? []
      : resolvePermissionGrants(read, membership).filter(grant => grant.permission === permission);
  };

  it('lets the customer persona fund a payment and approve a deal without a limit', () => {
    const fund = readGrants(SeedPersonaId.FRESH_CUSTOMER, 'payment_fund');
    const approve = readGrants(SeedPersonaId.FRESH_CUSTOMER, 'deal_approve');

    expect(fund.length).toBeGreaterThan(0);
    expect(fund.every(grant => grant.isOrganizationWide && grant.amountLimit === undefined)).toBe(true);
    expect(approve.length).toBeGreaterThan(0);
    expect(approve.every(grant => grant.isOrganizationWide && grant.amountLimit === undefined)).toBe(true);
  });

  it('lets the buyer persona approve a deal up to 100 000 roubles and never fund a payment', () => {
    const approve = readGrants(SeedPersonaId.FRESH_BUYER, 'deal_approve');

    expect(readGrants(SeedPersonaId.FRESH_BUYER, 'payment_fund')).toEqual([]);
    expect(approve).toHaveLength(1);
    expect(approve[0]?.amountLimit?.amountMinor).toBe(BUYER_LIMIT_MINOR);
    expect(approve[0]?.amountLimit?.currencyCode).toBe('RUB');
  });

  it('puts the buyer persona into the customer organization of the fresh vertical', () => {
    expect(read.get('personas', SeedPersonaId.FRESH_BUYER)).toMatchObject({
      organizationId: SeedOrganizationId.CUSTOMER_1,
    });
  });
});

describe('seed fictional names', () => {
  const records = createSeedRecords();
  const operatorUserIds = new Set(
    records.memberships.filter(membership => isPlatformOperator(membership.organizationId)).map(membership => membership.userId),
  );
  const clientOrganizations = records.organizations.filter(organization => !isPlatformOperator(organization.id));
  const clientSettings = records.organizationSettings.filter(settings => !isPlatformOperator(settings.organizationId));
  const clientUsers = records.users.filter(user => !operatorUserIds.has(user.id));
  const operatorUsers = records.users.filter(user => operatorUserIds.has(user.id));
  const clientRoles = records.roles.filter(role => !isPlatformOperator(role.tenantId));

  it('contains organizations, users, roles and warehouses to check', () => {
    expect(clientOrganizations.length).toBeGreaterThan(0);
    expect(records.organizationSettings.length).toBe(records.organizations.length);
    expect(clientUsers.length).toBeGreaterThan(0);
    expect(clientRoles.length).toBeGreaterThan(0);
    expect(records.warehouses.length).toBeGreaterThan(0);
  });

  it('names organizations by a company name, not by the technical template', () => {
    for (const { name } of clientOrganizations) {
      expect(name).not.toMatch(TECHNICAL_ORGANIZATION_NAME_PATTERN);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('names legal entities as a limited liability company with the organization name', () => {
    for (const { legalName, name } of clientOrganizations) {
      expect(legalName).toBe(`ООО «${name}»`);
    }
  });

  it('names brands after the organization', () => {
    const namesById = new Map(clientOrganizations.map(organization => [organization.id, organization.name]));

    for (const { brandName, organizationId } of clientSettings) {
      expect(brandName).toBe(namesById.get(organizationId));
    }
  });

  it('keeps organization names different', () => {
    const names = records.organizations.map(organization => organization.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('names users by the first name and the last name', () => {
    for (const { displayName } of clientUsers) {
      expect(displayName).toMatch(USER_NAME_PATTERN);
    }
  });

  it('gives every user a different name', () => {
    const names = records.users.map(user => user.displayName);

    expect(new Set(names).size).toBe(names.length);
  });

  it('gives no employee of the operator a first name of a client user', () => {
    const clientFirstNames = new Set(clientUsers.map(user => readFirstName(user.displayName)));

    expect(operatorUsers.length).toBeGreaterThan(0);

    for (const { displayName } of operatorUsers) {
      expect(clientFirstNames.has(readFirstName(displayName)), displayName).toBe(false);
    }
  });

  it('names roles by the preset names', () => {
    for (const { name } of clientRoles) {
      expect(name).toMatch(ROLE_NAME_PATTERN);
    }
  });

  it('names warehouses by the number', () => {
    for (const { name } of records.warehouses) {
      expect(name).toMatch(WAREHOUSE_NAME_PATTERN);
    }
  });

  it('names the platform operator, its brand, its staff and its roles by their own patterns', () => {
    const operatorOrganizations = records.organizations.filter(organization => isPlatformOperator(organization.id));
    const operatorSettings = records.organizationSettings.filter(settings => isPlatformOperator(settings.organizationId));
    const operatorRoles = records.roles.filter(role => isPlatformOperator(role.tenantId));

    expect(operatorOrganizations.map(organization => organization.name)).toEqual(['Тридок']);
    expect(operatorOrganizations.map(organization => organization.legalName)).toEqual(['ООО «Тридок»']);
    expect(operatorSettings.map(settings => settings.brandName)).toEqual(['Тридок']);
    expect(operatorUsers).toHaveLength(5);
    expect(operatorRoles).toHaveLength(4);

    operatorOrganizations.forEach(({ legalName, name }) => {
      expect(name).toMatch(OPERATOR_NAME_PATTERN);
      expect(legalName).toMatch(OPERATOR_LEGAL_NAME_PATTERN);
    });
    operatorUsers.forEach(({ displayName }) => {
      expect(displayName).toMatch(OPERATOR_USER_NAME_PATTERN);
    });
    operatorRoles.forEach(({ name }) => {
      expect(name).toMatch(OPERATOR_ROLE_NAME_PATTERN);
    });
  });
});
