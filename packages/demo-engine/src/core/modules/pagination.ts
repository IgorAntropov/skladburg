import type { PageRequest } from '@skladburg/contracts/common/v1/page';

import { create } from '@bufbuild/protobuf';
import {
  type PageResponse,
  PageResponseSchema,
} from '@skladburg/contracts/common/v1/page';

import type { IDomainErrors } from '../errors/index';

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_TOKEN_FIELD_PATH = 'page.page_token';
export const INVALID_PAGE_TOKEN_RULE_ID = 'page_token.invalid';

export interface PageValue<TItem> {
  items: TItem[];
  page: PageResponse;
}

export const paginate = <TItem>(
  items: readonly TItem[],
  getKey: (item: TItem) => string,
  request: PageRequest | undefined,
  errors: IDomainErrors,
): PageValue<TItem> => {
  const pageSize = request === undefined || request.pageSize === 0 ? DEFAULT_PAGE_SIZE : request.pageSize;
  const pageToken = request?.pageToken ?? '';
  const start = pageToken === '' ? 0 : items.findIndex(item => getKey(item) === pageToken) + 1;

  if (pageToken !== '' && start === 0) {
    throw errors.validationFailed([{ fieldPath: PAGE_TOKEN_FIELD_PATH, ruleId: INVALID_PAGE_TOKEN_RULE_ID }]);
  }

  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  const lastItem = pageItems.at(-1);
  const nextPageToken = end < items.length && lastItem !== undefined ? getKey(lastItem) : '';

  return { items: pageItems, page: create(PageResponseSchema, { nextPageToken }) };
};
