import {
  describe,
  expect,
  it,
} from 'vitest';

import { isPlatformOperator } from '../platform/index';
import { createSeedRecords } from './seedSnapshot';

const ORGANIZATION_NAME_PATTERN = /^(Заказчик|Поставщик|Перевозчик) \d+$/;
const LEGAL_NAME_PATTERN = /^ООО «(Заказчик|Поставщик|Перевозчик) \d+»$/;
const USER_NAME_PATTERN = /^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+$/;
const ROLE_NAME_PATTERN = /^(Директор|Администратор|Бухгалтер|Закупщик|Менеджер продаж|Кладовщик|Диспетчер)$/;
const WAREHOUSE_NAME_PATTERN = /^(Склад|Площадка) \d+$/;
const OPERATOR_NAME_PATTERN = /^Тридок$/;
const OPERATOR_LEGAL_NAME_PATTERN = /^ООО «Тридок»$/;
const OPERATOR_USER_NAME_PATTERN = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.$/;
const OPERATOR_ROLE_NAME_PATTERN = /^(Агент поддержки|Инженер поддержки|Администратор платформы|Супер-администратор)$/;

const INN_WEIGHTS: readonly number[] = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN_BODY_LENGTH = 9;
const OGRN_BODY_LENGTH = 12;

const toDigits = (value: string): number[] => Array.from(value, Number);

const computeInnCheckDigit = (body: string): number =>
  (toDigits(body).reduce((sum, digit, position) => sum + digit * (INN_WEIGHTS[position] ?? 0), 0) % 11) % 10;

const computeOgrnCheckDigit = (body: string): number => Number(BigInt(body) % 11n) % 10;

describe('seed organization identifiers', () => {
  const organizations = createSeedRecords().organizations;

  it('uses an INN of ten digits with a wrong check digit', () => {
    for (const { inn, name } of organizations) {
      expect(inn, name).toMatch(/^\d{10}$/);
      expect(computeInnCheckDigit(inn.slice(0, INN_BODY_LENGTH)), name).not.toBe(Number(inn.slice(INN_BODY_LENGTH)));
    }
  });

  it('uses an OGRN of thirteen digits with a wrong check digit', () => {
    for (const { name, ogrn } of organizations) {
      expect(ogrn, name).toMatch(/^[15]\d{12}$/);
      expect(computeOgrnCheckDigit(ogrn.slice(0, OGRN_BODY_LENGTH)), name).not.toBe(Number(ogrn.slice(OGRN_BODY_LENGTH)));
    }
  });

  it('uses a KPP of nine digits with a tax office code that does not exist', () => {
    for (const { kpp, name } of organizations) {
      expect(kpp, name).toMatch(/^\d{9}$/);
      expect(kpp.slice(0, 2), name).toBe('00');
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

  it.each([
    ['000000001', 8],
    ['100000000', 2],
    ['000006000', 0],
  ])('computes the INN check digit of %s as %s by the tax service algorithm', (body, expected) => {
    expect(computeInnCheckDigit(body)).toBe(expected);
  });

  it.each([
    ['000000000012', 1],
    ['000000000011', 0],
    ['000000000010', 0],
  ])('computes the OGRN check digit of %s as %s by the tax service algorithm', (body, expected) => {
    expect(computeOgrnCheckDigit(body)).toBe(expected);
  });
});

describe('seed placeholder names', () => {
  const records = createSeedRecords();
  const operatorUserIds = new Set(
    records.memberships.filter(membership => isPlatformOperator(membership.organizationId)).map(membership => membership.userId),
  );
  const clientOrganizations = records.organizations.filter(organization => !isPlatformOperator(organization.id));
  const clientSettings = records.organizationSettings.filter(settings => !isPlatformOperator(settings.organizationId));
  const clientUsers = records.users.filter(user => !operatorUserIds.has(user.id));
  const clientRoles = records.roles.filter(role => !isPlatformOperator(role.tenantId));

  it('contains organizations, users, roles and warehouses to check', () => {
    expect(clientOrganizations.length).toBeGreaterThan(0);
    expect(records.organizationSettings.length).toBe(records.organizations.length);
    expect(clientUsers.length).toBeGreaterThan(0);
    expect(clientRoles.length).toBeGreaterThan(0);
    expect(records.warehouses.length).toBeGreaterThan(0);
  });

  it('names organizations by the placeholder pattern', () => {
    for (const { name } of clientOrganizations) {
      expect(name).toMatch(ORGANIZATION_NAME_PATTERN);
    }
  });

  it('names legal entities by the placeholder pattern', () => {
    for (const { legalName } of clientOrganizations) {
      expect(legalName).toMatch(LEGAL_NAME_PATTERN);
    }
  });

  it('names brands by the placeholder pattern', () => {
    for (const { brandName } of clientSettings) {
      expect(brandName).toMatch(ORGANIZATION_NAME_PATTERN);
    }
  });

  it('names users by the placeholder pattern', () => {
    for (const { displayName } of clientUsers) {
      expect(displayName).toMatch(USER_NAME_PATTERN);
    }
  });

  it('gives every user a different name', () => {
    const names = records.users.map(user => user.displayName);

    expect(new Set(names).size).toBe(names.length);
  });

  it('names roles by the placeholder pattern', () => {
    for (const { name } of clientRoles) {
      expect(name).toMatch(ROLE_NAME_PATTERN);
    }
  });

  it('names warehouses by the placeholder pattern', () => {
    for (const { name } of records.warehouses) {
      expect(name).toMatch(WAREHOUSE_NAME_PATTERN);
    }
  });

  it('names the platform operator, its brand, its staff and its roles by their own patterns', () => {
    const operatorOrganizations = records.organizations.filter(organization => isPlatformOperator(organization.id));
    const operatorSettings = records.organizationSettings.filter(settings => isPlatformOperator(settings.organizationId));
    const operatorUsers = records.users.filter(user => operatorUserIds.has(user.id));
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
