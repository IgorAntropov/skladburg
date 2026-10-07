import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import { ErrorDetailSchema } from '@skladburg/contracts/common/v1/error';
import {
  type PageRequest,
  PageRequestSchema,
} from '@skladburg/contracts/common/v1/page';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../errors/index';
import { createSeededRandom } from '../ports/index';
import {
  DEFAULT_PAGE_SIZE,
  INVALID_PAGE_TOKEN_RULE_ID,
  PAGE_TOKEN_FIELD_PATH,
  paginate,
} from './pagination';

const errors = createDomainErrors(createSeededRandom(1));
const keyOf = (item: string): string => item;
const request = (overrides: MessageInitShape<typeof PageRequestSchema>): PageRequest => create(PageRequestSchema, overrides);
const createItems = (count: number): string[] => Array.from({ length: count }, (_, index) => `item-${String(index).padStart(4, '0')}`);

describe('paginate', () => {
  it('returns everything and an empty token when the list fits the default page', () => {
    const items = createItems(3);

    const result = paginate(items, keyOf, undefined, errors);

    expect(result.items).toEqual(items);
    expect(result.page.nextPageToken).toBe('');
  });

  it('uses the default page size when the requested size is 0', () => {
    const items = createItems(DEFAULT_PAGE_SIZE + 5);

    const result = paginate(items, keyOf, request({ pageSize: 0 }), errors);

    expect(result.items).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.page.nextPageToken).toBe(items[DEFAULT_PAGE_SIZE - 1]);
  });

  it('walks through all pages in order and ends with an empty token', () => {
    const items = createItems(5);
    const collected: string[] = [];
    let pageToken = '';

    do {
      const result = paginate(items, keyOf, request({ pageSize: 2, pageToken }), errors);
      collected.push(...result.items);
      pageToken = result.page.nextPageToken;
    } while (pageToken !== '');

    expect(collected).toEqual(items);
  });

  it('returns an empty token on a page that ends exactly at the end of the list', () => {
    const result = paginate(createItems(4), keyOf, request({ pageSize: 4 }), errors);

    expect(result.items).toHaveLength(4);
    expect(result.page.nextPageToken).toBe('');
  });

  it('returns an empty page for an empty list', () => {
    const result = paginate([], keyOf, undefined, errors);

    expect(result.items).toEqual([]);
    expect(result.page.nextPageToken).toBe('');
  });

  it('rejects a cursor that matches no record with validation_failed on page.page_token', () => {
    expect.assertions(3);

    try {
      paginate(createItems(3), keyOf, request({ pageToken: 'missing' }), errors);
    }
    catch (error) {
      const failure = errors.from(error);

      expect(failure.code).toBe(Code.InvalidArgument);
      expect(failure.rawMessage).toBe('validation_failed');
      expect(failure.findDetails(ErrorDetailSchema)[0]?.params.value).toMatchObject({
        violations: [{ fieldPath: PAGE_TOKEN_FIELD_PATH, ruleId: INVALID_PAGE_TOKEN_RULE_ID }],
      });
    }
  });
});
