import {
  create,
  type MessageInitShape,
} from '@bufbuild/protobuf';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  type GetShowcaseListingRequest,
  GetShowcaseListingRequestSchema,
  type ListShowcaseListingsRequest,
  ListShowcaseListingsRequestSchema,
} from '../gen/catalog/v1/showcase_pb';
import { collectViolations } from './collectViolations';

const validUuid = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const otherUuid = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

describe('ListShowcaseListingsRequest', () => {
  const createRequest = (overrides: MessageInitShape<typeof ListShowcaseListingsRequestSchema> = {}): ListShowcaseListingsRequest =>
    create(ListShowcaseListingsRequestSchema, overrides);

  it('accepts a request without filters', () => {
    expect(collectViolations(ListShowcaseListingsRequestSchema, createRequest())).toEqual([]);
  });

  it('accepts every filter', () => {
    const request = createRequest({
      query: 'яблоки',
      sphereId: validUuid,
      supplierOrganizationId: otherUuid,
      toWarehouseId: validUuid,
    });

    expect(collectViolations(ListShowcaseListingsRequestSchema, request)).toEqual([]);
  });

  it.each([
    { fieldPath: 'sphere_id', overrides: { sphereId: 'dairy' } },
    { fieldPath: 'supplier_organization_id', overrides: { supplierOrganizationId: 'supplier' } },
    { fieldPath: 'to_warehouse_id', overrides: { toWarehouseId: 'warehouse' } },
  ])('rejects $fieldPath that is not an identifier', ({ fieldPath, overrides }) => {
    expect(collectViolations(ListShowcaseListingsRequestSchema, createRequest(overrides))).toEqual([
      { fieldPath, ruleId: 'string.uuid' },
    ]);
  });

  it('accepts a query of a hundred characters', () => {
    expect(collectViolations(ListShowcaseListingsRequestSchema, createRequest({ query: 'я'.repeat(100) }))).toEqual([]);
  });

  it('rejects a query above a hundred characters', () => {
    expect(collectViolations(ListShowcaseListingsRequestSchema, createRequest({ query: 'я'.repeat(101) }))).toEqual([
      { fieldPath: 'query', ruleId: 'string.max_len' },
    ]);
  });
});

describe('GetShowcaseListingRequest', () => {
  const createRequest = (overrides: MessageInitShape<typeof GetShowcaseListingRequestSchema> = {}): GetShowcaseListingRequest =>
    create(GetShowcaseListingRequestSchema, { listingId: validUuid, ...overrides });

  it('accepts a listing without a warehouse and a quantity', () => {
    expect(collectViolations(GetShowcaseListingRequestSchema, createRequest())).toEqual([]);
  });

  it('accepts a warehouse and a quantity', () => {
    const request = createRequest({ quantity: 480n, toWarehouseId: otherUuid });

    expect(collectViolations(GetShowcaseListingRequestSchema, request)).toEqual([]);
  });

  it('rejects a request without a listing', () => {
    expect(collectViolations(GetShowcaseListingRequestSchema, createRequest({ listingId: '' }))).toEqual([
      { fieldPath: 'listing_id', ruleId: 'string.uuid_empty' },
    ]);
  });

  it('rejects a listing that is not an identifier', () => {
    expect(collectViolations(GetShowcaseListingRequestSchema, createRequest({ listingId: 'apples' }))).toEqual([
      { fieldPath: 'listing_id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects a warehouse that is not an identifier', () => {
    expect(collectViolations(GetShowcaseListingRequestSchema, createRequest({ toWarehouseId: 'warehouse' }))).toEqual([
      { fieldPath: 'to_warehouse_id', ruleId: 'string.uuid' },
    ]);
  });

  it('rejects a negative quantity', () => {
    expect(collectViolations(GetShowcaseListingRequestSchema, createRequest({ quantity: -1n }))).toEqual([
      { fieldPath: 'quantity', ruleId: 'int64.gte' },
    ]);
  });
});
