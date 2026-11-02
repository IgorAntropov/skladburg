import type { PriceList } from '@skladburg/contracts/catalog/v1/catalog';
import type { Organization } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import {
  ListingPriceSchema,
  ListingSchema,
  PriceListSchema,
  PriceTierSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { CalendarDateValue } from '../calendar/index';
import type { ShowcaseListingVisibilityInputValue } from './showcaseListing';

import { isShowcaseListingVisible } from './showcaseListing';

const SUPPLIER_ID = 'a0000000-0000-4000-8000-000000000001';
const VIEWER_ID = 'a0000000-0000-4000-8000-000000000002';
const TODAY: CalendarDateValue = { day: 15, month: 10, year: 2026 };

const buildOrganization = (id: string, profiles: readonly { kind: ProfileKind; verificationLevel: number }[]): Organization =>
  create(OrganizationSchema, { id, profiles: [...profiles] });

const buildPriceList = (validUntil: CalendarDateValue | undefined): PriceList =>
  create(PriceListSchema, { tenantId: SUPPLIER_ID, validUntil });

const buildInput = (overrides: Partial<ShowcaseListingVisibilityInputValue> = {}): ShowcaseListingVisibilityInputValue => ({
  listing: create(ListingSchema, { id: 'listing', isPublished: true, tenantId: SUPPLIER_ID }),
  listingPrice: create(ListingPriceSchema, {
    listingId: 'listing',
    tiers: [create(PriceTierSchema, { minQuantity: 1n })],
  }),
  priceList: undefined,
  supplier: buildOrganization(SUPPLIER_ID, [{ kind: ProfileKind.SUPPLIER, verificationLevel: 1 }]),
  today: TODAY,
  viewer: buildOrganization(VIEWER_ID, [{ kind: ProfileKind.CUSTOMER, verificationLevel: 1 }]),
  ...overrides,
});

describe('isShowcaseListingVisible', () => {
  it('shows a published priced listing of a verified supplier to a verified customer', () => {
    expect(isShowcaseListingVisible(buildInput())).toBe(true);
  });

  it.each([
    {
      name: 'the listing is a draft',
      overrides: { listing: create(ListingSchema, { id: 'listing', isPublished: false, tenantId: SUPPLIER_ID }) },
    },
    {
      name: 'the listing belongs to the viewer',
      overrides: { viewer: buildOrganization(SUPPLIER_ID, [
        { kind: ProfileKind.CUSTOMER, verificationLevel: 1 },
        { kind: ProfileKind.SUPPLIER, verificationLevel: 1 },
      ]) },
    },
    {
      name: 'the viewer customer profile is not verified',
      overrides: { viewer: buildOrganization(VIEWER_ID, [{ kind: ProfileKind.CUSTOMER, verificationLevel: 0 }]) },
    },
    {
      name: 'the viewer has no customer profile',
      overrides: { viewer: buildOrganization(VIEWER_ID, [{ kind: ProfileKind.CARRIER, verificationLevel: 2 }]) },
    },
    {
      name: 'the supplier profile is not verified',
      overrides: { supplier: buildOrganization(SUPPLIER_ID, [{ kind: ProfileKind.SUPPLIER, verificationLevel: 0 }]) },
    },
    { name: 'the listing has no price', overrides: { listingPrice: undefined } },
    {
      name: 'the price has no tiers',
      overrides: { listingPrice: create(ListingPriceSchema, { listingId: 'listing', tiers: [] }) },
    },
    {
      name: 'the price list expired yesterday',
      overrides: { priceList: buildPriceList({ day: 14, month: 10, year: 2026 }) },
    },
    {
      name: 'the price list expired in the previous year',
      overrides: { priceList: buildPriceList({ day: 31, month: 12, year: 2025 }) },
    },
  ])('hides the listing when $name', ({ overrides }) => {
    expect(isShowcaseListingVisible(buildInput(overrides))).toBe(false);
  });

  it.each([
    { name: 'there is no price list', priceList: undefined },
    { name: 'the price list has no end date', priceList: buildPriceList(undefined) },
    { name: 'the price list ends today', priceList: buildPriceList(TODAY) },
    { name: 'the price list ends tomorrow', priceList: buildPriceList({ day: 16, month: 10, year: 2026 }) },
    { name: 'the price list ends next year', priceList: buildPriceList({ day: 1, month: 1, year: 2027 }) },
  ])('keeps the listing when $name', ({ priceList }) => {
    expect(isShowcaseListingVisible(buildInput({ priceList }))).toBe(true);
  });

  it('switches the listing from visible to hidden on the day after the price list ends', () => {
    const priceList = buildPriceList({ day: 31, month: 10, year: 2026 });

    expect(isShowcaseListingVisible(buildInput({ priceList, today: { day: 31, month: 10, year: 2026 } }))).toBe(true);
    expect(isShowcaseListingVisible(buildInput({ priceList, today: { day: 1, month: 11, year: 2026 } }))).toBe(false);
  });

  it('hides the catalog of an organization with a verified carrier and an unverified supplier profile', () => {
    const supplier = buildOrganization(SUPPLIER_ID, [
      { kind: ProfileKind.CARRIER, verificationLevel: 2 },
      { kind: ProfileKind.SUPPLIER, verificationLevel: 0 },
    ]);

    expect(isShowcaseListingVisible(buildInput({ supplier }))).toBe(false);
  });
});
